// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'
import { harnessXtermFont, harnessXtermTheme } from '../src/client/xterm-theme.ts'

describe('harness xterm theme', () => {
  it('reads Harness CSS tokens with fallbacks', () => {
    document.documentElement.style.setProperty('--dsw-alias-bg-base', '#111111')
    document.documentElement.style.setProperty('--dsw-alias-label-primary', '#eeeeee')
    document.documentElement.style.setProperty('--dsw-alias-state-business-primary', '#336699')
    document.documentElement.style.setProperty('--dsw-alias-bg-overlay', '#445566')
    document.documentElement.style.setProperty('--ds-font-family-code', 'Menlo')
    expect(harnessXtermTheme(true)).toEqual({
      background: '#111111',
      foreground: '#eeeeee',
      cursor: '#336699',
      selectionBackground: '#445566',
    })
    expect(harnessXtermFont()).toEqual({
      fontFamily: 'Menlo',
      fontSize: 13,
      lineHeight: 20 / 13,
    })
  })

  it('uses dark fallbacks when tokens are absent', () => {
    document.documentElement.style.removeProperty('--dsw-alias-bg-base')
    document.documentElement.style.removeProperty('--ds-font-family-code')
    expect(harnessXtermTheme(false).background).toBe('#ffffff')
    expect(harnessXtermFont().fontFamily).toContain('monospace')
  })
})
