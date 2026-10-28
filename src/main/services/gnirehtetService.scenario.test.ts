import { EventEmitter } from 'events'
import { PassThrough } from 'stream'
import { describe, expect, it, vi } from 'vitest'
import type { ChildProcessWithoutNullStreams } from 'child_process'
import type { RuntimePaths } from '../appPaths'
import type { AdbService } from './adbService'
import { GnirehtetService } from './gnirehtetService'

const paths: RuntimePaths = {
  root: 'C:\\Wirebound',
  gnirehtetDir: 'C:\\Wirebound\\gnirehtet',
  gnirehtetExe: 'C:\\Wirebound\\gnirehtet\\gnirehtet.exe',
  adbDir: 'C:\\Wirebound\\adb',
  adbExe: 'C:\\Wirebound\\adb\\adb.exe',
  icon: 'C:\\Wirebound\\icon.png',
  trayIcon: 'C:\\Wirebound\\icon.ico'
}

function createFakeProcess(): ChildProcessWithoutNullStreams {
  const emitter = new EventEmitter()
  const fake = Object.assign(emitter, {
    stdin: new PassThrough(),
    stdout: new PassThrough(),
    stderr: new PassThrough(),
    kill: vi.fn()
  })
  const child = fake as unknown as ChildProcessWithoutNullStreams

  fake.kill.mockImplementation(() => {
    queueMicrotask(() => child.emit('close', 0))
    return true
  })

  return child
}

function createAdbDouble(): {
  adb: AdbService
  ensureServerReady: ReturnType<typeof vi.fn>
  getActiveGnirehtetClients: ReturnType<typeof vi.fn>
  stopAllClients: ReturnType<typeof vi.fn>
  cleanupGnirehtetReverse: ReturnType<typeof vi.fn>
} {
  const ensureServerReady = vi.fn().mockResolvedValue(undefined)
  const getActiveGnirehtetClients = vi.fn().mockResolvedValue([])
  const stopAllClients = vi.fn().mockResolvedValue(0)
  const cleanupGnirehtetReverse = vi.fn().mockResolvedValue(true)

  return {
    adb: {
      ensureServerReady,
      getActiveGnirehtetClients,
      stopAllClients,
      cleanupGnirehtetReverse
    } as unknown as AdbService,
    ensureServerReady,
    getActiveGnirehtetClients,
    stopAllClients,
    cleanupGnirehtetReverse
  }
}

