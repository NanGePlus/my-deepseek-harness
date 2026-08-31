/**
 * Attach mode: connect Renderer to an external `dsh web` Host.
 * @module @deepseek-ai/dsh-desktop-shell/attach
 */

/** Parsed attach configuration from `DSH_DESKTOP_ATTACH`. */
export interface DesktopAttachConfig {
  /** Loopback `dsh web` base URL (no trailing slash). */
  webUrl: string
}

/**
 * Read attach mode from the environment.
 * @param env - process environment (defaults to `process.env`).
 * @returns attach config when enabled; otherwise undefined.
 */
export function readDesktopAttachConfig(env: NodeJS.ProcessEnv = process.env): DesktopAttachConfig | undefined {
  const raw = env.DSH_DESKTOP_ATTACH?.trim()
  if (raw === undefined || raw === '') return undefined
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new Error(`DSH_DESKTOP_ATTACH must be an absolute http URL, got ${JSON.stringify(raw)}`)
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`DSH_DESKTOP_ATTACH must use http or https, got ${url.protocol}`)
  }
  const pathname = url.pathname.replace(/\/$/, '')
  const base = pathname === '' || pathname === '/' ? url.origin : `${url.origin}${pathname}`
  return { webUrl: base }
}

/** Whether Main should skip integrated Host boot. */
export function shouldSkipHostBoot(env: NodeJS.ProcessEnv = process.env): boolean {
  return readDesktopAttachConfig(env) !== undefined
}
