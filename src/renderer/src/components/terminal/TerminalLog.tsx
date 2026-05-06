import { useEffect, useRef, useState } from 'react'
import type { LogEntry } from '../../../../shared/types'

interface TerminalLogProps {
  logs: LogEntry[]
  onClear: () => void
}

export default function TerminalLog({ logs, onClear }: TerminalLogProps) {
  const [isExpanded, setIsExpanded] = useState(true)
  const [height, setHeight] = useState(200)
  const scrollRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)
  const startY = useRef(0)
  const startHeight = useRef(0)

  useEffect(() => {
    if (scrollRef.current && isExpanded) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [logs, isExpanded])

  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true
    startY.current = e.clientY
    startHeight.current = height
    document.body.style.cursor = 'ns-resize'
    document.body.style.userSelect = 'none'

    const handleMouseMove = (ev: MouseEvent) => {
      if (!isDragging.current) return
      const delta = startY.current - ev.clientY
      setHeight(Math.max(100, Math.min(500, startHeight.current + delta)))
    }

    const handleMouseUp = () => {
      isDragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  const getColor = (type: LogEntry['type']) => {
    if (type === 'stderr') return 'text-accent-red/80'
    if (type === 'info') return 'text-accent-blue/70'
    return 'text-text-secondary'
  }

  return (
    <div className="border-t border-border-subtle bg-bg-primary">
      <div className="flex items-center justify-between px-4 py-1.5 cursor-ns-resize select-none" onMouseDown={handleMouseDown}>
        <button onClick={() => setIsExpanded(!isExpanded)} className="flex items-center gap-2 text-xs text-text-muted hover:text-text-secondary transition-colors cursor-pointer">
          <svg className={`h-3 w-3 transition-transform duration-150 ${isExpanded ? '' : '-rotate-90'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
          <span className="font-medium uppercase tracking-wider">Terminal</span>
          {logs.length > 0 && <span className="text-text-muted/50">({logs.length})</span>}
        </button>
        <button onClick={onClear} className="text-xs text-text-muted hover:text-text-secondary transition-colors cursor-pointer px-1.5 py-0.5 rounded hover:bg-bg-elevated">Clear</button>
      </div>

      {isExpanded && (
        <div ref={scrollRef} style={{ height }} className="overflow-y-auto overflow-x-hidden px-4 pb-2 font-mono">
          {logs.length === 0 ? (
            <div className="flex items-center justify-center h-full text-xs text-text-muted/40">Belum ada output log</div>
          ) : (
            <div className="space-y-0.5">
              {logs.map((entry, i) => (
                <div key={i} className="flex gap-2 text-[11px] leading-5">
                  <span className="text-text-muted/40 shrink-0 select-none w-16">{entry.timestamp}</span>
                  <span className={`break-all ${getColor(entry.type)}`}>{entry.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
