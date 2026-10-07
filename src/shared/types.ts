export type DeviceTunnelStatus = 'idle' | 'waiting' | 'connected' | 'error' | 'unavailable'

export interface AdbDevice {
  id: string
  name: string
  battery?: string
  status: 'device' | 'offline' | 'unauthorized' | 'no permissions'
  tunnelStatus?: DeviceTunnelStatus
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

export interface SaveReportResult extends ActionResult {
  cancelled?: boolean
  filePath?: string
}

export interface AppSettings {
  dns: string
  port: string
  autoStart: boolean
  launchAtLogin: boolean
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

export type DiagnosticStatus = 'pass' | 'warning' | 'error' | 'info'

export type DiagnosticCheckId =
  | 'adbRuntime'
  | 'gnirehtetRuntime'
  | 'adbQuery'
  | 'deviceAccess'
  | 'androidVersion'
  | 'gnirehtetClient'

export interface DiagnosticCheck {
  id: DiagnosticCheckId
  status: DiagnosticStatus
  detail?: string
}

export interface DiagnosticDevice {
  id: string
  name: string
  status: AdbDevice['status']
  androidVersion?: string
  apiLevel?: string
  gnirehtetInstalled?: boolean
  gnirehtetActive?: boolean
}

export interface DiagnosticSystemInfo {
  platform: string
  release: string
  arch: string
}

export interface DiagnosticReport {
  generatedAt: string
  engineStatus: ConnectionStatus
  appVersion?: string
  system?: DiagnosticSystemInfo
  checks: DiagnosticCheck[]
  devices: DiagnosticDevice[]
}

export interface GnirehtetAPI {
  startGnirehtet: (dns: string, port: string) => Promise<ActionResult>
  stopGnirehtet: () => Promise<ActionResult>
  getStatus: () => Promise<ConnectionStatus>
  getDeviceSnapshot: () => Promise<AdbSnapshot>
  getSettings: () => Promise<AppSettings>
  saveSettings: (settings: AppSettings) => Promise<AppSettings>
  getAppVersion: () => Promise<string>
  getDiagnostics: () => Promise<DiagnosticReport>
  exportSupportReport: (content: string) => Promise<SaveReportResult>
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
