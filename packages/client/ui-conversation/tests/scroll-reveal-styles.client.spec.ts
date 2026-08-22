/**
 * Scroll-reveal rules on the conversation scrollport: the active class the
 * hook toggles rebinds ui-theme's indirection pair back to the base surface.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const css = readFileSync(fileURLToPath(new URL('../src/client/skeleton/ConversationRoot.module.css', import.meta.url)), 'utf8')
const declarationText = css.replace(/\/\*[\s\S]*?\*\//g, ' ')

describe('ConversationRoot.module.css scroll reveal', () => {
  it('hides the scrollport thumb by default', () => {
    const rule = /\.scrollBody\s*\{([^{}]*)\}/.exec(declarationText)
    expect(rule).not.toBeNull()
    const declarations = (rule![1] ?? '').split(';').map(part => part.trim()).filter(Boolean)
    expect(declarations).toContain('--dsh-scrollbar-thumb: transparent')
    expect(declarations).toContain('--dsh-scrollbar-thumb-hover: transparent')
  })

  it('rebinds the active scrollport to the l1 pair', () => {
    const rule = /\.scrollBodyScrollActive\s*\{([^{}]*)\}/.exec(declarationText)
    expect(rule).not.toBeNull()
    const declarations = (rule![1] ?? '').split(';').map(part => part.trim()).filter(Boolean).sort()
    expect(declarations).toEqual([
      '--dsh-scrollbar-thumb-hover: var(--dsw-alias-scrollbar-hover-l1)',
      '--dsh-scrollbar-thumb: var(--dsw-alias-scrollbar-bg-l1)',
    ].sort())
  })
})
