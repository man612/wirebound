import { describe, expect, it } from 'vitest'
import { isVersionNewer, normalizeVersion, parseVersion } from './version'

describe('version helpers', () => {
  it('parses standard release tags', () => {
    expect(parseVersion('v1.2.3')).toEqual({ major: 1, minor: 2, patch: 3 })
    expect(normalizeVersion('v1.2.3')).toBe('1.2.3')
  })

  it('compares semantic release versions numerically', () => {
    expect(isVersionNewer('1.2.0', '1.1.9')).toBe(true)
    expect(isVersionNewer('2.0.0', '1.99.99')).toBe(true)
    expect(isVersionNewer('1.1.1', '1.1.1')).toBe(false)
    expect(isVersionNewer('1.1.0', '1.1.1')).toBe(false)
  })

  it('fails closed for malformed versions', () => {
    expect(parseVersion('latest')).toBeNull()
    expect(isVersionNewer('latest', '1.1.1')).toBe(false)
  })
})
