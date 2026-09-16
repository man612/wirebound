import { createHash } from 'crypto'
import { app } from 'electron'
import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'fs'
import { join } from 'path'

export interface RuntimePaths {
  root: string
  gnirehtetDir: string
  gnirehtetExe: string
  adbDir: string
  adbExe: string
  icon: string
}

const ADB_RUNTIME_FILES = ['adb.exe', 'AdbWinApi.dll', 'AdbWinUsbApi.dll'] as const

function firstExisting(candidates: string[], fallback: string): string {
  return candidates.find((candidate) => existsSync(candidate)) ?? fallback
}

function hashFile(file: string): string {
  return createHash('sha256').update(readFileSync(file)).digest('hex')
}

function hashFiles(directory: string): string {
  const hash = createHash('sha256')

  for (const filename of ADB_RUNTIME_FILES) {
    const file = join(directory, filename)
    if (!existsSync(file)) throw new Error(`Missing ADB runtime file: ${file}`)
    hash.update(filename)
    hash.update(readFileSync(file))
  }

  return hash.digest('hex').slice(0, 16)
}

function prepareAdbCache(sourceDir: string): string {
  try {
    const fingerprint = hashFiles(sourceDir)
    const localRoot = process.env.LOCALAPPDATA ?? app.getPath('userData')
    const cacheDir = join(localRoot, 'Wirebound', 'runtime', `platform-tools-${fingerprint}`)
    mkdirSync(cacheDir, { recursive: true })

    for (const filename of ADB_RUNTIME_FILES) {
      const source = join(sourceDir, filename)
      const destination = join(cacheDir, filename)
      if (!existsSync(destination) || hashFile(destination) !== hashFile(source)) {
        copyFileSync(source, destination)
      }
    }

    return cacheDir
  } catch (error) {
    console.warn('Wirebound: Failed to prepare the local ADB cache; using bundled runtime.', error)
    return sourceDir
  }
}

export function getRuntimePaths(): RuntimePaths {
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
  const adbDir = prepareAdbCache(bundledAdbDir)
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
    icon
  }
}
