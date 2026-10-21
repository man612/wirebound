import { appendFileSync } from 'node:fs'
import { isAbsolute } from 'node:path'

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
