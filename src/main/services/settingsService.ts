import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync } from 'fs'
import { rename, rm, writeFile } from 'fs/promises'
import { dirname, join } from 'path'
import { DEFAULT_SETTINGS } from '../../shared/defaults'
import { normalizeSettings } from '../../shared/settings'
import type { AppSettings } from '../../shared/types'

let saveQueue: Promise<void> = Promise.resolve()

function settingsFile(): string {
  return join(app.getPath('userData'), 'settings.json')
}

export function loadSettings(): AppSettings {
  const file = settingsFile()

  try {
    if (!existsSync(file)) {
      return DEFAULT_SETTINGS
    }

    return normalizeSettings(JSON.parse(readFileSync(file, 'utf-8')))
  } catch (error) {
    console.warn('Wirebound: Failed to load settings, using defaults.', error)
    return DEFAULT_SETTINGS
  }
}

export async function saveSettings(settings: unknown): Promise<AppSettings> {
  const normalized = normalizeSettings(settings)
  const file = settingsFile()
  const temporaryFile = `${file}.${process.pid}.${Date.now()}.tmp`

  const operation = saveQueue.then(async () => {
    mkdirSync(dirname(file), { recursive: true })

    try {
      await writeFile(temporaryFile, JSON.stringify(normalized, null, 2), 'utf-8')
      await rename(temporaryFile, file)
    } catch (error) {
      await rm(temporaryFile, { force: true }).catch(() => undefined)
      throw error
    }
  })

  saveQueue = operation.then(
    () => undefined,
    () => undefined
  )

  await operation
  return normalized
}
