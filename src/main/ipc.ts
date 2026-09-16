import {
  app,
  ipcMain,
  shell,
  type BrowserWindow,
  type IpcMainEvent,
  type IpcMainInvokeEvent
} from 'electron'
import type { ActionResult } from '../shared/types'
import type { AdbService } from './services/adbService'
import type { GnirehtetService } from './services/gnirehtetService'
import { loadSettings, saveSettings } from './services/settingsService'

interface IpcDependencies {
  adbService: AdbService
  gnirehtetService: GnirehtetService
  getMainWindow: () => BrowserWindow | null
}

const ALLOWED_EXTERNAL_HOSTS = new Set(['fast.com', 'github.com'])

function readString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function assertTrustedSender(
  event: IpcMainInvokeEvent | IpcMainEvent,
  getMainWindow: () => BrowserWindow | null
): void {
  const mainWindow = getMainWindow()

  if (
    !mainWindow ||
    mainWindow.isDestroyed() ||
    event.sender !== mainWindow.webContents ||
    event.senderFrame !== mainWindow.webContents.mainFrame
  ) {
    throw new Error('Rejected IPC request from an untrusted renderer.')
  }
}

function controlWindow(window: BrowserWindow, action: unknown): void {
  if (action === 'minimize') {
    window.minimize()
  } else if (action === 'maximize') {
    window.isMaximized() ? window.unmaximize() : window.maximize()
  } else if (action === 'close') {
    window.close()
  }
}

async function openExternal(url: unknown): Promise<ActionResult> {
  try {
    if (typeof url !== 'string') {
      return { success: false, error: 'URL is invalid.' }
    }

    const parsedUrl = new URL(url)
    if (parsedUrl.protocol !== 'https:' || !ALLOWED_EXTERNAL_HOSTS.has(parsedUrl.hostname)) {
      return { success: false, error: 'External URL is not allowed.' }
    }

    await shell.openExternal(parsedUrl.toString())
    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to open external URL.'
    }
  }
}

export function registerIpcHandlers({
  adbService,
  gnirehtetService,
  getMainWindow
}: IpcDependencies): void {
  const trusted = (event: IpcMainInvokeEvent | IpcMainEvent): void =>
    assertTrustedSender(event, getMainWindow)

  ipcMain.handle('gnirehtet:start', (event, dns: unknown, port: unknown) => {
    trusted(event)
    return gnirehtetService.start(readString(dns, '8.8.8.8'), readString(port, '31416'))
  })

  ipcMain.handle('gnirehtet:stop', (event) => {
    trusted(event)
    return gnirehtetService.stop()
  })

  ipcMain.handle('gnirehtet:status', (event) => {
    trusted(event)
    return gnirehtetService.getStatus()
  })

  ipcMain.handle('adb:snapshot', (event) => {
    trusted(event)
    return adbService.getSnapshot()
  })

  ipcMain.handle('adb:testSpeed', (event, deviceId: unknown) => {
    trusted(event)
    return adbService.openSpeedTest(readString(deviceId))
  })

  ipcMain.handle('settings:get', (event) => {
    trusted(event)
    return loadSettings()
  })

  ipcMain.handle('settings:set', (event, settings: unknown) => {
    trusted(event)
    return saveSettings(settings)
  })

  ipcMain.handle('app:version', (event) => {
    trusted(event)
    return app.getVersion()
  })

  ipcMain.handle('app:diagnostics', (event) => {
    trusted(event)
    return adbService.getDiagnostics(gnirehtetService.getStatus())
  })

  ipcMain.handle('app:open-external', (event, url: unknown) => {
    trusted(event)
    return openExternal(url)
  })

  ipcMain.on('window:control', (event, action: unknown) => {
    trusted(event)
    const mainWindow = getMainWindow()

    if (mainWindow && !mainWindow.isDestroyed()) {
      controlWindow(mainWindow, action)
    }
  })
}
