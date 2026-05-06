import type { GnirehtetAPI } from '../shared/types'

declare global {
  interface Window {
    api: GnirehtetAPI
  }
}
