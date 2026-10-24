import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, readFileSync } from 'node:fs'
import { copyFile, readFile } from 'node:fs/promises'
import { join } from 'node:path'

export const ADB_RUNTIME_FILES = ['adb.exe', 'AdbWinApi.dll', 'AdbWinUsbApi.dll'] as const

type AdbFileName = (typeof ADB_RUNTIME_FILES)[number]
export type AdbSourceHashes = Record<AdbFileName, string>

export interface AdbRuntimeFingerprint {
  fingerprint: string
  sourceHashes: AdbSourceHashes
}

/**
 * Compute the historical bundled ADB fingerprint, and keep the per-file source
 * hashes from the SAME read. Previously every file was read again during cache
 * validation. The combined fingerprint intentionally retains the exact old
 * SHA-256 byte sequence and 16-character prefix so existing caches stay valid.
 */
export function fingerprintAdbRuntime(directory: string): AdbRuntimeFingerprint {
  const combined = createHash('sha256')
  const sourceHashes = {} as AdbSourceHashes

  for (const filename of ADB_RUNTIME_FILES) {
    const source = join(directory, filename)
    if (!existsSync(source)) throw new Error('Missing ADB runtime file: ' + source)
    const contents = readFileSync(source)
    combined.update(filename)
    combined.update(contents)
    sourceHashes[filename] = createHash('sha256').update(contents).digest('hex')
  }

  return { fingerprint: combined.digest('hex').slice(0, 16), sourceHashes }
}

/**
 * Keep the destination integrity check: an existing cache file is accepted
 * only when its hash matches the known-good bundled source hash.
 */
export function verifyAndPopulateAdbCache(
  sourceDir: string,
  destinationDir: string,
  sourceHashes: AdbSourceHashes
): number {
  let filesCopied = 0

  for (const filename of ADB_RUNTIME_FILES) {
    const destination = join(destinationDir, filename)
    const cachedHash = existsSync(destination)
      ? createHash('sha256').update(readFileSync(destination)).digest('hex')
      : null

    if (cachedHash !== sourceHashes[filename]) {
      copyFileSync(join(sourceDir, filename), destination)
      filesCopied += 1
    }
  }

  return filesCopied
}


/** Async I/O means slow HDD reads no longer hold Electron's main event loop. */
export async function fingerprintAdbRuntimeAsync(
  directory: string
): Promise<AdbRuntimeFingerprint> {
  const combined = createHash('sha256')
  const sourceHashes = {} as AdbSourceHashes
  for (const filename of ADB_RUNTIME_FILES) {
    const source = join(directory, filename)
    const contents = await readFile(source)
    combined.update(filename)
    combined.update(contents)
    sourceHashes[filename] = createHash('sha256').update(contents).digest('hex')
  }
  return { fingerprint: combined.digest('hex').slice(0, 16), sourceHashes }
}

/** Still hash every existing cached destination; repair altered copies. */
export async function verifyAndPopulateAdbCacheAsync(
  sourceDir: string,
  destinationDir: string,
  sourceHashes: AdbSourceHashes
): Promise<number> {
  let filesCopied = 0
  for (const filename of ADB_RUNTIME_FILES) {
    const destination = join(destinationDir, filename)
    let cachedHash: string | null = null
    try {
      cachedHash = createHash('sha256').update(await readFile(destination)).digest('hex')
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
    if (cachedHash !== sourceHashes[filename]) {
      await copyFile(join(sourceDir, filename), destination)
      filesCopied += 1
    }
  }
  return filesCopied
}
