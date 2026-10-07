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
} {
  const ensureServerReady = vi.fn().mockResolvedValue(undefined)
  const getActiveGnirehtetClients = vi.fn().mockResolvedValue([])
  const stopAllClients = vi.fn().mockResolvedValue(0)

  return {
    adb: {
      ensureServerReady,
      getActiveGnirehtetClients,
      stopAllClients
    } as unknown as AdbService,
    ensureServerReady,
    getActiveGnirehtetClients,
    stopAllClients
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
})
