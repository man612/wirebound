import { Activity, Settings as SettingsIcon } from 'lucide-react'
import type { Translation } from '../../i18n'

interface SidebarProps {
  activePage: 'dashboard' | 'settings'
  onNavigate: (page: 'dashboard' | 'settings') => void
  t: Translation
}

export default function Sidebar({ activePage, onNavigate, t }: SidebarProps): React.JSX.Element {
  return (
    <aside className="w-[200px] border-r border-border-subtle bg-bg-primary flex flex-col justify-between pt-8 pb-4 shrink-0 theme-transition">
      <div className="pt-4">
        <div className="text-[10px] font-bold text-text-muted px-4 mb-2 uppercase tracking-wider">
          Explorer
        </div>
        <button
          onClick={() => onNavigate('dashboard')}
          className={`group w-full flex items-center gap-2 px-4 py-1.5 text-sm transition-colors duration-200 outline-none focus-visible:bg-bg-hover ${
            activePage === 'dashboard'
              ? 'bg-bg-hover text-text-primary border-l-2 border-accent-blue'
              : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary border-l-2 border-transparent active:opacity-80'
          }`}
        >
          <Activity
            size={14}
            className={`transition-transform duration-300 ${activePage === 'dashboard' ? 'scale-110' : 'group-hover:rotate-12 group-active:scale-90'}`}
          />
          {t.dashboard}
        </button>
        <button
          onClick={() => onNavigate('settings')}
          className={`group w-full flex items-center gap-2 px-4 py-1.5 text-sm transition-colors duration-200 outline-none focus-visible:bg-bg-hover ${
            activePage === 'settings'
              ? 'bg-bg-hover text-text-primary border-l-2 border-accent-blue'
              : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary border-l-2 border-transparent active:opacity-80'
          }`}
        >
          <SettingsIcon
            size={14}
            className={`transition-transform duration-300 ${activePage === 'settings' ? 'rotate-90 scale-110' : 'group-hover:rotate-45 group-active:scale-90'}`}
          />
          {t.settings}
        </button>
      </div>
      <div className="px-4 text-[11px] text-text-muted font-mono transition-colors duration-200 hover:text-text-secondary cursor-default">
        v1.0.0
      </div>
    </aside>
  )
}
