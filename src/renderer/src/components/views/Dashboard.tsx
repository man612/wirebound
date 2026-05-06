import { useRef, useEffect } from 'react'
import { Laptop, Battery, Zap, Play, Square as StopSquare, Terminal } from 'lucide-react'
import type {
  AdbDevice,
  ConnectionStatus,
  LogEntry,
  TrafficDataPoint
} from '../../../../shared/types'
import type { Translation } from '../../i18n'
import TrafficChart from '../ui/TrafficChart'

interface DashboardProps {
  status: ConnectionStatus
  isLoading: boolean
  onStart: () => Promise<void>
  onStop: () => Promise<void>
  devices: AdbDevice[]
  trafficData: TrafficDataPoint[]
  logs: LogEntry[]
  onClearLogs: () => void
  t: Translation
}

export default function Dashboard({
  status,
  isLoading,
  onStart,
  onStop,
  devices,
  trafficData,
  logs,
  onClearLogs,
  t
}: DashboardProps): React.JSX.Element {
  const isRunning = status === 'connected'
  const isConnecting = status === 'connecting'
  const isError = status === 'error'
  const logEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  const handleOpenDesktopSpeedTest = (): void => {
    void window.api.openExternal('https://fast.com')
  }

  const handleOpenDeviceSpeedTest = (deviceId: string): void => {
    void window.api.testSpeedOnDevice(deviceId).then((result) => {
      if (!result.success) {
        console.warn('Failed to open speed test on device.', result.error)
      }
    })
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-bg-surface theme-transition animate-page-enter">
      {/* View Header */}
      <div className="px-4 py-2 border-b border-border-subtle flex items-center justify-between shrink-0 theme-transition">
        <div className="text-xs text-text-muted">
          Wirebound <span className="mx-1">/</span>{' '}
          <span className="text-text-primary">{t.dashboard}</span>
        </div>
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full state-morph ${isRunning ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : isConnecting ? 'bg-amber-500' : isError ? 'bg-accent-red' : 'bg-bg-hover'}`}
          ></div>
          <span className="text-xs font-mono state-morph text-text-secondary">
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

      <div className="p-4 flex flex-col gap-4 overflow-y-auto custom-scrollbar">
        {/* Core Control Panel */}
        <div className="border border-border-subtle bg-bg-primary rounded-sm p-4 flex items-center justify-between theme-transition">
          <div>
            <h2 className="text-sm font-semibold text-text-primary transition-colors duration-300">
              Wirebound Engine
            </h2>
            <p className="text-xs text-text-secondary mt-1 transition-colors duration-300">
              {t.onboardingDesc}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleOpenDesktopSpeedTest}
              className="group flex items-center gap-1.5 text-xs bg-bg-surface hover:bg-bg-hover text-text-secondary px-3 py-1.5 rounded-sm transition-all duration-200 active:scale-[0.96] border border-border-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
            >
              <Laptop
                size={14}
                className="transition-transform duration-200 group-hover:-translate-y-0.5 group-active:translate-y-0 text-text-muted group-hover:text-text-primary"
              />
              {t.testDesktopSpeed}
            </button>
            <button
              onClick={isRunning ? onStop : onStart}
              disabled={isConnecting || isLoading}
              className={`group flex items-center gap-1.5 text-xs font-semibold px-4 py-1.5 rounded-sm state-morph active:scale-[0.96] border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-[#252526] ${
                isRunning
                  ? 'bg-red-50 dark:bg-red-900/20 text-accent-red border-red-200 dark:border-red-900 hover:bg-accent-red-dim focus-visible:ring-accent-red'
                  : 'bg-accent-blue text-white border-accent-blue hover:opacity-90 focus-visible:ring-accent-blue disabled:opacity-50'
              }`}
            >
              <div className="relative w-[14px] h-[14px]">
                <StopSquare
                  size={14}
                  className={`absolute inset-0 transition-all duration-300 ${isRunning ? 'opacity-100 scale-100 rotate-0' : 'opacity-0 scale-50 rotate-90'}`}
                />
                <Play
                  size={14}
                  className={`absolute inset-0 transition-all duration-300 ${!isRunning ? 'opacity-100 scale-100 rotate-0' : 'opacity-0 scale-50 -rotate-90'}`}
                />
              </div>
              {isRunning ? t.stop : isConnecting || isLoading ? t.connecting : t.start}
            </button>
          </div>
        </div>

        {/* Traffic Chart */}
        <div>
          <div className="text-[11px] font-bold text-text-muted mb-2 uppercase tracking-wider">
            {t.trafficMonitor}
          </div>
          <TrafficChart data={trafficData} />
        </div>

        {/* Device Table */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="text-[11px] font-bold text-text-muted uppercase tracking-wider">
              {t.dashboard} ({devices.length})
            </div>
          </div>

          <div className="border border-border-subtle rounded-sm overflow-hidden bg-bg-surface theme-transition">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-bg-primary border-b border-border-subtle theme-transition">
                <tr>
                  <th className="py-2 px-3 font-semibold text-text-muted w-10">{t.deviceStatus}</th>
                  <th className="py-2 px-3 font-semibold text-text-muted">{t.deviceId}</th>
                  <th className="py-2 px-3 font-semibold text-text-muted">{t.model}</th>
                  <th className="py-2 px-3 font-semibold text-text-muted w-24">{t.power}</th>
                  <th className="py-2 px-3 font-semibold text-text-muted text-right w-32">
                    {t.actions}
                  </th>
                </tr>
              </thead>
              <tbody>
                {devices.map((dev) => (
                  <tr
                    key={dev.id}
                    className="border-b border-border-subtle/50 hover:bg-bg-primary transition-colors duration-150 group"
                  >
                    <td className="py-1.5 px-3">
                      <div
                        className={`w-2 h-2 rounded-full ${dev.status === 'device' ? 'bg-accent-green shadow-[0_0_6px_rgba(22,163,74,0.2)]' : 'bg-bg-hover'}`}
                      ></div>
                    </td>
                    <td className="py-1.5 px-3 font-mono text-text-muted">{dev.id}</td>
                    <td className="py-1.5 px-3 text-text-primary font-medium transition-colors group-hover:text-accent-blue">
                      {dev.name || 'Unknown'}
                    </td>
                    <td className="py-1.5 px-3">
                      <div className="flex items-center gap-1 text-text-muted">
                        <Battery size={12} className="text-text-muted" /> {dev.battery || '--'}%
                      </div>
                    </td>
                    <td className="py-1.5 px-3 text-right">
                      <button
                        onClick={() => handleOpenDeviceSpeedTest(dev.id)}
                        className="group/btn inline-flex items-center gap-1.5 text-[10px] font-medium bg-bg-primary hover:bg-accent-blue/10 text-text-secondary hover:text-accent-blue border border-border-subtle hover:border-accent-blue/50 px-2.5 py-1 rounded-sm transition-all duration-200 active:scale-[0.94] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue/50"
                      >
                        <Zap
                          size={12}
                          className="text-text-muted group-hover/btn:text-accent-yellow transition-all duration-200 group-hover/btn:scale-110 group-hover/btn:rotate-12"
                        />{' '}
                        {t.testDeviceSpeed}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {devices.length === 0 && (
              <div className="p-4 text-center text-xs text-text-muted">{t.noDevice}</div>
            )}
          </div>
        </div>

        {/* Terminal Logs */}
        <div className="pb-10">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[11px] font-bold text-text-muted uppercase tracking-wider flex items-center gap-2">
              <Terminal size={12} /> {t.terminalLabel}
            </div>
            <button
              onClick={onClearLogs}
              className="text-[10px] font-bold text-text-muted hover:text-accent-red uppercase transition-colors"
            >
              {t.clear}
            </button>
          </div>
          <div className="border border-border-subtle rounded-sm bg-bg-primary h-48 overflow-y-auto p-3 font-mono text-[10px] custom-scrollbar">
            {logs.length === 0 ? (
              <div className="h-full flex items-center justify-center text-text-muted italic">
                {t.gathering}
              </div>
            ) : (
              <div className="space-y-1">
                {logs.map((log, i) => (
                  <div
                    key={i}
                    className={`flex gap-2 ${log.type === 'stderr' ? 'text-accent-red' : 'text-text-secondary'}`}
                  >
                    <span className="opacity-50 shrink-0">[{log.timestamp}]</span>
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
