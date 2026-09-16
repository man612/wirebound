import { useCallback, useEffect, useRef, useState } from 'react'
import { DEFAULT_SETTINGS } from '../../../shared/defaults'
import type {
  ActionResult,
  AdbDevice,
  AppSettings,
  ConnectionStatus,
  DiagnosticReport,
  LogEntry
} from '../../../shared/types'

interface UseGnirehtetResult {
  status: ConnectionStatus
  logs: LogEntry[]
  isLoading: boolean
  start: (dns: string, port: string) => Promise<ActionResult>
  stop: () => Promise<ActionResult>
  clearLogs: () => void
}

interface UseDevicesResult {
  devices: AdbDevice[]
  error?: string
}

interface UseSettingsResult {
  settings: AppSettings
  updateSettings: (newSettings: Partial<AppSettings>) => Promise<void>
  loaded: boolean
}

interface UseDiagnosticsResult {
  report?: DiagnosticReport
  isRunning: boolean
  error?: string
  run: () => Promise<void>
}

const hasApi = (): boolean => typeof window !== 'undefined' && Boolean(window.api)

function actionFailure(error: unknown, fallback: string): ActionResult {
  return {
    success: false,
    error: error instanceof Error ? error.message : fallback
  }
}

export function useGnirehtet(): UseGnirehtetResult {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected')
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!hasApi()) return

    let mounted = true
    void window.api
      .getStatus()
      .then((currentStatus) => {
        if (mounted) setStatus(currentStatus)
      })
      .catch((error: unknown) => console.warn('Failed to load current status.', error))

    const unsubStatus = window.api.onStatusChange((newStatus) => {
      setStatus(newStatus)
      setIsLoading(false)
    })
    const unsubLog = window.api.onLog((entry) => {
      setLogs((previous) => {
        const updated = [...previous, entry]
        return updated.length > 500 ? updated.slice(-500) : updated
      })
    })

    return () => {
      mounted = false
      unsubStatus()
      unsubLog()
    }
  }, [])

  const start = useCallback(async (dns: string, port: string): Promise<ActionResult> => {
    if (!hasApi()) return { success: false, error: 'Electron API is not available.' }

    setIsLoading(true)
    try {
      const result = await window.api.startGnirehtet(dns, port)
      if (!result.success) setIsLoading(false)
      return result
    } catch (error) {
      setIsLoading(false)
      return actionFailure(error, 'Failed to start Gnirehtet.')
    }
  }, [])

  const stop = useCallback(async (): Promise<ActionResult> => {
    if (!hasApi()) return { success: false, error: 'Electron API is not available.' }

    setIsLoading(true)
    try {
      const result = await window.api.stopGnirehtet()
      setIsLoading(false)
      return result
    } catch (error) {
      setIsLoading(false)
      return actionFailure(error, 'Failed to stop Gnirehtet.')
    }
  }, [])

  const clearLogs = useCallback((): void => setLogs([]), [])

  return { status, logs, isLoading, start, stop, clearLogs }
}

export function useDevices(): UseDevicesResult {
  const [devices, setDevices] = useState<AdbDevice[]>([])
  const [error, setError] = useState<string | undefined>()

  useEffect(() => {
    if (!hasApi()) return

    let mounted = true
    void window.api
      .getDeviceSnapshot()
      .then((snapshot) => {
        if (!mounted) return
        setDevices(snapshot.devices)
        setError(snapshot.error)
      })
      .catch((loadError: unknown) => {
        if (!mounted) return
        setDevices([])
        setError(loadError instanceof Error ? loadError.message : 'Failed to query ADB devices.')
      })

    const unsub = window.api.onDevicesChange((snapshot) => {
      setDevices(snapshot.devices)
      setError(snapshot.error)
    })

    return () => {
      mounted = false
      unsub()
    }
  }, [])

  return { devices, error }
}

export function useSettings(): UseSettingsResult {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [loaded, setLoaded] = useState(() => !hasApi())
  const settingsRef = useRef<AppSettings>(DEFAULT_SETTINGS)

  useEffect(() => {
    settingsRef.current = settings
  }, [settings])

  useEffect(() => {
    if (!hasApi()) return

    let mounted = true
    void window.api
      .getSettings()
      .then((loadedSettings) => {
        if (!mounted) return
        settingsRef.current = loadedSettings
        setSettings(loadedSettings)
        setLoaded(true)
      })
      .catch((error: unknown) => {
        console.warn('Failed to load settings.', error)
        if (mounted) setLoaded(true)
      })

    return () => {
      mounted = false
    }
  }, [])

  const updateSettings = useCallback(async (newSettings: Partial<AppSettings>): Promise<void> => {
    const nextSettings = { ...settingsRef.current, ...newSettings }
    settingsRef.current = nextSettings
    setSettings(nextSettings)

    if (!hasApi()) return

    try {
      const savedSettings = await window.api.saveSettings(nextSettings)
      settingsRef.current = savedSettings
      setSettings(savedSettings)
    } catch (error) {
      console.warn('Failed to save settings.', error)
    }
  }, [])

  return { settings, updateSettings, loaded }
}

export function useDiagnostics(): UseDiagnosticsResult {
  const [report, setReport] = useState<DiagnosticReport | undefined>()
  const [isRunning, setIsRunning] = useState(false)
  const [error, setError] = useState<string | undefined>()

  const run = useCallback(async (): Promise<void> => {
    if (!hasApi()) {
      setError('Electron API is not available.')
      return
    }

    setIsRunning(true)
    setError(undefined)
    try {
      setReport(await window.api.getDiagnostics())
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : 'Diagnostics failed.')
    } finally {
      setIsRunning(false)
    }
  }, [])

  return { report, isRunning, error, run }
}

export function useAppVersion(): string {
  const [version, setVersion] = useState('')

  useEffect(() => {
    if (!hasApi()) return

    let mounted = true
    void window.api
      .getAppVersion()
      .then((appVersion) => {
        if (mounted) setVersion(appVersion)
      })
      .catch((error: unknown) => console.warn('Failed to load application version.', error))

    return () => {
      mounted = false
    }
  }, [])

  return version
}
