import { describe, expect, it } from 'vitest'
import { formatUiTimestamp, maskDeviceId } from './formatters'

describe('formatUiTimestamp', () => {
  it('renders Indonesian and English dates using their own locale with seconds', () => {
    const sample = '2026-10-20T09:46:13.000Z'
    for (const language of ['id', 'en'] as const) {
      const rendered = formatUiTimestamp(sample, language)
      expect(rendered).toContain('2026')
      expect(rendered).not.toBe('--')
      expect(rendered).not.toBe(
        formatUiTimestamp('2026-10-20T09:46:14.000Z', language)
      )
    }
  })

  it('does not render Invalid Date for bad timestamps', () => {
    expect(formatUiTimestamp('not-a-date', 'id')).toBe('--')
  })
})

describe('maskDeviceId', () => {
  it('does not expose complete Android serials in UI and support reports', () => {
    expect(maskDeviceId('ZX9234YY')).toBe('ZX...YY')
    expect(maskDeviceId('ZX...YY')).toBe('ZX...YY')
    expect(maskDeviceId('AB')).toBe('**')
  })
})
