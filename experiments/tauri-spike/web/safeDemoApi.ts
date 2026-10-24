import { invoke } from '@tauri-apps/api/core'
import { DEFAULT_SETTINGS } from '../../../src/shared/defaults'
import type {
  ActionResult,
  AppSettings,
  DiagnosticReport,
  GnirehtetAPI
} from '../../../src/shared/types'

let demoSettings: AppSettings = {
  ...DEFAULT_SETTINGS,
  onboardingCompleted: true,
  autoStart: false,
  launchAtLogin: false,
  telemetryEnabled: false
}

const unsupported = async (): Promise<ActionResult> => ({
  success: false,
  error: 'Tauri performance demo: ADB, Gnirehtet and device control are disabled.'
})

const noSubscription = (): (() => void) => () => {}

// Deliberately no ADB, Gnirehtet, process spawning, persistent settings,
// network requests, telemetry or interactions with the installed Wirebound.
export function installDemoApi(): void {
  const api: GnirehtetAPI = {
    startGnirehtet: unsupported,
    stopGnirehtet: unsupported,
    startDeviceTunnel: unsupported,
    stopDeviceTunnel: unsupported,
    getStatus: async () => 'disconnected',
    getDeviceSnapshot: async () => ({
      devices: [],
      error: 'Tauri lab is a UI-only benchmark. USB devices are not queried.'
    }),
    getSettings: async () => ({ ...demoSettings }),
    saveSettings: async (next) => {
      demoSettings = {
        ...next,
        autoStart: false,
        launchAtLogin: false,
        telemetryEnabled: false
      }
      return { ...demoSettings }
    },
    getAppVersion: async () => '0.0.1-tauri-lab',
    getDiagnostics: async (): Promise<DiagnosticReport> => ({
      generatedAt: new Date().toISOString(),
      engineStatus: 'disconnected',
      appVersion: '0.0.1-tauri-lab',
      checks: [],
      devices: []
    }),
    exportSupportReport: async () => ({
      success: false,
      error: 'Export disabled in benchmark demo.'
    }),
    checkForUpdates: async () => ({
      success: false,
      currentVersion: '0.0.1-tauri-lab',
      error: 'Update checks disabled in benchmark demo.'
    }),
    getCrashTelemetryState: async () => ({ available: false, uploadEnabled: false }),
    testSpeedOnDevice: unsupported,
    openExternal: unsupported,
    windowControl: (action) => {
      void invoke('window_action', { action }).catch((error: unknown) =>
        console.warn('Tauri lab window action failed', error)
      )
    },
    onLog: noSubscription,
    onStatusChange: noSubscription,
    onDevicesChange: noSubscription
  }

  window.api = api
  void invoke('runtime_probe')
    .then((result) => console.info('Tauri lab Rust backend is reachable:', result))
    .catch((error: unknown) => console.warn('Tauri lab runtime probe failed:', error))
}
