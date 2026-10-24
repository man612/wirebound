import { afterEach, describe, expect, it, vi } from 'vitest'
import { QA_FULL_PROBE_DEADLINES_MS, scheduleRendererQaProbes } from './rendererQaProbes'

afterEach(() => {
  vi.useRealTimers()
})

describe('bounded QA renderer probes', () => {
  it('always keeps the full two-second probe even when the early UI is ready', async () => {
    vi.useFakeTimers()
    const probe = vi.fn(async (_event: string) => true)
    const cancel = scheduleRendererQaProbes(probe)
    await vi.advanceTimersByTimeAsync(46000)
    expect(probe.mock.calls.map(([event]) => event)).toEqual([
      'renderer-timing-early', 'renderer-root-probe'
    ])
    cancel()
  })

  it('resamples an initially blank placeholder and stops at the first ready UI', async () => {
    vi.useFakeTimers()
    const deadlines: number[] = []
    const probe = vi.fn(async (name: string) => {
      if (name === 'renderer-timing-early') return false
      deadlines.push(Date.now())
      return deadlines.length >= 3
    })
    const started = Date.now()
    const cancel = scheduleRendererQaProbes(probe)
    await vi.advanceTimersByTimeAsync(46000)
    expect(deadlines.map(t => t - started)).toEqual([2000, 5000, 12000])
    expect(probe).toHaveBeenCalledTimes(4)
    cancel()
  })

  it('bounds failed or unavailable probes, including a rejected browser evaluation', async () => {
    vi.useFakeTimers()
    const probe = vi.fn(async (event: string) => {
      if (event === 'renderer-timing-early') return false
      throw new Error('renderer not ready')
    })
    const cancel = scheduleRendererQaProbes(probe)
    await vi.advanceTimersByTimeAsync(90000)
    expect(probe.mock.calls.filter(([name]) => name === 'renderer-root-probe')).toHaveLength(
      QA_FULL_PROBE_DEADLINES_MS.length
    )
    expect(vi.getTimerCount()).toBe(0)
    cancel()
  })

  it('cancels delayed probes on navigation or window destruction', async () => {
    vi.useFakeTimers()
    const probe = vi.fn(async () => false)
    const cancel = scheduleRendererQaProbes(probe)
    await vi.advanceTimersByTimeAsync(2100)
    cancel()
    await vi.advanceTimersByTimeAsync(90000)
    expect(probe).toHaveBeenCalledTimes(2)
    expect(vi.getTimerCount()).toBe(0)
  })
})
