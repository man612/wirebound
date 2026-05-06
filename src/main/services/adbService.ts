import { execFile, type ExecFileException } from 'child_process'
import { existsSync } from 'fs'
import type { RuntimePaths } from '../appPaths'
import type { ActionResult, AdbDevice } from '../../shared/types'

const GNIREHTET_PACKAGE = 'com.genymobile.gnirehtet'
const SPEED_TEST_URL = 'https://fast.com'

function capitalize(value: string): string {
  return value ? `${value.charAt(0).toUpperCase()}${value.slice(1)}` : ''
}

function errorMessage(error: ExecFileException, stderr: string | Buffer): string {
  const stderrText = stderr.toString().trim()
  return stderrText || error.message
}

export class AdbService {
  public constructor(private readonly paths: RuntimePaths) {}

  private adbEnv(): NodeJS.ProcessEnv {
    return {
      ...process.env,
      PATH: `${this.paths.adbDir};${process.env.PATH ?? ''}`
    }
  }

  private execAdb(args: string[], timeout = 5000): Promise<string> {
    if (!existsSync(this.paths.adbExe)) {
      return Promise.reject(new Error(`ADB not found: ${this.paths.adbExe}`))
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

  public async getDevices(): Promise<AdbDevice[]> {
    try {
      const stdout = await this.execAdb(['devices'])
      const devices = stdout
        .split(/\r?\n/)
        .map((line) => line.trim().match(/^([^\s]+)\s+(device|offline|unauthorized)$/))
        .filter((match): match is RegExpMatchArray => match !== null)
        .map((match) => ({
          id: match[1],
          name: 'Android Device',
          status: match[2] as AdbDevice['status']
        }))

      return Promise.all(
        devices.map(async (device) => {
          if (device.status !== 'device') {
            return device
          }

          const details = await this.getDeviceDetails(device.id)
          return { ...device, ...details }
        })
      )
    } catch (error) {
      console.warn('Wirebound: Failed to list ADB devices.', error)
      return []
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
        error: error instanceof Error ? error.message : 'Failed to open speed test on device.'
      }
    }
  }

  public async stopAllClients(): Promise<number> {
    const devices = await this.getDevices()
    const activeDevices = devices.filter((device) => device.status === 'device')

    await Promise.all(activeDevices.map((device) => this.stopClient(device.id)))
    return activeDevices.length
  }

  public async getActiveGnirehtetClients(devices?: AdbDevice[]): Promise<AdbDevice[]> {
    const deviceList = devices ?? (await this.getDevices())
    const activeDevices = deviceList.filter((device) => device.status === 'device')
    const states = await Promise.all(
      activeDevices.map(async (device) => ({
        device,
        active: await this.isGnirehtetClientActive(device.id)
      }))
    )

    return states.filter((state) => state.active).map((state) => state.device)
  }

  private async getDeviceDetails(deviceId: string): Promise<Pick<AdbDevice, 'name' | 'battery'>> {
    try {
      const [brandOutput, modelOutput, batteryOutput] = await Promise.all([
        this.execAdb(['-s', deviceId, 'shell', 'getprop', 'ro.product.brand'], 3000),
        this.execAdb(['-s', deviceId, 'shell', 'getprop', 'ro.product.model'], 3000),
        this.execAdb(['-s', deviceId, 'shell', 'dumpsys', 'battery'], 3000)
      ])

      const brand = capitalize(brandOutput.trim())
      const model = modelOutput.trim()
      const batteryMatch = batteryOutput.match(/level:\s*(\d+)/i)

      return {
        name: `${brand} ${model}`.trim() || 'Android Device',
        battery: batteryMatch?.[1]
      }
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
