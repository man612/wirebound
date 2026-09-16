import { useEffect, useRef } from 'react'
import {
  AlertTriangle,
  Battery,
  CheckCircle2,
  Laptop,
  Play,
  ShieldAlert,
  Square as StopSquare,
  Terminal,
  Usb,
  Zap
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { AdbDevice, ConnectionStatus, LogEntry } from '../../../../shared/types'
import type { Translation } from '../../i18n'

interface DashboardProps {
  status: ConnectionStatus
  isLoading: boolean
  onStart: () => Promise<void>
  onStop: () => Promise<void>
  devices: AdbDevice[]
  adbError?: string
  logs: LogEntry[]
  onClearLogs: () => void
  t: Translation
}

interface DeviceSetupState {
  title: string
  description: string
  tone: 'ready' | 'active' | 'warning' | 'error'
  icon: LucideIcon
}

function getDeviceStatusLabel(status: AdbDevice['status'], t: Translation): string {
  if (status === 'device') return t.adbStatusReady
  if (status === 'unauthorized') return t.adbStatusUnauthorized
  if (status === 'offline') return t.adbStatusOffline
  return t.adbStatusNoAccess
}

function getDeviceSetupState(
  devices: AdbDevice[],
  status: ConnectionStatus,
  adbError: string | undefined,
  t: Translation
): DeviceSetupState {
  if (adbError) {
    return {
      title: t.setupAdbErrorTitle,
      description: t.setupAdbErrorDesc,
      tone: 'error',
      icon: AlertTriangle
    }
  }

  if (status === 'connected') {
    return {
      title: t.setupConnectedTitle,
      description: t.setupConnectedDesc,
      tone: 'active',
      icon: CheckCircle2
    }
  }

  if (status === 'connecting') {
    return {
      title: t.setupConnectingTitle,
      description: t.setupConnectingDesc,
      tone: 'warning',
      icon: ShieldAlert
    }
  }

  if (devices.some((device) => device.status === 'unauthorized')) {
    return {
      title: t.setupUnauthorizedTitle,
      description: t.setupUnauthorizedDesc,
      tone: 'error',
      icon: ShieldAlert
    }
  }

  if (devices.some((device) => device.status === 'offline')) {
    return {
      title: t.setupOfflineTitle,
      description: t.setupOfflineDesc,
      tone: 'warning',
      icon: AlertTriangle
    }
  }

  if (devices.some((device) => device.status === 'no permissions')) {
    return {
      title: t.setupNoPermissionsTitle,
      description: t.setupNoPermissionsDesc,
      tone: 'error',
      icon: AlertTriangle
    }
  }

  if (devices.some((device) => device.status === 'device')) {
    return {
      title: t.setupReadyTitle,
      description: t.setupReadyDesc,
      tone: 'ready',
      icon: CheckCircle2
    }
  }

  return {
    title: t.setupNoDeviceTitle,
    description: t.setupNoDeviceDesc,
    tone: 'warning',
    icon: Usb
  }
}

export default function Dashboard({
  status,
  isLoading,
  onStart,
  onStop,
  devices,
  adbError,
  logs,
  onClearLogs,
  t
}: DashboardProps): React.JSX.Element {
  const isRunning = status === 'connected'
  const isConnecting = status === 'connecting'
  const isError = status === 'error'
  const setupState = getDeviceSetupState(devices, status, adbError, t)
  const SetupIcon = setupState.icon
  const logEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  const handleOpenDesktopSpeedTest = (): void => {
    void window.api.openExternal('https://fast.com')
  }

  const handleOpenDeviceSpeedTest = (deviceId: string): void => {
    void window.api.testSpeedOnDevice(deviceId).then((result) => {
      if (!result.success) console.warn('Failed to open speed test on device.', result.error)
    })
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-bg-surface theme-transition animate-page-enter">
      <div className="flex shrink-0 items-center justify-between border-b border-border-subtle px-4 py-2 theme-transition">
        <div className="text-xs text-text-muted">
          Wirebound <span className="mx-1">/</span>
          <span className="text-text-primary">{t.dashboard}</span>
        </div>
        <div className="flex items-center gap-2">
          <div
            className={`h-2 w-2 rounded-full state-morph ${
              isRunning
                ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]'
                : isConnecting
                  ? 'bg-amber-500'
                  : isError
                    ? 'bg-accent-red'
                    : 'bg-bg-hover'
            }`}
          />
          <span className="text-xs font-mono text-text-secondary state-morph">
            {isRunning
              ? t.connected.toUpperCase()
              : isConnecting
                ? t.connecting.toUpperCase()
                : isError
                  ? t.error.toUpperCase()
                  : t.disconnected.toUpperCase()}
          </span>
        </div>
      </div>

      <div className="custom-scrollbar flex flex-col gap-4 overflow-y-auto p-4">
        <div className="flex items-center justify-between rounded-sm border border-border-subtle bg-bg-primary p-4 theme-transition">
          <div className="min-w-0 pr-4">
            <h2 className="text-sm font-semibold text-text-primary">Wirebound Engine</h2>
            <p className="mt-1 text-xs text-text-secondary">{t.onboardingDesc}</p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <button
              onClick={handleOpenDesktopSpeedTest}
              className="group flex items-center gap-1.5 rounded-sm border border-border-subtle bg-bg-surface px-3 py-1.5 text-xs text-text-secondary transition-all duration-200 hover:bg-bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus active:scale-[0.96]"
            >
              <Laptop
                size={14}
                className="text-text-muted transition-transform group-hover:-translate-y-0.5"
              />
              {t.testDesktopSpeed}
            </button>
            <button
              onClick={isRunning ? onStop : onStart}
              disabled={isConnecting || isLoading}
              className={`group flex items-center gap-1.5 rounded-sm border px-4 py-1.5 text-xs font-semibold state-morph focus-visible:outline-none focus-visible:ring-2 disabled:opacity-50 ${
                isRunning
                  ? 'border-red-200 bg-red-50 text-accent-red hover:bg-accent-red-dim focus-visible:ring-accent-red dark:border-red-900 dark:bg-red-900/20'
                  : 'border-accent-blue bg-accent-blue text-white hover:opacity-90 focus-visible:ring-accent-blue'
              }`}
            >
              <div className="relative h-[14px] w-[14px]">
                <StopSquare
                  size={14}
                  className={`absolute inset-0 transition-all duration-300 ${
                    isRunning ? 'scale-100 opacity-100' : 'scale-50 rotate-90 opacity-0'
                  }`}
                />
                <Play
                  size={14}
                  className={`absolute inset-0 transition-all duration-300 ${
                    !isRunning ? 'scale-100 opacity-100' : 'scale-50 -rotate-90 opacity-0'
                  }`}
                />
              </div>
              {isRunning ? t.stop : isConnecting || isLoading ? t.connecting : t.start}
            </button>
          </div>
        </div>

        <div
          className={`flex items-start gap-3 rounded-sm border p-3 theme-transition ${
            setupState.tone === 'active' || setupState.tone === 'ready'
              ? 'border-accent-green/30 bg-accent-green-dim/40 dark:bg-accent-green-dim/20'
              : setupState.tone === 'error'
                ? 'border-accent-red/30 bg-accent-red-dim/40 dark:bg-accent-red-dim/20'
                : 'border-accent-yellow/30 bg-amber-50 dark:bg-yellow-950/20'
          }`}
        >
          <SetupIcon
            size={18}
            className={`mt-0.5 shrink-0 ${
              setupState.tone === 'active' || setupState.tone === 'ready'
                ? 'text-accent-green'
                : setupState.tone === 'error'
                  ? 'text-accent-red'
                  : 'text-accent-yellow'
            }`}
          />
          <div className="min-w-0">
            <div className="text-xs font-semibold text-text-primary">{setupState.title}</div>
            <p className="mt-1 text-xs leading-relaxed text-text-secondary">
              {setupState.description}
            </p>
            {adbError && (
              <p className="mt-1 break-all font-mono text-[10px] text-accent-red/80">{adbError}</p>
            )}
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <div className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
              {t.devicesLabel} ({devices.length})
            </div>
          </div>

          <div className="overflow-x-auto rounded-sm border border-border-subtle bg-bg-surface theme-transition">
            <table className="w-full min-w-[640px] border-collapse text-left text-xs">
              <thead className="border-b border-border-subtle bg-bg-primary">
                <tr>
                  <th className="w-28 px-3 py-2 font-semibold text-text-muted">{t.deviceStatus}</th>
                  <th className="px-3 py-2 font-semibold text-text-muted">{t.deviceId}</th>
                  <th className="px-3 py-2 font-semibold text-text-muted">{t.model}</th>
                  <th className="w-24 px-3 py-2 font-semibold text-text-muted">{t.power}</th>
                  <th className="w-32 px-3 py-2 text-right font-semibold text-text-muted">
                    {t.actions}
                  </th>
                </tr>
              </thead>
              <tbody>
                {devices.map((device) => (
                  <tr
                    key={device.id}
                    className="group border-b border-border-subtle/50 transition-colors hover:bg-bg-primary"
                  >
                    <td className="px-3 py-1.5">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-sm border px-2 py-0.5 text-[10px] font-semibold ${
                          device.status === 'device'
                            ? 'border-accent-green/30 bg-accent-green-dim/40 text-accent-green'
                            : device.status === 'unauthorized' || device.status === 'no permissions'
                              ? 'border-accent-red/30 bg-accent-red-dim/40 text-accent-red'
                              : 'border-accent-yellow/30 bg-amber-50 text-amber-700 dark:bg-yellow-950/20 dark:text-accent-yellow'
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            device.status === 'device'
                              ? 'bg-accent-green'
                              : device.status === 'unauthorized' ||
                                  device.status === 'no permissions'
                                ? 'bg-accent-red'
                                : 'bg-accent-yellow'
                          }`}
                        />
                        {getDeviceStatusLabel(device.status, t)}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 font-mono text-text-muted">{device.id}</td>
                    <td className="px-3 py-1.5 font-medium text-text-primary transition-colors group-hover:text-accent-blue">
                      {device.name || 'Unknown'}
                    </td>
                    <td className="px-3 py-1.5">
                      <div className="flex items-center gap-1 text-text-muted">
                        <Battery size={12} />
                        {device.battery ? `${device.battery}%` : '--'}
                      </div>
                    </td>
                    <td className="px-3 py-1.5 text-right">
                      <button
                        onClick={() => handleOpenDeviceSpeedTest(device.id)}
                        disabled={device.status !== 'device'}
                        className="group/btn inline-flex items-center gap-1.5 rounded-sm border border-border-subtle bg-bg-primary px-2.5 py-1 text-[10px] font-medium text-text-secondary transition-all hover:border-accent-blue/50 hover:bg-accent-blue/10 hover:text-accent-blue disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Zap
                          size={12}
                          className="text-text-muted transition-transform group-hover/btn:scale-110"
                        />
                        {t.testDeviceSpeed}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {devices.length === 0 && (
              <div className="p-4 text-center text-xs text-text-muted">
                {adbError ? t.adbUnavailable : t.noDevice}
              </div>
            )}
          </div>
        </div>

        <div className="pb-10">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-text-muted">
              <Terminal size={12} /> {t.terminalLabel}
            </div>
            <button
              onClick={onClearLogs}
              className="text-[10px] font-bold uppercase text-text-muted transition-colors hover:text-accent-red"
            >
              {t.clear}
            </button>
          </div>
          <div className="custom-scrollbar h-48 overflow-y-auto rounded-sm border border-border-subtle bg-bg-primary p-3 font-mono text-[10px]">
            {logs.length === 0 ? (
              <div className="flex h-full items-center justify-center text-text-muted italic">
                {t.noLogsYet}
              </div>
            ) : (
              <div className="space-y-1">
                {logs.map((log, index) => (
                  <div
                    key={`${log.timestamp}-${index}`}
                    className={`flex gap-2 ${log.type === 'stderr' ? 'text-accent-red' : 'text-text-secondary'}`}
                  >
                    <span className="shrink-0 opacity-50">[{log.timestamp}]</span>
                    <span className="break-all">{log.message}</span>
                  </div>
                ))}
                <div ref={logEndRef} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
