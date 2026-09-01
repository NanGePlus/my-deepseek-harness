/**
 * Match Playwright CDP pages to Electron BrowserView URLs.
 * Electron `webContents.getURL()` is `''` until the first load; Playwright reports `about:blank`.
 * @module @deepseek-ai/dsh-desktop-shell/desktop-browser-cdp
 */

/** Playwright page subset used when attaching over CDP. */
export interface CdpPageLike {
  url(): string
}

/** Playwright browser subset used to detect a stale connectOverCDP handle. */
export interface CdpBrowserLike {
  isConnected(): boolean
  contexts(): ReadonlyArray<{ pages(): readonly CdpPageLike[] }>
}

/**
 * True when Chromium landed on a net-error document (`chrome-error://chromewebdata/`).
 * @param url - `webContents.getURL()` or `page.url()`.
 */
export function isChromiumInternalErrorUrl(url: string): boolean {
  return url.startsWith('chrome-error://')
}

/**
 * Collapse Electron's empty URL and Playwright `about:blank` to one blank document.
 * Net-error URLs must not be reloaded when a BrowserView guest is revived.
 * @param url - `webContents.getURL()` or `page.url()`.
 * @returns `about:blank` for blank or net-error forms; otherwise the original URL.
 */
export function normalizeDesktopBrowserUrl(url: string): string {
  if (url === '' || url === 'about:blank' || isChromiumInternalErrorUrl(url)) return 'about:blank'
  return url
}

/**
 * Find an already-open CDP page whose URL matches the BrowserView target.
 * BrowserView targets exist before `connectOverCDP`, so they do not emit a new `page` event.
 * @param pages - pages from every Playwright browser context.
 * @param targetUrl - Electron `webContents.getURL()` for the tab.
 * @returns the matching page, or undefined when none matches.
 */
export function findCdpPageByUrl<T extends CdpPageLike>(
  pages: readonly T[],
  targetUrl: string,
): T | undefined {
  const want = normalizeDesktopBrowserUrl(targetUrl)
  return pages.find(page => normalizeDesktopBrowserUrl(page.url()) === want)
}

/**
 * True when a cached Playwright CDP browser can still enumerate Electron targets.
 * After `browser.close()`, Playwright keeps the object but `contexts()` is empty.
 * @param browser - a Playwright browser returned from `connectOverCDP`.
 */
export function isDesktopCdpBrowserLive(browser: CdpBrowserLike): boolean {
  return browser.isConnected() && browser.contexts().length > 0
}
