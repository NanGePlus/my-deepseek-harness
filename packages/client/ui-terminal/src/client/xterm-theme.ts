/** Map Harness CSS tokens to an xterm ITheme. */

import type { ITheme } from '@xterm/xterm'

/** Read one computed CSS custom property from the document root. */
function cssVar(name: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value === '' ? fallback : value
}

/**
 * Build an xterm theme from the active Harness token surface.
 * @param dark - whether the Harness document is in dark mode.
 * @returns xterm theme colors aligned with DESIGN tokens.
 */
export function harnessXtermTheme(dark: boolean): ITheme {
  const bg = cssVar('--dsw-alias-markdown-code-block', dark ? '#1e1e1e' : '#f6f8fa')
  const fg = cssVar('--dsw-alias-label-primary', dark ? '#e6edf3' : '#262626')
  const cursor = cssVar('--dsw-alias-state-business-primary', dark ? '#4d9fff' : '#0066ff')
  return {
    background: bg,
    foreground: fg,
    cursor,
    selectionBackground: cssVar('--dsw-alias-bg-overlay', dark ? '#264f78' : '#add6ff'),
  }
}

/** Font family and size aligned with DESIGN §3 code typography. */
export function harnessXtermFont(): { fontFamily: string; fontSize: number; lineHeight: number } {
  return {
    fontFamily: cssVar('--ds-font-family-code', 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'),
    fontSize: 13,
    lineHeight: 20 / 13,
  }
}
