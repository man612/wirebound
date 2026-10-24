import { afterEach, describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  ADB_RUNTIME_FILES,
  fingerprintAdbRuntime,
  verifyAndPopulateAdbCache,
  fingerprintAdbRuntimeAsync,
  verifyAndPopulateAdbCacheAsync
} from './adbCacheFingerprint'

const temporaryDirectories: string[] = []

function fixtures(): { bundled: string; cached: string } {
  const root = mkdtempSync(join(tmpdir(), 'wirebound-adb-cache-'))
  temporaryDirectories.push(root)
  const bundled = join(root, 'bundled')
  const cached = join(root, 'cached')
  mkdirSync(bundled)
  mkdirSync(cached)
  for (const name of ADB_RUNTIME_FILES) {
    writeFileSync(join(bundled, name), Buffer.from('fixture-' + name))
  }
  return { bundled, cached }
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

describe('ADB runtime cache fingerprint', () => {
  it('retains the previous combined hash algorithm and folder fingerprint', () => {
    const { bundled } = fixtures()
    const expected = createHash('sha256')
    for (const name of ADB_RUNTIME_FILES) {
      expected.update(name)
      expected.update(readFileSync(join(bundled, name)))
    }
    const result = fingerprintAdbRuntime(bundled)
    expect(result.fingerprint).toBe(expected.digest('hex').slice(0, 16))
    for (const name of ADB_RUNTIME_FILES) {
      expect(result.sourceHashes[name]).toBe(
        createHash('sha256').update(readFileSync(join(bundled, name))).digest('hex')
      )
    }
  })

  it('copies missing files, reuses intact files, and repairs tampered cache entries', () => {
    const { bundled, cached } = fixtures()
    const { sourceHashes } = fingerprintAdbRuntime(bundled)
    expect(verifyAndPopulateAdbCache(bundled, cached, sourceHashes)).toBe(3)
    expect(verifyAndPopulateAdbCache(bundled, cached, sourceHashes)).toBe(0)
    writeFileSync(join(cached, 'adb.exe'), 'corrupted cache')
    expect(verifyAndPopulateAdbCache(bundled, cached, sourceHashes)).toBe(1)
    for (const name of ADB_RUNTIME_FILES) {
      expect(readFileSync(join(cached, name))).toEqual(readFileSync(join(bundled, name)))
    }
  })

  it('async fingerprint matches the historical synchronous cache identifier', async () => {
    const { bundled } = fixtures()
    const fast = fingerprintAdbRuntime(bundled)
    await expect(fingerprintAdbRuntimeAsync(bundled)).resolves.toEqual(fast)
  })

  it('async cache copy checks integrity and restores damaged files', async () => {
    const { bundled, cached } = fixtures()
    const { sourceHashes } = await fingerprintAdbRuntimeAsync(bundled)
    expect(await verifyAndPopulateAdbCacheAsync(bundled, cached, sourceHashes)).toBe(3)
    expect(await verifyAndPopulateAdbCacheAsync(bundled, cached, sourceHashes)).toBe(0)
    writeFileSync(join(cached, 'AdbWinUsbApi.dll'), 'tampered')
    expect(await verifyAndPopulateAdbCacheAsync(bundled, cached, sourceHashes)).toBe(1)
    expect(readFileSync(join(cached, 'AdbWinUsbApi.dll'))).toEqual(
      readFileSync(join(bundled, 'AdbWinUsbApi.dll'))
    )
  })

  it('rejects missing bundled files and changes fingerprint when bundled contents change', () => {
    const { bundled } = fixtures()
    const first = fingerprintAdbRuntime(bundled).fingerprint
    writeFileSync(join(bundled, 'adb.exe'), 'changed-bundled-file')
    expect(fingerprintAdbRuntime(bundled).fingerprint).not.toBe(first)
    rmSync(join(bundled, 'AdbWinApi.dll'))
    expect(existsSync(join(bundled, 'AdbWinApi.dll'))).toBe(false)
    expect(() => fingerprintAdbRuntime(bundled)).toThrow(/Missing ADB runtime file/)
  })
})
