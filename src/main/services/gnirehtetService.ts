import { spawn, type ChildProcessWithoutNullStreams } from 'child_process'
import { existsSync } from 'fs'
import type { RuntimePaths } from '../appPaths'
import type { ActionResult, AdbDevice, ConnectionStatus, LogEntry } from '../../shared/types'
import type { AdbService } from './adbService'

type LogSender = (message: string, type?: LogEntry['type']) => void
type StatusSender = (status: ConnectionStatus) => void

function normalizeDns(value: string): string {
  return value.trim() || '8.8.8.8'
}

function normalizePort(value: string): string {
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
  private lastDeviceSync = 0

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

      if (this.status === 'disconnected' || this.status === 'error') {
        this.setStatus('connecting')
      }

      this.sendLog('Wirebound engine is already running.', 'info')
      return { success: true }
    }

    if (!existsSync(this.paths.gnirehtetExe)) {
      return this.fail(`Gnirehtet executable not found: ${this.paths.gnirehtetExe}`)
    }

    const dns = normalizeDns(dnsInput)
    const port = normalizePort(portInput)

    this.setStatus('connecting')
    this.sendLog(`Starting Wirebound engine (DNS: ${dns}, Port: ${port})`)

    try {
      this.isStopping = false
      this.childProcess = spawn(this.paths.gnirehtetExe, ['autorun', '-d', dns, '-p', port], {
        cwd: this.paths.gnirehtetDir,
        env: {
          ...process.env,
          PATH: `${this.paths.adbDir};${process.env.PATH ?? ''}`
        },
        windowsHide: true
      })

      this.attachProcessEvents(this.childProcess)
      return { success: true }
    } catch (error) {
      return this.fail(readError(error, 'Failed to start Gnirehtet.'))
    }
  }

  public async stop(): Promise<ActionResult> {
    this.isStopping = true
    this.sendLog('Stopping Wirebound engine...')

    try {
      if (this.childProcess) {
        const processToStop = this.childProcess
        processToStop.kill()
        await this.waitForProcessClose(processToStop)
        this.childProcess = null
      }

      const stoppedClients = await this.adbService.stopAllClients()
      this.setStatus('disconnected')
      this.sendLog(`Stopped. Cleaned ${stoppedClients} device client(s).`)
      return { success: true }
    } catch (error) {
      return this.fail(readError(error, 'Failed to stop Gnirehtet.'))
    } finally {
      this.isStopping = false
    }
  }

  public dispose(): void {
    if (this.childProcess) {
      this.childProcess.kill()
      this.childProcess = null
    }
  }

  public async syncStatusWithDeviceState(devices?: AdbDevice[]): Promise<void> {
    const now = Date.now()

    if (now - this.lastDeviceSync < 2500) {
      return
    }

    this.lastDeviceSync = now

    if (this.isStopping) {
      return
    }

    try {
      const activeClients = await this.adbService.getActiveGnirehtetClients(devices)

      if (activeClients.length > 0) {
        this.setStatus('connected')
      } else if (this.childProcess && this.status === 'error') {
        this.setStatus('connecting')
      } else if (!this.childProcess && this.status === 'connected') {
        this.setStatus('disconnected')
      }
    } catch (error) {
      console.warn('Wirebound: Failed to sync Gnirehtet status from device state.', error)
    }
  }

  private attachProcessEvents(childProcess: ChildProcessWithoutNullStreams): void {
    childProcess.stdout.on('data', (data) => this.handleOutput(data, 'stdout'))
    childProcess.stderr.on('data', (data) => this.handleOutput(data, 'stderr'))
    childProcess.on('error', (error) => {
      this.fail(readError(error, 'Gnirehtet process failed.'))
      this.childProcess = null
    })
    childProcess.on('close', (code) => {
      const stoppedByUser = this.isStopping
      this.childProcess = null

      if (!stoppedByUser) {
        void this.handleUnexpectedClose(code)
      }
    })
  }

  private async handleUnexpectedClose(code: number | null): Promise<void> {
    const activeClients = await this.adbService.getActiveGnirehtetClients()

    if (activeClients.length > 0) {
      this.sendLog(
        `Engine process exited with code ${code ?? 'unknown'}, but ${activeClients.length} device client(s) are still active.`,
        'info'
      )
      this.setStatus('connected')
      return
    }

    this.sendLog(`Engine exited with code ${code ?? 'unknown'}.`, code === 0 ? 'info' : 'stderr')
    this.setStatus(code === 0 ? 'disconnected' : 'error')
  }

  private handleOutput(data: Buffer, type: LogEntry['type']): void {
    data
      .toString()
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .forEach((line) => {
        this.sendLog(line, type)
        this.updateStatusFromLog(line, type)
      })
  }

  private updateStatusFromLog(message: string, type: LogEntry['type']): void {
    const lowerMessage = message.toLowerCase()

    if (type === 'stderr') {
      return
    }

    if (
      /\b(client|relay|tunnel|vpn)\b.*\b(start|started|open|opened|connect|connected|listen|listening|running)/i.test(
        message
      ) ||
      lowerMessage.includes('connected') ||
      lowerMessage.includes('client started')
    ) {
      this.setStatus('connected')
    }
  }

  private waitForProcessClose(childProcess: ChildProcessWithoutNullStreams): Promise<void> {
    return new Promise((resolve) => {
      const timeout = setTimeout(resolve, 2000)
      childProcess.once('close', () => {
        clearTimeout(timeout)
        resolve()
      })
    })
  }

  private setStatus(status: ConnectionStatus): void {
    this.status = status
    this.sendStatus(status)
  }

  private fail(error: string): ActionResult {
    this.sendLog(error, 'stderr')
    this.setStatus('error')
    return { success: false, error }
  }
}
