import { net } from 'electron'
import type { UpdateCheckResult } from '../../shared/types'
import { isVersionNewer, normalizeVersion, parseVersion } from '../../shared/version'

const LATEST_RELEASE_API = 'https://api.github.com/repos/man612/wirebound/releases/latest'
const CACHE_TTL_MS = 15 * 60 * 1000

interface LatestReleaseResponse {
  tag_name?: unknown
  html_url?: unknown
}

let cached:
  | {
      checkedAt: number
      result: UpdateCheckResult
    }
  | undefined

function isGithubReleaseUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && url.hostname === 'github.com'
  } catch {
    return false
  }
}

export async function checkForUpdates(currentVersion: string): Promise<UpdateCheckResult> {
  if (!parseVersion(currentVersion)) {
    return { success: false, currentVersion, error: 'Current Wirebound version is invalid.' }
  }

  if (cached && Date.now() - cached.checkedAt < CACHE_TTL_MS) {
    return { ...cached.result, currentVersion }
  }

  try {
    const response = await net.fetch(LATEST_RELEASE_API, {
      headers: {
        Accept: 'application/vnd.github+json'
      }
    })

    if (!response.ok) {
      return {
        success: false,
        currentVersion,
        error: `GitHub release check failed with HTTP ${response.status}.`
      }
    }

    const payload = (await response.json()) as LatestReleaseResponse
    if (typeof payload.tag_name !== 'string') {
      return { success: false, currentVersion, error: 'Latest GitHub release has no valid tag.' }
    }

    const latestVersion = normalizeVersion(payload.tag_name)
    if (!parseVersion(latestVersion)) {
      return { success: false, currentVersion, error: 'Latest GitHub release tag is invalid.' }
    }

    const releaseUrl =
      typeof payload.html_url === 'string' && isGithubReleaseUrl(payload.html_url)
        ? payload.html_url
        : undefined
    const result: UpdateCheckResult = {
      success: true,
      currentVersion,
      latestVersion,
      updateAvailable: isVersionNewer(latestVersion, currentVersion),
      releaseUrl
    }

    cached = { checkedAt: Date.now(), result }
    return result
  } catch (error) {
    return {
      success: false,
      currentVersion,
      error: error instanceof Error ? error.message : 'Unable to check GitHub releases.'
    }
  }
}
