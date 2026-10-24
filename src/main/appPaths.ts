import { app } from 'electron'
import { existsSync, mkdirSync } from 'fs'
import { mkdir } from 'node:fs/promises'
import { join } from 'path'
import { skipAdbCacheForQa, traceStartup } from './startupTrace'
import {
  fingerprintAdbRuntime,
  fingerprintAdbRuntimeAsync,
  verifyAndPopulateAdbCache,
  verifyAndPopulateAdbCacheAsync
} from './adbCacheFingerprint'

export interface RuntimePaths {
  root: string
  gnirehtetDir: string
  gnirehtetExe: string
  adbDir: string
  adbExe: string
  icon: string
  trayIcon: string
}

function firstExisting(candidates: string[], fallback: string): string {
  return candidates.find((candidate) => existsSync(candidate)) ?? fallback
}

function prepareAdbCache(sourceDir: string): string {
  try {
    traceStartup('adb-cache-fingerprint-start')
    const { fingerprint, sourceHashes } = fingerprintAdbRuntime(sourceDir)
    traceStartup('adb-cache-fingerprint-ready')
    const localRoot = process.env.LOCALAPPDATA ?? app.getPath('userData')
    const cacheDir = join(localRoot, 'Wirebound', 'runtime', `platform-tools-${fingerprint}`)
    mkdirSync(cacheDir, { recursive: true })
    traceStartup('adb-cache-verify-start')
    const copied = verifyAndPopulateAdbCache(sourceDir, cacheDir, sourceHashes)
    traceStartup('adb-cache-verify-ready', { filesCopied: copied })
    return cacheDir
  } catch (error) {
    traceStartup('adb-cache-fallback')
    console.warn('Wirebound: Failed to prepare the local ADB cache; using bundled runtime.', error)
    return sourceDir
  }
}

export function getRuntimePaths(options: { deferAdbPreparation?: boolean } = {}): RuntimePaths {
  const devRoot = process.cwd()
  const packagedRoot = process.resourcesPath
  const appRoot = app.getAppPath()
  const root = app.isPackaged ? packagedRoot : devRoot
  const rootCandidates = [root, devRoot, appRoot]

  const gnirehtetDir = firstExisting(
    rootCandidates.map((candidate) => join(candidate, 'bin', 'gnirehtet-rust-win64')),
    join(root, 'bin', 'gnirehtet-rust-win64')
  )
  const bundledAdbDir = firstExisting(
    rootCandidates.map((candidate) => join(candidate, 'bin', 'platform-tools')),
    join(root, 'bin', 'platform-tools')
  )
  const adbDir =
    options.deferAdbPreparation || skipAdbCacheForQa
      ? bundledAdbDir
      : prepareAdbCache(bundledAdbDir)
  if (skipAdbCacheForQa && !options.deferAdbPreparation) traceStartup('adb-cache-skipped-qa')
  const trayIcon = firstExisting(
    rootCandidates.flatMap((candidate) => [
      join(candidate, 'icon.ico'),
      join(candidate, 'build', 'icon.ico')
    ]),
    join(root, 'icon.ico')
  )
  const icon = firstExisting(
    rootCandidates.flatMap((candidate) => [
      join(candidate, 'icon.png'),
      join(candidate, 'src', 'renderer', 'src', 'assets', 'icon.png'),
      join(candidate, 'build', 'icon.ico'),
      join(candidate, 'build', 'icon.png'),
      join(candidate, 'resources', 'icon.png')
    ]),
    join(root, 'icon.png')
  )

  return {
    root,
    gnirehtetDir,
    gnirehtetExe: join(gnirehtetDir, 'gnirehtet.exe'),
    adbDir,
    adbExe: join(adbDir, 'adb.exe'),
    icon,
    trayIcon
  }
}


/**
 * Complete an initially UI-only path selection after the window is visible.
 * The returned paths MUST be used to create ADB and Gnirehtet services;
 * the unverified bundled paths must never be used by those services.
 */
export async function finishRuntimePathsAfterWindow(paths: RuntimePaths): Promise<RuntimePaths> {
  if (skipAdbCacheForQa) {
    traceStartup('adb-cache-skipped-qa')
    return paths
  }

  const sourceDir = paths.adbDir
  try {
    traceStartup('adb-cache-fingerprint-start')
    const { fingerprint, sourceHashes } = await fingerprintAdbRuntimeAsync(sourceDir)
    traceStartup('adb-cache-fingerprint-ready')
    const localRoot = process.env.LOCALAPPDATA ?? app.getPath('userData')
    const cacheDir = join(localRoot, 'Wirebound', 'runtime', `platform-tools-${fingerprint}`)
    await mkdir(cacheDir, { recursive: true })
    traceStartup('adb-cache-verify-start')
    const copied = await verifyAndPopulateAdbCacheAsync(sourceDir, cacheDir, sourceHashes)
    traceStartup('adb-cache-verify-ready', { filesCopied: copied })
    return { ...paths, adbDir: cacheDir, adbExe: join(cacheDir, 'adb.exe') }
  } catch (error) {
    traceStartup('adb-cache-fallback')
    console.warn('Wirebound: Could not prepare the ADB cache asynchronously; using bundled runtime.', error)
    return paths
  }
}
