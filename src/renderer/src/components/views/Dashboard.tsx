import { useEffect, useRef, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCopy,
  ChevronRight,
  X,
  Download,
  Laptop,
  Play,
  RefreshCw,
  ShieldAlert,
  Square as StopSquare,
  Stethoscope,
  Usb
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type {
  AdbDevice,
  ConnectionStatus,
  DiagnosticCheckId,
  DiagnosticReport,
  LogEntry
} from '../../../../shared/types'
import type { Language, Translation } from '../../i18n'
import { formatUiTimestamp, maskDeviceId } from '../../formatters'
import { hasFailedDiagnosticChecks } from './diagnosticsDisclosure'
import DeviceRow from './DeviceRow'
import TerminalLog from './TerminalLog'
import ConfirmDialog from '../ui/ConfirmDialog'
import Tooltip from '../ui/Tooltip'

let dashboardHasMountedOnce = false

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
    progress: { completed: number; total: number }
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
  const collapseTimerRef = useRef<number | null>(null)
  const copyTimerRef = useRef<number | null>(null)
  const manuallyToggledRef = useRef(false)
  const rerunLockRef = useRef(false)
  const acknowledgedRerunRef = useRef(0)
  const initialRevealScheduledRef = useRef(false)
  const [diagnosticsExpanded, setDiagnosticsExpanded] = useState(() => {
    const initial = typeof window === 'undefined' || !dashboardHasMountedOnce
    dashboardHasMountedOnce = true
    return initial
  })
  const [diagnosticsManuallyToggled, setDiagnosticsManuallyToggled] = useState(false)
  const [diagnosticsFeedback, setDiagnosticsFeedback] = useState<'running' | 'finished' | 'failed' | 'issues' | null>(null)
  const [rerunCycle, setRerunCycle] = useState(0)
  const [copyState, setCopyState] = useState<'idle' | 'copying' | 'success' | 'error'>('idle')
  const [reportExported, setReportExported] = useState(false)
  const [speedWarningDevice, setSpeedWarningDevice] = useState<string | null>(null)
  const [progressBarVisible, setProgressBarVisible] = useState(false)
  const [feedbackExiting, setFeedbackExiting] = useState(false)
  const progressHideTimerRef = useRef<number | null>(null)
  const messageTimerRef = useRef<number | null>(null)
  const deviceActionLockRef = useRef<Set<string>>(new Set())
  const [deviceActionIds, setDeviceActionIds] = useState<Set<string>>(() => new Set())
  const [deviceActionErrors, setDeviceActionErrors] = useState<Record<string, boolean>>({})
  const [readyDismissed, setReadyDismissed] = useState(false)
  const hasFailedChecks = hasFailedDiagnosticChecks(diagnostics.report)
  const checkCount = diagnostics.report?.checks.filter(check => check.status !== 'info').length ?? 0
  const passedCount = diagnostics.report?.checks.filter(check => check.status === 'pass').length ?? 0
  const infoCount = diagnostics.report?.checks.filter(check => check.status === 'info').length ?? 0
  const statusMessageVisible = diagnostics.isRunning || diagnosticsFeedback !== null || copyState === 'success' || copyState === 'error'
  const progressPercent = diagnostics.progress.total > 0
    ? Math.round(100 * diagnostics.progress.completed / diagnostics.progress.total) : 0
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
    // An executed scan may complete successfully yet report an actual failed
    // runtime/ADB check; do not hide those details automatically.
    if (diagnostics.error || hasFailedChecks || manuallyToggledRef.current) return

    collapseTimerRef.current = window.setTimeout(() => {
      if (!manuallyToggledRef.current) setDiagnosticsExpanded(false)
      collapseTimerRef.current = null
    }, 2600)
  }, [diagnostics.report, diagnostics.isRunning, diagnostics.error, hasFailedChecks])

  useEffect(() => () => {
    if (collapseTimerRef.current !== null) window.clearTimeout(collapseTimerRef.current)
    if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current)
    if (progressHideTimerRef.current !== null) window.clearTimeout(progressHideTimerRef.current)
    if (messageTimerRef.current !== null) window.clearTimeout(messageTimerRef.current)
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
    setDiagnosticsFeedback(failed ? 'failed' : hasFailedChecks ? 'issues' : 'finished')
    setFeedbackExiting(false)
    if (progressHideTimerRef.current !== null) window.clearTimeout(progressHideTimerRef.current)
    progressHideTimerRef.current = window.setTimeout(() => setProgressBarVisible(false), 900)
    if (messageTimerRef.current !== null) window.clearTimeout(messageTimerRef.current)
    messageTimerRef.current = window.setTimeout(() => {
      setFeedbackExiting(true)
      messageTimerRef.current = window.setTimeout(() => setDiagnosticsFeedback(null), 300)
    }, 2200)
    if (!failed && !hasFailedChecks && !manuallyToggledRef.current) {
      if (collapseTimerRef.current !== null) window.clearTimeout(collapseTimerRef.current)
      collapseTimerRef.current = window.setTimeout(() => {
        if (!manuallyToggledRef.current) setDiagnosticsExpanded(false)
        collapseTimerRef.current = null
      }, 2600)
    }
  }, [rerunCycle, diagnostics.error, hasFailedChecks])

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
    setFeedbackExiting(false)
    if (progressHideTimerRef.current !== null) window.clearTimeout(progressHideTimerRef.current)
    if (messageTimerRef.current !== null) window.clearTimeout(messageTimerRef.current)
    setProgressBarVisible(true)
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
    if (deviceActionLockRef.current.has(device.id)) return
    deviceActionLockRef.current.add(device.id)
    setDeviceActionIds(new Set(deviceActionLockRef.current))
    setDeviceActionErrors((previous) => ({ ...previous, [device.id]: false }))

    try {
      const result =
        device.tunnelStatus === 'connected'
          ? await window.api.stopDeviceTunnel(device.id)
          : await window.api.startDeviceTunnel(device.id)

      if (!result.success) {
        // Show a localized error without exposing raw device identifiers from ADB messages.
        console.warn('Per-device tethering action failed.')
        setDeviceActionErrors((previous) => ({ ...previous, [device.id]: true }))
      }
    } catch {
      setDeviceActionErrors((previous) => ({ ...previous, [device.id]: true }))
    } finally {
      deviceActionLockRef.current.delete(device.id)
      setDeviceActionIds(new Set(deviceActionLockRef.current))
    }
  }

  const launchDeviceSpeedTest = (deviceId: string): void => {
    void window.api.testSpeedOnDevice(deviceId).then((result) => {
      if (!result.success) console.warn('Failed to open speed test on device.', result.error)
    })
  }
  const handleOpenDeviceSpeedTest = (deviceId: string): void => {
    const device = devices.find((item) => item.id === deviceId)
    if (!device || device.status !== 'device') return
    if (device.tunnelStatus !== 'connected') {
      setSpeedWarningDevice(deviceId)
    } else launchDeviceSpeedTest(deviceId)
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
            <Tooltip text={language === 'id' ? 'Buka tes kecepatan internet komputer' : 'Open the desktop internet speed test'}>
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
            </Tooltip>
            <Tooltip text={isRunning ? (language === 'id' ? 'Putuskan seluruh koneksi USB Android' : 'Stop all Android USB connections') : (language === 'id' ? 'Bagikan koneksi komputer melalui kabel USB' : 'Share desktop internet over USB')}>
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
            </Tooltip>
          </div>
        </div>

        <div className={`notice-fold ${!readyDismissed || setupState.tone !== 'ready' ? 'notice-fold-open' : 'notice-fold-closed'}`}
          aria-hidden={readyDismissed && setupState.tone === 'ready'} inert={readyDismissed && setupState.tone === 'ready'}>
        <div className="notice-fold-content">
        <div
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
        </div>
        </div>
        </div>

        <div className="rounded-sm border border-border-subtle bg-bg-surface px-3 py-2.5 theme-transition">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <Stethoscope size={14} className="shrink-0 text-accent-blue" />
              <div className="min-w-0">
                <div className="text-[11px] font-bold uppercase tracking-wider text-text-muted">{t.diagnostics}</div>
                {diagnostics.report && (
                  <p className="mt-0.5 text-[10px] text-text-secondary">
                    {passedCount}/{checkCount} {t.diagnosticsPassed}{infoCount > 0 ? ` · ${infoCount} ${language === 'id' ? 'informasi' : 'info'}` : ''}
                  </p>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-1.5">
              <button
                onClick={() => void handleCopyDiagnostics()}
                disabled={!diagnostics.report || copyState === 'copying'}
                title={t.copyReportHelp}
                className="motion-control relative inline-flex h-7 w-[112px] items-center justify-center rounded-md border border-border-subtle bg-bg-primary px-1.5 text-[10px] font-medium text-text-secondary hover:text-accent-blue disabled:cursor-not-allowed disabled:opacity-40"
              >
                <span className={`motion-label absolute inset-0 flex items-center justify-center gap-1.5 ${copyState === 'idle' || copyState === 'error' ? 'motion-label-visible' : ''}`}><ClipboardCopy size={12} />{t.copyReport}</span>
                <span className={`motion-label absolute inset-0 flex items-center justify-center gap-1.5 ${copyState === 'copying' ? 'motion-label-visible' : ''}`}><RefreshCw size={12} className="animate-spin" />{t.copyingReport}</span>
                <span className={`motion-label absolute inset-0 flex items-center justify-center gap-1.5 ${copyState === 'success' ? 'motion-label-visible' : ''}`}><CheckCircle2 size={12}/>{t.reportCopied}</span>
              </button>
              <button
                onClick={() => void handleExportDiagnostics()}
                disabled={!diagnostics.report}
                className="motion-control relative inline-flex h-7 w-[110px] items-center justify-center rounded-md border border-border-subtle bg-bg-primary px-1.5 text-[10px] font-medium text-text-secondary hover:text-accent-blue disabled:cursor-not-allowed disabled:opacity-40"
              >
                <span className={`motion-label absolute inset-0 flex items-center justify-center gap-1.5 ${!reportExported ? 'motion-label-visible' : ''}`}><Download size={12}/>{t.exportReport}</span>
                <span className={`motion-label absolute inset-0 flex items-center justify-center gap-1.5 ${reportExported ? 'motion-label-visible' : ''}`}><CheckCircle2 size={12}/>{t.reportExported}</span>
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
                className="motion-control inline-flex h-7 w-[132px] items-center justify-center gap-1 rounded-md border border-border-subtle bg-bg-primary px-2 text-[10px] font-medium text-text-secondary hover:bg-bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus">
                <ChevronRight size={13} className={`transition-transform duration-200 ${diagnosticsVisible ? 'rotate-90' : ''}`} />
                {diagnosticsVisible ? t.diagnosticsHide : t.diagnosticsShow}
              </button>
            </div>
          </div>

          <div className={`diagnostic-status-fold ${statusMessageVisible ? 'diagnostic-status-open' : ''}`}>
          <div role="status" aria-live="polite" aria-atomic="true" className="text-[11px] text-text-secondary">
            {diagnostics.isRunning || diagnosticsFeedback === 'running' ? (
              <span className="motion-feedback motion-feedback-visible inline-flex items-center gap-1.5 text-accent-blue">
                <RefreshCw size={12} className="motion-safe:animate-spin" /> {t.diagnosticsChecking}
              </span>
            ) : (
              <span className={`motion-feedback ${diagnosticsFeedback && !feedbackExiting ? 'motion-feedback-visible' : ''}`}>
                {diagnosticsFeedback === 'finished' ? t.diagnosticsFinished
                  : diagnosticsFeedback === 'issues' ? t.diagnosticsIssues
                    : diagnosticsFeedback === 'failed' ? t.diagnosticsFailed : ''}
              </span>
            )}
            <span className={`motion-feedback ml-2 inline-flex items-center gap-1 text-accent-green ${copyState === 'success' ? 'motion-feedback-visible' : ''}`} aria-hidden={copyState !== 'success'}>
              <CheckCircle2 size={12} />{t.reportCopySuccess}
            </span>
            {copyState === 'error' && (
              <span className="ml-2 text-accent-red">{t.reportCopyFailed}</span>
            )}
          </div>
          </div>
          <div className={`diagnostic-progress-shell ${diagnostics.isRunning || progressBarVisible ? 'diagnostic-progress-open' : ''}`}
            aria-hidden={!(diagnostics.isRunning || progressBarVisible)}>
            <div className="min-h-0 overflow-hidden">
              <div className="my-2 flex items-center gap-3">
              <div role="progressbar" aria-label={language === 'id' ? 'Progres diagnostik' : 'Diagnostic progress'}
                aria-valuemin={0} aria-valuemax={100} aria-valuenow={progressPercent}
                className="h-1.5 flex-1 overflow-hidden rounded-full bg-bg-hover">
                <div className="diagnostic-progress-fill h-full rounded-full bg-accent-blue"
                  style={{ width: `${progressPercent}%` }}/>
              </div>
              <span className="w-9 text-right font-mono text-[10px] tabular-nums text-accent-blue">{progressPercent}%</span>
              </div>
            </div>
          </div>
          <div id="wirebound-diagnostic-details" className={"diagnostics-fold " + (diagnosticsVisible ? "diagnostics-fold-open" : "")}
            inert={!diagnosticsVisible} aria-hidden={!diagnosticsVisible}>
            <div className="diagnostics-fold-content">
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
                <div className="mt-2 border-t border-border-subtle pt-2">
                  <div className="mb-1 text-[9px] font-bold uppercase tracking-wider text-text-muted">{t.diagnosticDevices}</div>
                  <div className="space-y-1">
                    {diagnostics.report.devices.map((device) => (
                      <div key={device.id} className="motion-row flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-border-subtle bg-bg-primary px-2.5 py-2 text-[10px]">
                        <strong className="min-w-0 flex-[1_1_150px] truncate text-text-primary" title={device.name}>{device.name || "--"}</strong>
                        <span className="text-text-secondary">{device.androidVersion ? "Android " + device.androidVersion + " · API " + (device.apiLevel ?? "?") : "--"}</span>
                        <span className="text-text-secondary">ADB {getDeviceStatusLabel(device.status, t)}</span>
                        <span className="font-mono text-text-muted">{maskDeviceId(device.id)}</span>
                        <span className="text-text-muted">{t.gnirehtetActive}: {device.gnirehtetActive ? t.yes : t.no}</span>
                      </div>
                    ))}
                  </div>
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

          <div className="space-y-1.5">
            {devices.map((device) => (
              <DeviceRow key={device.id} device={device} engineStatus={status}
                busy={deviceActionIds.has(device.id)} actionFailed={Boolean(deviceActionErrors[device.id])}
                t={t} language={language} onAction={(selected) => void handleDeviceTunnelAction(selected)}
                onSpeed={handleOpenDeviceSpeedTest}/>
            ))}
            {devices.length === 0 && (
              <div className="rounded-md border border-dashed border-border-subtle bg-bg-primary p-4 text-center text-xs text-text-muted">
                {adbError ? t.adbUnavailable : t.noDevice}
              </div>
            )}
          </div>
        </div>

        <div className="pb-5">
          <TerminalLog logs={logs} devices={devices} onClear={onClearLogs} t={t} language={language}/>
        </div>
      </div>
      <ConfirmDialog open={speedWarningDevice !== null}
        title={language === 'id' ? 'Tes kecepatan internet HP?' : 'Test the phone internet speed?'}
        message={language === 'id'
          ? 'HP belum tersambung melalui Wirebound. Fast.com akan memakai jaringan HP yang aktif, termasuk data seluler jika digunakan. Tes ini dapat menghabiskan kuota.'
          : 'This phone is not using the Wirebound tunnel. Fast.com will use its current network, including mobile data if enabled, and can consume your data allowance.'}
        cancelLabel={language === 'id' ? 'Batal' : 'Cancel'}
        confirmLabel={language === 'id' ? 'Lanjut tes' : 'Continue test'}
        onCancel={() => setSpeedWarningDevice(null)}
        onConfirm={() => { if (speedWarningDevice) launchDeviceSpeedTest(speedWarningDevice); setSpeedWarningDevice(null) }}/>
    </div>
  )
}
