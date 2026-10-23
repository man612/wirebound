import { afterEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const tempDirs: string[] = []

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.resetModules()
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

describe('opt-in Electron startup timeline', () => {
  it('does not write anything with tracing disabled', async () => {
    vi.stubEnv('WIREBOUND_QA_STARTUP_TRACE', undefined)
    const { startupTraceEnabled, traceStartup } = await import('./startupTrace')
    expect(startupTraceEnabled).toBe(false)
    expect(() => traceStartup('window-created')).not.toThrow()
  })

  it('ignores relative paths for safety', async () => {
    vi.stubEnv('WIREBOUND_QA_STARTUP_TRACE', 'relative-trace.jsonl')
    const { startupTraceEnabled, traceStartup } = await import('./startupTrace')
    expect(startupTraceEnabled).toBe(false)
    expect(() => traceStartup('window-created')).not.toThrow()
  })

  it('writes an event with minimal metadata only when explicitly enabled', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'wirebound-trace-test-'))
    tempDirs.push(dir)
    const file = join(dir, 'startup.jsonl')
    vi.stubEnv('WIREBOUND_QA_STARTUP_TRACE', file)
    const { startupTraceEnabled, traceStartup } = await import('./startupTrace')
    expect(startupTraceEnabled).toBe(true)

    traceStartup('window-shown', { visible: true })
    const event = JSON.parse(readFileSync(file, 'utf8').trim()) as Record<string, unknown>
    expect(event).toMatchObject({ event: 'window-shown', visible: true, pid: process.pid })
    expect(event).toHaveProperty('elapsedMs')
    expect(event).not.toHaveProperty('url')
    expect(event).not.toHaveProperty('deviceId')
  })

  it('cannot skip the window icon outside explicit QA tracing', async () => {
    vi.stubEnv('WIREBOUND_QA_STARTUP_TRACE', undefined)
    vi.stubEnv('WIREBOUND_QA_SKIP_WINDOW_ICON', '1')
    const { skipWindowIconForQa } = await import('./startupTrace')
    expect(skipWindowIconForQa).toBe(false)
  })

  it('skips the window icon only with opt-in absolute QA trace and flag', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'wirebound-icon-qa-test-'))
    tempDirs.push(dir)
    vi.stubEnv('WIREBOUND_QA_STARTUP_TRACE', join(dir, 'startup.jsonl'))
    vi.stubEnv('WIREBOUND_QA_SKIP_WINDOW_ICON', '1')
    const { skipWindowIconForQa } = await import('./startupTrace')
    expect(skipWindowIconForQa).toBe(true)
  })

  it('never schedules a heartbeat for ordinary application launches', async () => {
    vi.stubEnv('WIREBOUND_QA_STARTUP_TRACE', undefined)
    const { startStartupHeartbeat } = await import('./startupTrace')
    expect(startStartupHeartbeat()).toBeNull()
  })

  it('records numeric QA heartbeats and stops the timer after two minutes', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'wirebound-heartbeat-test-'))
    tempDirs.push(dir)
    const file = join(dir, 'startup.jsonl')
    vi.stubEnv('WIREBOUND_QA_STARTUP_TRACE', file)
    vi.useFakeTimers()

    const { startStartupHeartbeat } = await import('./startupTrace')
    const timer = startStartupHeartbeat()
    expect(timer).not.toBeNull()

    vi.advanceTimersByTime(120_000)
    const lines = readFileSync(file, 'utf8').trim().split('\n')
    const pulses = lines.map((line) => JSON.parse(line) as Record<string, unknown>)
    expect(pulses.length).toBeGreaterThan(0)
    expect(pulses.every((pulse) => pulse.event === 'main-loop-heartbeat')).toBe(true)
    expect(pulses.every((pulse) => typeof pulse.tick === 'number')).toBe(true)
    expect(pulses.every((pulse) => typeof pulse.delayMs === 'number')).toBe(true)
    expect(pulses.every((pulse) => !('path' in pulse) && !('deviceId' in pulse))).toBe(true)

    const countAtTimeout = pulses.length
    vi.advanceTimersByTime(10_000)
    expect(readFileSync(file, 'utf8').trim().split('\n')).toHaveLength(countAtTimeout)
  })

  it('never fails application startup when the trace cannot be written', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'wirebound-trace-test-'))
    tempDirs.push(dir)
    vi.stubEnv('WIREBOUND_QA_STARTUP_TRACE', join(dir, 'missing-dir', 'startup.jsonl'))
    const { traceStartup } = await import('./startupTrace')
    expect(() => traceStartup('ready-to-show')).not.toThrow()
  })
})
