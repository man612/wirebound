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
let readyReported = false
const markTitleBar = (): void => {
  // Electron also delays showing its window until renderer readiness.
  // Show Tauri only after React has populated the dashboard, not on native
  // window creation. This avoids benchmarking Tauri's empty-window startup.
  if (!readyReported && root.querySelector('main')) {
    readyReported = true
    void invoke('show_after_renderer_ready').catch((error: unknown) =>
      console.error('Tauri lab failed to show rendered dashboard:', error)
    )
  }
  const titleBar = root.querySelector<HTMLElement>('[style*="-webkit-app-region: drag"]')
  titleBar?.setAttribute('data-tauri-drag-region', '')
}
const observer = new MutationObserver(markTitleBar)
observer.observe(root, { childList: true, subtree: true })
markTitleBar()
