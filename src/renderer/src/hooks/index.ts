import { useCallback, useEffect, useRef, useState } from 'react'
import { DEFAULT_SETTINGS } from '../../../shared/defaults'
import type {
  ActionResult,
  AdbDevice,
  AppSettings,
  ConnectionStatus,
  DiagnosticReport,
  DiagnosticProgress,
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
  progress: DiagnosticProgress
  attempt: number
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
  const [progress, setProgress] = useState<DiagnosticProgress>({ completed: 0, total: 6 })
  const [attempt, setAttempt] = useState(0)
  const progressQueueRef = useRef<Promise<void>>(Promise.resolve())
  const progressEpochRef = useRef(0)
  const runInFlightRef = useRef(false)
  useEffect(() => {
    if (!hasApi()) return
    return window.api.onDiagnosticsProgress((value) => {
      if (Number.isInteger(value.completed) && Number.isInteger(value.total) && value.total === 6 && value.completed >= 0 && value.completed <= 6) {
        // Real IPC checkpoints may arrive faster than one React paint. Queue them
        // in order so the bar never starts in the middle or jumps backwards.
        const epoch = progressEpochRef.current
        progressQueueRef.current = progressQueueRef.current.then(() => new Promise<void>(resolve => {
          window.setTimeout(() => {
            if (progressEpochRef.current === epoch) {
              setProgress(previous => value.completed > previous.completed ? value : previous)
            }
            resolve()
          }, 200)
        }))
      }
    })
  }, [])

  const run = useCallback(async (): Promise<void> => {
    if (runInFlightRef.current) return
    if (!hasApi()) {
      setError('Electron API is not available.')
      return
    }

    runInFlightRef.current = true
    progressEpochRef.current += 1
    progressQueueRef.current = Promise.resolve()
    setAttempt(value => value + 1)
    setIsRunning(true)
    setProgress({ completed: 0, total: 6 })
    setError(undefined)
    // Do not present an older successful scan as the result of a failed rerun.
    setReport(undefined)
    // Give the 0% frame time to paint before native milestones can arrive.
    await new Promise<void>(resolve => window.setTimeout(resolve, 70))
    try {
      const nextReport = await window.api.getDiagnostics()
      await progressQueueRef.current
      setReport(nextReport)
      setProgress({ completed: 6, total: 6 })
    } catch (runError) {
      await progressQueueRef.current
      setError(runError instanceof Error ? runError.message : 'Diagnostics failed.')
    } finally {
      runInFlightRef.current = false
      setIsRunning(false)
    }
  }, [])

  return { report, isRunning, error, progress, attempt, run }
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
