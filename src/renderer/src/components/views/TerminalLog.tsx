import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ClipboardCopy, FileDown, ChevronsDown, Pause, Play, Terminal, Trash2 } from 'lucide-react'
import type { AdbDevice, LogEntry } from '../../../../shared/types'
import type { Language, Translation } from '../../i18n'
import { maskDeviceId } from '../../formatters'
import Tooltip from '../ui/Tooltip'
import ConfirmDialog from '../ui/ConfirmDialog'

interface Props {
  logs: LogEntry[]
  devices: AdbDevice[]
  onClear: () => void
  t: Translation
  language: Language
  full?: boolean
}

/** Redact known ADB serials before showing, copying, or exporting the terminal history. */
export function renderSafeLogLines(logs: LogEntry[], devices: AdbDevice[]): string {
  return logs.map((entry) => {
    let line = `[${entry.timestamp}] [${entry.type}] ${entry.message}`
    for (const device of devices) {
      if (device.id.length > 4) line = line.split(device.id).join(maskDeviceId(device.id))
    }
    return line
  }).join('\n')
}

export default function TerminalLog({ logs, devices, onClear, t, language, full = false }: Props): React.JSX.Element {
  const id = language === 'id'
  const viewportRef = useRef<HTMLDivElement>(null)
  const followRef = useRef(true)
  const [following, setFollowing] = useState(true)
  const [pausedAt, setPausedAt] = useState(logs.length)
  const [clearPrompt, setClearPrompt] = useState(false)
  const [feedback, setFeedback] = useState<'copied' | 'exported' | 'error' | null>(null)
  const [filter, setFilter] = useState<'all' | 'errors'>('all')
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const empty = logs.length === 0
  const unread = following || empty ? 0 : Math.max(0, logs.length - pausedAt)
  const allText = useMemo(() => renderSafeLogLines(logs, devices), [logs, devices])
  const visibleLogs = filter === 'errors' ? logs.filter(x => x.type === 'stderr') : logs

  useEffect(() => {
    if (followRef.current && viewportRef.current) {
      viewportRef.current.scrollTop = viewportRef.current.scrollHeight
    }
  }, [logs])

  useEffect(() => () => {
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current)
  }, [])

  const showFeedback = (next: typeof feedback): void => {
    setFeedback(next)
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current)
    feedbackTimer.current = setTimeout(() => setFeedback(null), 2500)
  }

  const scrollLatest = (): void => {
    followRef.current = true
    setFollowing(true)
    setPausedAt(logs.length)
    const viewport = viewportRef.current
    if (viewport) viewport.scrollTo({ top: viewport.scrollHeight, behavior: 'smooth' })
  }

  const toggleFollow = (): void => {
    if (empty) return
    if (followRef.current) {
      followRef.current = false
      setPausedAt(logs.length)
      setFollowing(false)
    } else scrollLatest()
  }

  const onScroll = (): void => {
    const viewport = viewportRef.current
    if (!viewport || !followRef.current || empty) return
    if (viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight > 30) {
      followRef.current = false
      setPausedAt(logs.length)
      setFollowing(false)
    }
  }

  const copyLogs = async (): Promise<void> => {
    if (empty) return
    try {
      const result = await window.api.copySupportReport(allText)
      showFeedback(result.success ? 'copied' : 'error')
    } catch { showFeedback('error') }
  }
  const exportLogs = async (): Promise<void> => {
    if (empty) return
    try {
      const result = await window.api.exportSupportReport(allText)
      if (!result.cancelled) showFeedback(result.success ? 'exported' : 'error')
    } catch { showFeedback('error') }
  }
  const confirmClear = (): void => {
    onClear()
    setPausedAt(0)
    followRef.current = true
    setFollowing(true)
    setFilter('all')
    setClearPrompt(false)
  }

  return (
    <section className={`motion-enter relative ${full ? 'flex h-full min-h-0 flex-col' : ''}`}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-text-muted">
          <Terminal size={13}/>
          {t.terminalLabel} <span className="font-normal normal-case text-[10px]">({logs.length})</span>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <Tooltip text={id ? 'Tampilkan semua log' : 'Show all entries'}>
            <button type="button" disabled={empty}
              className={`motion-control log-tool ${filter === 'all' ? 'log-tool-active' : ''}`}
              aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>{id ? 'Semua' : 'All'}</button>
          </Tooltip>
          <Tooltip text={id ? 'Tampilkan hanya pesan kesalahan' : 'Show errors only'}>
            <button type="button" disabled={empty}
              className={`motion-control log-tool ${filter === 'errors' ? 'log-tool-active' : ''}`}
              aria-pressed={filter === 'errors'} onClick={() => setFilter('errors')}>{id ? 'Error' : 'Errors'}</button>
          </Tooltip>
          <span className="mx-1 h-4 border-l border-border-subtle"/>
          <Tooltip text={following
            ? id ? 'Jeda otomatis mengikuti log terbaru' : 'Pause automatic following of new entries'
            : id ? 'Lanjut mengikuti log terbaru' : 'Resume automatic following of new entries'}>
            <button type="button" disabled={empty} onClick={toggleFollow} aria-pressed={!following}
              className="motion-control log-tool" aria-label={following ? 'Pause auto-follow' : 'Resume auto-follow'}>
              {following ? <Pause size={12}/> : <Play size={12}/>}
              <span>{following ? (id ? 'Jeda' : 'Pause') : (id ? 'Lanjut' : 'Resume')}</span>
            </button>
          </Tooltip>
          <Tooltip text={id ? 'Gulir ke baris log terbaru' : 'Jump to the latest log entry'}>
            <button type="button" disabled={empty} className="motion-control log-tool" onClick={scrollLatest}
              aria-label={id ? 'Ke log terbaru' : 'Jump to latest'}><ChevronsDown size={15}/></button>
          </Tooltip>
          <Tooltip text={id ? 'Salin log yang disamarkan' : 'Copy redacted logs'}>
            <button type="button" className="motion-control log-tool" onClick={() => void copyLogs()} disabled={empty}
              aria-label={id ? 'Salin log' : 'Copy logs'}><ClipboardCopy size={13}/></button>
          </Tooltip>
          <Tooltip text={id ? 'Simpan log ke TXT, LOG, Markdown, JSON atau CSV' : 'Export logs as TXT, LOG, Markdown, JSON or CSV'}>
            <button type="button" className="motion-control log-tool" onClick={() => void exportLogs()} disabled={empty}
              aria-label={id ? 'Ekspor log' : 'Export logs'}><FileDown size={15}/></button>
          </Tooltip>
          <Tooltip text={empty ? (id ? 'Tidak ada log yang dihapus' : 'No entries to clear') : (id ? 'Hapus semua log dari tampilan' : 'Clear all visible logs')}>
            <button type="button" className="motion-control log-tool hover:text-accent-red" disabled={empty}
              aria-label={t.clear} title={empty ? t.noLogsToClear : t.clear}
              onClick={() => setClearPrompt(true)}><Trash2 size={13}/></button>
          </Tooltip>
        </div>
      </div>
      <div className="relative min-h-0">
        <div ref={viewportRef} onScroll={onScroll}
          className={`custom-scrollbar overflow-y-auto rounded-md border border-border-subtle bg-bg-primary p-3 font-mono text-[10px] ${full ? 'h-[calc(100vh-195px)]' : 'h-40'}`}
          role="log" aria-label={t.terminalLabel}>
          {visibleLogs.length === 0 ? (
            <p className="flex h-full items-center justify-center text-text-muted italic">
              {empty ? t.noLogsYet : id ? 'Tidak ada log error' : 'No error logs'}
            </p>
          ) : <div className="space-y-1">
            {visibleLogs.map((entry, i) => {
              let message = entry.message
              for (const device of devices) {
                if (device.id.length > 4) message = message.split(device.id).join(maskDeviceId(device.id))
              }
              return <div key={`${entry.timestamp}-${i}`}
                className={`motion-log-line flex gap-2 break-all ${entry.type === 'stderr' ? 'text-accent-red' : 'text-text-secondary'}`}>
                <span className="shrink-0 opacity-50">[{entry.timestamp}]</span><span>{message}</span>
              </div>
            })}
          </div>}
        </div>
        {unread > 0 && !following && (
          <button type="button" onClick={scrollLatest}
            className="motion-enter motion-control absolute bottom-3 right-3 rounded-full border border-accent-blue/40 bg-bg-surface px-3 py-1.5 text-[10px] text-accent-blue shadow-md">
            {unread} {id ? 'baris baru' : 'new lines'} ↓
          </button>
        )}
      </div>
      <div className="mt-1 min-h-4 text-[10px] text-text-muted" role="status" aria-live="polite">
        <span className={`motion-feedback inline-flex items-center gap-1 text-accent-green ${feedback === 'copied' || feedback === 'exported' ? 'motion-feedback-visible' : ''}`}>
          <Check size={11}/>{feedback === 'exported' ? (id ? 'Log diekspor' : 'Logs exported') : (id ? 'Log tersalin' : 'Logs copied')}
        </span>
        {feedback === 'error' && <span className="motion-enter ml-2 text-accent-red">{id ? 'Operasi gagal' : 'Action failed'}</span>}
        {!following && !empty && <span className="ml-2 text-accent-yellow">{id ? 'Auto-scroll dijeda' : 'Auto-follow paused'}</span>}
      </div>
      <ConfirmDialog open={clearPrompt} title={id ? 'Bersihkan log?' : 'Clear terminal logs?'}
        message={id ? 'Semua log yang tampil akan dihapus dari sesi ini. Tindakan ini tidak memutuskan koneksi.' : 'All log entries in this session will be cleared. Your connection stays active.'}
        cancelLabel={id ? 'Batal' : 'Cancel'} confirmLabel={id ? 'Bersihkan' : 'Clear logs'}
        destructive onCancel={() => setClearPrompt(false)} onConfirm={confirmClear}/>
    </section>
  )
}
