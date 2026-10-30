import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ClipboardCopy, Download, ArrowDownToLine, Pause, Play, Terminal, Trash2 } from 'lucide-react'
import type { AdbDevice, LogEntry } from '../../../../shared/types'
import type { Language, Translation } from '../../i18n'
import { maskDeviceId } from '../../formatters'

interface Props {
  logs: LogEntry[]
  devices: AdbDevice[]
  onClear: () => void
  t: Translation
  language: Language
  full?: boolean
}

/** Keep serials masked even if a future source logs one before native redaction. */
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
  const previousLengthRef = useRef(logs.length)
  const followRef = useRef(true)
  const [following, setFollowing] = useState(true)
  const [unread, setUnread] = useState(0)
  const [feedback, setFeedback] = useState<'copied' | 'exported' | 'error' | null>(null)
  const [filter, setFilter] = useState<'all' | 'errors'>('all')
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const allText = useMemo(() => renderSafeLogLines(logs, devices), [logs, devices])
  const visibleLogs = filter === 'errors' ? logs.filter(x => x.type === 'stderr') : logs

  useEffect(() => {
    if (logs.length === 0) {
      previousLengthRef.current = 0
      setUnread(0)
      return
    }
    const appended = logs.length > previousLengthRef.current ? logs.length - previousLengthRef.current : 0
    previousLengthRef.current = logs.length
    if (followRef.current) {
      if (viewportRef.current) viewportRef.current.scrollTop = viewportRef.current.scrollHeight
    } else if (appended > 0) {
      setUnread(n => n + appended)
    }
  }, [logs])

  useEffect(() => () => {
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current)
  }, [])

  const showFeedback = (next: typeof feedback): void => {
    setFeedback(next)
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current)
    feedbackTimer.current = setTimeout(() => setFeedback(null), 2200)
  }

  const scrollLatest = (): void => {
    followRef.current = true
    setFollowing(true)
    setUnread(0)
    const viewport = viewportRef.current
    if (viewport) viewport.scrollTo({ top: viewport.scrollHeight, behavior: 'smooth' })
  }

  const toggleFollow = (): void => {
    if (followRef.current) {
      followRef.current = false
      setFollowing(false)
    } else scrollLatest()
  }

  const onScroll = (): void => {
    if (!followRef.current) return
    const viewport = viewportRef.current
    if (!viewport) return
    if (viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight > 30) {
      followRef.current = false
      setFollowing(false)
    }
  }

  const copyLogs = async (): Promise<void> => {
    if (!allText) return
    try {
      const r = await window.api.copySupportReport(allText)
      showFeedback(r.success ? 'copied' : 'error')
    } catch {
      showFeedback('error')
    }
  }

  const exportLogs = async (): Promise<void> => {
    if (!allText) return
    try {
      const r = await window.api.exportSupportReport(allText)
      if (!r.cancelled) showFeedback(r.success ? 'exported' : 'error')
    } catch {
      showFeedback('error')
    }
  }

  return (
    <section className={`motion-enter relative ${full ? 'flex h-full min-h-0 flex-col' : ''}`}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-text-muted">
          <Terminal size={13}/>
          {t.terminalLabel}
          <span className="normal-case font-normal text-[10px]">({logs.length})</span>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <button type="button" className={`motion-control log-tool ${filter === 'all' ? 'log-tool-active' : ''}`}
            aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>{id ? 'Semua' : 'All'}</button>
          <button type="button" className={`motion-control log-tool ${filter === 'errors' ? 'log-tool-active' : ''}`}
            aria-pressed={filter === 'errors'} onClick={() => setFilter('errors')}>{id ? 'Error' : 'Errors'}</button>
          <span className="mx-1 h-4 border-l border-border-subtle"/>
          <button type="button" className="motion-control log-tool" onClick={toggleFollow} aria-pressed={!following}
            title={following ? (id ? 'Jeda mengikuti log' : 'Pause auto-follow') : (id ? 'Ikuti log baru' : 'Resume auto-follow')}>
            {following ? <Pause size={12}/> : <Play size={12}/>}
            <span>{following ? (id ? 'Jeda' : 'Pause') : (id ? 'Lanjut' : 'Resume')}</span>
          </button>
          <button type="button" className="motion-control log-tool" onClick={scrollLatest}
            title={id ? 'Ke log terbaru' : 'Jump to latest'}><ArrowDownToLine size={12}/></button>
          <button type="button" className="motion-control log-tool" onClick={() => void copyLogs()} disabled={!allText}
            title={id ? 'Salin log' : 'Copy logs'}><ClipboardCopy size={12}/></button>
          <button type="button" className="motion-control log-tool" onClick={() => void exportLogs()} disabled={!allText}
            title={id ? 'Ekspor log' : 'Export logs'}><Download size={12}/></button>
          <button type="button" className="motion-control log-tool hover:text-accent-red" disabled={logs.length === 0}
            title={logs.length === 0 ? t.noLogsToClear : t.clear} onClick={onClear}><Trash2 size={12}/></button>
        </div>
      </div>
      <div className="relative min-h-0">
        <div ref={viewportRef} onScroll={onScroll}
          className={`custom-scrollbar overflow-y-auto rounded-md border border-border-subtle bg-bg-primary p-3 font-mono text-[10px] ${full ? 'h-[calc(100vh-195px)]' : 'h-40'}`}
          role="log" aria-label={t.terminalLabel}>
          {visibleLogs.length === 0 ? (
            <p className="flex h-full items-center justify-center text-text-muted italic">
              {logs.length === 0 ? t.noLogsYet : id ? 'Tidak ada log error' : 'No error logs'}
            </p>
          ) : <div className="space-y-1">
            {visibleLogs.map((entry, i) => {
              let msg = entry.message
              for (const device of devices) {
                if (device.id.length > 4) msg = msg.split(device.id).join(maskDeviceId(device.id))
              }
              return (
                <div key={`${entry.timestamp}-${i}`} className={`flex gap-2 break-all ${entry.type === 'stderr' ? 'text-accent-red' : 'text-text-secondary'}`}>
                  <span className="shrink-0 opacity-50">[{entry.timestamp}]</span>
                  <span>{msg}</span>
                </div>
              )
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
      <div className="h-4 mt-1 text-[10px] text-text-muted" role="status" aria-live="polite">
        {feedback === 'copied' && <span className="inline-flex items-center gap-1 text-accent-green"><Check size={11}/>{id ? 'Log tersalin' : 'Logs copied'}</span>}
        {feedback === 'exported' && <span className="inline-flex items-center gap-1 text-accent-green"><Check size={11}/>{id ? 'Log diekspor' : 'Logs exported'}</span>}
        {feedback === 'error' && <span className="text-accent-red">{id ? 'Operasi gagal' : 'Action failed'}</span>}
      </div>
    </section>
  )
}
