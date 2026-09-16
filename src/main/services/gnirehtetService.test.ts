import { describe, expect, it } from 'vitest'
import { normalizeDns, normalizePort } from './gnirehtetService'

describe('normalizeDns', () => {
  it('accepts IPv4 and rejects invalid or IPv6 values', () => {
    expect(normalizeDns('1.1.1.1')).toBe('1.1.1.1')
    expect(normalizeDns('not-a-dns')).toBe('8.8.8.8')
    expect(normalizeDns('2001:4860:4860::8888')).toBe('8.8.8.8')
  })
})

describe('normalizePort', () => {
  it('accepts the valid TCP port range', () => {
    expect(normalizePort('1')).toBe('1')
    expect(normalizePort('65535')).toBe('65535')
  })

  it('falls back for invalid values', () => {
    expect(normalizePort('0')).toBe('31416')
    expect(normalizePort('70000')).toBe('31416')
    expect(normalizePort('abc')).toBe('31416')
  })
})
