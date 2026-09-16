import { spawn, type ChildProcessWithoutNullStreams } from 'child_process'
import { existsSync } from 'fs'
import { isIP } from 'net'
import type { RuntimePaths } from '../appPaths'
import type { ActionResult, AdbDevice, ConnectionStatus, LogEntry } from '../../shared/types'
import { WIREBOUND_ADB_SERVER_PORT, type AdbService } from './adbService'

type LogSender = (message: string, type?: LogEntry['type']) => void
type StatusSender = (status: ConnectionStatus) => void

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

  public constructor(
    private readonly paths: RuntimePaths,
    private readonly adbService: AdbService,
    private readonly sendLog: LogSender,
    private readonly sendStatus: StatusSender
  ) {}

  public getStatus(): ConnectionStatus {
    return this.status
  }

  public async start(dnsInput: string, portInput: string): Promise<ActionResult> {
    if (this.childProcess) {
      await this.syncStatusWithDeviceState()
      this.sendLog('Wirebound engine is already running.', 'info')
      return { success: true }
    }

    if (!existsSync(this.paths.gnirehtetExe)) {
      return this.fail(`Gnirehtet runtime not found: ${this.paths.gnirehtetExe}`)
    }

    const dns = normalizeDns(dnsInput)
    const port = normalizePort(portInput)

    this.isStopping = false
    this.lastAdbError = null
    this.setStatus('connecting')
    this.sendLog(`Starting Wirebound engine (DNS: ${dns}, Port: ${port})`)

    try {
      const childProcess = spawn(this.paths.gnirehtetExe, ['autorun', '-d', dns, '-p', port], {
        cwd: this.paths.gnirehtetDir,
        env: {
          ...process.env,
          PATH: `${this.paths.adbDir};${process.env.PATH ?? ''}`,
          ANDROID_ADB_SERVER_PORT: WIREBOUND_ADB_SERVER_PORT
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

  public async stop(): Promise<ActionResult> {
    if (this.isStopping) {
      return { success: true }
    }

    this.isStopping = true
    this.sendLog('Stopping Wirebound engine...')

    try {
      if (this.childProcess) {
        const processToStop = this.childProcess
        processToStop.kill()

        const closed = await this.waitForProcessClose(processToStop)
        if (!closed) {
          this.sendLog('Engine did not confirm shutdown within 2 seconds.', 'stderr')
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

  public async syncStatusWithDeviceState(devices?: AdbDevice[]): Promise<void> {
    if (this.isStopping) {
      return
    }

    if (!this.childProcess) {
      this.lastAdbError = null
      if (this.status === 'connected' || this.status === 'connecting') {
        this.setStatus('disconnected')
      }
      return
    }

    try {
      const activeClients = await this.adbService.getActiveGnirehtetClients(devices)
      this.lastAdbError = null
      this.setStatus(activeClients.length > 0 ? 'connected' : 'connecting')
    } catch (error) {
      this.reportAdbUnavailable(readError(error, 'Unable to query Gnirehtet client state.'))
    }
  }

  private attachProcessEvents(childProcess: ChildProcessWithoutNullStreams): void {
    childProcess.stdout.on('data', (data) => this.handleOutput(data, 'stdout'))
    childProcess.stderr.on('data', (data) => this.handleOutput(data, 'stderr'))

    childProcess.on('error', (error) => {
      if (this.childProcess === childProcess) {
        this.childProcess = null
      }
      this.fail(readError(error, 'Gnirehtet process failed.'))
    })

    childProcess.on('close', (code) => {
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
        this.sendLog(`Cleaned ${stoppedClients} Android client(s) after relay exit.`, 'info')
      }
    } catch (error) {
      this.sendLog(
        `Could not clean Android clients: ${readError(error, 'Unknown ADB error')}`,
        'stderr'
      )
    }

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
