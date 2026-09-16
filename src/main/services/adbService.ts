import { execFile, spawn, type ExecFileException } from 'child_process'
import { createConnection } from 'net'
import { existsSync } from 'fs'
import type { RuntimePaths } from '../appPaths'
import type {
  ActionResult,
  AdbDevice,
  AdbSnapshot,
  ConnectionStatus,
  DiagnosticCheck,
  DiagnosticDevice,
  DiagnosticReport,
  DiagnosticStatus
} from '../../shared/types'

const GNIREHTET_PACKAGE = 'com.genymobile.gnirehtet'
const SPEED_TEST_URL = 'https://fast.com'
const DEVICE_DETAILS_TTL_MS = 30_000

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

function isAdbPortOpen(timeout = 300): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection({ host: '127.0.0.1', port: 5037 })
    let settled = false

    const finish = (open: boolean): void => {
      if (settled) return
      settled = true
      socket.destroy()
      resolve(open)
    }

    socket.setTimeout(timeout)
    socket.once('connect', () => finish(true))
    socket.once('timeout', () => finish(false))
    socket.once('error', () => finish(false))
  })
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

export function maskDeviceId(deviceId: string): string {
  const value = deviceId.trim()
  if (value.length <= 4) return '****'
  return `${value.slice(0, 2)}...${value.slice(-2)}`
}

export function classifyDeviceAccess(devices: AdbDevice[]): DiagnosticStatus {
  if (devices.some((device) => device.status === 'device')) return 'pass'
  if (
    devices.some((device) => device.status === 'unauthorized' || device.status === 'no permissions')
  ) {
    return 'error'
  }
  return 'warning'
}

export class AdbService {
  private readonly detailsCache = new Map<string, CachedDeviceDetails>()
  private serverReadyPromise: Promise<void> | null = null
  private serverReadyAt = 0

  public constructor(private readonly paths: RuntimePaths) {}

