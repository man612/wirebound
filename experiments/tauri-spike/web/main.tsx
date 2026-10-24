import React from 'react'
import ReactDOM from 'react-dom/client'
import { invoke } from '@tauri-apps/api/core'
import App from '../../../src/renderer/src/App'
import { installDemoApi } from './safeDemoApi'
import './tauri.css'

installDemoApi()

const root = document.getElementById('root')
if (!root) throw new Error('Tauri lab root element missing')

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)

const notice = document.createElement('div')
notice.className = 'tauri-lab-watermark'
notice.setAttribute('role', 'status')
notice.textContent = 'TAURI LAB · DEMO ONLY · ADB / TETHERING DISABLED'
document.body.appendChild(notice)

// Tauri requires data-tauri-drag-region for frameless window dragging.
// The shared Electron title bar can remain unchanged in the production code.
// A single event-driven call can happen before the Tauri IPC bridge is ready.
// The old logic set readyReported before checking whether show() succeeded,
// leaving the real full-size window hidden indefinitely if the first call failed.
let readyReported = false
let showPending = false
let showAttempts = 0
const maxShowAttempts = 20
let retryTimer: number | undefined

const markTitleBar = (): void => {
  const titleBar = root.querySelector<HTMLElement>('[style*="app-region: drag"]')
  titleBar?.setAttribute('data-tauri-drag-region', '')

  // Renderer DOM exists. IPC must also explicitly confirm native visibility.
  if (!readyReported && !showPending && root.querySelector('main') && showAttempts < maxShowAttempts) {
    showPending = true
    showAttempts += 1
    void invoke<boolean>('show_after_renderer_ready')
      .then((visible) => {
        if (!visible) throw new Error('Native window is not visible yet')
        readyReported = true
        document.documentElement.dataset.tauriLabWindowReady = 'true'
        if (retryTimer !== undefined) window.clearInterval(retryTimer)
      })
      .catch((error: unknown) => {
        console.warn('Tauri lab window readiness attempt failed:', showAttempts, error)
        if (showAttempts >= maxShowAttempts) {
          console.error('Tauri lab could not display its dashboard window.')
        }
      })
      .finally(() => {
        showPending = false
      })
  }
}
const observer = new MutationObserver(markTitleBar)
observer.observe(root, { childList: true, subtree: true })
// The timer handles a race where a DOM mutation is observed before the bridge
// can accept native commands; it is bounded and terminates on success.
retryTimer = window.setInterval(markTitleBar, 250)
window.setTimeout(() => {
  if (retryTimer !== undefined) window.clearInterval(retryTimer)
}, 10000)
markTitleBar()
