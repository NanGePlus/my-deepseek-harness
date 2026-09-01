/**
 * Plan how a session or popup http(s) URL lands in the toolbox browser.
 * @module @deepseek-ai/dsh-client-ui-browser/client/embedded-browser-open
 */

import { normalizeBrowserNavigateUrl } from './browser-navigate-url.ts'
import { DEFAULT_BROWSER_TAB_URL } from './browser-tab-title.ts'

/** Selected toolbox tab used to decide create vs reuse. */
export interface EmbeddedBrowserOpenSelectedTab {
  tabId: string
  url: string
}

/** Create a Host tab, navigate the blank selected tab, or ignore an unusable URL. */
export type EmbeddedBrowserOpenPlan =
  | { kind: 'create'; url: string }
  | { kind: 'navigate'; url: string; tabId: string }
  | { kind: 'none' }

/**
 * True when the live tab is still the default blank document.
 * @param url - Host-reported tab URL.
 */
export function isBlankEmbeddedBrowserTabUrl(url: string): boolean {
  return url === '' || url === DEFAULT_BROWSER_TAB_URL
}

/**
 * Map a popup or session-link URL onto create vs navigate.
 * Blank selected tabs are reused so a first click does not leave an extra about:blank.
 * @param rawUrl - window-open or anchor href.
 * @param selected - currently selected toolbox tab, if any.
 */
export function planEmbeddedBrowserOpen(
  rawUrl: string,
  selected: EmbeddedBrowserOpenSelectedTab | undefined,
): EmbeddedBrowserOpenPlan {
  const url = normalizeBrowserNavigateUrl(rawUrl)
  if (url === undefined) return { kind: 'none' }
  if (selected !== undefined && isBlankEmbeddedBrowserTabUrl(selected.url)) {
    return { kind: 'navigate', url, tabId: selected.tabId }
  }
  return { kind: 'create', url }
}
