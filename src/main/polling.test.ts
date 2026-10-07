import { describe, expect, it } from 'vitest'
import { DEVICE_POLL_INTERVALS, getDevicePollInterval } from './polling'

describe('getDevicePollInterval', () => {
  it('polls quickly while the Android VPN is connecting', () => {
    expect(getDevicePollInterval('connecting', true, true)).toBe(
      DEVICE_POLL_INTERVALS.connecting
    )
  })

  it('keeps connected sessions responsive even while the window is hidden', () => {
    expect(getDevicePollInterval('connected', true, false)).toBe(
      DEVICE_POLL_INTERVALS.connected
    )
  })

  it('backs off aggressively when the app is idle in the tray', () => {
    expect(getDevicePollInterval('disconnected', false, false)).toBe(
      DEVICE_POLL_INTERVALS.hiddenIdle
    )
  })

  it('polls idle visible sessions less often when no device exists', () => {
    expect(getDevicePollInterval('disconnected', true, true)).toBe(
      DEVICE_POLL_INTERVALS.idleWithDevice
    )
    expect(getDevicePollInterval('disconnected', false, true)).toBe(
      DEVICE_POLL_INTERVALS.idleNoDevice
    )
  })
})
