import { describe, expect, it } from 'vitest'
import { parseAdbDevices, parseBatteryLevel } from './adbService'

describe('parseAdbDevices', () => {
  it('parses supported ADB device states and ignores headers', () => {
    const output = [
      'List of devices attached',
      'ABC123\tdevice',
      'DEF456\tunauthorized',
      'GHI789\toffline',
      ''
    ].join('\n')

    expect(parseAdbDevices(output)).toEqual([
      { id: 'ABC123', name: 'Android Device', status: 'device' },
      { id: 'DEF456', name: 'Android Device', status: 'unauthorized' },
      { id: 'GHI789', name: 'Android Device', status: 'offline' }
    ])
  })
})

describe('parseBatteryLevel', () => {
  it('reads battery percentage from dumpsys output', () => {
    expect(parseBatteryLevel('status: 2\n  level: 87\n  scale: 100')).toBe('87')
  })

  it('returns undefined when no level is present', () => {
    expect(parseBatteryLevel('status: unknown')).toBeUndefined()
  })
})
