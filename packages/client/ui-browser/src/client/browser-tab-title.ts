/** Tab label helper: document title or URL host name per PRD embedded-browser. */

/** Return the tab-bar label for one browser tab row. */
export function browserTabDisplayTitle(tab: { title: string; url: string }): string {
  const trimmed = tab.title.trim()
  if (trimmed !== '') return trimmed
  try {
    const host = new URL(tab.url).hostname
    return host !== '' ? host : tab.url
  } catch {
    return tab.url
  }
}

/** Default navigation target for the first automatic tab. */
export const DEFAULT_BROWSER_TAB_URL = 'about:blank'
