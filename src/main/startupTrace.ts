import { appendFileSync } from 'node:fs'
import { isAbsolute } from 'node:path'
import { performance } from 'node:perf_hooks'

// Opt-in QA-only event timeline. Never enabled for ordinary app launches.
// Callers must pass metadata only: no device IDs, user data, URLs or filesystem paths.
const traceFile = process.env.WIREBOUND_QA_STARTUP_TRACE
export const startupTraceEnabled = Boolean(traceFile && isAbsolute(traceFile))

type TraceDetail = Record<string, string | number | boolean | null>

export function traceStartup(event: string, details: TraceDetail = {}): void {
  if (!startupTraceEnabled || !traceFile) return

  try {
    appendFileSync(
      traceFile,
      JSON.stringify({
        time: new Date().toISOString(),
        pid: process.pid,
        elapsedMs: Math.round(process.uptime() * 1000),
        event,
        ...details
      }) + '\n',
      'utf8'
    )
  } catch {
    // Instrumentation must not prevent the application from starting.
  }
}

const HEARTBEAT_INTERVAL_MS = 1000
const HEARTBEAT_MAX_MS = 120_000
const HEARTBEAT_DELAY_THRESHOLD_MS = 500
const HEARTBEAT_PERIODIC_TICKS = 5

/**
 * Opt-in QA-only watchdog. A delayed timer suggests the main process event
 * loop or OS scheduling was stalled; regular ticks during a stuck page point
 * to renderer/navigation or another asynchronous wait instead.
 *
 * Events include only elapsed/tick/delay numbers, never any paths or user data.
 * This timer is unref'd and self-terminates so it cannot keep Electron alive.
 */
export function startStartupHeartbeat(): NodeJS.Timeout | null {
  if (!startupTraceEnabled) return null

  let previous = performance.now()
  const started = previous
  let ticks = 0
  const timer = setInterval(() => {
    const now = performance.now()
    ticks += 1
    const delayMs = Math.max(0, Math.round(now - previous - HEARTBEAT_INTERVAL_MS))
    previous = now

    if (delayMs > HEARTBEAT_DELAY_THRESHOLD_MS || ticks % HEARTBEAT_PERIODIC_TICKS === 0) {
      traceStartup('main-loop-heartbeat', { tick: ticks, delayMs })
    }
    if (now - started >= HEARTBEAT_MAX_MS || ticks >= HEARTBEAT_MAX_MS / HEARTBEAT_INTERVAL_MS) {
      clearInterval(timer)
    }
  }, HEARTBEAT_INTERVAL_MS)

  timer.unref()
  return timer
}
