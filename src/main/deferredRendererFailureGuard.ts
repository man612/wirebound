import type { StartupServiceGate } from './startupServiceGate'

type Trace = (event: string, details?: Record<string, string | number | boolean>) => void

/**
 * Fail queued ADB requests if an unshown renderer never becomes usable.
 * No automatic reload loop: the user can restart to retry.
 */
export function createDeferredRendererFailureGuard<T>(
  gate: StartupServiceGate<T>,
  trace: Trace
): {
  onFailedLoad: (errorCode: number, isMainFrame: boolean) => void
  onRendererGone: (reason: string) => void
} {
  return {
    onFailedLoad(errorCode, isMainFrame) {
      // -3 is Chromium's expected ERR_ABORTED on a replaced navigation.
      // A failed subframe must not abort the application's ADB startup.
      if (!isMainFrame || errorCode === -3) return
      trace('deferred-runtime-renderer-failed', { errorCode })
      gate.fail(new Error('Wirebound could not load its interface. Please restart the app.'))
    },
    onRendererGone(reason) {
      trace('deferred-runtime-renderer-gone', { reason })
      gate.fail(new Error('Wirebound interface unexpectedly stopped. Please restart the app.'))
    }
  }
}
