import { describe, expect, it, vi } from 'vitest'
import { StartupServiceGate } from './startupServiceGate'

describe('StartupServiceGate', () => {
  it('holds requests until initialization is deliberately started', async () => {
    const gate = new StartupServiceGate<{ name: string }>()
    let resolved = false
    void gate.wait().then(() => { resolved = true })
    await Promise.resolve()
    expect(resolved).toBe(false)
    gate.start(() => ({ name: 'ADB runtime ready' }))
    await expect(gate.wait()).resolves.toEqual({ name: 'ADB runtime ready' })
    expect(resolved).toBe(true)
  })

  it('starts only once even if multiple renderer requests race', async () => {
    const gate = new StartupServiceGate<number>()
    const init = vi.fn(async () => 42)
    const first = gate.wait()
    const second = gate.wait()
    gate.start(init)
    gate.start(init)
    expect(await Promise.all([first, second])).toEqual([42, 42])
    expect(init).toHaveBeenCalledTimes(1)
  })

  it('rejects waiting requests safely when initialization fails', async () => {
    const gate = new StartupServiceGate<string>()
    const first = gate.wait()
    gate.start(() => { throw new Error('No usable ADB runtime') })
    await expect(first).rejects.toThrow('No usable ADB runtime')
  })

  it('ignores a late result after shutdown cancellation', async () => {
    const gate = new StartupServiceGate<string>()
    let complete!: (value: string) => void
    const init = new Promise<string>((resolve) => { complete = resolve })
    gate.start(() => init)
    const wait = gate.wait()
    await Promise.resolve()
    gate.fail(new Error('Wirebound is shutting down.'))
    complete('too late')
    await expect(wait).rejects.toThrow('shutting down')
  })
})
