/**
 * QA-only, bounded probes relative to did-finish-load.
 * The two-second full probe stays for compatibility. Only a NOT-YET-ready
 * renderer receives later samples; no continuous poll or production telemetry.
 */
export type RendererProbeName = 'renderer-timing-early' | 'renderer-root-probe'
export const QA_FULL_PROBE_DEADLINES_MS = [2000, 5000, 12000, 25000, 45000] as const

export function scheduleRendererQaProbes(
  probe: (eventName: RendererProbeName) => Promise<boolean>
): () => void {
  const startedAt = Date.now()
  const timers = new Set<ReturnType<typeof setTimeout>>()
  let cancelled = false

  const scheduleAt = (deadlineMs: number, action: () => void): void => {
    const delay = Math.max(0, deadlineMs - (Date.now() - startedAt))
    const timer = setTimeout(() => {
      timers.delete(timer)
      if (!cancelled) action()
    }, delay)
    timers.add(timer)
  }

  // The early probe is informational only. Never skip the two-second
  // compatibility event even if an early sample already reports UI ready.
  scheduleAt(250, () => {
    void probe('renderer-timing-early').catch(() => undefined)
  })

  const fullProbe = (index: number): void => {
    void probe('renderer-root-probe')
      .then(
        (ready) => {
          if (ready || cancelled) return
          if (index + 1 < QA_FULL_PROBE_DEADLINES_MS.length) {
            scheduleAt(QA_FULL_PROBE_DEADLINES_MS[index + 1], () => fullProbe(index + 1))
          }
        },
        () => {
          if (cancelled) return
          if (index + 1 < QA_FULL_PROBE_DEADLINES_MS.length) {
            scheduleAt(QA_FULL_PROBE_DEADLINES_MS[index + 1], () => fullProbe(index + 1))
          }
        }
      )
  }

  scheduleAt(QA_FULL_PROBE_DEADLINES_MS[0], () => fullProbe(0))

  return () => {
    cancelled = true
    for (const timer of timers) clearTimeout(timer)
    timers.clear()
  }
}
