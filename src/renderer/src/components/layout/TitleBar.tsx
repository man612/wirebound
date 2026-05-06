import { Minus, Square, X, ShieldCheck } from 'lucide-react'

export default function TitleBar() {
  const handleMinimize = () => window.api.windowControl('minimize')
  const handleMaximize = () => window.api.windowControl('maximize')
  const handleClose = () => window.api.windowControl('close')

  return (
    <div className="h-8 w-full flex justify-between items-center bg-bg-primary border-b border-border-subtle select-none z-50 fixed top-0 theme-transition" style={{ WebkitAppRegion: 'drag' } as any}>
      <div className="flex items-center px-3 gap-2">
        <span className="text-[11px] font-bold tracking-widest text-text-primary">WIREBOUND</span>
      </div>
      <div className="flex h-full" style={{ WebkitAppRegion: 'no-drag' } as any}>
        <button onClick={handleMinimize} className="h-full px-3 hover:bg-bg-hover text-text-muted hover:text-text-primary transition-colors duration-150 active:opacity-70">
          <Minus size={14} />
        </button>
        <button onClick={handleMaximize} className="h-full px-3 hover:bg-bg-hover text-text-muted hover:text-text-primary transition-colors duration-150 active:opacity-70">
          <Square size={12} />
        </button>
        <button onClick={handleClose} className="h-full px-3 hover:bg-accent-red hover:text-white text-text-muted transition-colors duration-150">
          <X size={14} />
        </button>
      </div>
    </div>
  )
}


