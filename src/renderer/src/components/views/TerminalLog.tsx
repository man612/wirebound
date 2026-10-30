import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Check, ClipboardCopy, FileDown, ListEnd, Pause, Play, Terminal, Trash2 } from 'lucide-react'
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

/** Keep known serials out of the terminal and its clipboard/file output. */
export function renderSafeLogLines(logs: LogEntry[], devices: AdbDevice[]): string {
  return logs.map(entry => {
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
  // The user controls following ONLY by pressing Pause / Resume. Scrolling is
  // temporary viewport detachment, never a change to the selected follow mode.
  const [following, setFollowing] = useState(true)
  const followRef = useRef(true)
  const [detached, setDetached] = useState(false)
  const detachedRef = useRef(false)
  const [lastSeen, setLastSeen] = useState(logs.length)
  const [clearPrompt, setClearPrompt] = useState(false)
  const [feedback, setFeedback] = useState<'copied' | 'exported' | 'error' | null>(null)
  const [pauseToast, setPauseToast] = useState(false)
  const [filter, setFilter] = useState<'all' | 'errors'>('all')
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pauseToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const jumpTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const jumpingRef = useRef(false)
  const empty = logs.length === 0
  const unread = empty || (following && !detached) ? 0 : Math.max(0, logs.length - lastSeen)
  const safeText = useMemo(() => renderSafeLogLines(logs, devices), [logs, devices])
  const visibleLogs = filter === 'errors' ? logs.filter(e => e.type === 'stderr') : logs

  const markDetached = (): void => {
    if (empty) return
    detachedRef.current = true
    setDetached(true)
  }
  const markAtBottom = (): void => {
    detachedRef.current = false
    setDetached(false)
    setLastSeen(logs.length)
  }
  const jumpToLatest = (): void => {
    const viewport = viewportRef.current
    markAtBottom()
    if (!viewport) return
    jumpingRef.current = true
    if (jumpTimer.current) clearTimeout(jumpTimer.current)
    viewport.scrollTo({ top: viewport.scrollHeight, behavior: 'smooth' })
    jumpTimer.current = setTimeout(() => {
      jumpingRef.current = false
      // Catch log lines appended while the smooth scroll was moving.
      if (viewportRef.current) viewportRef.current.scrollTop = viewportRef.current.scrollHeight
      setLastSeen(logs.length)
    }, 440)
  }

  // While attached, remain at the bottom on incoming logs. When the reader
  // scrolls up, preserve their reading position without altering Pause/Resume.
  useLayoutEffect(() => {
    if (!followRef.current || detachedRef.current || jumpingRef.current || !viewportRef.current) return
    viewportRef.current.scrollTop = viewportRef.current.scrollHeight
    setLastSeen(logs.length)
  }, [logs, filter])

  useEffect(() => () => {
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current)
    if (pauseToastTimer.current) clearTimeout(pauseToastTimer.current)
    if (jumpTimer.current) clearTimeout(jumpTimer.current)
  }, [])

  const notify = (next: typeof feedback): void => {
    setFeedback(next)
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current)
    feedbackTimer.current = setTimeout(() => setFeedback(null), 2300)
  }
  const toggleFollow = (): void => {
    if (empty) return
    const next = !followRef.current
    followRef.current = next
    setFollowing(next)
    if (next) {
      setPauseToast(false)
      jumpToLatest()
    } else {
      setLastSeen(logs.length)
      setPauseToast(true)
      if (pauseToastTimer.current) clearTimeout(pauseToastTimer.current)
      pauseToastTimer.current = setTimeout(() => setPauseToast(false), 1500)
    }
  }
  const onWheel = (event: React.WheelEvent<HTMLDivElement>): void => {
    if (event.deltaY < 0 && event.currentTarget.scrollHeight > event.currentTarget.clientHeight) markDetached()
  }
  const onKey = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    if (['ArrowUp', 'PageUp', 'Home'].includes(event.key)) markDetached()
  }
  const onPointer = (event: React.PointerEvent<HTMLDivElement>): void => {
    if (event.clientX >= event.currentTarget.getBoundingClientRect().right - 14 &&
      event.currentTarget.scrollHeight > event.currentTarget.clientHeight) markDetached()
  }
  const onScroll = (event: React.UIEvent<HTMLDivElement>): void => {
    const el = event.currentTarget
    if (el.scrollHeight - el.scrollTop - el.clientHeight <= 8 && detachedRef.current && !jumpingRef.current) {
      markAtBottom()
    }
  }
  const copyLogs = async (): Promise<void> => {
    if (empty) return
    try {
      const result = await window.api.copySupportReport(safeText)
      notify(result.success ? 'copied' : 'error')
    } catch { notify('error') }
  }
  const exportLogs = async (): Promise<void> => {
    if (empty) return
    try {
      const result = await window.api.exportSupportReport(safeText)
      if (!result.cancelled) notify(result.success ? 'exported' : 'error')
    } catch { notify('error') }
  }
  const confirmClear = (): void => {
    onClear()
    followRef.current = true
    setFollowing(true)
    markAtBottom()
    setFilter('all')
    setPauseToast(false)
    setClearPrompt(false)
  }

  return (
    <section className={`motion-enter relative ${full ? 'flex h-full min-h-0 flex-col' : ''}`}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-text-muted">
          <Terminal size={13}/>{t.terminalLabel}
          <span className="font-normal normal-case text-[10px]">({logs.length})</span>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <Tooltip text={id ? 'Tampilkan semua log' : 'Show all entries'}>
            <button type="button" disabled={empty} className={`motion-control log-tool ${filter === 'all' ? 'log-tool-active' : ''}`}
              aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>{id ? 'Semua' : 'All'}</button>
          </Tooltip>
          <Tooltip text={id ? 'Tampilkan pesan kesalahan' : 'Show errors only'}>
            <button type="button" disabled={empty} className={`motion-control log-tool ${filter === 'errors' ? 'log-tool-active' : ''}`}
              aria-pressed={filter === 'errors'} onClick={() => setFilter('errors')}>{id ? 'Error' : 'Errors'}</button>
          </Tooltip>
          <span className="mx-1 h-4 border-l border-border-subtle"/>
          <Tooltip text={following
            ? id ? 'Jeda mengikuti log baru, tanpa menghentikan koneksi' : 'Pause following new logs without stopping the connection'
            : id ? 'Lanjut mengikuti log terbaru' : 'Resume following new log entries'}>
            <button type="button" disabled={empty} onClick={toggleFollow} aria-pressed={!following}
              className={`motion-control log-tool relative w-[72px] ${!following ? 'log-follow-paused' : ''}`}
              aria-label={following ? 'Pause auto-follow' : 'Resume auto-follow'}>
              <span className={`motion-label absolute inset-0 flex items-center justify-center gap-1 ${following ? 'motion-label-visible' : ''}`}>
                <Pause size={12}/>{id ? 'Jeda' : 'Pause'}
              </span>
              <span className={`motion-label absolute inset-0 flex items-center justify-center gap-1 ${!following ? 'motion-label-visible' : ''}`}>
                <Play size={12}/>{id ? 'Lanjut' : 'Resume'}
              </span>
            </button>
          </Tooltip>
          <Tooltip text={id ? 'Lompat halus ke log paling baru' : 'Smoothly jump to the latest log'}>
            <button type="button" disabled={empty} className="motion-control log-tool" onClick={jumpToLatest}
              aria-label={id ? 'Ke log terbaru' : 'Jump to latest'}><ListEnd size={15}/></button>
          </Tooltip>
          <Tooltip text={id ? 'Salin log tersamarkan' : 'Copy redacted logs'}>
            <button type="button" className="motion-control log-tool" onClick={() => void copyLogs()} disabled={empty}
              aria-label={id ? 'Salin log' : 'Copy logs'}><ClipboardCopy size={13}/></button>
          </Tooltip>
          <Tooltip text={id ? 'Ekspor log TXT, LOG, Markdown, JSON, CSV' : 'Export logs as TXT, LOG, Markdown, JSON or CSV'}>
            <button type="button" className="motion-control log-tool" onClick={() => void exportLogs()} disabled={empty}
              aria-label={id ? 'Ekspor log' : 'Export logs'}><FileDown size={15}/></button>
          </Tooltip>
          <Tooltip text={empty ? (id ? 'Belum ada log' : 'No logs to clear') : (id ? 'Bersihkan semua log' : 'Clear all logs')}>
            <button type="button" className="motion-control log-tool hover:text-accent-red" disabled={empty}
              aria-label={t.clear} title={empty ? t.noLogsToClear : t.clear}
              onClick={() => setClearPrompt(true)}><Trash2 size={13}/></button>
          </Tooltip>
        </div>
      </div>
      <div className="relative min-h-0">
        <div ref={viewportRef} onWheel={onWheel} onKeyDown={onKey} onPointerDown={onPointer} onScroll={onScroll}
          tabIndex={empty ? -1 : 0}
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
        <span role="status" aria-live="polite"
          className={`pointer-events-none motion-feedback absolute right-3 top-2 rounded bg-bg-elevated/95 px-2 py-1 text-[10px] text-text-muted shadow-sm ${pauseToast ? 'motion-feedback-visible' : ''}`}>
          {id ? 'Auto-follow dijeda' : 'Auto-follow paused'}
        </span>
        {unread > 0 && (detached || !following) && (
          <button type="button" onClick={jumpToLatest}
            className="motion-enter motion-control absolute bottom-3 right-3 rounded-full border border-border-focus bg-bg-surface px-3 py-1.5 text-[10px] text-text-secondary shadow-md">
            {unread} {id ? 'baris baru' : 'new lines'} ↓
          </button>
        )}
      </div>
      <div className="mt-1 min-h-4 text-[10px] text-text-muted" role="status" aria-live="polite">
        <span className={`motion-feedback inline-flex items-center gap-1 text-accent-green ${feedback === 'copied' || feedback === 'exported' ? 'motion-feedback-visible' : ''}`}>
          <Check size={11}/>{feedback === 'exported' ? (id ? 'Log diekspor' : 'Logs exported') : (id ? 'Log tersalin' : 'Logs copied')}
        </span>
        {feedback === 'error' && <span className="motion-enter ml-2 text-accent-red">{id ? 'Operasi gagal' : 'Action failed'}</span>}
      </div>
      <ConfirmDialog open={clearPrompt} title={id ? 'Bersihkan log?' : 'Clear terminal logs?'}
        message={id ? 'Semua log sesi ini akan dihapus. Koneksi tetap berjalan.' : 'Session logs will be cleared. The connection remains active.'}
        cancelLabel={id ? 'Batal' : 'Cancel'} confirmLabel={id ? 'Bersihkan' : 'Clear logs'}
        destructive onCancel={() => setClearPrompt(false)} onConfirm={confirmClear}/>
    </section>
  )
}
