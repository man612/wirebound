import { app, BrowserWindow, Menu, Tray } from 'electron'
import { mkdirSync } from 'node:fs'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { finishRuntimePathsAfterWindow, getRuntimePaths } from './appPaths'
import type { RuntimePaths } from './appPaths'
import { registerIpcHandlers } from './ipc'
import { createMainWindow } from './window'
import { loadSettings } from './services/settingsService'
import { AdbService } from './services/adbService'
import { GnirehtetService } from './services/gnirehtetService'
import { applyDeviceTunnelStates } from './deviceState'
import { getDevicePollInterval } from './polling'
import { applyCrashUploadConsent, initializeCrashReporting } from './services/telemetryService'
import type { AdbSnapshot, AppSettings, ConnectionStatus, LogEntry } from '../shared/types'
import { deferAdbRuntimeForQa, startStartupHeartbeat, traceStartup } from './startupTrace'
import { StartupServiceGate } from './startupServiceGate'
import { getQaProfileDir } from './qaProfile'


let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let trayHintShown = false
let devicePoller: NodeJS.Timeout | null = null
let runtimePaths: RuntimePaths | null = null
let adbService: AdbService | null = null
let gnirehtetService: GnirehtetService | null = null
let handlersRegistered = false
let shutdownStarted = false
let shutdownComplete = false
const servicesGate = new StartupServiceGate<ReturnType<typeof ensureServices>>()

// The QA harness must never write into the normal Electron userData path.
// Electron does not necessarily honor changed APPDATA in a spawned process;
// override userData/sessionData before 'ready' only for explicit QA isolation.
const qaProfileDir = getQaProfileDir()
// Only the accepted isolated QA userData enables the opt-in UI-first path.
const uiFirstQa = deferAdbRuntimeForQa && Boolean(qaProfileDir)
if (qaProfileDir) {
  mkdirSync(qaProfileDir, { recursive: true })
  app.setPath('userData', qaProfileDir)
  app.setPath('sessionData', qaProfileDir)
  traceStartup('qa-profile-isolated')
}

traceStartup('main-module-start')
startStartupHeartbeat()
initializeCrashReporting()
traceStartup('crash-reporting-initialized')

function showMainWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed()) return
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
}

function hideMainWindowToTray(): void {
  if (!mainWindow || mainWindow.isDestroyed()) return
  mainWindow.hide()

  if (!tray || trayHintShown) return

  const indonesian = loadSettings().language === 'id'
  tray.displayBalloon({
    title: 'Wirebound',
    content: indonesian
      ? 'Wirebound masih berjalan di tray. Gunakan menu tray untuk membuka kembali atau keluar.'
      : 'Wirebound is still running in the tray. Use the tray menu to reopen or quit.',
    noSound: true,
    respectQuietTime: true
  })
  trayHintShown = true
}

function refreshTrayMenu(): void {
  if (!tray) return

  const settings = loadSettings()
  const indonesian = settings.language === 'id'
  const engineStatus = gnirehtetService?.getStatus() ?? 'disconnected'

  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: indonesian ? 'Buka Wirebound' : 'Show Wirebound',
        click: showMainWindow
      },
      {
        label: indonesian ? 'Putuskan Tethering' : 'Disconnect Tethering',
        enabled: engineStatus !== 'disconnected',
        click: () => {
          void (async () => {
            await gnirehtetService?.stop()
            refreshTrayMenu()
          })()
        }
      },
      { type: 'separator' },
      {
        label: indonesian ? 'Keluar' : 'Quit',
        click: () => void shutdown()
      }
    ])
  )
}

function ensureTray(paths: RuntimePaths): void {
  if (tray) return

  tray = new Tray(paths.trayIcon)
  tray.setToolTip('Wirebound')
  tray.on('click', showMainWindow)
  refreshTrayMenu()
}

function sendToRenderer(channel: string, payload: unknown): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, payload)
  }
}

function sendLog(message: string, type: LogEntry['type'] = 'info'): void {
  const timestamp = new Date().toLocaleTimeString('id-ID', { hour12: false })
  sendToRenderer('gnirehtet:log', { timestamp, message, type } satisfies LogEntry)
}

