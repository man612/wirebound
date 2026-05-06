// Types for ADB devices
export interface AdbDevice {
  id: string
  name: string
  battery?: string
  status: 'device' | 'offline' | 'unauthorized' | 'no permissions'
}

// Types for Gnirehtet connection status
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

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
  startGnirehtet: (dns: string, port: string) => Promise<{ success: boolean; error?: string }>
  stopGnirehtet: () => Promise<{ success: boolean; error?: string }>
  getDevices: () => Promise<AdbDevice[]>
  getSettings: () => Promise<AppSettings>
  saveSettings: (settings: AppSettings) => Promise<void>
  testSpeedOnDevice: (deviceId: string) => Promise<boolean>
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
