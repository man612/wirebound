export interface ParsedVersion {
  major: number
  minor: number
  patch: number
}

export function parseVersion(value: string): ParsedVersion | null {
  const match = value.trim().match(/^v?(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/i)
  if (!match) return null

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3])
  }
}

export function isVersionNewer(latest: string, current: string): boolean {
  const latestVersion = parseVersion(latest)
  const currentVersion = parseVersion(current)
  if (!latestVersion || !currentVersion) return false

  if (latestVersion.major !== currentVersion.major) {
    return latestVersion.major > currentVersion.major
  }
  if (latestVersion.minor !== currentVersion.minor) {
    return latestVersion.minor > currentVersion.minor
  }
  return latestVersion.patch > currentVersion.patch
}

export function normalizeVersion(value: string): string {
  return value.trim().replace(/^v/i, '')
}
