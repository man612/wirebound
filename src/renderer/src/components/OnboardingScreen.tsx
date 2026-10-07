import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Moon,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Sun,
  Usb
} from 'lucide-react'
import type { AdbDevice, DiagnosticCheckId, DiagnosticReport } from '../../../shared/types'
import type { Language, Translation } from '../i18n'
import { translations } from '../i18n'

interface OnboardingProps {
  onComplete: (lang: Language, theme: 'light' | 'dark') => Promise<void>
  devices: AdbDevice[]
  adbError?: string
  diagnostics: {
    report?: DiagnosticReport
    isRunning: boolean
    error?: string
    run: () => Promise<void>
  }
}

type OnboardingStep = 'appearance' | 'device' | 'preflight'

function getDiagnosticLabel(id: DiagnosticCheckId, t: Translation): string {
  if (id === 'adbRuntime') return t.diagAdbRuntime
  if (id === 'gnirehtetRuntime') return t.diagGnirehtetRuntime
  if (id === 'adbQuery') return t.diagAdbQuery
  if (id === 'deviceAccess') return t.diagDeviceAccess
  if (id === 'androidVersion') return t.diagAndroidVersion
  return t.diagGnirehtetClient
}

function getDeviceMessage(devices: AdbDevice[], adbError: string | undefined, t: Translation): {
  title: string
  description: string
  tone: 'ready' | 'warning' | 'error'
} {
  if (adbError) {
    return { title: t.setupAdbErrorTitle, description: t.setupAdbErrorDesc, tone: 'error' }
  }

  if (devices.some((device) => device.status === 'device')) {
    return { title: t.onboardingDeviceReadyTitle, description: t.onboardingDeviceReadyDesc, tone: 'ready' }
  }

  if (devices.some((device) => device.status === 'unauthorized')) {
    return {
      title: t.setupUnauthorizedTitle,
      description: t.setupUnauthorizedDesc,
      tone: 'warning'
    }
  }

  if (devices.some((device) => device.status === 'offline')) {
    return { title: t.setupOfflineTitle, description: t.setupOfflineDesc, tone: 'warning' }
  }

  if (devices.some((device) => device.status === 'no permissions')) {
    return {
      title: t.setupNoPermissionsTitle,
      description: t.setupNoPermissionsDesc,
      tone: 'error'
    }
  }

  return { title: t.setupNoDeviceTitle, description: t.setupNoDeviceDesc, tone: 'warning' }
}

