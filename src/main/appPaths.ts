import { app } from 'electron'
import { existsSync } from 'fs'
import { join } from 'path'

export interface RuntimePaths {
  root: string
  gnirehtetDir: string
  gnirehtetExe: string
  adbDir: string
  adbExe: string
  icon: string
}

function firstExisting(candidates: string[], fallback: string): string {
  return candidates.find((candidate) => existsSync(candidate)) ?? fallback
}

export function getRuntimePaths(): RuntimePaths {
  const devRoot = process.cwd()
  const packagedRoot = process.resourcesPath
  const appRoot = app.getAppPath()
  const root = app.isPackaged ? packagedRoot : devRoot
  const rootCandidates = [root, devRoot, appRoot]

  const gnirehtetDir = firstExisting(
    rootCandidates.map((candidate) => join(candidate, 'gnirehtet-rust-win64')),
    join(root, 'gnirehtet-rust-win64')
  )
  const adbDir = firstExisting(
    rootCandidates.map((candidate) => join(candidate, 'platform-tools')),
    join(root, 'platform-tools')
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
    icon
  }
}
