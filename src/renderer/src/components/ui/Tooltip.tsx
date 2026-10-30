import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { cloneElement, isValidElement } from 'react'
import type { ReactNode } from 'react'

interface Props {
  text: string
  children: ReactNode
  side?: 'right' | 'top'
  className?: string
  delay?: number
}

/**
 * Pointer hover has a deliberate delay. Pointer-initiated focus and clicks must
 * never summon a tooltip; a keyboard's focus-visible state can still reveal it.
 */
export default function Tooltip({ text, children, side = 'top', className = '', delay = 850 }: Props): React.JSX.Element {
  const ref = useRef<HTMLSpanElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const blockedUntilLeave = useRef(false)
  const [visible, setVisible] = useState(false)
  const [rect, setRect] = useState({ top: 0, left: 0 })
  const tipId = useId()

  const hide = (): void => {
    if (timer.current !== null) clearTimeout(timer.current)
    timer.current = null
    setVisible(false)
  }

  const schedule = (wait: number): void => {
    if (blockedUntilLeave.current) return
    if (timer.current !== null) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      if (blockedUntilLeave.current) return
      const r = ref.current?.getBoundingClientRect()
      if (!r) return
      setRect(side === 'right'
        ? { top: r.top + r.height / 2, left: r.right + 10 }
        : { top: r.top - 10, left: r.left + r.width / 2 })
      setVisible(true)
    }, wait)
  }

  const dismissForInteraction = (): void => {
    blockedUntilLeave.current = true
    hide()
  }

  useEffect(() => {
    if (!visible) return
    const onEscape = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') dismissForInteraction()
    }
    const onWindowBlur = (): void => hide()
    window.addEventListener('keydown', onEscape)
    window.addEventListener('blur', onWindowBlur)
    return () => {
      window.removeEventListener('keydown', onEscape)
      window.removeEventListener('blur', onWindowBlur)
    }
  }, [visible])

  useEffect(() => () => {
    if (timer.current !== null) clearTimeout(timer.current)
  }, [])

  const describedChild = isValidElement<{ 'aria-describedby'?: string }>(children)
    ? cloneElement(children, { 'aria-describedby': visible ? tipId : children.props['aria-describedby'] })
    : children

  return <>
    <span ref={ref} className={`inline-flex min-w-0 ${className}`}
      onMouseEnter={() => schedule(delay)}
      onMouseLeave={() => { blockedUntilLeave.current = false; hide() }}
      onPointerDownCapture={dismissForInteraction}
      onClickCapture={dismissForInteraction}
      onFocusCapture={(e) => {
        if (e.target instanceof HTMLElement && e.target.matches(':focus-visible')) schedule(400)
      }}
      onBlurCapture={hide}>
      {describedChild}
    </span>
    {visible && createPortal(
      <span id={tipId} role="tooltip"
        className="wirebound-tooltip pointer-events-none fixed z-[100] max-w-[220px] rounded-md border border-border-focus bg-bg-elevated px-2.5 py-1.5 text-[11px] leading-4 text-text-primary shadow-lg"
        style={side === 'right'
          ? { top: rect.top, left: rect.left, transform: 'translateY(-50%)' }
          : { top: rect.top, left: rect.left, transform: 'translate(-50%, -100%)' }}>
        {text}
      </span>, document.body)}
  </>
}
