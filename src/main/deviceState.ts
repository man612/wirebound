import type {
  AdbDevice,
  ConnectionStatus,
  DeviceTunnelStatus
} from '../shared/types'

export function getDeviceTunnelStatus(
  device: AdbDevice,
  engineStatus: ConnectionStatus,
  activeDeviceIds: ReadonlySet<string>
): DeviceTunnelStatus {
  if (device.status !== 'device') return 'unavailable'
  if (engineStatus === 'disconnected') return 'idle'
  if (engineStatus === 'error') return 'error'
  return activeDeviceIds.has(device.id) ? 'connected' : 'waiting'
}

export function applyDeviceTunnelStates(
  devices: AdbDevice[],
  engineStatus: ConnectionStatus,
  activeDeviceIds: ReadonlySet<string>
): AdbDevice[] {
  return devices.map((device) => ({
    ...device,
    tunnelStatus: getDeviceTunnelStatus(device, engineStatus, activeDeviceIds)
  }))
}
