import { useCallback, useEffect, useRef, useState } from 'react'
import { DEFAULT_SETTINGS } from '../../../shared/defaults'
import type {
  ActionResult,
  AdbDevice,
  AppSettings,
  ConnectionStatus,
  LogEntry,
  TrafficDataPoint
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
}

interface UseSettingsResult {
  settings: AppSettings
  updateSettings: (newSettings: Partial<AppSettings>) => Promise<void>
  loaded: boolean
}

interface UseTrafficResult {
  data: TrafficDataPoint[]
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
    if (!hasApi()) {
      return
    }

    let mounted = true
    void window.api
      .getStatus()
      .then((currentStatus) => {
        if (mounted) {
          setStatus(currentStatus)
        }
      })
      .catch((error: unknown) => console.warn('Failed to load current status.', error))

    const unsubStatus = window.api.onStatusChange((newStatus) => {
      setStatus(newStatus)
      setIsLoading(false)
    })

    const unsubLog = window.api.onLog((entry) => {
      setLogs((prev) => {
        const updated = [...prev, entry]
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
    if (!hasApi()) {
      return { success: false, error: 'Electron API is not available.' }
    }

    setIsLoading(true)

    try {
      const result = await window.api.startGnirehtet(dns, port)
      if (!result.success) {
        setIsLoading(false)
      }
      return result
    } catch (error) {
      setIsLoading(false)
      return actionFailure(error, 'Failed to start Gnirehtet.')
    }
  }, [])

  const stop = useCallback(async (): Promise<ActionResult> => {
    if (!hasApi()) {
      return { success: false, error: 'Electron API is not available.' }
    }

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

  const clearLogs = useCallback((): void => {
    setLogs([])
  }, [])

  return { status, logs, isLoading, start, stop, clearLogs }
}

export function useDevices(): UseDevicesResult {
  const [devices, setDevices] = useState<AdbDevice[]>([])

  useEffect(() => {
    if (!hasApi()) {
      return
    }

    let mounted = true
    void window.api
      .getDevices()
      .then((currentDevices) => {
        if (mounted) {
          setDevices(currentDevices)
        }
      })
      .catch((error: unknown) => console.warn('Failed to load devices.', error))

    const unsub = window.api.onDevicesChange((newDevices) => {
      setDevices(newDevices)
    })

    return () => {
      mounted = false
      unsub()
    }
  }, [])

  return { devices }
}

export function useSettings(): UseSettingsResult {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [loaded, setLoaded] = useState(() => !hasApi())
  const settingsRef = useRef<AppSettings>(DEFAULT_SETTINGS)

  useEffect(() => {
    settingsRef.current = settings
  }, [settings])

  useEffect(() => {
    if (!hasApi()) {
      return
    }

    let mounted = true
    void window.api
      .getSettings()
      .then((loadedSettings) => {
        if (mounted) {
          settingsRef.current = loadedSettings
          setSettings(loadedSettings)
          setLoaded(true)
        }
      })
      .catch((error: unknown) => {
        console.warn('Failed to load settings.', error)
        if (mounted) {
          setLoaded(true)
        }
      })

    return () => {
      mounted = false
    }
  }, [])

  const updateSettings = useCallback(async (newSettings: Partial<AppSettings>): Promise<void> => {
    const nextSettings = { ...settingsRef.current, ...newSettings }
    settingsRef.current = nextSettings
    setSettings(nextSettings)

    if (!hasApi()) {
      return
    }

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

export function useTraffic(isConnected: boolean): UseTrafficResult {
  const [data, setData] = useState<TrafficDataPoint[]>([])
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!isConnected) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }

    intervalRef.current = setInterval(() => {
      const now = new Date()
      const time = now.toLocaleTimeString('id-ID', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      })

      setData((prev) => {
        const updated = [
          ...prev,
          {
            time,
            upload: Math.random() * 50 + 5,
            download: Math.random() * 120 + 10
          }
        ]

        return updated.length > 30 ? updated.slice(-30) : updated
      })
    }, 2000)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [isConnected])

  return { data }
}
