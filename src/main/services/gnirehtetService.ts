import { execFile, spawn, type ChildProcessWithoutNullStreams } from 'child_process'
import { existsSync } from 'fs'
import { isIP } from 'net'
import type { RuntimePaths } from '../appPaths'
import type { ActionResult, AdbDevice, ConnectionStatus, LogEntry } from '../../shared/types'
import type { AdbService } from './adbService'
import { NativeLogLineBuffer, redactGnirehtetLogLine } from './gnirehtetLogPrivacy'

type LogSender = (message: string, type?: LogEntry['type']) => void
type StatusSender = (status: ConnectionStatus) => void
type ProcessSpawner = typeof spawn
type FileExists = (path: string) => boolean
type DeviceCommandRunner = (args: string[], timeout: number) => Promise<string>

const DEVICE_ID_PATTERN = /^[A-Za-z0-9._:-]+$/

export function normalizeDns(value: string): string {
  const dns = value.trim()
  return isIP(dns) === 4 ? dns : '8.8.8.8'
}

export function normalizePort(value: string): string {
  const port = Number(value.trim())
  return Number.isInteger(port) && port >= 1 && port <= 65535 ? String(port) : '31416'
}

function readError(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

export class GnirehtetService {
  private childProcess: ChildProcessWithoutNullStreams | null = null
  private status: ConnectionStatus = 'disconnected'
  private isStopping = false
  private lastAdbError: string | null = null
  private readonly knownDeviceIds = new Set<string>()

  public constructor(
    private readonly paths: RuntimePaths,
    private readonly adbService: AdbService,
    private readonly sendLog: LogSender,
    private readonly sendStatus: StatusSender,
    private readonly spawnProcess: ProcessSpawner = spawn,
    private readonly fileExists: FileExists = existsSync,
    private readonly deviceCommandRunner?: DeviceCommandRunner
  ) {}

  public getStatus(): ConnectionStatus {
    return this.status
  }

  // Only a limited set of known, actual ADB IDs is kept for log redaction.
  private rememberDeviceId(deviceId: string): void {
    if (!/^[A-Za-z0-9._:-]{4,255}$/.test(deviceId) || this.knownDeviceIds.has(deviceId)) return
    if (this.knownDeviceIds.size >= 64) {
      const oldest = this.knownDeviceIds.values().next().value
      if (oldest) this.knownDeviceIds.delete(oldest)
    }
    this.knownDeviceIds.add(deviceId)
  }

  private emitSafeLog(message: string, type: LogEntry['type'] = 'info'): void {
    this.sendLog(redactGnirehtetLogLine(message, [...this.knownDeviceIds]), type)
  }

  public async start(dnsInput: string, portInput: string): Promise<ActionResult> {
    if (this.childProcess) {
      await this.syncStatusWithDeviceState()
      this.emitSafeLog('Wirebound engine is already running.', 'info')
      return { success: true }
    }

    if (!this.fileExists(this.paths.gnirehtetExe)) {
      return this.fail(`Gnirehtet runtime not found: ${this.paths.gnirehtetExe}`)
    }

    const dns = normalizeDns(dnsInput)
    const port = normalizePort(portInput)

    this.isStopping = false
    this.lastAdbError = null
    this.setStatus('connecting')
    this.emitSafeLog(`Starting Wirebound engine (DNS: ${dns}, Port: ${port})`)

    try {
      await this.adbService.ensureServerReady()
      const childProcess = this.spawnProcess(this.paths.gnirehtetExe, ['autorun', '-d', dns, '-p', port], {
        cwd: this.paths.gnirehtetDir,
        env: {
          ...process.env,
          PATH: `${this.paths.adbDir};${process.env.PATH ?? ''}`
        },
        windowsHide: true
      })

      this.childProcess = childProcess
      this.attachProcessEvents(childProcess)
      return { success: true }
    } catch (error) {
      this.childProcess = null
      return this.fail(readError(error, 'Failed to start Gnirehtet.'))
    }
  }

  public async startDevice(
    deviceId: string,
    dnsInput: string,
    portInput: string
  ): Promise<ActionResult> {
    if (!this.childProcess) {
      return { success: false, error: 'Start the Wirebound engine before connecting one device.' }
    }
    if (!this.isValidDeviceId(deviceId)) {
      return { success: false, error: 'Device id is invalid.' }
    }
    this.rememberDeviceId(deviceId)

    const dns = normalizeDns(dnsInput)
    const port = normalizePort(portInput)

    try {
      await this.adbService.ensureServerReady()
      await this.runDeviceCommand(['start', deviceId, '-d', dns, '-p', port], 10_000)
      this.emitSafeLog('Requested tethering start for the selected Android device.', 'info')
      await this.syncStatusWithDeviceState()
      return { success: true }
    } catch (error) {
      const message = readError(error, 'Failed to start tethering on the selected device.')
      this.emitSafeLog(message, 'stderr')
      return {
        success: false,
        error: redactGnirehtetLogLine(message, [...this.knownDeviceIds])
      }
    }
  }

  public async stopDevice(deviceId: string): Promise<ActionResult> {
    if (!this.isValidDeviceId(deviceId)) {
      return { success: false, error: 'Device id is invalid.' }
    }
    this.rememberDeviceId(deviceId)

    try {
      await this.adbService.ensureServerReady()
      await this.runDeviceCommand(['stop', deviceId], 10_000)
      try {
        await this.adbService.cleanupGnirehtetReverse(deviceId)
      } catch (error) {
        // The VPN stop succeeded; a stale ADB reverse tunnel is only a cleanup warning.
        this.emitSafeLog(`Could not remove Gnirehtet USB tunnel: ${readError(error, 'ADB error')}`, 'stderr')
      }
      this.emitSafeLog('Stopped tethering on the selected Android device.', 'info')
      await this.syncStatusWithDeviceState()
      return { success: true }
    } catch (error) {
      const message = readError(error, 'Failed to stop tethering on the selected device.')
      this.emitSafeLog(message, 'stderr')
      return {
        success: false,
        error: redactGnirehtetLogLine(message, [...this.knownDeviceIds])
      }
    }
  }

  public async stop(): Promise<ActionResult> {
    if (this.isStopping) {
      return { success: true }
    }

    this.isStopping = true
    this.emitSafeLog('Stopping Wirebound engine...')

    try {
      if (this.childProcess) {
        const processToStop = this.childProcess
        processToStop.kill()

        const closed = await this.waitForProcessClose(processToStop)
        if (!closed) {
          this.emitSafeLog('Engine did not confirm shutdown within 2 seconds.', 'stderr')
        }

        if (this.childProcess === processToStop) {
          this.childProcess = null
        }
      }

      const stoppedClients = await this.adbService.stopAllClients()
      this.lastAdbError = null
      this.setStatus('disconnected')
      this.emitSafeLog(`Stopped. Cleaned ${stoppedClients} device client(s).`)
      return { success: true }
    } catch (error) {
      return this.fail(readError(error, 'Failed to stop Gnirehtet.'))
    } finally {
      this.isStopping = false
    }
  }

  public reportAdbUnavailable(error: string): void {
    if (this.lastAdbError !== error) {
      this.emitSafeLog(`ADB unavailable: ${error}`, 'stderr')
      this.lastAdbError = error
    }

    if (this.childProcess || this.status === 'connecting' || this.status === 'connected') {
      this.setStatus('error')
    }
  }

  public async syncStatusWithDeviceState(devices?: AdbDevice[]): Promise<Set<string>> {
    for (const device of devices ?? []) this.rememberDeviceId(device.id)
    if (this.isStopping) {
      return new Set()
    }

    if (!this.childProcess) {
      this.lastAdbError = null
      if (this.status === 'connected' || this.status === 'connecting') {
        this.setStatus('disconnected')
      }
      return new Set()
    }

    try {
      const activeClients = await this.adbService.getActiveGnirehtetClients(devices)
      for (const device of activeClients) this.rememberDeviceId(device.id)
      this.lastAdbError = null
      this.setStatus(activeClients.length > 0 ? 'connected' : 'connecting')
      return new Set(activeClients.map((device) => device.id))
    } catch (error) {
      this.reportAdbUnavailable(readError(error, 'Unable to query Gnirehtet client state.'))
      return new Set()
    }
  }

  private isValidDeviceId(deviceId: string): boolean {
    const value = deviceId.trim()
    return value.length > 0 && value.length <= 255 && !value.startsWith('-') && DEVICE_ID_PATTERN.test(value)
  }

  private runDeviceCommand(args: string[], timeout: number): Promise<string> {
    if (this.deviceCommandRunner) {
      return this.deviceCommandRunner(args, timeout)
    }

    if (!this.fileExists(this.paths.gnirehtetExe)) {
      return Promise.reject(new Error(`Gnirehtet runtime not found: ${this.paths.gnirehtetExe}`))
    }

    return new Promise((resolve, reject) => {
      execFile(
        this.paths.gnirehtetExe,
        args,
        {
          cwd: this.paths.gnirehtetDir,
          env: {
            ...process.env,
            PATH: `${this.paths.adbDir};${process.env.PATH ?? ''}`
          },
          timeout,
          windowsHide: true,
          encoding: 'utf8'
        },
        (error, stdout, stderr) => {
          if (error) {
            reject(new Error(stderr.trim() || error.message))
            return
          }
          resolve(stdout)
        }
      )
    })
  }

  private attachProcessEvents(childProcess: ChildProcessWithoutNullStreams): void {
    const stdoutLines = new NativeLogLineBuffer()
    const stderrLines = new NativeLogLineBuffer()
    childProcess.stdout.on('data', (data) => this.handleOutput(data, 'stdout', stdoutLines))
    childProcess.stderr.on('data', (data) => this.handleOutput(data, 'stderr', stderrLines))
    const flushOutput = (): void => {
      for (const line of stdoutLines.flush()) this.emitSafeLog(line, 'stdout')
      for (const line of stderrLines.flush()) this.emitSafeLog(line, 'stderr')
    }

    childProcess.on('error', (error) => {
      flushOutput()
      if (this.childProcess === childProcess) {
        this.childProcess = null
      }
      this.fail(readError(error, 'Gnirehtet process failed.'))
    })

    childProcess.on('close', (code) => {
      flushOutput()
      if (this.childProcess === childProcess) {
        this.childProcess = null
      }

      if (!this.isStopping) {
        void this.handleUnexpectedClose(code)
      }
    })
  }

  private async handleUnexpectedClose(code: number | null): Promise<void> {
    try {
      const stoppedClients = await this.adbService.stopAllClients()
      if (stoppedClients > 0) {
        this.emitSafeLog(`Cleaned ${stoppedClients} Android client(s) after relay exit.`, 'info')
      }
    } catch (error) {
      this.emitSafeLog(
        `Could not clean Android clients: ${readError(error, 'Unknown ADB error')}`,
        'stderr'
      )
    }

    const exitCode = code ?? 'unknown'
    if (code === 0) {
      this.emitSafeLog(`Engine exited with code ${exitCode}.`, 'info')
      this.setStatus('disconnected')
    } else {
      this.emitSafeLog(`Engine exited unexpectedly with code ${exitCode}.`, 'stderr')
      this.setStatus('error')
    }
  }

  private handleOutput(
    data: Buffer,
    type: LogEntry['type'],
    lines: NativeLogLineBuffer
  ): void {
    for (const line of lines.push(data.toString())) this.emitSafeLog(line, type)
  }

  private waitForProcessClose(childProcess: ChildProcessWithoutNullStreams): Promise<boolean> {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => resolve(false), 2000)

      childProcess.once('close', () => {
        clearTimeout(timeout)
        resolve(true)
      })
    })
  }

  private setStatus(status: ConnectionStatus): void {
    if (this.status === status) {
      return
    }

    this.status = status
    this.sendStatus(status)
  }

  private fail(error: string): ActionResult {
    const safeError = redactGnirehtetLogLine(error, [...this.knownDeviceIds])
    this.emitSafeLog(safeError, 'stderr')
    this.setStatus('error')
    return { success: false, error: safeError }
  }
}
