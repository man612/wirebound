import { BrowserWindow, nativeImage, screen } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import type { RuntimePaths } from './appPaths'
import { skipWindowIconForQa, startupTraceEnabled, traceStartup } from './startupTrace'
import { scheduleRendererQaProbes } from './rendererQaProbes'

export function createMainWindow(paths: RuntimePaths): BrowserWindow {
  traceStartup('display-query-start')
  const { width, height } = screen.getPrimaryDisplay().workAreaSize
  traceStartup('display-query-ready')
  traceStartup('window-icon-load-start', { skipped: skipWindowIconForQa })
  const winIcon = skipWindowIconForQa ? undefined : nativeImage.createFromPath(paths.icon)
  traceStartup('window-icon-load-ready', { skipped: skipWindowIconForQa })

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
  let cancelRendererProbes: (() => void) | null = null
  let rendererLoadGeneration = 0
  mainWindow.on('show', () => traceStartup('window-shown'))
  mainWindow.on('closed', () => cancelRendererProbes?.())
  mainWindow.webContents.on('did-start-loading', () => {
    cancelRendererProbes?.()
    rendererLoadGeneration += 1
    traceStartup('did-start-loading')
  })
  mainWindow.webContents.on('dom-ready', () => traceStartup('dom-ready'))
  mainWindow.webContents.on('did-finish-load', () => {
    traceStartup('did-finish-load')
    if (!startupTraceEnabled) return

    // Numeric navigation-relative milestones only. No DOM text, settings,
    // URLs, paths, or device identity are read or stored.
    cancelRendererProbes?.()
    const generation = rendererLoadGeneration
    const probe = (eventName: 'renderer-timing-early' | 'renderer-root-probe'): Promise<boolean> => {
      if (mainWindow.isDestroyed() || mainWindow.webContents.isDestroyed() ||
          generation !== rendererLoadGeneration) return Promise.resolve(true)
      return mainWindow.webContents
        .executeJavaScript(
          "(() => { const entries = performance.getEntriesByType('paint'); const marks = performance.getEntriesByType('mark'); const nav = performance.getEntriesByType('navigation')[0]; const at = (list, name) => Math.round(list.find((e) => e.name === name)?.startTime ?? -1); return { rootChildren: document.getElementById('root')?.childElementCount ?? -1, readyState: document.readyState, firstPaintMs: at(entries, 'first-paint'), firstContentfulPaintMs: at(entries, 'first-contentful-paint'), entryEvaluatedMs: at(marks, 'wirebound:entry-evaluated'), reactFirstCommitMs: at(marks, 'wirebound:react-first-commit'), uiSettingsReadyMs: at(marks, 'wirebound:ui-settings-ready'), responseEndMs: nav ? Math.round(nav.responseEnd) : -1, domInteractiveMs: nav ? Math.round(nav.domInteractive) : -1 }; })()"
        )
        .then((result: {
          rootChildren: number
          readyState: string
          firstPaintMs: number
          firstContentfulPaintMs: number
          entryEvaluatedMs: number
          reactFirstCommitMs: number
          uiSettingsReadyMs: number
          responseEndMs: number
          domInteractiveMs: number
        }) => {
          if (mainWindow.isDestroyed() || generation !== rendererLoadGeneration) return true
          traceStartup(eventName, { ...result, visible: mainWindow.isVisible() })
          // Nonempty React root can be a placeholder; only the UI settings
          // commit mark confirms that rendering progressed beyond it.
          return result.rootChildren > 0 && result.uiSettingsReadyMs >= 0
        })
        .catch(() => {
          if (generation === rendererLoadGeneration && !mainWindow.isDestroyed()) {
            traceStartup('renderer-root-probe-failed')
          }
          return false
        })
    }
    // Keep the original early/full probes. Only if the full probe does not
    // observe UI readiness, sample again at bounded QA-only deadlines.
    cancelRendererProbes = scheduleRendererQaProbes(probe)
  })
  mainWindow.webContents.on('did-stop-loading', () => traceStartup('did-stop-loading'))
  mainWindow.webContents.on('unresponsive', () => traceStartup('renderer-unresponsive'))
  mainWindow.webContents.on('responsive', () => traceStartup('renderer-responsive'))
  mainWindow.webContents.on('did-fail-load', (_event, errorCode, _message, _url, isMainFrame) => {
    if (isMainFrame && errorCode !== -3) cancelRendererProbes?.()
    traceStartup('did-fail-load', { errorCode, isMainFrame })
  })
  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    cancelRendererProbes?.()
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
