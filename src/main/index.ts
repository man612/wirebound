import { app, BrowserWindow, Menu, Tray } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { getRuntimePaths } from './appPaths'
import type { RuntimePaths } from './appPaths'
import { registerIpcHandlers } from './ipc'
import { createMainWindow } from './window'
import { loadSettings } from './services/settingsService'
import { AdbService } from './services/adbService'
import { GnirehtetService } from './services/gnirehtetService'
import { applyDeviceTunnelStates } from './deviceState'
import type { AdbSnapshot, AppSettings, ConnectionStatus, LogEntry } from '../shared/types'

const DEVICE_POLL_INTERVAL_MS = 4000

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
    sendToRenderer('adb:devices-change', snapshot)

    if (!shutdownStarted) {
      devicePoller = setTimeout(() => void poll(), DEVICE_POLL_INTERVAL_MS)
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
    runtimePaths = getRuntimePaths()
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
  const { paths, adb, engine } = ensureServices()
  const settings = loadSettings()

  mainWindow = createMainWindow(paths)
  mainWindow.on('close', (event) => {
    if (shutdownStarted) return
    event.preventDefault()
    hideMainWindowToTray()
  })
  mainWindow.on('closed', () => {
    mainWindow = null
  })
  ensureTray(paths)

  if (!handlersRegistered) {
    registerIpcHandlers({
      adbService: adb,
      gnirehtetService: engine,
      getDeviceSnapshot: () => getDeviceSnapshot(adb, engine),
      getMainWindow: () => mainWindow,
      hideToTray: hideMainWindowToTray,
      onSettingsChanged: refreshTrayMenu
    })
    handlersRegistered = true
  }

  try {
    await adb.ensureServerReady()
  } catch (error) {
    console.warn('Wirebound: ADB server was not ready during bootstrap.', error)
  }

  if (!devicePoller) {
    startDevicePolling(adb, engine)
  }

  if (settings.autoStart && engine.getStatus() === 'disconnected') {
    void engine.start(getSelectedDns(settings), settings.port)
  }
}

async function shutdown(): Promise<void> {
  if (shutdownStarted) {
    return
  }

  shutdownStarted = true
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

if (!hasSingleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    showMainWindow()
  })

  app.whenReady().then(() => {
    electronApp.setAppUserModelId('com.wirebound.app')

    app.on('browser-window-created', (_, window) => {
      optimizer.watchWindowShortcuts(window)
    })

    void bootstrap()

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
