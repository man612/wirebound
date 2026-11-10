import type { DiagnosticReport } from '../../../../shared/types'

/** Keep diagnostic failures visible until the user deliberately collapses them. */
export function hasFailedDiagnosticChecks(
  report: Pick<DiagnosticReport, 'checks'> | undefined
): boolean {
  return report?.checks.some((check) => check.status === 'error') ?? false
}
