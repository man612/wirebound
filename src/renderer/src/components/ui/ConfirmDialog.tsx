import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, X } from 'lucide-react'

interface Props {
  open: boolean
  title: string
  message: string
  cancelLabel: string
  confirmLabel: string
  destructive?: boolean
  onCancel: () => void
  onConfirm: () => void
}
export default function ConfirmDialog({
  open, title, message, cancelLabel, confirmLabel, destructive = false, onCancel, onConfirm
}: Props): React.JSX.Element | null {
  const cancelRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!open) return
    const former = document.activeElement instanceof HTMLElement ? document.activeElement : null
    cancelRef.current?.focus()
    return () => { former?.focus() }
  }, [open])
  const onKey = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Escape') { event.preventDefault(); onCancel(); return }
    if (event.key !== 'Tab') return
    const nodes = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')]
    const first = nodes[0], last = nodes[nodes.length - 1]
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
  }
  if (typeof document === 'undefined') return null
  return createPortal(
    <div className={`wirebound-dialog-shell fixed inset-0 z-[90] flex items-center justify-center p-4 ${open ? 'wirebound-dialog-open' : ''}`}
      aria-hidden={!open} inert={!open} onKeyDown={onKey}>
      <div className="absolute inset-0 bg-black/60" onClick={onCancel}/>
      <div role="alertdialog" aria-modal="true" aria-labelledby="wirebound-confirm-title"
        aria-describedby="wirebound-confirm-message"
        className="wirebound-dialog-panel relative w-full max-w-[390px] rounded-xl border border-border-focus bg-bg-surface p-5 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <AlertTriangle size={19} className={destructive ? 'text-accent-red' : 'text-accent-yellow'}/>
          <button aria-label="Close" onClick={onCancel} className="rounded p-1 text-text-secondary hover:bg-bg-hover"><X size={16}/></button>
        </div>
        <h2 id="wirebound-confirm-title" className="text-sm font-semibold text-text-primary">{title}</h2>
        <p id="wirebound-confirm-message" className="mt-2 text-xs leading-5 text-text-secondary">{message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button ref={cancelRef} onClick={onCancel} className="motion-control rounded-md border border-border-subtle px-3 py-2 text-xs">{cancelLabel}</button>
          <button onClick={onConfirm} className={`motion-control rounded-md px-3 py-2 text-xs font-semibold text-white ${destructive ? 'bg-accent-red' : 'bg-accent-blue'}`}>{confirmLabel}</button>
        </div>
      </div>
    </div>, document.body
  )
}
