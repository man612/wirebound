import type { ConnectionStatus } from '../shared/types'

export const DEVICE_POLL_INTERVALS = {
  connecting: 2_000,
  connected: 4_000,
  idleWithDevice: 6_000,
  idleNoDevice: 8_000,
  hiddenIdle: 15_000
} as const

export function getDevicePollInterval(
  status: ConnectionStatus,
  hasDevices: boolean,
  windowVisible: boolean
): number {
  if (status === 'connecting') return DEVICE_POLL_INTERVALS.connecting
  if (status === 'connected') return DEVICE_POLL_INTERVALS.connected
  if (!windowVisible) return DEVICE_POLL_INTERVALS.hiddenIdle
  return hasDevices ? DEVICE_POLL_INTERVALS.idleWithDevice : DEVICE_POLL_INTERVALS.idleNoDevice
}
