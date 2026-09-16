import { app, BrowserWindow } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { getRuntimePaths } from './appPaths'
import type { RuntimePaths } from './appPaths'
import { registerIpcHandlers } from './ipc'
import { createMainWindow } from './window'
import { loadSettings } from './services/settingsService'
import { AdbService } from './services/adbService'
import { GnirehtetService } from './services/gnirehtetService'
import type { AppSettings, ConnectionStatus, LogEntry } from '../shared/types'

const DEVICE_POLL_INTERVAL_MS = 4000

let mainWindow: BrowserWindow | null = null
let devicePoller: NodeJS.Timeout | null = null
let runtimePaths: RuntimePaths | null = null
let adbService: AdbService | null = null
let gnirehtetService: GnirehtetService | null = null
let handlersRegistered = false
let shutdownStarted = false
let shutdownComplete = false

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
}

function startDevicePolling(adb: AdbService, engine: GnirehtetService): void {
  const poll = async (): Promise<void> => {
    const snapshot = await adb.getSnapshot()
    sendToRenderer('adb:devices-change', snapshot)

    if (snapshot.error) {
      engine.reportAdbUnavailable(snapshot.error)
    } else {
      await engine.syncStatusWithDeviceState(snapshot.devices)
    }

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
  mainWindow.on('closed', () => {
    mainWindow = null
  })

  if (!handlersRegistered) {
    registerIpcHandlers({
      adbService: adb,
      gnirehtetService: engine,
      getMainWindow: () => mainWindow
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
    if (!mainWindow || mainWindow.isDestroyed()) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.show()
    mainWindow.focus()
  })

  app.whenReady().then(() => {
    electronApp.setAppUserModelId('com.wirebound.app')

    app.on('browser-window-created', (_, window) => {
      optimizer.watchWindowShortcuts(window)
    })

    void bootstrap()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0 && !shutdownStarted) {
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
    if (process.platform !== 'darwin') app.quit()
  })
}
