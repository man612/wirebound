import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'

interface Props { text: string; children: ReactNode; side?: 'right' | 'top'; className?: string }

export default function Tooltip({ text, children, side = 'top', className = '' }: Props): React.JSX.Element {
  const ref = useRef<HTMLSpanElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [visible, setVisible] = useState(false)
  const [rect, setRect] = useState({ top: 0, left: 0 })
  const show = (delay: number): void => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      const r = ref.current?.getBoundingClientRect()
      if (r) {
        setRect(side === 'right'
          ? { top: r.top + r.height / 2, left: r.right + 10 }
          : { top: r.top - 10, left: r.left + r.width / 2 })
        setVisible(true)
      }
    }, delay)
  }
  const hide = (): void => {
    if (timer.current) clearTimeout(timer.current)
    setVisible(false)
  }
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])
  return <>
    <span ref={ref} className={`inline-flex min-w-0 ${className}`} onMouseEnter={() => show(550)}
      onMouseLeave={hide} onFocusCapture={() => show(0)} onBlurCapture={hide}>
      {children}
    </span>
    {visible && createPortal(
      <span role="tooltip" className="wirebound-tooltip pointer-events-none fixed z-[100] max-w-[220px] rounded-md border border-border-focus bg-bg-elevated px-2.5 py-1.5 text-[11px] leading-4 text-text-primary shadow-lg"
        style={side === 'right'
          ? { top: rect.top, left: rect.left, transform: 'translateY(-50%)' }
          : { top: rect.top, left: rect.left, transform: 'translate(-50%, -100%)' }}>
        {text}
      </span>, document.body)}
  </>
}
