import { execFile, type ExecFileException } from 'child_process'
import { existsSync } from 'fs'
import type { RuntimePaths } from '../appPaths'
import type { ActionResult, AdbDevice, AdbSnapshot } from '../../shared/types'

const GNIREHTET_PACKAGE = 'com.genymobile.gnirehtet'
const SPEED_TEST_URL = 'https://fast.com'
const DEVICE_DETAILS_TTL_MS = 30_000
export const WIREBOUND_ADB_SERVER_PORT = '5038'

interface DeviceDetails {
  name: string
  battery?: string
}

interface CachedDeviceDetails extends DeviceDetails {
  expiresAt: number
}

function capitalize(value: string): string {
  return value ? `${value.charAt(0).toUpperCase()}${value.slice(1)}` : ''
}

function errorMessage(error: ExecFileException, stderr: string | Buffer): string {
  const stderrText = stderr.toString().trim()
  return stderrText || error.message
}

function readableError(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

export function parseAdbDevices(stdout: string): AdbDevice[] {
  return stdout
    .split(/\r?\n/)
    .map((line) =>
      line.trim().match(/^([^\s]+)\s+(device|offline|unauthorized|no permissions)(?:\s+.*)?$/)
    )
    .filter((match): match is RegExpMatchArray => match !== null)
    .map((match) => ({
      id: match[1],
      name: 'Android Device',
      status: match[2] as AdbDevice['status']
    }))
}

export function parseBatteryLevel(output: string): string | undefined {
  return output.match(/level:\s*(\d+)/i)?.[1]
}

export class AdbService {
  private readonly detailsCache = new Map<string, CachedDeviceDetails>()

  public constructor(private readonly paths: RuntimePaths) {}

  private adbEnv(): NodeJS.ProcessEnv {
    return {
      ...process.env,
      PATH: `${this.paths.adbDir};${process.env.PATH ?? ''}`,
      ANDROID_ADB_SERVER_PORT: WIREBOUND_ADB_SERVER_PORT
    }
  }

  private runAdb(args: string[], timeout = 5000): Promise<string> {
    if (!existsSync(this.paths.adbExe)) {
      return Promise.reject(new Error(`ADB runtime not found: ${this.paths.adbExe}`))
    }

    return new Promise((resolve, reject) => {
      execFile(
        this.paths.adbExe,
        args,
        { env: this.adbEnv(), timeout, windowsHide: true },
        (error: ExecFileException | null, stdout: string | Buffer, stderr: string | Buffer) => {
          if (error) {
            reject(new Error(errorMessage(error, stderr)))
            return
          }

          resolve(stdout.toString())
        }
      )
    })
  }

  private execAdb(args: string[], timeout = 5000): Promise<string> {
    return this.runAdb(args, timeout)
  }

  public async releaseOwnedServer(): Promise<void> {
    try {
      await this.runAdb(['kill-server'], 3000)
    } catch (error) {
      console.warn('Wirebound: Failed to stop dedicated ADB server.', error)
    }
  }

  public async getSnapshot(): Promise<AdbSnapshot> {
    try {
      const devices = parseAdbDevices(await this.execAdb(['devices']))
      const connectedIds = new Set(devices.map((device) => device.id))

      for (const cachedId of this.detailsCache.keys()) {
        if (!connectedIds.has(cachedId)) {
          this.detailsCache.delete(cachedId)
        }
      }

      const detailedDevices = await Promise.all(
        devices.map(async (device) => {
          if (device.status !== 'device') {
            return device
          }

          return { ...device, ...(await this.getDeviceDetails(device.id)) }
        })
      )

      return { devices: detailedDevices }
    } catch (error) {
      return {
        devices: [],
        error: readableError(error, 'Unable to query ADB devices.')
      }
    }
  }

  public async openSpeedTest(deviceId: string): Promise<ActionResult> {
    if (!deviceId.trim()) {
      return { success: false, error: 'Device id is empty.' }
    }

    try {
      await this.execAdb(
        [
          '-s',
          deviceId,
          'shell',
          'am',
          'start',
          '-a',
          'android.intent.action.VIEW',
          '-d',
          SPEED_TEST_URL
        ],
        8000
      )
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: readableError(error, 'Failed to open speed test on device.')
      }
    }
  }

  public async stopAllClients(): Promise<number> {
    const snapshot = await this.getSnapshot()

    if (snapshot.error) {
      throw new Error(snapshot.error)
    }

    const activeDevices = snapshot.devices.filter((device) => device.status === 'device')
    await Promise.all(activeDevices.map((device) => this.stopClient(device.id)))
    return activeDevices.length
  }

  public async getActiveGnirehtetClients(devices?: AdbDevice[]): Promise<AdbDevice[]> {
    let deviceList = devices

    if (!deviceList) {
      const snapshot = await this.getSnapshot()
      if (snapshot.error) {
        throw new Error(snapshot.error)
      }
      deviceList = snapshot.devices
    }

    const activeDevices = deviceList.filter((device) => device.status === 'device')
    const states = await Promise.all(
      activeDevices.map(async (device) => ({
        device,
        active: await this.isGnirehtetClientActive(device.id)
      }))
    )

    return states.filter((state) => state.active).map((state) => state.device)
  }

  private async getDeviceDetails(deviceId: string): Promise<DeviceDetails> {
    const cached = this.detailsCache.get(deviceId)

    if (cached && cached.expiresAt > Date.now()) {
      return { name: cached.name, battery: cached.battery }
    }

    try {
      const [brandOutput, modelOutput, batteryOutput] = await Promise.all([
        this.execAdb(['-s', deviceId, 'shell', 'getprop', 'ro.product.brand'], 3000),
        this.execAdb(['-s', deviceId, 'shell', 'getprop', 'ro.product.model'], 3000),
        this.execAdb(['-s', deviceId, 'shell', 'dumpsys', 'battery'], 3000)
      ])

      const brand = capitalize(brandOutput.trim())
      const model = modelOutput.trim()
      const details: DeviceDetails = {
        name: `${brand} ${model}`.trim() || 'Android Device',
        battery: parseBatteryLevel(batteryOutput)
      }

      this.detailsCache.set(deviceId, {
        ...details,
        expiresAt: Date.now() + DEVICE_DETAILS_TTL_MS
      })

      return details
    } catch (error) {
      console.warn(`Wirebound: Failed to read details for ${deviceId}.`, error)
      return { name: 'Android Device' }
    }
  }

  private async stopClient(deviceId: string): Promise<void> {
    try {
      await this.execAdb(['-s', deviceId, 'shell', 'am', 'force-stop', GNIREHTET_PACKAGE], 5000)
    } catch (error) {
      console.warn(`Wirebound: Failed to stop gnirehtet client on ${deviceId}.`, error)
    }
  }

  private async isGnirehtetClientActive(deviceId: string): Promise<boolean> {
    try {
      const output = await this.execAdb(['-s', deviceId, 'shell', 'pidof', GNIREHTET_PACKAGE], 3000)
      return output.trim().length > 0
    } catch {
      try {
        const output = await this.execAdb(
          ['-s', deviceId, 'shell', 'dumpsys', 'activity', 'services', GNIREHTET_PACKAGE],
          4000
        )
        return output.includes(GNIREHTET_PACKAGE)
      } catch {
        return false
      }
    }
  }
}
