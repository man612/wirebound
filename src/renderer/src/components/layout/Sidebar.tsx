import {
  Activity,
  Smartphone,
  Stethoscope,
  Terminal,
  Gauge,
  RefreshCw,
  Settings as SettingsIcon,
  Info
} from 'lucide-react'
import type { AppPage } from '../../pages'
import Tooltip from '../ui/Tooltip'
import type { Language, Translation } from '../../i18n'

interface SidebarProps {
  activePage: AppPage
  onNavigate: (page: AppPage) => void
  t: Translation
  language: Language
  version: string
}

export default function Sidebar({ activePage, onNavigate, t, language, version }: SidebarProps): React.JSX.Element {
  const id = language === 'id'
  const groups = [
    {
      title: id ? 'UTAMA' : 'WORKSPACE',
      items: [
        { page: 'dashboard', label: t.dashboard, icon: Activity, hint: id ? 'Ringkasan koneksi dan perangkat' : 'Connection and device overview' },
        { page: 'devices', label: id ? 'Perangkat' : 'Devices', icon: Smartphone, hint: id ? 'Perangkat Android yang terhubung' : 'Connected Android devices' },
        { page: 'diagnostics', label: t.diagnostics, icon: Stethoscope, hint: id ? 'Pemeriksaan koneksi dan laporan' : 'Connection checks and reports' },
        { page: 'logs', label: id ? 'Log Aktivitas' : 'Activity Logs', icon: Terminal, hint: id ? 'Log koneksi dan kesalahan' : 'Connection and error logs' }
      ]
    },
    {
      title: id ? 'ALAT' : 'TOOLS',
      items: [
        { page: 'speed', label: id ? 'Tes Kecepatan' : 'Speed Test', icon: Gauge, hint: id ? 'Akses pengujian kecepatan' : 'Speed test shortcuts' },
        { page: 'updates', label: id ? 'Pembaruan' : 'Updates', icon: RefreshCw, hint: id ? 'Status pembaruan aplikasi' : 'Application update status' }
      ]
    },
    {
      title: id ? 'APLIKASI' : 'APPLICATION',
      items: [
        { page: 'settings', label: t.settings, icon: SettingsIcon, hint: id ? 'Pengaturan aplikasi' : 'Application preferences' },
        { page: 'about', label: id ? 'Tentang' : 'About', icon: Info, hint: id ? 'Informasi versi Wirebound' : 'Version and project information' }
      ]
    }
  ] as const

  return (
    <aside className="w-[200px] shrink-0 border-r border-border-subtle bg-bg-primary flex flex-col pt-8 pb-3 theme-transition">
      <nav className="flex-1 min-h-0 custom-scrollbar overflow-y-auto py-3" aria-label={id ? 'Navigasi utama' : 'Main navigation'}>
        {groups.map((group) => (
          <div key={group.title} className="mb-3">
            <div className="px-4 mb-1 text-[9px] font-bold tracking-[0.12em] text-text-muted">
              {group.title}
            </div>
            {group.items.map(({ page, label, icon: Icon, hint }) => {
              const selected = activePage === page
              return (
                <Tooltip key={page} text={hint} side="right" className="w-full">
                <button type="button" onClick={() => onNavigate(page)}
                  aria-current={selected ? 'page' : undefined}
                  className={`motion-control motion-nav relative w-full min-h-[33px] flex items-center gap-2.5 px-4 py-1.5 text-left text-xs outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-border-focus ${
                    selected ? 'bg-bg-hover text-text-primary' : 'text-text-secondary hover:bg-bg-hover/60 hover:text-text-primary'
                  }`}>
                  <span className={`absolute left-0 w-[2px] rounded-r bg-accent-blue transition-[height,opacity] duration-200 ${
                    selected ? 'h-5 opacity-100' : 'h-1 opacity-0'
                  }`} />
                  <Icon size={14} strokeWidth={1.8} className={`shrink-0 transition-transform duration-200 ${
                    selected ? 'text-accent-blue scale-105' : 'group-hover:text-accent-blue'
                  }`} />
                  <span className="truncate">{label}</span>
                </button>
                </Tooltip>
              )
            })}
          </div>
        ))}
      </nav>
      <div className="shrink-0 border-t border-border-subtle px-4 pt-3 text-[10px] font-mono text-text-muted">
        {version ? `Wirebound v${version}` : 'Wirebound'}
      </div>
    </aside>
  )
}
