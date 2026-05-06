import { Sun, Moon } from 'lucide-react'
import CustomSelect from '../ui/CustomSelect'
import icon from '../../assets/icon.png'

interface SettingsProps {
  settings: any
  updateSettings: (newSettings: any) => void
  t: any
}


export default function Settings({ settings, updateSettings, t }: SettingsProps) {
  const update = (delta: any) => updateSettings(delta)

  return (
    <div className="flex flex-col h-full overflow-hidden bg-bg-surface theme-transition animate-page-enter">

      <div className="px-4 py-2 border-b border-border-subtle shrink-0 theme-transition">
        <div className="text-xs text-text-muted">Wirebound <span className="mx-1">/</span> <span className="text-text-primary">{t.settings}</span></div>
      </div>
      
      <div className="p-4 overflow-y-auto max-w-3xl pb-12 custom-scrollbar">
        
        {/* Network Configuration */}
        <div className="border border-border-subtle bg-bg-surface rounded-sm mb-4 theme-transition animate-fade-slide-up">
          <div className="px-4 py-2 border-b border-border-subtle bg-bg-primary theme-transition">
            <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">{t.networkConfig}</h3>
          </div>
          
          <div className="p-4 space-y-4 text-sm">
            <div className="flex items-center justify-between group relative z-20">
              <div>
                <div className="text-text-primary transition-colors duration-200 group-hover:text-accent-blue">{t.dnsProvider}</div>
                <div className="text-xs text-text-muted">{t.dnsDesc}</div>
              </div>
              <CustomSelect 
                value={settings.dns}
                onChange={(val) => update({ dns: val })}
                options={[
                  { value: '8.8.8.8', label: 'Google (8.8.8.8)' },
                  { value: '1.1.1.1', label: 'Cloudflare (1.1.1.1)' },
                  { value: 'custom', label: t.customIp + '...' }
                ]}
              />
            </div>

            <div className={`grid transition-all duration-300 ease-in-out ${settings.dns === 'custom' ? 'grid-rows-[1fr] opacity-100 mt-4' : 'grid-rows-[0fr] opacity-0 mt-0'}`}>
              <div className="overflow-hidden">
                <div className="flex items-center justify-between pt-4 border-t border-border-subtle">
                  <div className="text-text-secondary">{t.customIp}</div>
                  <input 
                    type="text" 
                    placeholder="e.g. 9.9.9.9"
                    value={settings.customDns}
                    onChange={(e) => update({ customDns: e.target.value })}
                    className="bg-bg-primary border border-border-subtle text-text-primary px-2 py-1 h-8 rounded-sm w-48 outline-none focus:border-accent-blue focus:ring-1 focus:ring-accent-blue/50 font-mono text-sm transition-all duration-200 shadow-sm placeholder:text-text-muted"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-border-subtle group">
              <div>
                <div className="text-text-primary transition-colors duration-200 group-hover:text-accent-blue">{t.relayPort}</div>
                <div className="text-xs text-text-muted">{t.portDesc}</div>
              </div>
              <input 
                type="text" 
                placeholder="31416"
                value={settings.port}
                onChange={(e) => update({ port: e.target.value })}
                className="bg-bg-primary border border-border-subtle text-text-primary px-2 py-1 h-8 rounded-sm w-24 text-center outline-none focus:border-accent-blue focus:ring-1 focus:ring-accent-blue/50 font-mono text-sm transition-all duration-200 shadow-sm"
              />
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-border-subtle group">
              <div>
                <div className="text-text-primary transition-colors duration-200 group-hover:text-accent-blue">{t.autoStartLabel}</div>
                <div className="text-xs text-text-muted">{t.autoStartDesc}</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer active:scale-95 transition-transform duration-200">
                <input 
                  type="checkbox" 
                  checked={settings.autoStart}
                  onChange={(e) => update({ autoStart: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-8 h-4 bg-bg-hover peer-focus:outline-none rounded-sm peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white dark:after:bg-zinc-400 peer-checked:after:bg-white after:border-none after:rounded-sm after:h-3 after:w-3.5 after:transition-all after:duration-300 peer-checked:bg-accent-blue shadow-inner"></div>
              </label>
            </div>
          </div>
        </div>

        {/* Environment */}
        <div className="border border-border-subtle bg-bg-surface rounded-sm theme-transition animate-fade-slide-up">
          <div className="px-4 py-2 border-b border-border-subtle bg-bg-primary theme-transition">
            <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">{t.environment}</h3>
          </div>
          
          <div className="p-4 space-y-4 text-sm relative z-10">
            <div className="flex items-center justify-between group">
              <div>
                <div className="text-text-primary transition-colors duration-200 group-hover:text-accent-yellow">{t.themeLabel}</div>
                <div className="text-xs text-text-muted">{t.themeDesc}</div>
              </div>
              <div className="flex bg-bg-primary border border-border-subtle rounded-sm p-0.5 theme-transition">
                <button 
                  onClick={() => update({ theme: 'light' })}
                  className={`group/btn flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-sm transition-all duration-200 active:scale-[0.95] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue ${settings.theme === 'light' ? 'bg-bg-surface text-text-primary shadow-sm border border-border-subtle' : 'text-text-muted hover:text-text-secondary border border-transparent'}`}
                >
                  <Sun size={12} className={`transition-transform duration-300 ${settings.theme === 'light' ? 'text-accent-yellow' : 'group-hover/btn:rotate-45'}`} /> {t.lightTheme}
                </button>
                <button 
                  onClick={() => update({ theme: 'dark' })}
                  className={`group/btn flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-sm transition-all duration-200 active:scale-[0.95] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue ${settings.theme === 'dark' ? 'bg-bg-hover text-text-primary shadow-sm border border-border-subtle' : 'text-text-muted hover:text-text-secondary border border-transparent'}`}
                >
                  <Moon size={12} className={`transition-transform duration-300 ${settings.theme === 'dark' ? 'text-accent-blue' : 'group-hover/btn:-rotate-12'}`} /> {t.darkTheme}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-border-subtle group">
              <div>
                <div className="text-text-primary transition-colors duration-200 group-hover:text-accent-blue">{t.langLabel}</div>
              </div>
              <CustomSelect 
                value={settings.language}
                onChange={(val) => update({ language: val })}
                options={[
                  { value: 'en', label: 'English' },
                  { value: 'id', label: 'Bahasa Indonesia' }
                ]}
              />
            </div>
          </div>
        </div>

        {/* About Section */}
        <div className="mt-8 border-t border-border-subtle pt-8 animate-fade-slide-up pb-4">
          <div className="flex items-start gap-4">
            <img src={icon} alt="Wirebound Icon" className="w-12 h-12 rounded-xl shadow-sm" />
            
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-text-primary">Wirebound</h2>
                <span className="text-[10px] bg-bg-hover text-text-muted px-1.5 py-0.5 rounded-sm font-mono uppercase tracking-widest">v1.0.0</span>
              </div>
              
              <p className="text-[11px] text-text-secondary mt-1 leading-tight">
                {t.creditsDesc}
              </p>

              <div className="flex items-center gap-4 mt-3">
                <div className="flex flex-col">
                  <span className="text-[9px] font-bold text-text-muted uppercase tracking-wider">{t.developer}</span>
                  <span className="text-xs font-semibold text-text-primary leading-none mt-1">Yasman</span>
                </div>
                <div className="w-px h-6 bg-border-subtle"></div>
                <button 
                  onClick={() => window.open('https://github.com/man612/wirebound', '_blank')}
                  className="group flex flex-col text-left active:scale-95 transition-transform duration-200"
                >
                  <span className="text-[9px] font-bold text-text-muted uppercase tracking-wider group-hover:text-accent-blue transition-colors">GitHub</span>
                  <span className="text-xs font-semibold text-text-primary group-hover:text-accent-blue transition-colors leading-none mt-1">Source Code</span>
                </button>
              </div>
            </div>
          </div>
          
          <div className="mt-8 text-[9px] text-text-muted opacity-40 uppercase tracking-widest font-medium">
            &copy; 2026 Yasman. All Rights Reserved.
          </div>
        </div>

      </div>
    </div>
  )
}