function sendStatus(status: ConnectionStatus): void {
  sendToRenderer('gnirehtet:status-change', status)
  refreshTrayMenu()
}

async function getDeviceSnapshot(adb: AdbService, engine: GnirehtetService): Promise<AdbSnapshot> {
  const snapshot = await adb.getSnapshot()

  if (snapshot.error) {
    engine.reportAdbUnavailable(snapshot.error)
    return snapshot
  }

  const activeDeviceIds = await engine.syncStatusWithDeviceState(snapshot.devices)
  const devicesWithTunnelState = applyDeviceTunnelStates(
    snapshot.devices,
    engine.getStatus(),
    activeDeviceIds
  )
  const traffic = new Map(
    await Promise.all(
      devicesWithTunnelState
        .filter((device) => device.tunnelStatus === 'connected')
        .map(async (device) => [device.id, await adb.getTunnelTraffic(device.id)] as const)
    )
  )

  return {
    ...snapshot,
    devices: devicesWithTunnelState.map((device) => ({
      ...device,
      traffic: traffic.get(device.id)
    }))
  }
}

function startDevicePolling(adb: AdbService, engine: GnirehtetService): void {
  const poll = async (): Promise<void> => {
    const snapshot = await getDeviceSnapshot(adb, engine)
    // Stop completion-time sends too; a poll already in flight may outlive quit.
    if (shutdownStarted) return
    sendToRenderer('adb:devices-change', snapshot)

    if (!shutdownStarted) {
      const interval = getDevicePollInterval(
        engine.getStatus(),
        snapshot.devices.length > 0,
        mainWindow?.isVisible() ?? false
      )
      devicePoller = setTimeout(() => void poll(), interval)
    }
  }

  void poll()
}

function stopDevicePolling(): void {
  if (devicePoller) {
    clearTimeout(devicePoller)
    devicePoller = null
  }
}

function getSelectedDns(settings: AppSettings): string {
  return settings.dns === 'custom' ? settings.customDns : settings.dns
}

function ensureServices(): { paths: RuntimePaths; adb: AdbService; engine: GnirehtetService } {
  if (!runtimePaths) {
    traceStartup('runtime-paths-start')
    runtimePaths = getRuntimePaths()
    traceStartup('runtime-paths-ready')
  }

  if (!adbService) {
    adbService = new AdbService(runtimePaths)
  }

  if (!gnirehtetService) {
    gnirehtetService = new GnirehtetService(runtimePaths, adbService, sendLog, sendStatus)
  }

  return { paths: runtimePaths, adb: adbService, engine: gnirehtetService }
}

