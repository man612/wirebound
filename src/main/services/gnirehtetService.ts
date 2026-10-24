import { execFile, spawn, type ChildProcessWithoutNullStreams } from 'child_process'
import { existsSync } from 'fs'
import { isIP } from 'net'
import type { RuntimePaths } from '../appPaths'
import type { ActionResult, AdbDevice, ConnectionStatus, LogEntry } from '../../shared/types'
import type { AdbService } from './adbService'

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
  private startPromise: Promise<ActionResult> | null = null
  private stopPromise: Promise<ActionResult> | null = null
  private unexpectedExitCleanup: Promise<void> | null = null
  private lifecycleGeneration = 0
  private readonly requestedStops = new WeakSet<ChildProcessWithoutNullStreams>()

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

  public start(dnsInput: string, portInput: string): Promise<ActionResult> {
    if (this.startPromise) return this.startPromise
    if (this.isStopping) {
      return Promise.resolve({ success: false, error: 'Wirebound engine is stopping.' })
    }

    if (this.childProcess) {
      const childProcess = this.childProcess
      if (this.requestedStops.has(childProcess)) {
        return Promise.resolve({
          success: false, error: 'Previous Wirebound engine has not confirmed shutdown.'
        })
      }
      return this.syncStatusWithDeviceState().then(() => {
        if (this.isStopping || this.childProcess !== childProcess) {
          return { success: false, error: 'Wirebound engine start was cancelled.' }
        }
        this.sendLog('Wirebound engine is already running.', 'info')
        return { success: true }
      })
    }

    const generation = ++this.lifecycleGeneration
    const pending = this.launchRelay(dnsInput, portInput, generation)
    this.startPromise = pending
    void pending.then(
      () => { if (this.startPromise === pending) this.startPromise = null },
      () => { if (this.startPromise === pending) this.startPromise = null }
    )
    return pending
  }

  private async launchRelay(
    dnsInput: string,
    portInput: string,
    generation: number
  ): Promise<ActionResult> {
    if (!this.fileExists(this.paths.gnirehtetExe)) {
      return this.fail(`Gnirehtet runtime not found: ${this.paths.gnirehtetExe}`)
    }

    const dns = normalizeDns(dnsInput)
    const port = normalizePort(portInput)

    this.lastAdbError = null
    this.setStatus('connecting')
    this.sendLog(`Starting Wirebound engine (DNS: ${dns}, Port: ${port})`)

    try {
      // A previous relay's unexpected-exit cleanup must finish before a new
      // autorun relay may create Android clients or ADB reverse mappings.
      if (this.unexpectedExitCleanup) await this.unexpectedExitCleanup
      await this.adbService.ensureServerReady()
      if (generation !== this.lifecycleGeneration || this.isStopping) {
        return { success: false, error: 'Wirebound engine start was cancelled.' }
      }

      const childProcess = this.spawnProcess(this.paths.gnirehtetExe, ['autorun', '-d', dns, '-p', port], {
        cwd: this.paths.gnirehtetDir,
        env: {
          ...process.env,
          PATH: `${this.paths.adbDir};${process.env.PATH ?? ''}`
        },
        windowsHide: true
      })

      this.childProcess = childProcess
      this.attachProcessEvents(childProcess, generation)
      return { success: true }
    } catch (error) {
      if (generation !== this.lifecycleGeneration || this.isStopping) {
        return { success: false, error: 'Wirebound engine start was cancelled.' }
      }
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

    const dns = normalizeDns(dnsInput)
    const port = normalizePort(portInput)

    try {
      await this.adbService.ensureServerReady()
      await this.runDeviceCommand(['start', deviceId, '-d', dns, '-p', port], 10_000)
      this.sendLog('Requested tethering start for the selected Android device.', 'info')
      await this.syncStatusWithDeviceState()
      return { success: true }
    } catch (error) {
      const message = readError(error, 'Failed to start tethering on the selected device.')
      this.sendLog(message, 'stderr')
      return { success: false, error: message }
    }
  }

  public async stopDevice(deviceId: string): Promise<ActionResult> {
    if (!this.isValidDeviceId(deviceId)) {
      return { success: false, error: 'Device id is invalid.' }
    }

    try {
      await this.adbService.ensureServerReady()
      await this.runDeviceCommand(['stop', deviceId], 10_000)
      try {
        await this.adbService.cleanupGnirehtetReverse(deviceId)
      } catch (error) {
        // The VPN stop succeeded; a stale ADB reverse tunnel is only a cleanup warning.
        this.sendLog(`Could not remove Gnirehtet USB tunnel: ${readError(error, 'ADB error')}`, 'stderr')
      }
      this.sendLog('Stopped tethering on the selected Android device.', 'info')
      await this.syncStatusWithDeviceState()
      return { success: true }
    } catch (error) {
      const message = readError(error, 'Failed to stop tethering on the selected device.')
      this.sendLog(message, 'stderr')
      return { success: false, error: message }
    }
  }

  public stop(): Promise<ActionResult> {
    if (this.stopPromise) return this.stopPromise

    // Invalidate every Start that has passed its first check but is still
    // awaiting ADB or cleanup. A new Start must never cross this Stop.
    this.lifecycleGeneration += 1
    this.startPromise = null
    this.isStopping = true
    const pending = this.stopRelay()
    this.stopPromise = pending
    void pending.then(
      () => { if (this.stopPromise === pending) this.stopPromise = null },
      () => { if (this.stopPromise === pending) this.stopPromise = null }
    )
    return pending
  }

  private async stopRelay(): Promise<ActionResult> {
    this.sendLog('Stopping Wirebound engine...')

    try {
      if (this.childProcess) {
        const processToStop = this.childProcess
        this.requestedStops.add(processToStop)
        processToStop.kill()

        const closed = await this.waitForProcessClose(processToStop)
        if (!closed && this.childProcess === processToStop) {
          // Do not pretend it stopped, lose the last reference, or spawn a
          // replacement while a native relay could still be running.
          return this.fail('Engine did not confirm shutdown within 2 seconds.')
        }

        if (this.childProcess === processToStop) {
          this.childProcess = null
        }
      }

      const stoppedClients = await this.adbService.stopAllClients()
      this.lastAdbError = null
      this.setStatus('disconnected')
      this.sendLog(`Stopped. Cleaned ${stoppedClients} device client(s).`)
      return { success: true }
    } catch (error) {
      return this.fail(readError(error, 'Failed to stop Gnirehtet.'))
    } finally {
      this.isStopping = false
    }
  }

  public reportAdbUnavailable(error: string): void {
    if (this.lastAdbError !== error) {
      this.sendLog(`ADB unavailable: ${error}`, 'stderr')
      this.lastAdbError = error
    }

    if (this.childProcess || this.status === 'connecting' || this.status === 'connected') {
      this.setStatus('error')
    }
  }

  public async syncStatusWithDeviceState(devices?: AdbDevice[]): Promise<Set<string>> {
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

  private attachProcessEvents(
    childProcess: ChildProcessWithoutNullStreams,
    generation: number
  ): void {
    childProcess.stdout.on('data', (data) => this.handleOutput(data, 'stdout'))
    childProcess.stderr.on('data', (data) => this.handleOutput(data, 'stderr'))

    childProcess.on('error', (error) => {
      if (this.childProcess !== childProcess) return
      if (this.requestedStops.has(childProcess)) return
      this.childProcess = null
      this.fail(readError(error, 'Gnirehtet process failed.'))
    })

    childProcess.on('close', (code) => {
      if (this.childProcess !== childProcess) return
      this.childProcess = null
      if (this.requestedStops.has(childProcess) || this.isStopping) return

      const cleanup = this.handleUnexpectedClose(code, generation)
      this.unexpectedExitCleanup = cleanup
      void cleanup.then(
        () => { if (this.unexpectedExitCleanup === cleanup) this.unexpectedExitCleanup = null },
        () => { if (this.unexpectedExitCleanup === cleanup) this.unexpectedExitCleanup = null }
      )
    })
  }

  private async handleUnexpectedClose(code: number | null, generation: number): Promise<void> {
    // Obsolete children must never change a later relay's status.
    if (generation !== this.lifecycleGeneration || this.childProcess || this.isStopping) return

    try {
      const stoppedClients = await this.adbService.stopAllClients()
      if (generation !== this.lifecycleGeneration || this.childProcess || this.isStopping) return
      if (stoppedClients > 0) {
        this.sendLog(`Cleaned ${stoppedClients} Android client(s) after relay exit.`, 'info')
      }
    } catch (error) {
      if (generation !== this.lifecycleGeneration || this.childProcess || this.isStopping) return
      this.sendLog(
        `Could not clean Android clients: ${readError(error, 'Unknown ADB error')}`,
        'stderr'
      )
    }

    if (generation !== this.lifecycleGeneration || this.childProcess || this.isStopping) return
    const exitCode = code ?? 'unknown'
    if (code === 0) {
      this.sendLog(`Engine exited with code ${exitCode}.`, 'info')
      this.setStatus('disconnected')
    } else {
      this.sendLog(`Engine exited unexpectedly with code ${exitCode}.`, 'stderr')
      this.setStatus('error')
    }
  }

  private handleOutput(data: Buffer, type: LogEntry['type']): void {
    data
      .toString()
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .forEach((line) => this.sendLog(line, type))
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
    this.sendLog(error, 'stderr')
    this.setStatus('error')
    return { success: false, error }
  }
}
