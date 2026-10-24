import { describe, expect, it, vi } from 'vitest'
import { StartupServiceGate } from './startupServiceGate'
import { createDeferredRendererFailureGuard } from './deferredRendererFailureGuard'

describe('deferred renderer failure guard', () => {
  it('rejects all queued IPC when the main frame load fails', async () => {
    const gate = new StartupServiceGate<string>()
    const trace = vi.fn()
    const guard = createDeferredRendererFailureGuard(gate, trace)
    const request = gate.wait()
    guard.onFailedLoad(-6, true)
    await expect(request).rejects.toThrow('could not load its interface')
    expect(trace).toHaveBeenCalledWith('deferred-runtime-renderer-failed', { errorCode: -6 })
  })

  it('ignores a subframe failure and an expected navigation cancellation', async () => {
    const gate = new StartupServiceGate<string>()
    const trace = vi.fn()
    const guard = createDeferredRendererFailureGuard(gate, trace)
    guard.onFailedLoad(-6, false)
    guard.onFailedLoad(-3, true)
    gate.start(() => 'ready')
    await expect(gate.wait()).resolves.toBe('ready')
    expect(trace).not.toHaveBeenCalled()
  })

  it('rejects queued calls when Chromium renderer exits', async () => {
    const gate = new StartupServiceGate<string>()
    const trace = vi.fn()
    const guard = createDeferredRendererFailureGuard(gate, trace)
    const request = gate.wait()
    guard.onRendererGone('crashed')
    await expect(request).rejects.toThrow('unexpectedly stopped')
    expect(trace).toHaveBeenCalledWith('deferred-runtime-renderer-gone', { reason: 'crashed' })
  })

  it('does not retroactively invalidate an already-ready ADB service', async () => {
    const gate = new StartupServiceGate<string>()
    gate.start(() => 'ready')
    await expect(gate.wait()).resolves.toBe('ready')
    const guard = createDeferredRendererFailureGuard(gate, vi.fn())
    guard.onFailedLoad(-6, true)
    await expect(gate.wait()).resolves.toBe('ready')
  })
})