describe('GnirehtetService lifecycle scenarios', () => {
  it('moves from connecting to connected when an Android client becomes active', async () => {
    const child = createFakeProcess()
    const spawnProcess = vi.fn(() => child) as unknown as typeof import('child_process').spawn
    const { adb, getActiveGnirehtetClients } = createAdbDouble()
    const statuses: string[] = []
    const service = new GnirehtetService(
      paths,
      adb,
      vi.fn(),
      (status) => statuses.push(status),
      spawnProcess,
      () => true
    )

    await expect(service.start('1.1.1.1', '31416')).resolves.toEqual({ success: true })
    expect(service.getStatus()).toBe('connecting')

    getActiveGnirehtetClients.mockResolvedValue([
      { id: 'ABC123', name: 'Phone', status: 'device' }
    ])
    const activeIds = await service.syncStatusWithDeviceState([
      { id: 'ABC123', name: 'Phone', status: 'device' }
    ])

    expect([...activeIds]).toEqual(['ABC123'])
    expect(service.getStatus()).toBe('connected')
    expect(statuses).toEqual(['connecting', 'connected'])
  })

  it('stays in connecting while the relay is running but no Android VPN client is active', async () => {
    const child = createFakeProcess()
    const spawnProcess = vi.fn(() => child) as unknown as typeof import('child_process').spawn
    const { adb } = createAdbDouble()
    const service = new GnirehtetService(paths, adb, vi.fn(), vi.fn(), spawnProcess, () => true)

    await service.start('8.8.8.8', '31416')
    await service.syncStatusWithDeviceState([{ id: 'ABC123', name: 'Phone', status: 'device' }])

    expect(service.getStatus()).toBe('connecting')
  })

  it('targets one attached device with explicit Gnirehtet start and stop commands', async () => {
    const child = createFakeProcess()
    const spawnProcess = vi.fn(() => child) as unknown as typeof import('child_process').spawn
    const commandRunner = vi.fn().mockResolvedValue('')
    const { adb } = createAdbDouble()
    const service = new GnirehtetService(
      paths,
      adb,
      vi.fn(),
      vi.fn(),
      spawnProcess,
      () => true,
      commandRunner
    )

    await service.start('8.8.8.8', '31416')
    await expect(service.startDevice('ABC123', '1.1.1.1', '4242')).resolves.toEqual({
      success: true
    })
    await expect(service.stopDevice('ABC123')).resolves.toEqual({ success: true })

    expect(commandRunner).toHaveBeenNthCalledWith(
      1,
      ['start', 'ABC123', '-d', '1.1.1.1', '-p', '4242'],
      10_000
    )
    expect(commandRunner).toHaveBeenNthCalledWith(2, ['stop', 'ABC123'], 10_000)
    expect(adb.cleanupGnirehtetReverse).toHaveBeenCalledWith('ABC123')
  })

  it('rejects unsafe device identifiers before invoking Gnirehtet', async () => {
    const commandRunner = vi.fn().mockResolvedValue('')
    const { adb } = createAdbDouble()
    const service = new GnirehtetService(
      paths,
      adb,
      vi.fn(),
      vi.fn(),
      vi.fn() as unknown as typeof import('child_process').spawn,
      () => true,
      commandRunner
    )

    await expect(service.stopDevice('--help')).resolves.toEqual({
      success: false,
      error: 'Device id is invalid.'
    })
    expect(commandRunner).not.toHaveBeenCalled()
  })

  it('stops the relay, cleans Android clients, and returns to disconnected', async () => {
    const child = createFakeProcess()
    const spawnProcess = vi.fn(() => child) as unknown as typeof import('child_process').spawn
    const { adb, stopAllClients } = createAdbDouble()
    stopAllClients.mockResolvedValue(2)
    const service = new GnirehtetService(paths, adb, vi.fn(), vi.fn(), spawnProcess, () => true)

    await service.start('8.8.8.8', '31416')
    const result = await service.stop()

    expect(result).toEqual({ success: true })
    expect(child.kill).toHaveBeenCalledOnce()
    expect(stopAllClients).toHaveBeenCalledOnce()
    expect(service.getStatus()).toBe('disconnected')
  })

  it('marks the engine as error and cleans clients after an unexpected relay failure', async () => {
    const child = createFakeProcess()
    const spawnProcess = vi.fn(() => child) as unknown as typeof import('child_process').spawn
    const { adb, stopAllClients } = createAdbDouble()
    const service = new GnirehtetService(paths, adb, vi.fn(), vi.fn(), spawnProcess, () => true)

    await service.start('8.8.8.8', '31416')
    child.emit('close', 7)
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(stopAllClients).toHaveBeenCalledOnce()
    expect(service.getStatus()).toBe('error')
  })

  it('single-flights concurrent starts while ADB readiness is pending', async () => {
    let releaseAdb!: () => void
    const ready = new Promise<void>((resolve) => { releaseAdb = resolve })
    const child = createFakeProcess()
    const spawnProcess = vi.fn(() => child) as unknown as typeof import('child_process').spawn
    const { adb, ensureServerReady } = createAdbDouble()
    ensureServerReady.mockReturnValue(ready)
    const service = new GnirehtetService(paths, adb, vi.fn(), vi.fn(), spawnProcess, () => true)

    const first = service.start('8.8.8.8', '31416')
    const second = service.start('8.8.8.8', '31416')
    expect(spawnProcess).not.toHaveBeenCalled()

    releaseAdb()
    expect(await Promise.all([first, second])).toEqual([{ success: true }, { success: true }])
    expect(spawnProcess).toHaveBeenCalledTimes(1)
    expect(service.getStatus()).toBe('connecting')
  })

  it('does not start a relay after Stop finishes while ADB was pending', async () => {
    let releaseAdb!: () => void
    const ready = new Promise<void>((resolve) => { releaseAdb = resolve })
    const spawnProcess = vi.fn(() => createFakeProcess()) as unknown as typeof import('child_process').spawn
    const { adb, ensureServerReady, stopAllClients } = createAdbDouble()
    ensureServerReady.mockReturnValue(ready)
    const service = new GnirehtetService(paths, adb, vi.fn(), vi.fn(), spawnProcess, () => true)

    const inFlightStart = service.start('8.8.8.8', '31416')
    await expect(service.stop()).resolves.toEqual({ success: true })
    releaseAdb()

    await expect(inFlightStart).resolves.toEqual({
      success: false, error: 'Wirebound engine start was cancelled.'
    })
    expect(stopAllClients).toHaveBeenCalledOnce()
    expect(spawnProcess).not.toHaveBeenCalled()
    expect(service.getStatus()).toBe('disconnected')
  })

  it('does not allow a replacement relay until an old stopping child confirms exit', async () => {
    vi.useFakeTimers()
    try {
      const oldChild = createFakeProcess()
      // A realistic unresponsive child receives kill() but never emits close in time.
      oldChild.kill = vi.fn(() => true)
      const newChild = createFakeProcess()
      const spawnProcess = vi.fn()
        .mockReturnValueOnce(oldChild).mockReturnValueOnce(newChild) as unknown as typeof import('child_process').spawn
      const { adb } = createAdbDouble()
      const service = new GnirehtetService(paths, adb, vi.fn(), vi.fn(), spawnProcess, () => true)

      await service.start('8.8.8.8', '31416')
      const stopping = service.stop()
      await vi.advanceTimersByTimeAsync(2000)
      const outcome = await stopping
      expect(outcome.success).toBe(false)
      expect(service.getStatus()).toBe('error')
      expect((await service.start('8.8.8.8', '31416')).success).toBe(false)
      expect(spawnProcess).toHaveBeenCalledTimes(1)

      // Late completion must not trigger a second, unrelated client cleanup.
      oldChild.emit('close', 7)
      await vi.advanceTimersByTimeAsync(0)
      expect(spawnProcess).toHaveBeenCalledTimes(1)
      await expect(service.start('8.8.8.8', '31416')).resolves.toEqual({ success: true })
      expect(spawnProcess).toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
    }
  })

  it('does not overwrite a new relay status when an old unexpected-exit cleanup resolves late', async () => {
    let releaseCleanup!: (count: number) => void
    const delayedCleanup = new Promise<number>((resolve) => { releaseCleanup = resolve })
    const oldChild = createFakeProcess()
    const newChild = createFakeProcess()
    const spawnProcess = vi.fn()
      .mockReturnValueOnce(oldChild).mockReturnValueOnce(newChild) as unknown as typeof import('child_process').spawn
    const { adb, stopAllClients } = createAdbDouble()
    stopAllClients.mockReturnValueOnce(delayedCleanup)
    const service = new GnirehtetService(paths, adb, vi.fn(), vi.fn(), spawnProcess, () => true)

    await service.start('8.8.8.8', '31416')
    oldChild.emit('close', 7)
    const replacement = service.start('8.8.8.8', '31416')
    // Do not start a replacement relay while old-client cleanup is unresolved.
    await Promise.resolve()
    expect(spawnProcess).toHaveBeenCalledTimes(1)
    releaseCleanup(0)
    await expect(replacement).resolves.toEqual({ success: true })

    expect(spawnProcess).toHaveBeenCalledTimes(2)
    expect(service.getStatus()).toBe('connecting')
  })

  it('shares the actual Stop result rather than reporting an early success to a second caller', async () => {
    const child = createFakeProcess()
    const spawnProcess = vi.fn(() => child) as unknown as typeof import('child_process').spawn
    const { adb, stopAllClients } = createAdbDouble()
    let finishCleanup!: (count: number) => void
    let cleanupEntered!: () => void
    const enteredCleanup = new Promise<void>((resolve) => { cleanupEntered = resolve })
    const pendingCleanup = new Promise<number>((resolve) => { finishCleanup = resolve })
    stopAllClients.mockImplementation(() => {
      cleanupEntered()
      return pendingCleanup
    })
    const service = new GnirehtetService(paths, adb, vi.fn(), vi.fn(), spawnProcess, () => true)

    await service.start('8.8.8.8', '31416')
    const first = service.stop()
    const second = service.stop()
    let secondSettled = false
    void second.then(() => { secondSettled = true })
    await enteredCleanup
    expect(secondSettled).toBe(false)
    finishCleanup(2)
    expect(await Promise.all([first, second])).toEqual([{ success: true }, { success: true }])
    expect(stopAllClients).toHaveBeenCalledOnce()
  })


  it('redacts a serial split between native stderr chunks before forwarding logs', async () => {
    const child = createFakeProcess()
    const spawnProcess = vi.fn(() => child) as unknown as typeof import('child_process').spawn
    const { adb } = createAdbDouble()
    const logs: Array<{ message: string; type?: string }> = []
    const service = new GnirehtetService(
      paths, adb, (message, type) => logs.push({ message, type }), vi.fn(), spawnProcess, () => true
    )

    await service.start('8.8.8.8', '31416')
    child.stderr.emit('data', Buffer.from('2026 ERROR Main: Command adb ["-s", "SYN'))
    expect(logs.some((log) => log.message.includes('SYN'))).toBe(false)
    child.stderr.emit('data', Buffer.from('THETIC-A1", "shell"] returned with value 1\n'))

    const failure = logs.find((log) => log.message.includes('returned with value 1'))
    expect(failure?.type).toBe('stderr')
    expect(failure?.message).toContain('SY...A1')
    expect(failure?.message).not.toContain('SYNTHETIC-A1')
  })

  it('flushes native incomplete lines on child close and keeps stdout separate', async () => {
    const child = createFakeProcess()
    const spawnProcess = vi.fn(() => child) as unknown as typeof import('child_process').spawn
    const { adb } = createAdbDouble()
    const logs: Array<{ message: string; type?: string }> = []
    const service = new GnirehtetService(
      paths, adb, (message, type) => logs.push({ message, type }), vi.fn(), spawnProcess, () => true
    )

    await service.start('8.8.8.8', '31416')
    child.stdout.emit('data', Buffer.from('Relay server started\n'))
    child.stderr.emit('data', Buffer.from("adb: device 'SYNTHETIC-B2' not found"))
    child.emit('close', 0)
    await Promise.resolve()

    expect(logs.some((log) => log.message === 'Relay server started' && log.type === 'stdout')).toBe(true)
    const stderr = logs.find((log) => log.message.includes('not found'))
    expect(stderr?.type).toBe('stderr')
    expect(stderr?.message).toContain('SY...B2')
    expect(stderr?.message).not.toContain('SYNTHETIC-B2')
  })

  it('masks a known device ID in an otherwise unstructured per-device failure', async () => {
    const child = createFakeProcess()
    const spawnProcess = vi.fn(() => child) as unknown as typeof import('child_process').spawn
    const runner = vi.fn().mockRejectedValue(new Error('Command failed for SYNTHETIC-C3'))
    const { adb } = createAdbDouble()
    const logs: string[] = []
    const service = new GnirehtetService(
      paths, adb, (message) => logs.push(message), vi.fn(), spawnProcess, () => true, runner
    )

    await service.start('8.8.8.8', '31416')
    const result = await service.startDevice('SYNTHETIC-C3', '8.8.8.8', '31416')
    expect(result.success).toBe(false)
    // Both the returned IPC result and the emitted service log must be safe.
    expect(result.error).not.toContain('SYNTHETIC-C3')
    expect(result.error).toContain('SY...C3')
    expect(logs.join('\n')).not.toContain('SYNTHETIC-C3')
    expect(logs.join('\n')).toContain('SY...C3')
  })

})
