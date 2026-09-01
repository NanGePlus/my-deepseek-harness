/**
 * Chromium internal navigation URLs that must not be persisted or reloaded.
 * @module @deepseek-ai/dsh-host-apiproxy/browser-navigation-url
 */

/**
 * True when Chromium landed on a net-error document (`chrome-error://chromewebdata/`).
 * @param url - Playwright `page.url()` or Electron `webContents.getURL()`.
 */
export function isChromiumInternalErrorUrl(url: string): boolean {
  return url.startsWith('chrome-error://')
}

/**
 * User-visible failure when navigation ends on a Chromium net-error page.
 */
export class BrowserNavigationFailedError extends Error {
  /** @param requestedUrl - the http(s) URL the Host attempted to load. */
  constructor(readonly requestedUrl: string) {
    super(`Failed to load ${requestedUrl}`)
    this.name = 'BrowserNavigationFailedError'
  }
}
