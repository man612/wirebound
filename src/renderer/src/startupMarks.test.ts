import { afterEach, describe, expect, it, vi } from 'vitest'
import { markRendererStartup } from './startupMarks'

afterEach(() => vi.unstubAllGlobals())

describe('renderer startup marks', () => {
  it('records each safe, fixed milestone only once', () => {
    const marks: string[] = []
    vi.stubGlobal('performance', {
      mark: (name: string) => { marks.push(name) },
      getEntriesByName: (name: string) => marks.includes(name) ? [{ name }] : []
    })
    markRendererStartup('entry-evaluated')
    markRendererStartup('entry-evaluated')
    markRendererStartup('react-first-commit')
    markRendererStartup('ui-settings-ready')
    expect(marks).toEqual([
      'wirebound:entry-evaluated',
      'wirebound:react-first-commit',
      'wirebound:ui-settings-ready'
    ])
  })

  it('does not fail renderer startup when performance marks are unavailable', () => {
    vi.stubGlobal('performance', undefined)
    expect(() => markRendererStartup('entry-evaluated')).not.toThrow()
  })

  it('does not fail if performance APIs throw', () => {
    vi.stubGlobal('performance', { mark: () => { throw new Error('restricted') }, getEntriesByName: () => [] })
    expect(() => markRendererStartup('react-first-commit')).not.toThrow()
  })
})
