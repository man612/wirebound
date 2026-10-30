import { describe, expect, it } from 'vitest'
import {
  MAX_NATIVE_LOG_LINE,
  NativeLogLineBuffer,
  OVERSIZED_NATIVE_LOG_LINE,
  redactGnirehtetLogLine
} from './gnirehtetLogPrivacy'

describe('Gnirehtet native log redaction', () => {
  it('masks a Rust subprocess command serial while preserving useful diagnostics', () => {
    const line = '2026-10-25 ERROR Main: Cannot start client: Command adb ["-s", "SYNTHETIC-A1", "shell", "am"] returned with value 1'
    const safe = redactGnirehtetLogLine(line)
    expect(safe).toContain('"-s", "SY...A1"')
    expect(safe).toContain('returned with value 1')
    expect(safe).not.toContain('SYNTHETIC-A1')
  })

  it('masks quoted ADB transport errors and labeled serials without suppressing errors', () => {
    expect(redactGnirehtetLogLine("adb: device 'SYNTHETIC-B2' not found"))
      .toBe("adb: device 'SY...B2' not found")
    expect(redactGnirehtetLogLine('device_id=SYNTHETIC-C3 disconnected'))
      .toBe('device_id=SY...C3 disconnected')
    expect(redactGnirehtetLogLine('adb -s SYNTHETIC-D4 shell dumpsys connectivity'))
      .toContain('adb -s SY...D4 shell')
  })

  it('removes known identifiers even in otherwise unstructured native output', () => {
    expect(redactGnirehtetLogLine('Failed for SYNTHETIC-A1; transport unavailable', ['SYNTHETIC-A1']))
      .toBe('Failed for SY...A1; transport unavailable')
    expect(redactGnirehtetLogLine('Relay server started')).toBe('Relay server started')
  })

  it('does not expose raw serial fragments across two native data chunks', () => {
    const buffer = new NativeLogLineBuffer()
    expect(buffer.push('2026 ERROR adb ["-s", "SYN')).toEqual([])
    const lines = buffer.push('THETIC-A1", "shell"] failed\n')
    expect(lines).toHaveLength(1)
    const safe = lines.map((line) => redactGnirehtetLogLine(line)).join('\n')
    expect(safe).toContain('SY...A1')
    expect(safe).not.toContain('SYNTHETIC-A1')
  })

  it('keeps stdout/stderr streams isolated and flushes trailing partial lines', () => {
    const stdout = new NativeLogLineBuffer()
    const stderr = new NativeLogLineBuffer()
    expect(stdout.push('Relay server sta')).toEqual([])
    expect(stderr.push('adb: device \'SYNTHETIC-B2\' not found')).toEqual([])
    expect(stdout.push('rted\n')).toEqual(['Relay server started'])
    const flushed = stderr.flush()
    expect(flushed).toHaveLength(1)
    expect(redactGnirehtetLogLine(flushed[0])).not.toContain('SYNTHETIC-B2')
    expect(stderr.flush()).toEqual([])
  })

  it('discards oversized lines until the newline, then safely resumes next line', () => {
    const buffer = new NativeLogLineBuffer()
    expect(buffer.push('SYNTHETIC-VERY-LONG-SECRET'.repeat(MAX_NATIVE_LOG_LINE))).toEqual([])
    expect(buffer.push('still unsafe\nRelay server started\n')).toEqual([
      OVERSIZED_NATIVE_LOG_LINE,
      'Relay server started'
    ])
    expect(buffer.flush()).toEqual([])
  })
})
