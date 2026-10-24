/**
 * One-shot readiness barrier for services that must not be used until their
 * runtime files have been prepared. An IPC request made during initialization
 * waits for the SAME promise; it cannot accidentally construct a second engine.
 */
export class StartupServiceGate<T> {
  private started = false
  private settled = false
  private resolveReady!: (value: T) => void
  private rejectReady!: (reason: Error) => void
  private readonly ready: Promise<T>

  constructor() {
    this.ready = new Promise<T>((resolve, reject) => {
      this.resolveReady = resolve
      this.rejectReady = reject
    })
    // A renderer might never request services before an initialization error.
    // Keep the error observable through wait() without an unhandled rejection.
    void this.ready.catch(() => undefined)
  }

  public get hasStarted(): boolean {
    return this.started
  }

  public wait(): Promise<T> {
    return this.ready
  }

  public start(initialize: () => T | Promise<T>): void {
    if (this.started || this.settled) return
    this.started = true
    void Promise.resolve()
      .then(initialize)
      .then(
        (value) => {
          if (this.settled) return
          this.settled = true
          this.resolveReady(value)
        },
        (error: unknown) => {
          this.fail(error)
        }
      )
  }

  public fail(error: unknown): void {
    if (this.settled) return
    this.settled = true
    this.rejectReady(error instanceof Error ? error : new Error('Runtime initialization failed.'))
  }
}
