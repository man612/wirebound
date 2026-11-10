import {
  BatteryFull, BatteryMedium, BatteryLow, BatteryWarning, BatteryCharging,
  Battery as BatteryIcon, Link2, Unplug, Gauge, Smartphone
} from 'lucide-react'
import type { AdbDevice, ConnectionStatus } from '../../../../shared/types'
import type { Language, Translation } from '../../i18n'
import { maskDeviceId } from '../../formatters'
import Tooltip from '../ui/Tooltip'

interface Props {
  device: AdbDevice
  engineStatus: ConnectionStatus
  busy: boolean
  actionFailed: boolean
  t: Translation
  language: Language
  onAction: (device: AdbDevice) => void
  onSpeed: (id: string) => void
}

function formatBytes(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value) || value < 0) return '--'
  if (value < 1024) return `${value} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let num = value / 1024
  let unit = 0
  while (num >= 1024 && unit < units.length - 1) {
    num /= 1024
    unit++
  }
  return `${num.toFixed(num >= 100 ? 0 : 1)} ${units[unit]}`
}

export function getBatteryPresentation(
  input: string | undefined,
  status: AdbDevice['batteryStatus'],
  language: Language
): { label: string; tone: string; Icon: typeof BatteryIcon; level: number | undefined } {
  const id = language === 'id'
  const level = input !== undefined && input.trim() !== '' ? Number(input) : NaN
  if (!Number.isInteger(level) || level < 0 || level > 100) {
    return { label: '--', tone: 'text-text-muted', Icon: BatteryIcon, level: undefined }
  }
  if (status === 'full' || level === 100) {
    return { label: `${level}% ${id ? 'Penuh' : 'Full'}`, tone: 'text-accent-green', Icon: BatteryFull, level }
  }
  if (status === 'charging') {
    return { label: `${level}% ${id ? 'Mengisi' : 'Charging'}`, tone: 'text-accent-teal', Icon: BatteryCharging, level }
  }
  if (level <= 15) {
    return { label: `${level}% ${id ? 'Kritis' : 'Critical'}`, tone: 'text-accent-red', Icon: BatteryWarning, level }
  }
  if (level <= 25) {
    return { label: `${level}% ${id ? 'Rendah' : 'Low'}`, tone: 'text-accent-yellow', Icon: BatteryLow, level }
  }
  if (level < 60) {
    return { label: `${level}%`, tone: 'text-text-secondary', Icon: BatteryMedium, level }
  }
  return { label: `${level}%`, tone: 'text-accent-green', Icon: BatteryFull, level }
}

function deviceStatusLabel(device: AdbDevice, t: Translation): string {
  if (device.status === 'device') return t.adbStatusReady
  if (device.status === 'unauthorized') return t.adbStatusUnauthorized
  if (device.status === 'offline') return t.adbStatusOffline
  return t.adbStatusNoAccess
}

export default function DeviceRow({
  device, engineStatus, busy, actionFailed, t, language, onAction, onSpeed
}: Props): React.JSX.Element {
  const battery = getBatteryPresentation(device.battery, device.batteryStatus, language)
  const connected = device.tunnelStatus === 'connected'
  const isDeviceReady = device.status === 'device'
  const canAct = isDeviceReady && engineStatus !== 'connecting' && !busy
  const batteryLabel = language === 'id' ? 'Baterai' : 'Battery'
  const subtitle = [
    device.androidVersion ? `Android ${device.androidVersion}` : undefined,
    device.codename ? `${language === 'id' ? 'Kode' : 'Codename'}: ${device.codename}` : undefined
  ].filter(Boolean).join(' · ')

  return (
    <article className="motion-row rounded-md border border-border-subtle bg-bg-surface px-3 py-2.5 hover:border-border-focus"
      aria-label={device.name || 'Android device'}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex min-w-[160px] flex-[1_1_210px] items-center gap-2.5">
          <span className="shrink-0 grid h-8 w-8 place-items-center rounded-md border border-border-subtle bg-bg-primary text-accent-blue">
            <Smartphone size={15} strokeWidth={1.8}/>
          </span>
          <div className="min-w-0">
            <div className="truncate text-xs font-semibold text-text-primary" title={device.name}>
              {device.name || 'Android Device'}
            </div>
            <div className="truncate mt-0.5 text-[10px] text-text-muted" title={subtitle || undefined}>
              {subtitle || `${t.deviceId}: ${maskDeviceId(device.id)}`}
            </div>
          </div>
        </div>
        <div className="min-w-[130px] flex-[0_1_145px] space-y-1">
          <span className={`inline-flex items-center gap-1.5 text-[10px] ${
            isDeviceReady ? 'text-accent-green' : 'text-accent-yellow'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isDeviceReady ? 'bg-accent-green' : 'bg-accent-yellow'}`}/>
            ADB {deviceStatusLabel(device, t)}
          </span>
          <div className={`text-[10px] ${connected ? 'text-accent-green' : 'text-text-muted'}`}>
            {connected ? t.tunnelConnected : device.tunnelStatus === 'waiting' ? t.tunnelWaiting : t.tunnelIdle}
          </div>
        </div>
        <div className="flex min-w-[115px] flex-[0_1_125px] flex-col gap-1">
          <span className={`inline-flex items-center gap-1.5 text-[10px] ${battery.tone}`}
            title={`${batteryLabel}: ${battery.label}`}>
            <battery.Icon size={14} strokeWidth={1.8} />
            {battery.label}
          </span>
          <span className="font-mono text-[10px] text-text-secondary" title={device.traffic?.interfaceName || t.trafficUnavailable}>
            RX {formatBytes(device.traffic?.rxBytes)} <span className="text-text-muted">/</span> TX {formatBytes(device.traffic?.txBytes)}
          </span>
        </div>
        <div className="flex flex-[1_0_140px] items-center justify-end gap-1.5">
          <button type="button" onClick={() => onAction(device)} disabled={!canAct}
            className={`motion-control inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[10px] font-semibold disabled:opacity-40 disabled:cursor-not-allowed ${
              connected ? 'border-accent-red/30 text-accent-red hover:bg-accent-red-dim/20' : 'border-accent-blue/30 text-accent-blue hover:bg-bg-hover'
            }`}>
            {connected ? <Unplug size={12}/> : <Link2 size={12}/>}
            {busy ? t.deviceActionWorking : connected ? t.disconnectDevice : language === 'id' ? 'Hubungkan' : 'Connect'}
          </button>
          <Tooltip text={language === 'id' ? 'Tes kecepatan internet HP' : 'Test phone internet speed'}>
          <button type="button" onClick={() => onSpeed(device.id)} disabled={!isDeviceReady}
            aria-label={t.testDeviceSpeed}
            className="motion-control grid place-items-center rounded-md border border-border-subtle bg-bg-primary p-1.5 text-text-secondary hover:text-accent-blue disabled:opacity-40 disabled:cursor-not-allowed">
            <Gauge size={13}/>
          </button>
          </Tooltip>
        </div>
      </div>
      {actionFailed && <p role="alert" className="motion-enter mt-1 text-[11px] text-accent-red">{t.deviceActionFailed}</p>}
    </article>
  )
}
