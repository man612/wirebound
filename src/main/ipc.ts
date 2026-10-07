import {
  app,
  dialog,
  ipcMain,
  shell,
  type BrowserWindow,
  type IpcMainEvent,
  type IpcMainInvokeEvent
} from 'electron'
import { writeFile } from 'fs/promises'
import { release } from 'os'
import { join } from 'path'
import type { ActionResult, AdbSnapshot, AppSettings, SaveReportResult } from '../shared/types'
import type { AdbService } from './services/adbService'
import type { GnirehtetService } from './services/gnirehtetService'
import { loadSettings, saveSettings } from './services/settingsService'

interface IpcDependencies {
  adbService: AdbService
  gnirehtetService: GnirehtetService
  getDeviceSnapshot: () => Promise<AdbSnapshot>
  getMainWindow: () => BrowserWindow | null
  hideToTray: () => void
  onSettingsChanged: () => void
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

function controlWindow(window: BrowserWindow, action: unknown, hideToTray: () => void): void {
  if (action === 'minimize' || action === 'close') {
    hideToTray()
  } else if (action === 'maximize') {
    window.isMaximized() ? window.unmaximize() : window.maximize()
  }
}

function getLaunchAtLogin(storedValue: boolean): boolean {
  if (process.platform !== 'win32' || !app.isPackaged) return storedValue

  const state = app.getLoginItemSettings({ path: process.execPath })
  return state.openAtLogin && state.executableWillLaunchAtLogin
}

function withSystemStartupState(settings: AppSettings): AppSettings {
  return {
    ...settings,
    launchAtLogin: getLaunchAtLogin(settings.launchAtLogin)
  }
}

function applyLaunchAtLogin(enabled: boolean): void {
  if (process.platform !== 'win32' || !app.isPackaged) return

  app.setLoginItemSettings({
    openAtLogin: enabled,
    enabled,
    path: process.execPath
  })
}

async function saveSupportReport(
  content: unknown,
  getMainWindow: () => BrowserWindow | null
): Promise<SaveReportResult> {
  if (typeof content !== 'string' || content.length === 0 || content.length > 100_000) {
    return { success: false, error: 'Support report content is invalid.' }
  }

  const mainWindow = getMainWindow()
  if (!mainWindow || mainWindow.isDestroyed()) {
    return { success: false, error: 'Wirebound window is not available.' }
  }

  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Export Wirebound Support Report',
      defaultPath: join(app.getPath('documents'), `wirebound-support-${timestamp}.txt`),
      filters: [{ name: 'Text file', extensions: ['txt'] }]
    })

    if (result.canceled || !result.filePath) {
      return { success: true, cancelled: true }
    }

    await writeFile(result.filePath, content, 'utf8')
    return { success: true, filePath: result.filePath }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to export support report.'
    }
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
  getDeviceSnapshot,
  getMainWindow,
  hideToTray,
  onSettingsChanged
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
    return getDeviceSnapshot()
  })

  ipcMain.handle('adb:testSpeed', (event, deviceId: unknown) => {
    trusted(event)
    return adbService.openSpeedTest(readString(deviceId))
  })

  ipcMain.handle('settings:get', (event) => {
    trusted(event)
    return withSystemStartupState(loadSettings())
  })

  ipcMain.handle('settings:set', async (event, settings: unknown) => {
    trusted(event)
    const saved = await saveSettings(settings)

    try {
      applyLaunchAtLogin(saved.launchAtLogin)
    } catch (error) {
      console.warn('Wirebound: Failed to update Windows login startup setting.', error)
    }

    onSettingsChanged()
    return withSystemStartupState(saved)
  })

  ipcMain.handle('app:version', (event) => {
    trusted(event)
    return app.getVersion()
  })

  ipcMain.handle('app:diagnostics', async (event) => {
    trusted(event)
    const report = await adbService.getDiagnostics(gnirehtetService.getStatus())
    return {
      ...report,
      appVersion: app.getVersion(),
      system: {
        platform: process.platform,
        release: release(),
        arch: process.arch
      }
    }
  })

  ipcMain.handle('app:export-support-report', (event, content: unknown) => {
    trusted(event)
    return saveSupportReport(content, getMainWindow)
  })

  ipcMain.handle('app:open-external', (event, url: unknown) => {
    trusted(event)
    return openExternal(url)
  })

  ipcMain.on('window:control', (event, action: unknown) => {
    trusted(event)
    const mainWindow = getMainWindow()

    if (mainWindow && !mainWindow.isDestroyed()) {
      controlWindow(mainWindow, action, hideToTray)
    }
  })
}
