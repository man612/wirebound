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

  it('does not report a disconnected VPN as active when the app process survives', async () => {
    const executor = vi.fn(async (args: string[]): Promise<string> => {
      if (args.join(' ').endsWith('dumpsys connectivity')) {
        return '2167 com.genymobile.gnirehtet\\nNetworkAgentInfo{ni{WIFI CONNECTED}}'
      }
      throw new Error('Unexpected command')
    })
    const service = new AdbService(paths, executor)

    const active = await service.getActiveGnirehtetClients([
      { id: 'ABC123', name: 'Ready phone', status: 'device' }
    ])

    expect(active).toEqual([])
    expect(executor).not.toHaveBeenCalledWith(expect.arrayContaining(['pidof']), expect.anything())
  })

  it('removes only the Gnirehtet-owned ADB reverse socket', async () => {
    const executor = vi.fn(async (args: string[]): Promise<string> => {
      const command = args.join(' ')
      if (command === '-s ABC123 reverse --list') {
        return 'UsbFfs localabstract:other-app tcp:9222\nUsbFfs localabstract:gnirehtet tcp:31416\n'
      }
      if (command === '-s ABC123 reverse --remove localabstract:gnirehtet') return ''
      throw new Error('Unexpected ADB command: ' + command)
    })
    const service = new AdbService(paths, executor)

    await expect(service.cleanupGnirehtetReverse('ABC123')).resolves.toBe(true)
    expect(executor).toHaveBeenCalledTimes(2)
    expect(executor).toHaveBeenNthCalledWith(
      2, ['-s', 'ABC123', 'reverse', '--remove', 'localabstract:gnirehtet'], 3000
    )
    expect(executor).not.toHaveBeenCalledWith(
      expect.arrayContaining(['--remove-all']), expect.anything()
    )
  })

  it('does not remove another app reverse socket when no Gnirehtet mapping exists', async () => {
    const executor = vi.fn(async () => 'UsbFfs localabstract:other-app tcp:9222\n')
    const service = new AdbService(paths, executor)

    await expect(service.cleanupGnirehtetReverse('ABC123')).resolves.toBe(false)
    expect(executor).toHaveBeenCalledTimes(1)
  })

  it('rejects device IDs that could inject ADB options', async () => {
    const executor = vi.fn()
    const service = new AdbService(paths, executor)

    await expect(service.cleanupGnirehtetReverse('--remove-all')).rejects.toThrow(
      'Invalid Android device identifier.'
    )
    expect(executor).not.toHaveBeenCalled()
  })

  it('removes stale reverse mapping on quit even if no VPN is active; skips offline phones', async () => {
    const executor = vi.fn(async (args: string[]): Promise<string> => {
      const command = args.join(' ')
      if (command === '-s ABC123 reverse --list') {
        return 'UsbFfs localabstract:gnirehtet tcp:31416\n'
      }
      if (command === '-s ABC123 reverse --remove localabstract:gnirehtet') return ''
      throw new Error('Unexpected ADB command: ' + command)
    })
    const service = new AdbService(paths, executor)
    vi.spyOn(service, 'getSnapshot').mockResolvedValue({
      devices: [
        { id: 'ABC123', name: 'Ready', status: 'device' },
        { id: 'OFFLINE', name: 'Offline', status: 'offline' }
      ]
    })
    vi.spyOn(service, 'getActiveGnirehtetClients').mockResolvedValue([])

    await expect(service.stopAllClients()).resolves.toBe(0)
    expect(executor).toHaveBeenCalledTimes(2)
    expect(executor).not.toHaveBeenCalledWith(
      expect.arrayContaining(['OFFLINE']), expect.anything()
    )
  })

  it('detects active Gnirehtet clients only on authorized devices', async () => {
    const executor = vi.fn(async (args: string[]): Promise<string> => {
      const command = args.join(' ')
      if (command.includes('-s ABC123') && command.endsWith('dumpsys connectivity')) {
        return 'NetworkAgentInfo{network{110} ni{VPN CONNECTED extra: VPN:com.genymobile.gnirehtet}}'
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
