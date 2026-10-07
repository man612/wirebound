import { describe, expect, it, vi } from 'vitest'
import type { RuntimePaths } from '../appPaths'
import { AdbService } from './adbService'

const paths: RuntimePaths = {
  root: 'C:\\Wirebound',
  gnirehtetDir: 'C:\\Wirebound\\gnirehtet',
  gnirehtetExe: 'C:\\Wirebound\\gnirehtet\\gnirehtet.exe',
  adbDir: 'C:\\Wirebound\\adb',
  adbExe: 'C:\\Wirebound\\adb\\adb.exe',
  icon: 'C:\\Wirebound\\icon.png',
  trayIcon: 'C:\\Wirebound\\icon.ico'
}

describe('AdbService runtime scenarios', () => {
  it('keeps an unauthorized device visible instead of treating it as no device', async () => {
    const executor = vi.fn(async (args: string[]): Promise<string> => {
      if (args.join(' ') === 'devices') {
        return 'List of devices attached\nABC123\tunauthorized\n'
      }
      throw new Error(`Unexpected ADB command: ${args.join(' ')}`)
    })
    const service = new AdbService(paths, executor)
    vi.spyOn(service, 'ensureServerReady').mockResolvedValue()

    await expect(service.getSnapshot()).resolves.toEqual({
      devices: [{ id: 'ABC123', name: 'Android Device', status: 'unauthorized' }]
    })
  })

  it('enriches an authorized device with model and battery details', async () => {
    const executor = vi.fn(async (args: string[]): Promise<string> => {
      const command = args.join(' ')
      if (command === 'devices') return 'List of devices attached\nABC123\tdevice\n'
      if (command.endsWith('getprop ro.product.brand')) return 'motorola\n'
      if (command.endsWith('getprop ro.product.model')) return 'moto g45 5G\n'
      if (command.endsWith('dumpsys battery')) return 'level: 73\n'
      throw new Error(`Unexpected ADB command: ${command}`)
    })
    const service = new AdbService(paths, executor)
    vi.spyOn(service, 'ensureServerReady').mockResolvedValue()

    const snapshot = await service.getSnapshot()

    expect(snapshot.error).toBeUndefined()
    expect(snapshot.devices).toEqual([
      {
        id: 'ABC123',
        name: 'Motorola moto g45 5G',
        battery: '73',
        status: 'device'
      }
    ])
  })

  it('returns an explicit ADB error instead of silently returning an empty list', async () => {
    const service = new AdbService(paths, async () => {
      throw new Error('ADB transport failed')
    })
    vi.spyOn(service, 'ensureServerReady').mockResolvedValue()

    await expect(service.getSnapshot()).resolves.toEqual({
      devices: [],
      error: 'ADB transport failed'
    })
  })

  it('detects active Gnirehtet clients only on authorized devices', async () => {
    const executor = vi.fn(async (args: string[]): Promise<string> => {
      const command = args.join(' ')
      if (command.includes('-s ABC123') && command.endsWith('pidof com.genymobile.gnirehtet')) {
        return '4321\n'
      }
      throw new Error('client not active')
    })
    const service = new AdbService(paths, executor)

    const active = await service.getActiveGnirehtetClients([
      { id: 'ABC123', name: 'Ready phone', status: 'device' },
      { id: 'LOCKED', name: 'Locked phone', status: 'unauthorized' }
    ])

    expect(active.map((device) => device.id)).toEqual(['ABC123'])
    expect(executor).not.toHaveBeenCalledWith(
      expect.arrayContaining(['LOCKED']),
      expect.anything()
    )
  })
})
