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
  DiagnosticStatus,
  DeviceTraffic
} from '../../shared/types'

const GNIREHTET_PACKAGE = 'com.genymobile.gnirehtet'
const SPEED_TEST_URL = 'https://fast.com'
const DEVICE_DETAILS_TTL_MS = 30_000

interface DeviceDetails {
  name: string
  battery?: string
  batteryStatus?: 'charging' | 'full' | 'discharging' | 'unknown'
  codename?: string
  androidVersion?: string
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

/** Android status=2 charging, status=5 full; do not infer state only from percentage. */
export function parseBatteryStatus(output: string): DeviceDetails['batteryStatus'] {
  const status = Number(output.match(/^\s*status:\s*(\d+)/mi)?.[1])
  if (status === 5) return 'full'
  if (status === 2) return 'charging'
  if (status === 3 || status === 4) return 'discharging'
  return 'unknown'
}

export function parseTunnelTraffic(output: string): DeviceTraffic | undefined {
  const candidates: DeviceTraffic[] = []

  for (const line of output.split(/\r?\n/)) {
    const match = line.match(/^\s*([^:\s]+):\s+(.+)$/)
    if (!match || !/^tun\d*$/i.test(match[1])) continue

    const columns = match[2].trim().split(/\s+/)
    if (columns.length < 16) continue

    const rxBytes = Number(columns[0])
    const txBytes = Number(columns[8])
    if (!Number.isFinite(rxBytes) || !Number.isFinite(txBytes) || rxBytes < 0 || txBytes < 0) {
      continue
    }

    candidates.push({
      interfaceName: match[1],
      rxBytes,
      txBytes
    })
  }

  return candidates.sort(
    (left, right) => right.rxBytes + right.txBytes - (left.rxBytes + left.txBytes)
  )[0]
}

// An Android app process can remain alive after its VPN is disconnected.
// Only the active VPN network owned by Gnirehtet proves tethering is connected.
export function parseGnirehtetVpnConnected(output: string): boolean {
  return output.split(/\r?\n/).some(
    (line) =>
      line.includes('NetworkAgentInfo{') &&
      /\bVPN\s+CONNECTED\b/.test(line) &&
      line.includes(`VPN:${GNIREHTET_PACKAGE}`)
  )
}

// Gnirehtet owns this specific socket; never delete unrelated ADB reverse mappings.
export function hasGnirehtetReverseMapping(output: string): boolean {
  return output.split(/\r?\n/).some((line) => {
    const fields = line.trim().split(/\s+/)
    return fields.length === 3 && fields[1] === 'localabstract:gnirehtet' && /^tcp:\d+$/.test(fields[2])
  })
}

export function maskDeviceId(deviceId: string): string {
  const value = deviceId.trim()
  if (value.length <= 4) return '****'
  return `${value.slice(0, 2)}...${value.slice(-2)}`
}

/** Show a device-specific ADB error without exposing that device's raw identifier. */
function safeDeviceError(error: unknown, deviceId: string): string {
  const message = readableError(error, 'ADB operation failed.')
  return deviceId ? message.split(deviceId).join(maskDeviceId(deviceId)) : message
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

type AdbExecutor = (args: string[], timeout: number) => Promise<string>

export class AdbService {
  private readonly detailsCache = new Map<string, CachedDeviceDetails>()
  private serverReadyPromise: Promise<void> | null = null
  private serverReadyAt = 0

  public constructor(
    private readonly paths: RuntimePaths,
    private readonly executor?: AdbExecutor
  ) {}

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
    return this.executor ? this.executor(args, timeout) : this.runAdb(args, timeout)
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

  public async getDiagnostics(
    engineStatus: ConnectionStatus,
    onProgress?: (completed: number, total: number) => void
  ): Promise<DiagnosticReport> {
    const total = 6
    const progress = (completed: number): void => onProgress?.(completed, total)
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

    progress(2)
    if (!existsSync(this.paths.adbExe)) {
      progress(total)
      return { generatedAt: new Date().toISOString(), engineStatus, checks, devices: [] }
    }

    try {
      const versionOutput = await this.execAdb(['version'], 3000)
      const versionLine = versionOutput
        .split(/\r?\n/)
        .map((line) => line.trim())
        .find((line) => line.startsWith('Version '))
      progress(3)
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
      progress(total)
      return { generatedAt: new Date().toISOString(), engineStatus, checks, devices: [] }
    }

    const snapshot = await this.getSnapshot()
    if (snapshot.error) {
      checks.push({ id: 'deviceAccess', status: 'error', detail: snapshot.error })
      progress(total)
      return { generatedAt: new Date().toISOString(), engineStatus, checks, devices: [] }
    }
    progress(4)

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

    progress(5)
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

    progress(total)
    return { generatedAt: new Date().toISOString(), engineStatus, checks, devices }
  }

  public async getTunnelTraffic(deviceId: string): Promise<DeviceTraffic | undefined> {
    try {
      const output = await this.execAdb(
        ['-s', deviceId, 'shell', 'cat', '/proc/net/dev'],
        3000
      )
      return parseTunnelTraffic(output)
    } catch {
      return undefined
    }
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

  public async cleanupGnirehtetReverse(deviceId: string): Promise<boolean> {
    if (deviceId.startsWith('-') || !/^[A-Za-z0-9._:-]{1,255}$/.test(deviceId)) {
      throw new Error('Invalid Android device identifier.')
    }

    const mappings = await this.execAdb(['-s', deviceId, 'reverse', '--list'], 3000)
    if (!hasGnirehtetReverseMapping(mappings)) return false

    await this.execAdb(['-s', deviceId, 'reverse', '--remove', 'localabstract:gnirehtet'], 3000)
    return true
  }

  public async stopAllClients(): Promise<number> {
    const snapshot = await this.getSnapshot()

    if (snapshot.error) {
      throw new Error(snapshot.error)
    }

    const activeDevices = await this.getActiveGnirehtetClients(snapshot.devices)
    // A previously active VPN is not proof that its force-stop command succeeded.
    // Return successful ADB commands, not just the number of detected clients.
    const stopResults = await Promise.all(activeDevices.map((device) => this.stopClient(device.id)))

    // Stale Gnirehtet reverse forwarding can outlive the Android VPN client.
    // Check each authorized phone, even when its VPN was already stopped.
    const authorizedDevices = snapshot.devices.filter((device) => device.status === 'device')
    await Promise.all(
      authorizedDevices.map(async (device) => {
        try {
          await this.cleanupGnirehtetReverse(device.id)
        } catch (error) {
          console.warn(
            `Wirebound: Could not clear Gnirehtet reverse tunnel for ${maskDeviceId(device.id)}.`,
            safeDeviceError(error, device.id)
          )
        }
      })
    )
    return stopResults.filter(Boolean).length
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
      return { name: cached.name, battery: cached.battery, batteryStatus: cached.batteryStatus, codename: cached.codename, androidVersion: cached.androidVersion }
    }

    try {
      const [brandOutput, modelOutput, batteryOutput] = await Promise.all([
        this.execAdb(['-s', deviceId, 'shell', 'getprop', 'ro.product.brand'], 3000),
        this.execAdb(['-s', deviceId, 'shell', 'getprop', 'ro.product.model'], 3000),
        this.execAdb(['-s', deviceId, 'shell', 'dumpsys', 'battery'], 3000)
      ])

      // Optional properties are best-effort; failure must not hide an authorized device.
      const extras = await Promise.allSettled([
        this.execAdb(['-s', deviceId, 'shell', 'getprop', 'ro.product.device'], 3000),
        this.execAdb(['-s', deviceId, 'shell', 'getprop', 'ro.build.version.release'], 3000)
      ])
      const optional = (index: number): string | undefined => {
        const item = extras[index]
        if (item.status !== 'fulfilled') return undefined
        const value = item.value.trim()
        return value && value !== 'unknown' && value.length <= 64 ? value : undefined
      }
      const brand = capitalize(brandOutput.trim())
      const model = modelOutput.trim()
      const details: DeviceDetails = {
        name: `${brand} ${model}`.trim() || 'Android Device',
        battery: parseBatteryLevel(batteryOutput),
        batteryStatus: parseBatteryStatus(batteryOutput),
        codename: optional(0),
        androidVersion: optional(1)
      }

      this.detailsCache.set(deviceId, {
        ...details,
        expiresAt: Date.now() + DEVICE_DETAILS_TTL_MS
      })

      return details
    } catch (error) {
      console.warn(
        `Wirebound: Failed to read details for ${maskDeviceId(deviceId)}.`,
        safeDeviceError(error, deviceId)
      )
      return { name: 'Android Device' }
    }
  }

  private async stopClient(deviceId: string): Promise<boolean> {
    try {
      await this.execAdb(['-s', deviceId, 'shell', 'am', 'force-stop', GNIREHTET_PACKAGE], 5000)
      return true
    } catch (error) {
      console.warn(
        `Wirebound: Failed to stop Gnirehtet client on ${maskDeviceId(deviceId)}.`,
        safeDeviceError(error, deviceId)
      )
      return false
    }
  }

  private async isGnirehtetClientActive(deviceId: string): Promise<boolean> {
    try {
      const output = await this.execAdb(['-s', deviceId, 'shell', 'dumpsys', 'connectivity'], 5000)
      return parseGnirehtetVpnConnected(output)
    } catch {
      // Unknown is not connected: process existence alone cannot prove a VPN tunnel.
      return false
    }
  }
}
