import type { Language } from './i18n'

/** Format real local timestamps with seconds and the current UI locale. */
export function formatUiTimestamp(value: string | number | Date, language: Language): string {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return '--'
  return new Intl.DateTimeFormat(language === 'id' ? 'id-ID' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: language !== 'id'
  }).format(date)
}

/** Device identifiers remain intact in API calls, but not in visible UI or exported reports. */
export function maskDeviceId(id: string): string {
  if (id.length <= 4) return '*'.repeat(id.length)
  if (id.includes('...')) return id
  return id.slice(0, 2) + '...' + id.slice(-2)
}
