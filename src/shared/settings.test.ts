import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from './defaults'
import { normalizeSettings } from './settings'

describe('normalizeSettings', () => {
  it('returns defaults for a non-object value', () => {
    expect(normalizeSettings(null)).toEqual(DEFAULT_SETTINGS)
  })

  it('preserves valid persisted settings', () => {
    expect(
      normalizeSettings({
        dns: '1.1.1.1',
        port: '4242',
        autoStart: true,
        customDns: '9.9.9.9',
        theme: 'light',
        language: 'id',
        onboardingCompleted: true
      })
    ).toEqual({
      dns: '1.1.1.1',
      port: '4242',
      autoStart: true,
      customDns: '9.9.9.9',
      theme: 'light',
      language: 'id',
      onboardingCompleted: true
    })
  })

  it('repairs invalid enum and port values', () => {
    expect(
      normalizeSettings({
        port: '70000',
        theme: 'sepia',
        language: 'fr'
      })
    ).toMatchObject({
      port: DEFAULT_SETTINGS.port,
      theme: DEFAULT_SETTINGS.theme,
      language: DEFAULT_SETTINGS.language
    })
  })
})
