import React from 'react'
import ReactDOM from 'react-dom/client'
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
const markTitleBar = (): void => {
  const titleBar = root.querySelector<HTMLElement>('[style*="-webkit-app-region: drag"]')
  titleBar?.setAttribute('data-tauri-drag-region', '')
}
const observer = new MutationObserver(markTitleBar)
observer.observe(root, { childList: true, subtree: true })
markTitleBar()