  private adbEnv(): NodeJS.ProcessEnv {
    return {
      ...process.env,
      PATH: `${this.paths.adbDir};${process.env.PATH ?? ''}`
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

  public async ensureServerReady(): Promise<void> {
    if (Date.now() - this.serverReadyAt < 5000) return
    if (this.serverReadyPromise) return this.serverReadyPromise

    this.serverReadyPromise = (async () => {
      if (!existsSync(this.paths.adbExe)) {
        throw new Error(`ADB runtime not found: ${this.paths.adbExe}`)
      }

      if (!(await isAdbPortOpen())) {
        const server = spawn(this.paths.adbExe, ['nodaemon', 'server'], {
          env: this.adbEnv(),
          detached: true,
          stdio: 'ignore',
          windowsHide: true
        })
        server.on('error', (error) => {
          console.warn('Wirebound: Detached ADB server process failed.', error)
        })
        server.unref()
      }

      let lastError: unknown
      for (let attempt = 0; attempt < 20; attempt += 1) {
        if (!(await isAdbPortOpen())) {
          await new Promise((resolve) => setTimeout(resolve, 250))
          continue
        }

        try {
          await this.execAdb(['devices'], 3000)
          this.serverReadyAt = Date.now()
          return
        } catch (error) {
          lastError = error
          await new Promise((resolve) => setTimeout(resolve, 250))
        }
      }

      throw lastError instanceof Error ? lastError : new Error('ADB server did not become ready.')
    })()

    try {
      await this.serverReadyPromise
    } finally {
      this.serverReadyPromise = null
    }
  }

  public async getSnapshot(): Promise<AdbSnapshot> {
    try {
      await this.ensureServerReady()
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

  public async getDiagnostics(engineStatus: ConnectionStatus): Promise<DiagnosticReport> {
    const checks: DiagnosticCheck[] = [
      {
        id: 'adbRuntime',
        status: existsSync(this.paths.adbExe) ? 'pass' : 'error',
        detail: existsSync(this.paths.adbExe)
          ? 'ADB runtime is present.'
          : 'ADB runtime is missing.'
      },
      {
        id: 'gnirehtetRuntime',
        status: existsSync(this.paths.gnirehtetExe) ? 'pass' : 'error',
        detail: existsSync(this.paths.gnirehtetExe)
          ? 'Gnirehtet runtime is present.'
          : 'Gnirehtet runtime is missing.'
      }
    ]

    if (!existsSync(this.paths.adbExe)) {
      return { generatedAt: new Date().toISOString(), engineStatus, checks, devices: [] }
    }

    try {
      const versionOutput = await this.execAdb(['version'], 3000)
      const versionLine = versionOutput
        .split(/\r?\n/)
        .map((line) => line.trim())
        .find((line) => line.startsWith('Version '))
      checks.push({
        id: 'adbQuery',
        status: 'pass',
        detail: versionLine ?? 'ADB responded successfully.'
      })
    } catch (error) {
      checks.push({
        id: 'adbQuery',
        status: 'error',
        detail: readableError(error, 'ADB did not respond.')
      })
      return { generatedAt: new Date().toISOString(), engineStatus, checks, devices: [] }
    }

    const snapshot = await this.getSnapshot()
    if (snapshot.error) {
      checks.push({ id: 'deviceAccess', status: 'error', detail: snapshot.error })
      return { generatedAt: new Date().toISOString(), engineStatus, checks, devices: [] }
    }

    checks.push({
      id: 'deviceAccess',
      status: classifyDeviceAccess(snapshot.devices),
      detail:
        snapshot.devices.length === 0
          ? 'No Android device is visible to ADB.'
          : `${snapshot.devices.filter((device) => device.status === 'device').length} authorized device(s), ${snapshot.devices.length} total.`
    })

    const devices = await Promise.all(
      snapshot.devices.map((device) => this.getDiagnosticDevice(device))
    )
    const readyDevices = devices.filter((device) => device.status === 'device')

    checks.push({
      id: 'androidVersion',
      status: readyDevices.length > 0 ? 'pass' : 'info',
      detail:
        readyDevices.length > 0
          ? readyDevices
              .map(
                (device) =>
                  `${device.name}: Android ${device.androidVersion ?? '?'} (API ${device.apiLevel ?? '?'})`
              )
              .join('; ')
          : 'Android version can be read after a device is authorized.'
    })

    const activeClients = readyDevices.filter((device) => device.gnirehtetActive).length
    checks.push({
      id: 'gnirehtetClient',
      status:
        engineStatus === 'connected'
          ? activeClients > 0
            ? 'pass'
            : 'error'
          : engineStatus === 'connecting'
            ? 'warning'
            : engineStatus === 'error'
              ? 'error'
              : 'info',
      detail:
        engineStatus === 'connected'
          ? `${activeClients} active Android Gnirehtet client(s).`
          : engineStatus === 'connecting'
            ? 'Desktop relay is running and waiting for the Android VPN client.'
            : engineStatus === 'error'
              ? 'The Wirebound engine is in an error state.'
              : 'The Wirebound engine is stopped.'
    })

    return { generatedAt: new Date().toISOString(), engineStatus, checks, devices }
  }

  public async openSpeedTest(deviceId: string): Promise<ActionResult> {
    if (!deviceId.trim()) {
      return { success: false, error: 'Device id is empty.' }
    }

    try {
      await this.ensureServerReady()
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

    const activeDevices = await this.getActiveGnirehtetClients(snapshot.devices)
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

  private async getDiagnosticDevice(device: AdbDevice): Promise<DiagnosticDevice> {
    const diagnosticDevice: DiagnosticDevice = {
      id: maskDeviceId(device.id),
      name: device.name,
      status: device.status
    }

    if (device.status !== 'device') return diagnosticDevice

    const [androidVersion, apiLevel, packagePath, clientActive] = await Promise.allSettled([
      this.execAdb(['-s', device.id, 'shell', 'getprop', 'ro.build.version.release'], 3000),
      this.execAdb(['-s', device.id, 'shell', 'getprop', 'ro.build.version.sdk'], 3000),
      this.execAdb(['-s', device.id, 'shell', 'pm', 'path', GNIREHTET_PACKAGE], 4000),
      this.isGnirehtetClientActive(device.id)
    ])

    if (androidVersion.status === 'fulfilled') {
      diagnosticDevice.androidVersion = androidVersion.value.trim() || undefined
    }
    if (apiLevel.status === 'fulfilled') {
      diagnosticDevice.apiLevel = apiLevel.value.trim() || undefined
    }
    diagnosticDevice.gnirehtetInstalled =
      packagePath.status === 'fulfilled' && packagePath.value.includes('package:')
    diagnosticDevice.gnirehtetActive = clientActive.status === 'fulfilled' && clientActive.value

    return diagnosticDevice
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
