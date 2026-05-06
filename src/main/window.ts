import { BrowserWindow, nativeImage, screen, shell } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import type { RuntimePaths } from './appPaths'

export function createMainWindow(paths: RuntimePaths): BrowserWindow {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize
  const winIcon = nativeImage.createFromPath(paths.icon)

  const mainWindow = new BrowserWindow({
    width: Math.min(1000, Math.round(width * 0.9)),
    height: Math.min(720, Math.round(height * 0.9)),
    show: false,
    autoHideMenuBar: true,
    frame: false,
    icon: winIcon,
    backgroundColor: '#09090b',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true
    }
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      void shell.openExternal(url)
    }

    return { action: 'deny' }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  if (is.dev && process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}