async function bootstrap(): Promise<void> {
  traceStartup('bootstrap-start')
  // In the isolated QA experiment, discover icon/resource locations without
  // hashing ADB files on the critical path to the first visible window.
  // Normal installed launches still prepare ADB synchronously as before.
  const paths = uiFirstQa
    ? getRuntimePaths({ deferAdbPreparation: true })
    : ensureServices().paths
  if (!uiFirstQa) servicesGate.start(ensureServices)
  traceStartup('settings-load-start')
  const settings = loadSettings()
  traceStartup('settings-load-ready')
  applyCrashUploadConsent(settings.telemetryEnabled)
  traceStartup('crash-consent-applied')

  mainWindow = createMainWindow(paths)
  traceStartup('bootstrap-window-created')
  if (uiFirstQa) {
    // A failed renderer load means its 'ready-to-show' event may never fire.
    // Reject queued ADB IPC rather than leave requests hanging indefinitely.
    mainWindow.webContents.on('did-fail-load', (_event, errorCode, _message, _url, isMainFrame) => {
      if (isMainFrame && errorCode !== -3) {
        traceStartup('deferred-runtime-renderer-failed', { errorCode })
        servicesGate.fail(new Error('Wirebound could not load its interface. Please restart the app.'))
      }
    })
    mainWindow.webContents.on('render-process-gone', (_event, details) => {
      traceStartup('deferred-runtime-renderer-gone', { reason: details.reason })
      servicesGate.fail(new Error('Wirebound interface unexpectedly stopped. Please restart the app.'))
    })
  }

  if (uiFirstQa) {
    const window = mainWindow
    window.once('show', () => {
      traceStartup('deferred-runtime-scheduled')
      // React can show its first window before any large HDD hash/copy work.
      // The async fs operations do not synchronously block the main event loop.
      setTimeout(() => {
        if (shutdownStarted || window.isDestroyed()) {
          servicesGate.fail(new Error('Wirebound is shutting down.'))
          return
        }
        servicesGate.start(async () => {
          traceStartup('deferred-runtime-start')
          const preparedPaths = await finishRuntimePathsAfterWindow(paths)
          if (shutdownStarted) throw new Error('Wirebound is shutting down.')
          runtimePaths = preparedPaths
          adbService = new AdbService(preparedPaths)
          gnirehtetService = new GnirehtetService(
            preparedPaths, adbService, sendLog, sendStatus
          )
          traceStartup('deferred-runtime-ready')
          return { paths: preparedPaths, adb: adbService, engine: gnirehtetService }
        })
      }, 0)
    })
  }
  mainWindow.on('close', (event) => {
    if (shutdownStarted) return
    event.preventDefault()
    hideMainWindowToTray()
  })
  mainWindow.on('closed', () => {
    mainWindow = null
  })
  ensureTray(paths)
  traceStartup('tray-ready')

  if (!handlersRegistered) {
    registerIpcHandlers({
      getServices: () => servicesGate.wait(),
      getDeviceSnapshot: async () => {
        const { adb, engine } = await servicesGate.wait()
        return getDeviceSnapshot(adb, engine)
      },
      getMainWindow: () => mainWindow,
      hideToTray: hideMainWindowToTray,
      onSettingsChanged: (settings) => {
        refreshTrayMenu()
        applyCrashUploadConsent(settings.telemetryEnabled)
      }
    })
    handlersRegistered = true
  }
  traceStartup('ipc-ready')

  const { adb, engine } = await servicesGate.wait()
  if (shutdownStarted) return
  try {
    await adb.ensureServerReady()
    traceStartup('adb-server-ready')
  } catch (error) {
    traceStartup('adb-server-unavailable')
    console.warn('Wirebound: ADB server was not ready during bootstrap.', error)
  }

  if (!devicePoller) {
    startDevicePolling(adb, engine)
  }

  if (settings.autoStart && engine.getStatus() === 'disconnected') {
    void engine.start(getSelectedDns(settings), settings.port)
  }
  traceStartup('bootstrap-complete')
}

async function shutdown(): Promise<void> {
  if (shutdownStarted) {
    return
  }

  shutdownStarted = true
  servicesGate.fail(new Error('Wirebound is shutting down.'))
  stopDevicePolling()

  try {
    await gnirehtetService?.stop()
  } catch (error) {
    console.warn('Wirebound: Engine shutdown cleanup failed.', error)
  }

  shutdownComplete = true
  app.quit()
}

const hasSingleInstanceLock = app.requestSingleInstanceLock()
traceStartup('single-instance-lock', { acquired: hasSingleInstanceLock })

if (!hasSingleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    showMainWindow()
  })

  app.on('child-process-gone', (_event, details) => {
    // GPU and utility process failures are distinct from renderer crashes.
    // Record only the Electron-defined type/reason/code, never process paths.
    traceStartup('child-process-gone', {
      type: details.type,
      reason: details.reason,
      exitCode: details.exitCode
    })
  })

  app.whenReady().then(() => {
    traceStartup('app-when-ready')
    electronApp.setAppUserModelId('com.wirebound.app')

    app.on('browser-window-created', (_, window) => {
      optimizer.watchWindowShortcuts(window)
    })

    void bootstrap().catch((error: unknown) => {
      servicesGate.fail(error)
      traceStartup('bootstrap-rejected', {
        errorType: error instanceof Error ? error.name : 'unknown'
      })
      console.error('Wirebound: Startup failed.', error)
    })

    app.on('activate', () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        showMainWindow()
      } else if (BrowserWindow.getAllWindows().length === 0 && !shutdownStarted) {
        void bootstrap()
      }
    })
  })

  app.on('before-quit', (event) => {
    if (shutdownComplete) return

    event.preventDefault()
    void shutdown()
  })

  app.on('window-all-closed', () => {
    // Keep the main process alive for the Windows tray. Explicit Quit runs shutdown().
  })
}
