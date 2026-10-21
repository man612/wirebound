import { BrowserWindow, nativeImage, screen } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import type { RuntimePaths } from './appPaths'
import { startupTraceEnabled, traceStartup } from './startupTrace'

export function createMainWindow(paths: RuntimePaths): BrowserWindow {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize
  const winIcon = nativeImage.createFromPath(paths.icon)

  traceStartup('window-creating')
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

  traceStartup('window-created')
  mainWindow.on('show', () => traceStartup('window-shown'))
  mainWindow.webContents.on('did-start-loading', () => traceStartup('did-start-loading'))
  mainWindow.webContents.on('dom-ready', () => traceStartup('dom-ready'))
  mainWindow.webContents.on('did-finish-load', () => {
    traceStartup('did-finish-load')
    if (!startupTraceEnabled) return

    // A failed React mount may still have a loaded HTML document. Inspect only
    // DOM readiness and child count, never text, settings or device identifiers.
    setTimeout(() => {
      if (mainWindow.isDestroyed() || mainWindow.webContents.isDestroyed()) return
      void mainWindow.webContents
        .executeJavaScript(
          "({ rootChildren: document.getElementById('root')?.childElementCount ?? -1, readyState: document.readyState })"
        )
        .then((result: { rootChildren: number; readyState: string }) => {
          traceStartup('renderer-root-probe', {
            rootChildren: result.rootChildren,
            readyState: result.readyState,
            visible: mainWindow.isVisible()
          })
        })
        .catch(() => traceStartup('renderer-root-probe-failed'))
    }, 2000)
  })
  mainWindow.webContents.on('did-stop-loading', () => traceStartup('did-stop-loading'))
  mainWindow.webContents.on('did-fail-load', (_event, errorCode, _message, _url, isMainFrame) => {
    traceStartup('did-fail-load', { errorCode, isMainFrame })
  })
  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    traceStartup('render-process-gone', { reason: details.reason, exitCode: details.exitCode })
  })

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  mainWindow.webContents.on('will-navigate', (event) => event.preventDefault())
  mainWindow.webContents.session.setPermissionRequestHandler(
    (_webContents, _permission, callback) => callback(false)
  )

  mainWindow.on('ready-to-show', () => {
    traceStartup('ready-to-show')
    mainWindow.show()
  })

  traceStartup('renderer-load-requested', {
    mode: is.dev && process.env.ELECTRON_RENDERER_URL ? 'dev-url' : 'production-file'
  })
  const load =
    is.dev && process.env.ELECTRON_RENDERER_URL
      ? mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
      : mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  void load.then(
    () => traceStartup('renderer-load-resolved'),
    (error: unknown) => {
      traceStartup('renderer-load-rejected', {
        errorType: error instanceof Error ? error.name : 'unknown'
      })
      console.error('Wirebound: Renderer failed to load.', error)
    }
  )

  return mainWindow
}
