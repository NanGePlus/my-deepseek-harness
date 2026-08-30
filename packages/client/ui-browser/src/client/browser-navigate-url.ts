/** Normalize human-entered address-bar input to an http(s) navigation target. */

const HTTP_SCHEME_RE = /^https?:\/\//i

/**
 * Return a navigable http(s) URL, or undefined when the input cannot be mapped.
 * @param input - raw address-bar text.
 */
export function normalizeBrowserNavigateUrl(input: string): string | undefined {
  const trimmed = input.trim()
  if (trimmed === '') return undefined
  if (HTTP_SCHEME_RE.test(trimmed)) {
    try {
      const parsed = new URL(trimmed)
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return parsed.toString()
    } catch {
      return undefined
    }
    return undefined
  }
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) return undefined
  const localhostLike = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?(\/|$)/i.test(trimmed)
  const candidate = `${localhostLike ? 'http' : 'https'}://${trimmed}`
  try {
    const parsed = new URL(candidate)
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return parsed.toString()
  } catch {
    return undefined
  }
  return undefined
}

/**
 * True when the URL may open in the system browser (http(s) only).
 * @param url - live tab URL.
 */
export function isExternalBrowserUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}
