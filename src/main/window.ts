import { BrowserWindow, nativeImage, screen } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import type { RuntimePaths } from './appPaths'

export function createMainWindow(paths: RuntimePaths): BrowserWindow {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize
  const winIcon = nativeImage.createFromPath(paths.icon)

  const mainWindow = new BrowserWindow({
    width: Math.min(1000, Math.round(width * 0.9)),
    height: Math.min(720, Math.round(height * 0.9)),
    minWidth: 760,
    minHeight: 560,
    show: false,
    autoHideMenuBar: true,
    frame: false,
    icon: winIcon,
    backgroundColor: '#09090b',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true
    }
  })

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  mainWindow.webContents.on('will-navigate', (event) => event.preventDefault())
  mainWindow.webContents.session.setPermissionRequestHandler(
    (_webContents, _permission, callback) => callback(false)
  )

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  if (is.dev && process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}
