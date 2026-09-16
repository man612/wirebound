import { DEFAULT_SETTINGS } from './defaults'
import type { AppSettings } from './types'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readString(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value.trim() : fallback
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function normalizePort(value: unknown): string {
  const port = readString(value, DEFAULT_SETTINGS.port)
  const numericPort = Number(port)

  if (Number.isInteger(numericPort) && numericPort >= 1 && numericPort <= 65535) {
    return String(numericPort)
  }

  return DEFAULT_SETTINGS.port
}

export function normalizeSettings(value: unknown): AppSettings {
  const input = isRecord(value) ? value : {}
  const theme =
    input.theme === 'light' || input.theme === 'dark' ? input.theme : DEFAULT_SETTINGS.theme
  const language =
    input.language === 'en' || input.language === 'id' ? input.language : DEFAULT_SETTINGS.language

  return {
    dns: readString(input.dns, DEFAULT_SETTINGS.dns) || DEFAULT_SETTINGS.dns,
    port: normalizePort(input.port),
    autoStart: readBoolean(input.autoStart, DEFAULT_SETTINGS.autoStart),
    customDns: readString(input.customDns, DEFAULT_SETTINGS.customDns),
    theme,
    language,
    onboardingCompleted: readBoolean(
      input.onboardingCompleted,
      DEFAULT_SETTINGS.onboardingCompleted
    )
  }
}
