import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { markRendererStartup } from './startupMarks'

// ESM imports have completed. This is distinct from Chromium DOM readiness.
markRendererStartup('entry-evaluated')
ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
