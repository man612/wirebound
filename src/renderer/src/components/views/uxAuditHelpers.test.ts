import { describe, expect, it } from 'vitest'
import { getBatteryPresentation } from './DeviceRow'
import { renderSafeLogLines } from './TerminalLog'

describe('Wirebound device battery presentation', () => {
  it('shows charging from Android status instead of guessing from percentage', () => {
    const battery = getBatteryPresentation('64', 'charging', 'en')
    expect(battery.label).toContain('Charging')
    expect(battery.level).toBe(64)
  })
  it('has distinct critical, low, and full states', () => {
    expect(getBatteryPresentation('12', 'discharging', 'en').label).toContain('Critical')
    expect(getBatteryPresentation('23', 'discharging', 'id').label).toContain('Rendah')
    expect(getBatteryPresentation('100', 'full', 'en').label).toContain('Full')
  })
  it('does not invent values from malformed battery input', () => {
    expect(getBatteryPresentation(undefined, 'unknown', 'en').label).toBe('--')
    expect(getBatteryPresentation('105', 'unknown', 'en').level).toBeUndefined()
  })
})

describe('copy/export-safe terminal output', () => {
  it('masks known raw device IDs and preserves severity/timestamps', () => {
    const text = renderSafeLogLines(
      [{ timestamp: '12:01', type: 'stderr', message: 'ADB ZP222226P2 disconnected' }],
      [{ id: 'ZP222226P2', name: 'Motorola', status: 'device' }]
    )
    expect(text).toContain('[stderr]')
    expect(text).toContain('ZP...P2')
    expect(text).not.toContain('ZP222226P2')
  })
})
