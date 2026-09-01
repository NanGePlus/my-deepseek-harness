/**
 * Match Playwright CDP pages to Electron BrowserView URLs.
 * Electron `webContents.getURL()` is `''` until the first load; Playwright reports `about:blank`.
 * @module @deepseek-ai/dsh-desktop-shell/desktop-browser-cdp
 */

/** Playwright page subset used when attaching over CDP. */
export interface CdpPageLike {
  url(): string
}

/**
 * Collapse Electron's empty URL and Playwright `about:blank` to one blank document.
 * @param url - `webContents.getURL()` or `page.url()`.
 * @returns `about:blank` for either blank form; otherwise the original URL.
 */
export function normalizeDesktopBrowserUrl(url: string): string {
  return url === '' || url === 'about:blank' ? 'about:blank' : url
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
