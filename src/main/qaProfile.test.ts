import { describe, expect, it } from 'vitest'
import { resolve } from 'node:path'
import { getQaProfileDir } from './qaProfile'

describe('QA user data profile isolation gate', () => {
  it('does not redirect ordinary application launches', () => {
    expect(getQaProfileDir({})).toBeNull()
    expect(getQaProfileDir({ WIREBOUND_QA_PROFILE_DIR: resolve('qa-sample') })).toBeNull()
  })

  it('requires a valid absolute path when QA isolation is explicitly enabled', () => {
    expect(() => getQaProfileDir({ WIREBOUND_QA_PROFILE_ISOLATION: '1' })).toThrow()
    expect(() =>
      getQaProfileDir({
        WIREBOUND_QA_PROFILE_ISOLATION: '1',
        WIREBOUND_QA_PROFILE_DIR: 'relative/profile'
      })
    ).toThrow()
  })

  it('accepts explicit absolute QA directory even with internal trace disabled', () => {
    const directory = resolve('qa-isolated-settings')
    expect(
      getQaProfileDir({
        WIREBOUND_QA_PROFILE_ISOLATION: '1',
        WIREBOUND_QA_PROFILE_DIR: directory
      })
    ).toBe(directory)
  })
})
