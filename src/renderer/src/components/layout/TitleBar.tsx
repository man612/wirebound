import { Minus, Square, X } from 'lucide-react'

type WindowDragStyle = React.CSSProperties & {
  WebkitAppRegion?: 'drag' | 'no-drag'
}

const dragStyle: WindowDragStyle = { WebkitAppRegion: 'drag' }
const noDragStyle: WindowDragStyle = { WebkitAppRegion: 'no-drag' }

export default function TitleBar(): React.JSX.Element {
  const handleMinimize = (): void => window.api.windowControl('minimize')
  const handleMaximize = (): void => window.api.windowControl('maximize')
  const handleClose = (): void => window.api.windowControl('close')

  return (
    <div
      className="h-8 w-full flex justify-between items-center bg-bg-primary border-b border-border-subtle select-none z-50 fixed top-0 theme-transition"
      style={dragStyle}
    >
      <div className="flex items-center px-3 gap-2">
        <span className="text-[11px] font-bold tracking-widest text-text-primary">WIREBOUND</span>
      </div>
      <div className="flex h-full" style={noDragStyle}>
        <button
          onClick={handleMinimize}
          className="h-full px-3 hover:bg-bg-hover text-text-muted hover:text-text-primary transition-colors duration-150 active:opacity-70"
        >
          <Minus size={14} />
        </button>
        <button
          onClick={handleMaximize}
          className="h-full px-3 hover:bg-bg-hover text-text-muted hover:text-text-primary transition-colors duration-150 active:opacity-70"
        >
          <Square size={12} />
        </button>
        <button
          onClick={handleClose}
          className="h-full px-3 hover:bg-accent-red hover:text-white text-text-muted transition-colors duration-150"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  )
}
