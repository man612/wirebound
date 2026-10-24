import { isAbsolute } from 'node:path'

/**
 * Fail closed when a QA harness explicitly requests an isolated Electron
 * profile. This setting is never applied for a normal application launch.
 */
export function getQaProfileDir(env: NodeJS.ProcessEnv = process.env): string | null {
  if (env.WIREBOUND_QA_PROFILE_ISOLATION !== '1') return null

  const directory = env.WIREBOUND_QA_PROFILE_DIR
  if (!directory || !isAbsolute(directory)) {
    throw new Error('QA profile isolation requires an absolute directory')
  }
  return directory
}
