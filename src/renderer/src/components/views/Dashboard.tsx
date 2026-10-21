import { useEffect, useRef, useState } from 'react'
import {
  AlertTriangle,
  Battery,
  CheckCircle2,
  ClipboardCopy,
  ChevronDown,
  ChevronRight,
  X,
  Download,
  Laptop,
  Link2,
  Play,
  RefreshCw,
  ShieldAlert,
  Square as StopSquare,
  Stethoscope,
  Terminal,
  Unplug,
  Usb,
  Zap
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type {
  AdbDevice,
  ConnectionStatus,
  DiagnosticCheckId,
  DiagnosticReport,
  DeviceTunnelStatus,
  LogEntry
} from '../../../../shared/types'
import type { Language, Translation } from '../../i18n'
import { formatUiTimestamp, maskDeviceId } from '../../formatters'

interface DashboardProps {
  status: ConnectionStatus
  isLoading: boolean
  onStart: () => Promise<void>
  onStop: () => Promise<void>
  devices: AdbDevice[]
  adbError?: string
  logs: LogEntry[]
  onClearLogs: () => void
  diagnostics: {
    report?: DiagnosticReport
    isRunning: boolean
    error?: string
    run: () => Promise<void>
  }
  t: Translation
  language: Language
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

function getTunnelStatusLabel(
  status: DeviceTunnelStatus | undefined,
  t: Translation
): string {
  if (status === 'connected') return t.tunnelConnected
  if (status === 'waiting') return t.tunnelWaiting
  if (status === 'idle') return t.tunnelIdle
  if (status === 'error') return t.tunnelError
  return t.tunnelUnavailable
}

function getTunnelStatusClass(status: DeviceTunnelStatus | undefined): string {
  if (status === 'connected') {
    return 'border-accent-green/30 bg-accent-green-dim/40 text-accent-green'
  }
  if (status === 'waiting') {
    return 'border-accent-yellow/30 bg-amber-50 text-amber-700 dark:bg-yellow-950/20 dark:text-accent-yellow'
  }
  if (status === 'error') {
    return 'border-accent-red/30 bg-accent-red-dim/40 text-accent-red'
  }
  return 'border-border-subtle bg-bg-primary text-text-muted'
}

function formatBytes(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value) || value < 0) return '--'

  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let amount = value
  let unitIndex = 0

  while (amount >= 1024 && unitIndex < units.length - 1) {
    amount /= 1024
    unitIndex += 1
  }

  const digits = amount >= 100 || unitIndex === 0 ? 0 : amount >= 10 ? 1 : 2
  return `${amount.toFixed(digits)} ${units[unitIndex]}`
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

function getDiagnosticLabel(id: DiagnosticCheckId, t: Translation): string {
  if (id === 'adbRuntime') return t.diagAdbRuntime
  if (id === 'gnirehtetRuntime') return t.diagGnirehtetRuntime
  if (id === 'adbQuery') return t.diagAdbQuery
  if (id === 'deviceAccess') return t.diagDeviceAccess
  if (id === 'androidVersion') return t.diagAndroidVersion
  return t.diagGnirehtetClient
}

function formatDiagnosticReport(report: DiagnosticReport): string {
  const lines = [
    'Wirebound Support Report',
    `Wirebound version: ${report.appVersion ? `v${report.appVersion}` : 'unknown'}`,
    `System: ${
      report.system
        ? `${report.system.platform} ${report.system.release} (${report.system.arch})`
        : 'unknown'
    }`,
    `Generated: ${report.generatedAt}`,
    `Engine status: ${report.engineStatus}`,
    '',
    'Checks:'
  ]

  for (const check of report.checks) {
    lines.push(`- [${check.status.toUpperCase()}] ${check.id}: ${check.detail ?? ''}`)
  }

  if (report.devices.length > 0) {
    lines.push('', 'Devices:')
    for (const device of report.devices) {
      lines.push(
        `- ${device.name} (${maskDeviceId(device.id)}) | ${device.status} | Android ${device.androidVersion ?? '?'} / API ${device.apiLevel ?? '?'} | Gnirehtet installed: ${device.gnirehtetInstalled ? 'yes' : 'no'} | client active: ${device.gnirehtetActive ? 'yes' : 'no'}`
      )
    }
  }

  return lines.join('\n')
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
  diagnostics,
  t,
  language
}: DashboardProps): React.JSX.Element {
  const isRunning = status === 'connected'
  const isConnecting = status === 'connecting'
  const isError = status === 'error'
  const setupState = getDeviceSetupState(devices, status, adbError, t)
  const SetupIcon = setupState.icon
  const logViewportRef = useRef<HTMLDivElement>(null)
  const logPinnedToBottomRef = useRef(true)
  const collapseTimerRef = useRef<number | null>(null)
  const copyTimerRef = useRef<number | null>(null)
  const manuallyToggledRef = useRef(false)
  const rerunLockRef = useRef(false)
  const acknowledgedRerunRef = useRef(0)
  const initialRevealScheduledRef = useRef(false)
  const [diagnosticsExpanded, setDiagnosticsExpanded] = useState(true)
  const [diagnosticsManuallyToggled, setDiagnosticsManuallyToggled] = useState(false)
  const [diagnosticsFeedback, setDiagnosticsFeedback] = useState<'running' | 'finished' | 'failed' | null>(null)
  const [rerunCycle, setRerunCycle] = useState(0)
  const [copyState, setCopyState] = useState<'idle' | 'copying' | 'success' | 'error'>('idle')
  const [reportExported, setReportExported] = useState(false)
  const [deviceActionId, setDeviceActionId] = useState<string>()
  const [readyDismissed, setReadyDismissed] = useState(false)
  const diagnosticsVisible =
    diagnosticsExpanded || (Boolean(diagnostics.error) && !diagnosticsManuallyToggled)

  // A returning user has no cached diagnostic report: perform one real scan.
  // Never run it again on ordinary device polling or dashboard re-renders.
  useEffect(() => {
    if (!diagnostics.report && !diagnostics.isRunning && !diagnostics.error) {
      void diagnostics.run()
    }
  }, [diagnostics.report, diagnostics.isRunning, diagnostics.error, diagnostics.run])

  // Start the brief reveal AFTER the real scan finishes, not while it is pending.
  // A failed scan stays visible; user-driven disclosure always wins.
  useEffect(() => {
    if (
      initialRevealScheduledRef.current ||
      diagnostics.isRunning ||
      (!diagnostics.report && !diagnostics.error)
    ) return

    initialRevealScheduledRef.current = true
    if (diagnostics.error || manuallyToggledRef.current) return

    collapseTimerRef.current = window.setTimeout(() => {
      if (!manuallyToggledRef.current) setDiagnosticsExpanded(false)
      collapseTimerRef.current = null
    }, 2600)
  }, [diagnostics.report, diagnostics.isRunning, diagnostics.error])

  useEffect(() => () => {
    if (collapseTimerRef.current !== null) window.clearTimeout(collapseTimerRef.current)
    if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current)
  }, [])

  useEffect(() => {
    // Keep failed scans visible without synchronously setting React state in an effect.
    if (diagnostics.error && !diagnostics.isRunning) {
      if (collapseTimerRef.current !== null) window.clearTimeout(collapseTimerRef.current)
      collapseTimerRef.current = null
    }
  }, [diagnostics.error, diagnostics.isRunning])

  useEffect(() => {
    if (rerunCycle === 0 || acknowledgedRerunRef.current === rerunCycle) return
    acknowledgedRerunRef.current = rerunCycle
    const failed = Boolean(diagnostics.error)
    setDiagnosticsFeedback(failed ? 'failed' : 'finished')
    if (!failed && !manuallyToggledRef.current) {
      if (collapseTimerRef.current !== null) window.clearTimeout(collapseTimerRef.current)
      collapseTimerRef.current = window.setTimeout(() => {
        if (!manuallyToggledRef.current) setDiagnosticsExpanded(false)
        collapseTimerRef.current = null
      }, 2600)
    }
  }, [rerunCycle, diagnostics.error])

  // Scroll only the terminal viewport, never its ancestor dashboard.
  useEffect(() => {
    const viewport = logViewportRef.current
    if (viewport && logPinnedToBottomRef.current) viewport.scrollTop = viewport.scrollHeight
  }, [logs])

  const handleLogScroll = (): void => {
    const viewport = logViewportRef.current
    if (!viewport) return
    logPinnedToBottomRef.current =
      viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 28
  }

  const handleToggleDiagnostics = (): void => {
    manuallyToggledRef.current = true
    setDiagnosticsManuallyToggled(true)
    if (collapseTimerRef.current !== null) window.clearTimeout(collapseTimerRef.current)
    collapseTimerRef.current = null
    setDiagnosticsExpanded(!diagnosticsVisible)
  }

  const handleRerunDiagnostics = async (): Promise<void> => {
    if (rerunLockRef.current || diagnostics.isRunning) return
    rerunLockRef.current = true
    manuallyToggledRef.current = false
    setDiagnosticsManuallyToggled(false)
    if (collapseTimerRef.current !== null) window.clearTimeout(collapseTimerRef.current)
    collapseTimerRef.current = null
    setDiagnosticsExpanded(true)
    setDiagnosticsFeedback('running')
    try {
      await diagnostics.run()
    } finally {
      // useDiagnostics resolves after it publishes the real result or error.
      setRerunCycle((previous) => previous + 1)
      rerunLockRef.current = false
    }
  }

  const handleCopyDiagnostics = async (): Promise<void> => {
    if (!diagnostics.report || copyState === 'copying') return
    if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current)
    setCopyState('copying')
    try {
      const result = await window.api.copySupportReport(formatDiagnosticReport(diagnostics.report))
      if (!result.success) throw new Error(result.error ?? 'Failed to copy support report.')
      setCopyState('success')
    } catch (error) {
      console.warn('Failed to copy diagnostic report.', error)
      setCopyState('error')
    }
    copyTimerRef.current = window.setTimeout(() => {
      setCopyState('idle')
      copyTimerRef.current = null
    }, 2600)
  }

  const handleExportDiagnostics = async (): Promise<void> => {
    if (!diagnostics.report) return

    const result = await window.api.exportSupportReport(formatDiagnosticReport(diagnostics.report))
    if (!result.success) {
      console.warn('Failed to export support report.', result.error)
      return
    }
    if (result.cancelled) return

    setReportExported(true)
    window.setTimeout(() => setReportExported(false), 1500)
  }

  const handleOpenDesktopSpeedTest = (): void => {
    void window.api.openExternal('https://fast.com')
  }

  const handleDeviceTunnelAction = async (device: AdbDevice): Promise<void> => {
    setDeviceActionId(device.id)
    try {
      const result =
        device.tunnelStatus === 'connected'
          ? await window.api.stopDeviceTunnel(device.id)
          : await window.api.startDeviceTunnel(device.id)

      if (!result.success) {
        console.warn('Per-device tethering action failed.', result.error)
      }
    } finally {
      setDeviceActionId(undefined)
    }
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
        <div className="flex flex-col gap-3 rounded-sm border border-border-subtle bg-bg-primary p-4 theme-transition md:flex-row md:items-center md:justify-between">
          <div className="min-w-0 md:pr-4">
            <h2 className="text-sm font-semibold text-text-primary">Wirebound Engine</h2>
            <p className="mt-1 text-xs text-text-secondary">{t.onboardingDesc}</p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2 md:shrink-0">
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

        {(!readyDismissed || setupState.tone !== 'ready') && <div
          className={`flex items-center gap-2 rounded-sm border px-3 py-2 theme-transition ${
            setupState.tone === 'active' || setupState.tone === 'ready'
              ? 'border-accent-green/30 bg-accent-green-dim/40 dark:bg-accent-green-dim/20'
              : setupState.tone === 'error'
                ? 'border-accent-red/30 bg-accent-red-dim/40 dark:bg-accent-red-dim/20'
                : 'border-accent-yellow/30 bg-amber-50 dark:bg-yellow-950/20'
          }`}
        >
          <SetupIcon
            size={16}
            className={`shrink-0 ${
              setupState.tone === 'active' || setupState.tone === 'ready'
                ? 'text-accent-green'
                : setupState.tone === 'error'
                  ? 'text-accent-red'
                  : 'text-accent-yellow'
            }`}
          />
          <div className="min-w-0 flex-1 text-xs">
            <span className="font-semibold text-text-primary">{setupState.title}</span>
            <span className="ml-2 text-text-secondary">{setupState.description}</span>
            {adbError && (
              <p className="mt-1 break-all font-mono text-[10px] text-accent-red/80">{adbError}</p>
            )}
          </div>
          {setupState.tone === 'ready' && (
            <button type="button" onClick={() => setReadyDismissed(true)}
              aria-label={t.dismissNotice}
              className="ml-auto shrink-0 rounded-sm p-1 text-text-muted hover:bg-bg-hover hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus">
              <X size={14} />
            </button>
          )}
        </div>}

        <div className="rounded-sm border border-border-subtle bg-bg-surface p-3 theme-transition">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <Stethoscope size={14} className="shrink-0 text-accent-blue" />
              <div className="min-w-0">
                <div className="text-[11px] font-bold uppercase tracking-wider text-text-muted">{t.diagnostics}</div>
                {diagnostics.report && (
                  <p className="mt-0.5 text-[10px] text-text-secondary">
                    {diagnostics.report.checks.filter((check) => check.status === 'pass').length}/{diagnostics.report.checks.length} {t.diagnosticsPassed}
                  </p>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-1.5">
              <button
                onClick={() => void handleCopyDiagnostics()}
                disabled={!diagnostics.report || copyState === 'copying'}
                title={t.copyReportHelp}
                className="inline-flex items-center gap-1.5 rounded-sm border border-border-subtle bg-bg-primary px-2.5 py-1 text-[10px] font-medium text-text-secondary transition-colors hover:text-accent-blue disabled:cursor-not-allowed disabled:opacity-40"
              >
                {copyState === 'success' ? <CheckCircle2 size={12} /> : <ClipboardCopy size={12} />}
                {copyState === 'copying' ? t.copyingReport : copyState === 'success' ? t.reportCopied : t.copyReport}
              </button>
              <button
                onClick={() => void handleExportDiagnostics()}
                disabled={!diagnostics.report}
                className="inline-flex items-center gap-1.5 rounded-sm border border-border-subtle bg-bg-primary px-2.5 py-1 text-[10px] font-medium text-text-secondary transition-colors hover:text-accent-blue disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Download size={12} />
                {reportExported ? t.reportExported : t.exportReport}
              </button>
              <button
                onClick={() => void handleRerunDiagnostics()}
                disabled={diagnostics.isRunning}
                className="inline-flex items-center gap-1.5 rounded-sm border border-accent-blue/30 bg-accent-blue/10 px-2.5 py-1 text-[10px] font-semibold text-accent-blue transition-colors hover:bg-accent-blue/15 disabled:opacity-50"
              >
                <RefreshCw size={12} className={diagnostics.isRunning ? 'motion-safe:animate-spin' : ''} />
                {diagnostics.report ? t.rerunDiagnostics : t.runDiagnostics}
              </button>
              <button type="button" onClick={handleToggleDiagnostics}
                aria-expanded={diagnosticsVisible} aria-controls="wirebound-diagnostic-details"
                className="inline-flex items-center gap-1 rounded-sm border border-border-subtle bg-bg-primary px-2 py-1 text-[10px] font-medium text-text-secondary hover:bg-bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus">
                {diagnosticsVisible ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                {diagnosticsVisible ? t.diagnosticsHide : t.diagnosticsShow}
              </button>
            </div>
          </div>

          <div role="status" aria-live="polite" aria-atomic="true" className="mt-1 text-[11px] text-text-secondary">
            {diagnostics.isRunning || diagnosticsFeedback === 'running' ? (
              <span className="inline-flex items-center gap-1.5 text-accent-blue">
                <RefreshCw size={12} className="motion-safe:animate-spin" /> {t.diagnosticsChecking}
              </span>
            ) : diagnosticsFeedback === 'finished' ? t.diagnosticsFinished
              : diagnosticsFeedback === 'failed' ? t.diagnosticsFailed : null}
            {copyState === 'success' && (
              <span className="ml-2 inline-flex items-center gap-1 text-accent-green"><CheckCircle2 size={12} />{t.reportCopySuccess}</span>
            )}
            {copyState === 'error' && (
              <span className="ml-2 text-accent-red">{t.reportCopyFailed}</span>
            )}
          </div>
          {diagnostics.isRunning && (
            <div aria-hidden="true" className="mt-2 h-0.5 overflow-hidden rounded-sm bg-bg-primary">
              <div className="h-full w-1/3 bg-accent-blue motion-safe:animate-shimmer" />
            </div>
          )}
          <div id="wirebound-diagnostic-details" hidden={!diagnosticsVisible}>
          {!diagnostics.report && !diagnostics.error && (
            <p className="mt-2 text-xs text-text-secondary">{t.diagnosticsIdle}</p>
          )}
          {diagnostics.error && (
            <p className="mt-2 break-all font-mono text-[10px] text-accent-red">
              {diagnostics.error}
            </p>
          )}
          {diagnostics.report && (
            <>
              <div className={`mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3 ${diagnostics.isRunning ? 'opacity-65' : ''}`}>
                {diagnostics.report.checks.map((check) => (
                  <div
                    key={check.id}
                    className="rounded-sm border border-border-subtle bg-bg-primary p-2.5"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`h-2 w-2 rounded-full ${
                          check.status === 'pass'
                            ? 'bg-accent-green'
                            : check.status === 'error'
                              ? 'bg-accent-red'
                              : check.status === 'warning'
                                ? 'bg-accent-yellow'
                                : 'bg-accent-blue'
                        }`}
                      />
                      <span className="text-[11px] font-semibold text-text-primary">
                        {getDiagnosticLabel(check.id, t)}
                      </span>
                    </div>
                    {check.detail && (
                      <p className="mt-1 break-words text-[10px] leading-relaxed text-text-muted">
                        {check.detail}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              {diagnostics.report.devices.length > 0 && (
                <div className="mt-3 border-t border-border-subtle pt-2">
                  <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-text-muted">
                    {t.diagnosticDevices}
                  </div>
                  {diagnostics.report.devices.map((device) => (
                    <div key={device.id} className="mt-2 rounded-sm border border-border-subtle bg-bg-primary p-2.5">
                      <div className="break-words text-xs font-semibold text-text-primary">{device.name || '--'}</div>
                      <div className="mt-2 grid gap-x-4 gap-y-1 text-[11px] text-text-secondary sm:grid-cols-2 xl:grid-cols-3">
                        <div><span className="text-text-muted">{t.deviceId}:</span> <span className="break-all font-mono">{maskDeviceId(device.id)}</span></div>
                        <div><span className="text-text-muted">{t.deviceStatus}:</span> {getDeviceStatusLabel(device.status, t)}</div>
                        <div><span className="text-text-muted">{t.diagAndroidVersion}:</span> {device.androidVersion ? `Android ${device.androidVersion} / API ${device.apiLevel ?? '?'}` : '--'}</div>
                        <div><span className="text-text-muted">{t.gnirehtetInstalled}:</span> {device.status === 'device' ? device.gnirehtetInstalled ? t.yes : t.no : '--'}</div>
                        <div><span className="text-text-muted">{t.gnirehtetActive}:</span> {device.status === 'device' ? device.gnirehtetActive ? t.yes : t.no : '--'}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <p className="mt-2 text-[9px] text-text-muted">
                {t.diagnosticsGenerated}:{' '}
                {formatUiTimestamp(diagnostics.report.generatedAt, language)}
              </p>
            </>
          )}
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-start justify-between gap-4">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
                {t.devicesLabel} ({devices.length})
              </div>
              {devices.length > 1 && (
                <p className="mt-1 max-w-2xl text-[10px] leading-relaxed text-text-muted">
                  {t.multiDeviceControlNote}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            {devices.map((device) => (
              <article key={device.id} className="rounded-sm border border-border-subtle bg-bg-surface p-3 theme-transition">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="break-words text-xs font-semibold text-text-primary">{device.name || 'Unknown'}</h3>
                    <p className="mt-1 break-all font-mono text-[10px] text-text-muted">
                      {t.deviceId}: {maskDeviceId(device.id)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={'inline-flex items-center rounded-sm border px-2 py-1 text-[10px] font-semibold ' +
                      (device.status === 'device'
                        ? 'border-accent-green/30 bg-accent-green-dim/40 text-accent-green'
                        : device.status === 'unauthorized' || device.status === 'no permissions'
                          ? 'border-accent-red/30 bg-accent-red-dim/40 text-accent-red'
                          : 'border-accent-yellow/30 bg-amber-50 text-amber-700 dark:bg-yellow-950/20 dark:text-accent-yellow')}>
                      {t.deviceStatus}: {getDeviceStatusLabel(device.status, t)}
                    </span>
                    <span className={'inline-flex items-center rounded-sm border px-2 py-1 text-[10px] font-semibold ' +
                      getTunnelStatusClass(device.tunnelStatus)}>
                      {t.tunnelStatus}: {getTunnelStatusLabel(device.tunnelStatus, t)}
                    </span>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle pt-2">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-text-secondary">
                    <span className="inline-flex items-center gap-1"><Battery size={12} />
                      {t.power}: {device.battery !== undefined && device.battery !== '' ? device.battery + '%' : '--'}
                    </span>
                    <span title={device.traffic ? device.traffic.interfaceName + ' kernel counters' : t.trafficUnavailable}
                      className="font-mono">
                      RX {formatBytes(device.traffic?.rxBytes)} / TX {formatBytes(device.traffic?.txBytes)}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button type="button" onClick={() => void handleDeviceTunnelAction(device)}
                      disabled={device.status !== 'device' || (!isRunning && !isConnecting) || deviceActionId === device.id}
                      className={'inline-flex items-center gap-1.5 rounded-sm border px-2.5 py-1.5 text-[10px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus disabled:cursor-not-allowed disabled:opacity-40 ' +
                        (device.tunnelStatus === 'connected'
                          ? 'border-accent-red/30 bg-accent-red-dim/20 text-accent-red hover:bg-accent-red-dim/40'
                          : 'border-accent-blue/30 bg-accent-blue/10 text-accent-blue hover:bg-accent-blue/15')}>
                      {device.tunnelStatus === 'connected' ? <Unplug size={12} /> : <Link2 size={12} />}
                      {deviceActionId === device.id ? t.deviceActionWorking
                        : device.tunnelStatus === 'connected' ? t.disconnectDevice : t.retryDevice}
                    </button>
                    <button type="button" onClick={() => handleOpenDeviceSpeedTest(device.id)}
                      disabled={device.tunnelStatus !== 'connected'}
                      className="inline-flex items-center gap-1.5 rounded-sm border border-border-subtle bg-bg-primary px-2.5 py-1.5 text-[10px] font-medium text-text-secondary transition-colors hover:border-accent-blue/50 hover:text-accent-blue focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus disabled:cursor-not-allowed disabled:opacity-40">
                      <Zap size={12} />
                      {t.testDeviceSpeed}
                    </button>
                  </div>
                </div>
              </article>
            ))}
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
              disabled={logs.length === 0}
              title={logs.length === 0 ? t.noLogsToClear : t.clear}
              className="text-[10px] font-bold uppercase text-text-muted transition-colors hover:text-accent-red disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-text-muted"
            >
              {t.clear}
            </button>
          </div>
          <div ref={logViewportRef} onScroll={handleLogScroll} className="custom-scrollbar h-48 overflow-y-auto rounded-sm border border-border-subtle bg-bg-primary p-3 font-mono text-[10px]">
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

              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
