import { describe, expect, it } from 'vitest'
import type { DiagnosticCheck, DiagnosticStatus } from '../../../../shared/types'
import { hasFailedDiagnosticChecks } from './diagnosticsDisclosure'

const reportWith = (...statuses: DiagnosticStatus[]): { checks: DiagnosticCheck[] } => ({
  checks: statuses.map((status) => ({ id: 'adbRuntime', status }))
})

describe('diagnostic disclosure severity', () => {
  it('allows completed clean and informational scans to auto-collapse', () => {
    expect(hasFailedDiagnosticChecks(undefined)).toBe(false)
    expect(hasFailedDiagnosticChecks(reportWith('pass', 'info', 'warning'))).toBe(false)
  })

  it('retains the panel when one actual check reports an error', () => {
    expect(hasFailedDiagnosticChecks(reportWith('pass', 'error'))).toBe(true)
    expect(hasFailedDiagnosticChecks(reportWith('error', 'pass', 'info'))).toBe(true)
  })

  it('does not classify a warning as a failed check', () => {
    expect(hasFailedDiagnosticChecks(reportWith('warning', 'info'))).toBe(false)
  })
})
