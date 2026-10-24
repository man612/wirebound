/** Maximum text retained for one native stdout/stderr line before dropping it. */
export const MAX_NATIVE_LOG_LINE = 8192
export const OVERSIZED_NATIVE_LOG_LINE = '[Gnirehtet output line omitted: exceeds safe length]'

function maskId(value: string): string {
  return value.length <= 4 ? '****' : `${value.slice(0, 2)}...${value.slice(-2)}`
}

/**
 * Redact known ADB identifiers and the argument forms emitted by Gnirehtet
 * (notably Rust's Command [... "-s", "serial" ...] errors).
 *
 * This is NOT a generic PII sanitizer: unstructured output may have unrelated
 * sensitive values. Do not use raw native logs as a shareable support report.
 */
export function redactGnirehtetLogLine(
  line: string,
  knownDeviceIds: readonly string[] = []
): string {
  let text = line

  // Longest first handles overlapping serial substrings deterministically.
  const ids = [...new Set(knownDeviceIds)]
    .filter((id) => id.length >= 4)
    .sort((a, b) => b.length - a.length)
  for (const id of ids) {
    text = text.split(id).join(maskId(id))
  }

  // Rust: Command adb ["-s", "SERIAL", "shell", ...] returned with value 1.
  text = text.replace(
    /(["']-s["']\s*,\s*["'])([A-Za-z0-9._:-]{5,255})(["'])/g,
    (_, prefix: string, id: string, suffix: string) => prefix + maskId(id) + suffix
  )
  // CLI diagnostics: adb -s SERIAL shell ...
  text = text.replace(
    /(\b-s\s+)([A-Za-z0-9._:-]{5,255})(?=\s|$)/g,
    (_, prefix: string, id: string) => prefix + maskId(id)
  )
  // ADB transport errors: adb: device 'SERIAL' not found / offline / unauthorized.
  text = text.replace(
    /(\bdevice\s+['"])([^'"]{5,255})(['"]\s+(?:not found|offline|unauthorized)\b)/gi,
    (_, prefix: string, id: string, suffix: string) => prefix + maskId(id) + suffix
  )
  // Explicit machine-parseable labels: serial=... / device_id: ...
  text = text.replace(
    /(\b(?:serial(?:no)?|device[_ -]?id)\s*[:=]\s*['"]?)([A-Za-z0-9._:-]{5,255})/gi,
    (_, prefix: string, id: string) => prefix + maskId(id)
  )
  return text
}

/**
 * Native process chunks are arbitrary byte slices, not complete log lines.
 * Buffer to a newline before redacting, never expose a split serial in pieces.
 * Oversized lines are dropped until their newline rather than emitted in parts.
 * One instance must be used per child process AND per stream.
 */
export class NativeLogLineBuffer {
  private pending = ''
  private discardingOversizedLine = false

  public push(chunk: string): string[] {
    const lines: string[] = []
    let cursor = 0

    while (cursor < chunk.length) {
      const end = chunk.indexOf('\n', cursor)
      const fragment = end < 0 ? chunk.slice(cursor) : chunk.slice(cursor, end)
      if (!this.discardingOversizedLine) {
        if (this.pending.length + fragment.length > MAX_NATIVE_LOG_LINE) {
          this.pending = ''
          this.discardingOversizedLine = true
        } else {
          this.pending += fragment
        }
      }

      if (end < 0) break

      if (this.discardingOversizedLine) {
        lines.push(OVERSIZED_NATIVE_LOG_LINE)
      } else {
        const text = this.pending.replace(/\r$/, '').trim()
        if (text) lines.push(text)
      }
      this.pending = ''
      this.discardingOversizedLine = false
      cursor = end + 1
    }
    return lines
  }

  public flush(): string[] {
    const text = this.discardingOversizedLine
      ? OVERSIZED_NATIVE_LOG_LINE
      : this.pending.replace(/\r$/, '').trim()
    this.pending = ''
    this.discardingOversizedLine = false
    return text ? [text] : []
  }
}
