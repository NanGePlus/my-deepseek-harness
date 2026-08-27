/**
 * Scroll-reveal rules on the diff preview scroller: the active class the hook
 * toggles rebinds ui-theme's indirection pair to the sidebar elevation.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const css = readFileSync(fileURLToPath(new URL('../src/client/GitPanel.module.css', import.meta.url)), 'utf8')
const declarationText = css.replace(/\/\*[\s\S]*?\*\//g, ' ')

describe('GitPanel.module.css scroll reveal', () => {
  it('hides the preview scroller thumb by default', () => {
    const rule = /\.previewBody\s*\{([^{}]*)\}/.exec(declarationText)
    expect(rule).not.toBeNull()
    const declarations = (rule![1] ?? '').split(';').map(part => part.trim()).filter(Boolean)
    expect(declarations).toContain('--dsh-scrollbar-thumb: transparent')
    expect(declarations).toContain('--dsh-scrollbar-thumb-hover: transparent')
  })

  it('rebinds the active preview scroller to the l2 pair', () => {
    const rule = /\.previewBodyActive\s*\{([^{}]*)\}/.exec(declarationText)
    expect(rule).not.toBeNull()
    const declarations = (rule![1] ?? '').split(';').map(part => part.trim()).filter(Boolean).sort()
    expect(declarations).toEqual([
      '--dsh-scrollbar-thumb-hover: var(--dsw-alias-scrollbar-hover-l2)',
      '--dsh-scrollbar-thumb: var(--dsw-alias-scrollbar-bg-l2)',
    ].sort())
  })
})
