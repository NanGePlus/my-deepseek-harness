/**
 * Decide how desktop webContents handle window.open / target=_blank.
 * @module @deepseek-ai/dsh-desktop-shell/window-open-policy
 */

/** Deny a popup; when `embedUrl` is set, Renderer opens it in the toolbox browser. */
export type DesktopWindowOpenDecision =
  | { action: 'deny'; embedUrl: string }
  | { action: 'deny' }

/**
 * Route http(s) popups into the embedded browser; deny every other scheme.
 * @param url - Chromium window-open target.
 */
export function decideDesktopWindowOpen(url: string): DesktopWindowOpenDecision {
  try {
    const parsed = new URL(url)
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return { action: 'deny', embedUrl: parsed.toString() }
    }
  } catch {
    return { action: 'deny' }
  }
  return { action: 'deny' }
}
