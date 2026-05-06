import { useState, useEffect, useCallback, useRef } from 'react'
import type { ConnectionStatus, LogEntry, AdbDevice, AppSettings } from '../../../shared/types'

// Helper: check if Electron API is available
const hasApi = (): boolean => typeof window !== 'undefined' && !!window.api

// === Hook to manage Gnirehtet connection ===
export function useGnirehtet() {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected')
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!hasApi()) return

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
      unsubStatus()
      unsubLog()
    }
  }, [])

  const start = useCallback(async (dns: string, port: string) => {
    if (!hasApi()) return { success: false, error: 'API not available' }
    setIsLoading(true)
    const result = await window.api.startGnirehtet(dns, port)
    if (!result.success) setIsLoading(false)
    return result
  }, [])

  const stop = useCallback(async () => {
    if (!hasApi()) return { success: false, error: 'API not available' }
    setIsLoading(true)
    const result = await window.api.stopGnirehtet()
    setIsLoading(false)
    return result
  }, [])

  const clearLogs = useCallback(() => {
    setLogs([])
  }, [])

  return { status, logs, isLoading, start, stop, clearLogs }
}

// === Hook for ADB device polling ===
export function useDevices() {
  const [devices, setDevices] = useState<AdbDevice[]>([])

  useEffect(() => {
    if (!hasApi()) return

    window.api.getDevices().then(setDevices)

    const unsub = window.api.onDevicesChange((newDevices) => {
      setDevices(newDevices)
    })

    return () => { unsub() }
  }, [])

  return { devices }
}

// === Hook for application settings ===
export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>({
    dns: '8.8.8.8',
    port: '31416',
    autoStart: false,
    customDns: '',
    theme: 'dark',
    language: 'en',
    onboardingCompleted: false
  })

  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!hasApi()) {
      setLoaded(true)
      return
    }
    window.api.getSettings().then((s) => {
      setSettings(s)
      setLoaded(true)
    })
  }, [])

  const updateSettings = useCallback(async (newSettings: Partial<AppSettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings }
      if (hasApi()) {
        window.api.saveSettings(updated)
      }
      return updated
    })
  }, [])


  return { settings, updateSettings, loaded }
}

// === Hook for traffic telemetry data (simulation) ===
export function useTraffic(isConnected: boolean) {
  const [data, setData] = useState<Array<{ time: string; upload: number; download: number }>>([])
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (isConnected) {
      intervalRef.current = setInterval(() => {
        const now = new Date()
        const timeStr = now.toLocaleTimeString('id-ID', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
        setData((prev) => {
          const newPoint = {
            time: timeStr,
            upload: Math.random() * 50 + 5,
            download: Math.random() * 120 + 10
          }
          const updated = [...prev, newPoint]
          return updated.length > 30 ? updated.slice(-30) : updated
        })
      }, 2000)
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [isConnected])

  return { data }
}
