import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { translations } from '../../i18n'
import TerminalLog from './TerminalLog'

describe('TerminalLog jump control', () => {
  it('disables Jump to latest when auto-follow starts at the bottom', () => {
    const html = renderToStaticMarkup(
      <TerminalLog
        logs={[{ timestamp: '12:00', message: 'ready', type: 'info' }]}
        devices={[]}
        onClear={() => {}}
        t={translations.en}
        language="en"
      />
    )
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*aria-label="Jump to latest"/)
  })

  it('keeps Jump to latest disabled with no logs to scroll', () => {
    const html = renderToStaticMarkup(
      <TerminalLog logs={[]} devices={[]} onClear={() => {}} t={translations.id} language="id" />
    )
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*aria-label="Ke log terbaru"/)
  })
})
