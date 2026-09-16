export interface AdbDevice {
  id: string
  name: string
  battery?: string
  status: 'device' | 'offline' | 'unauthorized' | 'no permissions'
}

export interface AdbSnapshot {
  devices: AdbDevice[]
  error?: string
}

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

export interface ActionResult {
  success: boolean
  error?: string
}

export interface AppSettings {
  dns: string
  port: string
  autoStart: boolean
  customDns: string
  theme: 'light' | 'dark'
  language: 'en' | 'id'
  onboardingCompleted: boolean
}

export interface LogEntry {
  timestamp: string
  message: string
  type: 'stdout' | 'stderr' | 'info'
}

export interface GnirehtetAPI {
  startGnirehtet: (dns: string, port: string) => Promise<ActionResult>
  stopGnirehtet: () => Promise<ActionResult>
  getStatus: () => Promise<ConnectionStatus>
  getDeviceSnapshot: () => Promise<AdbSnapshot>
  getSettings: () => Promise<AppSettings>
  saveSettings: (settings: AppSettings) => Promise<AppSettings>
  getAppVersion: () => Promise<string>
  testSpeedOnDevice: (deviceId: string) => Promise<ActionResult>
  openExternal: (url: string) => Promise<ActionResult>
  windowControl: (action: 'minimize' | 'maximize' | 'close') => void
  onLog: (callback: (entry: LogEntry) => void) => () => void
  onStatusChange: (callback: (status: ConnectionStatus) => void) => () => void
  onDevicesChange: (callback: (snapshot: AdbSnapshot) => void) => () => void
}

declare global {
  interface Window {
    api: GnirehtetAPI
  }
}
