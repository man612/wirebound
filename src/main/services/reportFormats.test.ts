import { describe, expect, it } from 'vitest'
import { formatSupportContent, parseReportFormat } from './reportFormats'
describe('Report export formats', () => {
  it('supports common extensions and rejects misleading suffixes', () => {
    expect(parseReportFormat('report.json')).toBe('json')
    expect(parseReportFormat('report.CSV')).toBe('csv')
    expect(parseReportFormat('report.exe')).toBeUndefined()
  })
  it('produces valid JSON and appropriately escaped CSV', () => {
    const text = 'A,"B"\nsecond'
    expect(JSON.parse(formatSupportContent(text, 'json')).lines).toEqual(['A,"B"', 'second'])
    const csv = formatSupportContent(text, 'csv')
    expect(csv).toContain('"A,""B"""')
    expect(csv).toContain('2,"second"')
  })
  it('keeps log/plain output unchanged and provides readable Markdown', () => {
    expect(formatSupportContent('OK', 'log')).toBe('OK')
    expect(formatSupportContent('OK', 'txt')).toBe('OK')
    expect(formatSupportContent('OK', 'md')).toContain('    OK')
  })
})
