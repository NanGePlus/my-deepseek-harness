/**
 * Resolve the Renderer load URL for dev vs production desktop delivery.
 * @module @deepseek-ai/dsh-desktop-shell/load-url
 */

import { readDesktopAttachConfig } from './attach.ts'
import { productionSpaUrl } from './protocol-dsh.ts'

/** Desktop renderer load target. */
export interface DesktopLoadTarget {
  /** URL passed to BrowserWindow.loadURL. */
  url: string
  /** True when loading the Vite dev server (HMR). */
  dev: boolean
  /** True when using attach mode against an external `dsh web`. */
  attach: boolean
}

/**
 * Resolve the SPA URL for the current launch mode.
 * @param env - process environment.
 * @returns the renderer load target.
 */
export function resolveDesktopLoadTarget(env: NodeJS.ProcessEnv = process.env): DesktopLoadTarget {
  const attach = readDesktopAttachConfig(env)
  if (attach !== undefined) {
    return { url: `${attach.webUrl}/`, dev: false, attach: true }
  }
  const devUrl = env.DSH_DESKTOP_DEV_URL?.trim()
  if (devUrl !== undefined && devUrl !== '') {
    return { url: devUrl, dev: true, attach: false }
  }
  return { url: productionSpaUrl(), dev: false, attach: false }
}

/** Default Vite dev server URL for `pnpm run dev:desktop`. */
export const DEFAULT_DESKTOP_DEV_URL = 'http://127.0.0.1:5173/'
