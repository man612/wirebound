import { useMemo, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import CustomSelect from '../ui/CustomSelect'
import icon from '../../assets/icon.png'
import type { AppSettings } from '../../../../shared/types'
import type { Translation } from '../../i18n'

interface SettingsProps {
  settings: AppSettings
  updateSettings: (newSettings: Partial<AppSettings>) => Promise<void>
  version: string
  t: Translation
}

function isValidIpv4(value: string): boolean {
  const parts = value.trim().split('.')
  return (
    parts.length === 4 &&
    parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) >= 0 && Number(part) <= 255)
  )
}

function isValidPort(value: string): boolean {
  if (!/^\d+$/.test(value.trim())) return false
  const port = Number(value)
  return Number.isInteger(port) && port >= 1 && port <= 65535
}

export default function Settings({
  settings,
  updateSettings,
  version,
  t
}: SettingsProps): React.JSX.Element {
  const [customDnsDraft, setCustomDnsDraft] = useState(settings.customDns)
  const [portDraft, setPortDraft] = useState(settings.port)

  const customDnsInvalid = useMemo(
    () =>
      settings.dns === 'custom' && customDnsDraft.trim().length > 0 && !isValidIpv4(customDnsDraft),
    [customDnsDraft, settings.dns]
  )
  const portInvalid = useMemo(() => !isValidPort(portDraft), [portDraft])

  const update = (delta: Partial<AppSettings>): void => {
    void updateSettings(delta)
  }

  const commitCustomDns = (): void => {
    const value = customDnsDraft.trim()
    if (!value || !isValidIpv4(value)) {
      setCustomDnsDraft(settings.customDns)
      return
    }
    setCustomDnsDraft(value)
    update({ customDns: value })
  }

  const commitPort = (): void => {
    if (!isValidPort(portDraft)) {
      setPortDraft(settings.port)
      return
    }
    const value = String(Number(portDraft))
    setPortDraft(value)
    update({ port: value })
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-bg-surface theme-transition animate-page-enter">
      <div className="shrink-0 border-b border-border-subtle px-4 py-2 theme-transition">
        <div className="text-xs text-text-muted">
          Wirebound <span className="mx-1">/</span>
          <span className="text-text-primary">{t.settings}</span>
        </div>
      </div>

      <div className="custom-scrollbar max-w-3xl overflow-y-auto p-4 pb-12">
        <div className="mb-4 rounded-sm border border-border-subtle bg-bg-surface theme-transition animate-fade-slide-up">
          <div className="border-b border-border-subtle bg-bg-primary px-4 py-2 theme-transition">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
              {t.networkConfig}
            </h3>
          </div>

          <div className="space-y-4 p-4 text-sm">
            <div className="group relative z-20 flex items-center justify-between gap-6">
              <div>
                <div className="text-text-primary transition-colors group-hover:text-accent-blue">
                  {t.dnsProvider}
                </div>
                <div className="text-xs text-text-muted">{t.dnsDesc}</div>
              </div>
              <CustomSelect
                value={settings.dns}
                onChange={(value) => update({ dns: value })}
                options={[
                  { value: '8.8.8.8', label: 'Google (8.8.8.8)' },
                  { value: '1.1.1.1', label: 'Cloudflare (1.1.1.1)' },
                  { value: 'custom', label: `${t.customIp}...` }
                ]}
              />
            </div>

            <div
              className={`grid transition-all duration-300 ${
                settings.dns === 'custom'
                  ? 'mt-4 grid-rows-[1fr] opacity-100'
                  : 'mt-0 grid-rows-[0fr] opacity-0'
              }`}
            >
              <div className="overflow-hidden">
                <div className="flex items-start justify-between gap-6 border-t border-border-subtle pt-4">
                  <div>
                    <div className="text-text-secondary">{t.customIp}</div>
                    {customDnsInvalid && (
                      <div className="mt-1 text-[11px] text-accent-red">{t.customDnsInvalid}</div>
                    )}
                  </div>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="9.9.9.9"
                    value={customDnsDraft}
                    aria-invalid={customDnsInvalid}
                    onChange={(event) => setCustomDnsDraft(event.target.value)}
                    onBlur={commitCustomDns}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') event.currentTarget.blur()
                    }}
                    className={`h-8 w-48 rounded-sm border bg-bg-primary px-2 py-1 font-mono text-sm text-text-primary outline-none transition-all ${
                      customDnsInvalid
                        ? 'border-accent-red focus:ring-1 focus:ring-accent-red/50'
                        : 'border-border-subtle focus:border-accent-blue focus:ring-1 focus:ring-accent-blue/50'
                    }`}
                  />
                </div>
              </div>
            </div>

            <div className="group flex items-start justify-between gap-6 border-t border-border-subtle pt-4">
              <div>
                <div className="text-text-primary transition-colors group-hover:text-accent-blue">
                  {t.relayPort}
                </div>
                <div className="text-xs text-text-muted">{t.portDesc}</div>
                {portInvalid && (
                  <div className="mt-1 text-[11px] text-accent-red">{t.portInvalid}</div>
                )}
              </div>
              <input
                type="text"
                inputMode="numeric"
                placeholder="31416"
                value={portDraft}
                aria-invalid={portInvalid}
                onChange={(event) => setPortDraft(event.target.value)}
                onBlur={commitPort}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') event.currentTarget.blur()
                }}
                className={`h-8 w-24 rounded-sm border bg-bg-primary px-2 py-1 text-center font-mono text-sm text-text-primary outline-none transition-all ${
                  portInvalid
                    ? 'border-accent-red focus:ring-1 focus:ring-accent-red/50'
                    : 'border-border-subtle focus:border-accent-blue focus:ring-1 focus:ring-accent-blue/50'
                }`}
              />
            </div>

            <div className="group flex items-center justify-between gap-6 border-t border-border-subtle pt-4">
              <div>
                <div className="text-text-primary transition-colors group-hover:text-accent-blue">
                  {t.autoStartLabel}
                </div>
                <div className="text-xs text-text-muted">{t.autoStartDesc}</div>
              </div>
              <label className="relative inline-flex cursor-pointer items-center transition-transform active:scale-95">
                <input
                  type="checkbox"
                  checked={settings.autoStart}
                  onChange={(event) => update({ autoStart: event.target.checked })}
                  className="peer sr-only"
                />
                <div className="peer h-4 w-8 rounded-sm bg-bg-hover shadow-inner after:absolute after:left-[2px] after:top-[2px] after:h-3 after:w-3.5 after:rounded-sm after:bg-white after:content-[''] after:transition-all peer-checked:bg-accent-blue peer-checked:after:translate-x-full" />
              </label>
            </div>
          </div>
        </div>

        <div className="rounded-sm border border-border-subtle bg-bg-surface theme-transition animate-fade-slide-up">
          <div className="border-b border-border-subtle bg-bg-primary px-4 py-2 theme-transition">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
              {t.environment}
            </h3>
          </div>

          <div className="relative z-10 space-y-4 p-4 text-sm">
            <div className="group flex items-center justify-between gap-6">
              <div>
                <div className="text-text-primary transition-colors group-hover:text-accent-yellow">
                  {t.themeLabel}
                </div>
                <div className="text-xs text-text-muted">{t.themeDesc}</div>
              </div>
              <div className="flex rounded-sm border border-border-subtle bg-bg-primary p-0.5 theme-transition">
                <button
                  onClick={() => update({ theme: 'light' })}
                  className={`flex items-center gap-1.5 rounded-sm border px-3 py-1 text-xs font-medium transition-all ${
                    settings.theme === 'light'
                      ? 'border-border-subtle bg-bg-surface text-text-primary shadow-sm'
                      : 'border-transparent text-text-muted hover:text-text-secondary'
                  }`}
                >
                  <Sun
                    size={12}
                    className={settings.theme === 'light' ? 'text-accent-yellow' : ''}
                  />
                  {t.lightTheme}
                </button>
                <button
                  onClick={() => update({ theme: 'dark' })}
                  className={`flex items-center gap-1.5 rounded-sm border px-3 py-1 text-xs font-medium transition-all ${
                    settings.theme === 'dark'
                      ? 'border-border-subtle bg-bg-hover text-text-primary shadow-sm'
                      : 'border-transparent text-text-muted hover:text-text-secondary'
                  }`}
                >
                  <Moon size={12} className={settings.theme === 'dark' ? 'text-accent-blue' : ''} />
                  {t.darkTheme}
                </button>
              </div>
            </div>

            <div className="group flex items-center justify-between gap-6 border-t border-border-subtle pt-4">
              <div className="text-text-primary transition-colors group-hover:text-accent-blue">
                {t.langLabel}
              </div>
              <CustomSelect
                value={settings.language}
                onChange={(value) => update({ language: value as AppSettings['language'] })}
                options={[
                  { value: 'en', label: 'English' },
                  { value: 'id', label: 'Bahasa Indonesia' }
                ]}
              />
            </div>
          </div>
        </div>

        <div className="mt-8 border-t border-border-subtle pb-4 pt-8 animate-fade-slide-up">
          <div className="flex items-start gap-4">
            <img src={icon} alt="Wirebound" className="h-12 w-12 rounded-xl shadow-sm" />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-text-primary">Wirebound</h2>
                <span className="rounded-sm bg-bg-hover px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-widest text-text-muted">
                  {version ? `v${version}` : '...'}
                </span>
              </div>
              <p className="mt-1 text-[11px] leading-tight text-text-secondary">{t.creditsDesc}</p>

              <div className="mt-3 flex items-center gap-4">
                <div className="flex flex-col">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-text-muted">
                    {t.developer}
                  </span>
                  <span className="mt-1 text-xs font-semibold leading-none text-text-primary">
                    Yasman
                  </span>
                </div>
                <div className="h-6 w-px bg-border-subtle" />
                <button
                  onClick={() =>
                    void window.api.openExternal('https://github.com/man612/wirebound')
                  }
                  className="group flex flex-col text-left transition-transform active:scale-95"
                >
                  <span className="text-[9px] font-bold uppercase tracking-wider text-text-muted transition-colors group-hover:text-accent-blue">
                    GitHub
                  </span>
                  <span className="mt-1 text-xs font-semibold leading-none text-text-primary transition-colors group-hover:text-accent-blue">
                    Source Code
                  </span>
                </button>
              </div>
            </div>
          </div>

          <div className="mt-8 text-[10px] font-semibold uppercase tracking-widest text-text-secondary">
            © 2026 Yasman · Apache-2.0
          </div>
        </div>
      </div>
    </div>
  )
}
