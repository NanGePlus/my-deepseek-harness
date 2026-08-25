/**
 * Change list rows use the pointer cursor like the file tree.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const css = readFileSync(fileURLToPath(new URL('../src/client/GitPanel.module.css', import.meta.url)), 'utf8')
const declarationText = css.replace(/\/\*[\s\S]*?\*\//g, ' ')

describe('GitPanel.module.css change row cursor', () => {
  it('shows a pointer cursor on clickable change rows', () => {
    const rule = /\.row\s*\{([^{}]*)\}/.exec(declarationText)
    expect(rule).not.toBeNull()
    const declarations = (rule![1] ?? '').split(';').map(part => part.trim()).filter(Boolean)
    expect(declarations).toContain('cursor: pointer')
  })
})
