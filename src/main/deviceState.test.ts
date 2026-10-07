import { describe, expect, it } from 'vitest'
import { getDeviceTunnelStatus } from './deviceState'
import type { AdbDevice } from '../shared/types'

const readyDevice: AdbDevice = {
  id: 'ABC123',
  name: 'Android Device',
  status: 'device'
}

describe('getDeviceTunnelStatus', () => {
  it('reports an authorized device as idle while the engine is stopped', () => {
    expect(getDeviceTunnelStatus(readyDevice, 'disconnected', new Set())).toBe('idle')
  })

  it('distinguishes connected and waiting devices while the relay is running', () => {
    expect(getDeviceTunnelStatus(readyDevice, 'connected', new Set(['ABC123']))).toBe('connected')
    expect(getDeviceTunnelStatus(readyDevice, 'connected', new Set())).toBe('waiting')
    expect(getDeviceTunnelStatus(readyDevice, 'connecting', new Set())).toBe('waiting')
  })

  it('keeps ADB access failures separate from tunnel state', () => {
    expect(
      getDeviceTunnelStatus(
        { ...readyDevice, status: 'unauthorized' },
        'connected',
        new Set(['ABC123'])
      )
    ).toBe('unavailable')
  })

  it('reports an engine error for otherwise authorized devices', () => {
    expect(getDeviceTunnelStatus(readyDevice, 'error', new Set())).toBe('error')
  })
})
