import { crashReporter } from 'electron'
import type { CrashTelemetryState } from '../../shared/types'

let started = false
let configuredUrl: string | undefined

function readConfiguredUrl(): string | undefined {
  const value =
    typeof __WIREBOUND_CRASH_REPORT_URL__ === 'string'
      ? __WIREBOUND_CRASH_REPORT_URL__.trim()
      : ''

  if (!value) return undefined

  try {
    const url = new URL(value)
    return url.protocol === 'https:' ? url.toString() : undefined
  } catch {
    return undefined
  }
}

export function initializeCrashReporting(): void {
  if (started) return

  configuredUrl = readConfiguredUrl()

  crashReporter.start({
    ...(configuredUrl ? { submitURL: configuredUrl } : {}),
    productName: 'Wirebound',
    uploadToServer: false,
    rateLimit: true,
    compress: true,
    globalExtra: {
      releaseChannel: 'stable'
    }
  })

  started = true
}

export function applyCrashUploadConsent(enabled: boolean): void {
  if (!started) initializeCrashReporting()
  crashReporter.setUploadToServer(Boolean(configuredUrl && enabled))
}

export function getCrashTelemetryState(): CrashTelemetryState {
  if (!started) initializeCrashReporting()

  return {
    available: Boolean(configuredUrl),
    uploadEnabled: Boolean(configuredUrl && crashReporter.getUploadToServer())
  }
}
