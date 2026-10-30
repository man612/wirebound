import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { AdbDevice, LogEntry } from '../../../../shared/types'
import { translations } from '../../i18n'
import Dashboard from './Dashboard'

function renderDashboard(devices: AdbDevice[], logs: LogEntry[] = []): string {
  return renderToStaticMarkup(
    <Dashboard
      status="disconnected"
      isLoading={false}
      onStart={async () => {}}
      onStop={async () => {}}
      devices={devices}
      logs={logs}
      onClearLogs={() => {}}
      diagnostics={{
        isRunning: false,
        progress: { completed: 6, total: 6 },
        run: async () => {},
        report: {
          generatedAt: '2026-10-20T09:46:13Z',
          engineStatus: 'disconnected',
          checks: [],
          devices: []
        }
      }}
      t={translations.en}
      language="en"
    />
  )
}

describe('Dashboard markup regressions', () => {
  it('disables Clear on empty engine logs and enables it with output', () => {
    expect(renderDashboard([])).toMatch(/disabled=""[^>]*title="Nothing to clear"/)
    expect(renderDashboard([], [{ timestamp: '12:00', message: 'ready', type: 'info' }]))
      .not.toMatch(/disabled=""[^>]*title="Nothing to clear"/)
  })

  it('uses responsive cards, not a wide horizontal table, and masks visible device IDs', () => {
    const rendered = renderDashboard([{
      id: 'ZX9234YY',
      name: 'Motorola moto g45 5G',
      battery: '0',
      status: 'device',
      tunnelStatus: 'idle'
    }])
    expect(rendered).toContain('Motorola moto g45 5G')
    expect(rendered).toContain('ZX...YY')
    expect(rendered).not.toContain('ZX9234YY')
    expect(rendered).toContain('0%')
    expect(rendered).toContain('ADB Ready')
    expect(rendered).not.toContain('ADB $Ready')
    expect(rendered).toContain('Connect')
    expect(rendered).not.toContain('min-w-[920px]')
    expect(rendered).not.toContain('overflow-x-auto')
  })

  it('renders the diagnostic disclosure with accessible expanded state', () => {
    const rendered = renderDashboard([])
    expect(rendered).toContain('aria-expanded="true"')
    expect(rendered).toContain('aria-controls="wirebound-diagnostic-details"')
  })
})
