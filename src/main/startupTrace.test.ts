import { afterEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const tempDirs: string[] = []

afterEach(() => {
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

  it('never fails application startup when the trace cannot be written', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'wirebound-trace-test-'))
    tempDirs.push(dir)
    vi.stubEnv('WIREBOUND_QA_STARTUP_TRACE', join(dir, 'missing-dir', 'startup.jsonl'))
    const { traceStartup } = await import('./startupTrace')
    expect(() => traceStartup('ready-to-show')).not.toThrow()
  })
})
