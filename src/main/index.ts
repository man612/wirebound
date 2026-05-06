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

let mainWindow: BrowserWindow | null = null
let devicePoller: NodeJS.Timeout | null = null
let runtimePaths: RuntimePaths | null = null
let adbService: AdbService | null = null
let gnirehtetService: GnirehtetService | null = null
let handlersRegistered = false

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

function startDevicePolling(adbService: AdbService): void {
  const pollDevices = async (): Promise<void> => {
    const devices = await adbService.getDevices()
    sendToRenderer('adb:devices-change', devices)
    await gnirehtetService?.syncStatusWithDeviceState(devices)
  }

  void pollDevices()
  devicePoller = setInterval(() => {
    void pollDevices()
  }, 3000)
}

function stopDevicePolling(): void {
  if (devicePoller) {
    clearInterval(devicePoller)
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

function bootstrap(): void {
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

  if (!devicePoller) {
    startDevicePolling(adb)
  }

  if (settings.autoStart && engine.getStatus() === 'disconnected') {
    void engine.start(getSelectedDns(settings), settings.port)
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.yasman.wirebound')
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  bootstrap()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      bootstrap()
    }
  })
})

app.on('before-quit', () => {
  stopDevicePolling()
  gnirehtetService?.dispose()
})

app.on('window-all-closed', () => {
  stopDevicePolling()

  if (process.platform !== 'darwin') {
    gnirehtetService?.dispose()
    app.quit()
  }
})
