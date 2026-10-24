/** Minimal renderer-side performance milestones (navigation-relative). */
export type RendererStartupMark = 'entry-evaluated' | 'react-first-commit' | 'ui-settings-ready'

export function markRendererStartup(name: RendererStartupMark): void {
  try {
    const api = globalThis.performance
    if (!api || typeof api.mark !== 'function') return
    const markName = `wirebound:${name}`
    if (api.getEntriesByName(markName, 'mark').length > 0) return
    api.mark(markName)
  } catch {
    // Observability must never block startup on old or restricted WebViews.
  }
}
