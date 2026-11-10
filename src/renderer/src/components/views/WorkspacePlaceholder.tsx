import { ArrowLeft, Construction } from 'lucide-react'
import type { AppPage } from '../../pages'
import type { Language } from '../../i18n'

interface Props {
  page: AppPage
  language: Language
  onDashboard: () => void
}

const names: Record<AppPage, [string, string]> = {
  dashboard: ['Dashboard', 'Dasbor'],
  devices: ['Devices', 'Perangkat'],
  diagnostics: ['Diagnostics', 'Diagnostik'],
  logs: ['Activity Logs', 'Log Aktivitas'],
  speed: ['Speed Test', 'Tes Kecepatan'],
  updates: ['Updates', 'Pembaruan'],
  settings: ['Settings', 'Pengaturan'],
  about: ['About', 'Tentang']
}

export default function WorkspacePlaceholder({ page, language, onDashboard }: Props): React.JSX.Element {
  const id = language === 'id'
  const heading = names[page][id ? 1 : 0]
  return (
    <div className="h-full overflow-auto bg-bg-surface">
      <div className="border-b border-border-subtle px-4 py-2 text-xs text-text-muted">
        Wirebound / <span className="text-text-primary">{heading}</span>
      </div>
      <div className="min-h-[75%] flex items-center justify-center p-6">
        <div className="motion-enter max-w-sm text-center">
          <div className="mx-auto mb-4 w-12 h-12 grid place-items-center rounded-xl border border-border-subtle bg-bg-primary text-accent-blue">
            <Construction size={20} strokeWidth={1.6} />
          </div>
          <h2 className="text-base font-semibold text-text-primary">{heading}</h2>
          <p className="mt-2 text-xs leading-5 text-text-secondary">
            {id
              ? 'Halaman ini sudah disiapkan di navigasi. Fiturnya belum diaktifkan; semua kontrol koneksi tetap tersedia di Dasbor.'
              : 'This navigation page is prepared but its features are not enabled yet. Connection controls remain available on Dashboard.'}
          </p>
          <button type="button" onClick={onDashboard}
            className="motion-control mt-5 inline-flex items-center gap-2 rounded-md border border-border-subtle bg-bg-primary px-3 py-2 text-xs text-text-primary hover:border-accent-blue">
            <ArrowLeft size={13}/>{id ? 'Kembali ke Dasbor' : 'Back to Dashboard'}
          </button>
        </div>
      </div>
    </div>
  )
}
