// Types for ADB devices
export interface AdbDevice {
  id: string
  name: string
  battery?: string
  status: 'device' | 'offline' | 'unauthorized' | 'no permissions'
}

// Types for Gnirehtet connection status
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

// Standard result returned by main-process actions
export interface ActionResult {
  success: boolean
  error?: string
}

// Types for application settings
export interface AppSettings {
  dns: string
  port: string
  autoStart: boolean
  customDns: string
  theme: 'light' | 'dark'
  language: 'en' | 'id'
  onboardingCompleted: boolean
}

// Types for log entries
export interface LogEntry {
  timestamp: string
  message: string
  type: 'stdout' | 'stderr' | 'info'
}

// Types for traffic telemetry data
export interface TrafficDataPoint {
  time: string
  upload: number
  download: number
}

// API exposed to the renderer via contextBridge
export interface GnirehtetAPI {
  startGnirehtet: (dns: string, port: string) => Promise<ActionResult>
  stopGnirehtet: () => Promise<ActionResult>
  getStatus: () => Promise<ConnectionStatus>
  getDevices: () => Promise<AdbDevice[]>
  getSettings: () => Promise<AppSettings>
  saveSettings: (settings: AppSettings) => Promise<AppSettings>
  testSpeedOnDevice: (deviceId: string) => Promise<ActionResult>
  openExternal: (url: string) => Promise<ActionResult>
  windowControl: (action: 'minimize' | 'maximize' | 'close') => void
  onLog: (callback: (entry: LogEntry) => void) => () => void
  onStatusChange: (callback: (status: ConnectionStatus) => void) => () => void
  onDevicesChange: (callback: (devices: AdbDevice[]) => void) => () => void
}

declare global {
  interface Window {
    api: GnirehtetAPI
  }
}