export default function OnboardingScreen({
  onComplete,
  devices,
  adbError,
  diagnostics
}: OnboardingProps): React.JSX.Element {
  const [lang, setLang] = useState<Language>('en')
  const [theme, setTheme] = useState<'light' | 'dark'>('dark')
  const [step, setStep] = useState<OnboardingStep>('appearance')
  const t = useMemo(() => translations[lang], [lang])

  const deviceMessage = getDeviceMessage(devices, adbError, t)
  const readyDevice = devices.some((device) => device.status === 'device')
  const blockingDiagnostic = diagnostics.report?.checks.some(
    (check) =>
      (check.id === 'adbRuntime' || check.id === 'gnirehtetRuntime' || check.id === 'adbQuery') &&
      check.status === 'error'
  )
  const preflightReady =
    readyDevice &&
    !adbError &&
    Boolean(diagnostics.report) &&
    !blockingDiagnostic &&
    !diagnostics.error &&
    !diagnostics.isRunning

  useEffect(() => {
    if (step === 'preflight' && !diagnostics.report && !diagnostics.isRunning && !diagnostics.error) {
      void diagnostics.run()
    }
  }, [step, diagnostics.report, diagnostics.isRunning, diagnostics.error, diagnostics.run])

  const stepIndex = step === 'appearance' ? 0 : step === 'device' ? 1 : 2
  const relevantChecks = diagnostics.report?.checks.filter((check) =>
    ['adbRuntime', 'gnirehtetRuntime', 'adbQuery', 'deviceAccess'].includes(check.id)
  )

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm transition-opacity duration-300">
      <div className="flex w-[500px] max-w-[calc(100vw-32px)] flex-col rounded-sm border border-border-subtle bg-bg-surface shadow-2xl animate-modal-enter theme-transition">
        <div className="flex items-center gap-3 border-b border-border-subtle bg-bg-primary px-6 py-4 theme-transition">
          <ShieldCheck size={20} className="text-accent-blue" />
          <div className="min-w-0 flex-1">
            <h1 className="text-sm font-semibold text-text-primary">Wirebound Setup</h1>
            <p className="mt-0.5 text-[10px] text-text-muted">
              {t.onboardingStepLabel} {stepIndex + 1} / 3
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            {[0, 1, 2].map((index) => (
              <span
                key={index}
                className={`h-1.5 w-8 rounded-full transition-colors ${
                  index <= stepIndex ? 'bg-accent-blue' : 'bg-bg-hover'
                }`}
              />
            ))}
          </div>
        </div>

        <div className="min-h-[350px] p-6">
          {step === 'appearance' && (
            <div className="space-y-5">
              <div>
                <h2 className="text-sm font-semibold text-text-primary">{t.welcome}</h2>
                <p className="mt-1 text-sm leading-relaxed text-text-secondary">{t.onboardingDesc}</p>
              </div>

              <div>
                <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-text-muted">
                  {t.chooseLanguage}
                </div>
                <div className="space-y-1.5 rounded-sm border border-border-subtle bg-bg-primary p-2 theme-transition">
                  {([
                    ['en', 'English (US)'],
                    ['id', 'Bahasa Indonesia']
                  ] as const).map(([value, label]) => (
                    <label
                      key={value}
                      className={`group flex cursor-pointer items-center gap-3 rounded-sm border p-2.5 transition-all duration-200 active:scale-[0.99] ${
                        lang === value
                          ? 'border-accent-blue/20 bg-accent-blue/10 text-accent-blue'
                          : 'border-transparent text-text-secondary hover:bg-bg-hover'
                      }`}
                    >
                      <input
                        type="radio"
                        name="lang"
                        checked={lang === value}
                        onChange={() => setLang(value)}
                        className="hidden"
                      />
                      <span
                        className={`flex h-3.5 w-3.5 items-center justify-center rounded-full border transition-colors duration-200 ${
                          lang === value
                            ? 'border-accent-blue'
                            : 'border-border-subtle group-hover:border-accent-blue'
                        }`}
                      >
                        {lang === value && <span className="h-1.5 w-1.5 rounded-full bg-accent-blue" />}
                      </span>
                      <span className="text-sm font-medium">{label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-text-muted">
                  {t.chooseTheme}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setTheme('light')}
                    className={`flex items-center justify-center gap-2 rounded-sm border px-3 py-2 text-sm transition-all duration-200 ${
                      theme === 'light'
                        ? 'border-accent-blue/30 bg-accent-blue/10 text-accent-blue'
                        : 'border-border-subtle bg-bg-primary text-text-secondary hover:bg-bg-hover'
                    }`}
                  >
                    <Sun size={14} />
                    {t.lightTheme}
                  </button>
                  <button
                    onClick={() => setTheme('dark')}
                    className={`flex items-center justify-center gap-2 rounded-sm border px-3 py-2 text-sm transition-all duration-200 ${
                      theme === 'dark'
                        ? 'border-accent-blue/30 bg-accent-blue/10 text-accent-blue'
                        : 'border-border-subtle bg-bg-primary text-text-secondary hover:bg-bg-hover'
                    }`}
                  >
                    <Moon size={14} />
                    {t.darkTheme}
                  </button>
                </div>
              </div>
            </div>
          )}

          {step === 'device' && (
            <div className="space-y-4">
              <div>
                <h2 className="text-sm font-semibold text-text-primary">{t.onboardingConnectTitle}</h2>
                <p className="mt-1 text-sm leading-relaxed text-text-secondary">
                  {t.onboardingConnectDesc}
                </p>
              </div>

              <div className="space-y-2 rounded-sm border border-border-subtle bg-bg-primary p-4">
                {[
                  [Usb, t.onboardingChecklistUsb],
                  [Smartphone, t.onboardingChecklistDebugging],
                  [ShieldCheck, t.onboardingChecklistAuthorize]
                ].map(([Icon, label], index) => (
                  <div key={index} className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-sm border border-border-subtle bg-bg-surface text-accent-blue">
                      <Icon size={13} />
                    </div>
                    <p className="pt-1 text-xs leading-relaxed text-text-secondary">{label as string}</p>
                  </div>
                ))}
              </div>

              <div className="rounded-sm border border-accent-blue/20 bg-accent-blue/5 p-3">
                <p className="text-xs leading-relaxed text-text-secondary">{t.onboardingVpnNote}</p>
              </div>
            </div>
          )}

          {step === 'preflight' && (
            <div className="space-y-4">
              <div>
                <h2 className="text-sm font-semibold text-text-primary">{t.onboardingPreflightTitle}</h2>
                <p className="mt-1 text-sm leading-relaxed text-text-secondary">
                  {t.onboardingPreflightDesc}
                </p>
              </div>

              <div
                className={`rounded-sm border p-3 ${
                  deviceMessage.tone === 'ready'
                    ? 'border-accent-green/30 bg-accent-green-dim/30'
                    : deviceMessage.tone === 'error'
                      ? 'border-accent-red/30 bg-accent-red-dim/30'
                      : 'border-accent-yellow/30 bg-amber-50 dark:bg-yellow-950/20'
                }`}
              >
                <div className="flex items-start gap-3">
                  {deviceMessage.tone === 'ready' ? (
                    <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-accent-green" />
                  ) : (
                    <AlertTriangle
                      size={18}
                      className={`mt-0.5 shrink-0 ${
                        deviceMessage.tone === 'error' ? 'text-accent-red' : 'text-accent-yellow'
                      }`}
                    />
                  )}
                  <div>
                    <div className="text-xs font-semibold text-text-primary">{deviceMessage.title}</div>
                    <p className="mt-1 text-xs leading-relaxed text-text-secondary">
                      {deviceMessage.description}
                    </p>
                    {adbError && (
                      <p className="mt-1 break-all font-mono text-[10px] text-accent-red/80">
                        {adbError}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="rounded-sm border border-border-subtle bg-bg-primary p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
                    {t.onboardingSystemChecks}
                  </div>
                  <button
                    onClick={() => void diagnostics.run()}
                    disabled={diagnostics.isRunning}
                    className="inline-flex items-center gap-1.5 rounded-sm border border-border-subtle bg-bg-surface px-2 py-1 text-[10px] font-medium text-text-secondary transition-colors hover:text-accent-blue disabled:opacity-50"
                  >
                    <RefreshCw size={11} className={diagnostics.isRunning ? 'animate-spin' : ''} />
                    {t.onboardingRefresh}
                  </button>
                </div>

                {diagnostics.isRunning && (
                  <p className="text-xs text-text-secondary">{t.onboardingChecking}</p>
                )}
                {diagnostics.error && (
                  <p className="break-all font-mono text-[10px] text-accent-red">{diagnostics.error}</p>
                )}
                {!diagnostics.isRunning && relevantChecks && (
                  <div className="space-y-1.5">
                    {relevantChecks.map((check) => (
                      <div key={check.id} className="flex items-center gap-2 text-xs">
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
                        <span className="text-text-secondary">{getDiagnosticLabel(check.id, t)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <p className="text-[11px] leading-relaxed text-text-muted">
                {preflightReady ? t.onboardingReadyToFinish : t.onboardingNotReadyYet}
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-border-subtle bg-bg-primary px-6 py-4 theme-transition">
          <button
            onClick={() =>
              setStep(step === 'preflight' ? 'device' : step === 'device' ? 'appearance' : 'appearance')
            }
            disabled={step === 'appearance'}
            className="inline-flex items-center gap-1.5 rounded-sm border border-border-subtle bg-bg-surface px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-bg-hover disabled:cursor-not-allowed disabled:opacity-0"
          >
            <ChevronLeft size={13} />
            {t.onboardingBack}
          </button>

          {step !== 'preflight' ? (
            <button
              onClick={() => setStep(step === 'appearance' ? 'device' : 'preflight')}
              className="inline-flex items-center gap-1.5 rounded-sm bg-accent-blue px-5 py-1.5 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:opacity-90 active:scale-[0.96]"
            >
              {t.next}
              <ChevronRight size={14} />
            </button>
          ) : (
            <button
              onClick={() => void onComplete(lang, theme)}
              disabled={!preflightReady}
              className="rounded-sm bg-accent-blue px-6 py-1.5 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:opacity-90 active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {t.getStarted}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
