import { ipcMain, shell, type BrowserWindow } from 'electron'
import type { ActionResult, AppSettings } from '../shared/types'
import type { AdbService } from './services/adbService'
import type { GnirehtetService } from './services/gnirehtetService'
import { loadSettings, saveSettings } from './services/settingsService'

interface IpcDependencies {
  adbService: AdbService
  gnirehtetService: GnirehtetService
  getMainWindow: () => BrowserWindow | null
}

function readString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function controlWindow(window: BrowserWindow, action: unknown): void {
  if (action === 'minimize') {
    window.minimize()
  } else if (action === 'maximize') {
    if (window.isMaximized()) {
      window.unmaximize()
    } else {
      window.maximize()
    }
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
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return { success: false, error: 'Only http and https URLs can be opened.' }
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
  ipcMain.handle('gnirehtet:start', (_event, dns: unknown, port: unknown) =>
    gnirehtetService.start(readString(dns, '8.8.8.8'), readString(port, '31416'))
  )
  ipcMain.handle('gnirehtet:stop', () => gnirehtetService.stop())
  ipcMain.handle('gnirehtet:status', () => gnirehtetService.getStatus())
  ipcMain.handle('adb:devices', () => adbService.getDevices())
  ipcMain.handle('adb:testSpeed', (_event, deviceId: unknown) =>
    adbService.openSpeedTest(readString(deviceId))
  )
  ipcMain.handle('settings:get', () => loadSettings())
  ipcMain.handle('settings:set', (_event, settings: AppSettings) => saveSettings(settings))
  ipcMain.handle('app:open-external', (_event, url: unknown) => openExternal(url))

  ipcMain.on('window:control', (_event, action: unknown) => {
    const mainWindow = getMainWindow()

    if (mainWindow && !mainWindow.isDestroyed()) {
      controlWindow(mainWindow, action)
    }
  })
}
