/**
 * Git panel row actions use compact icon buttons and the discard (not refresh) glyph.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const gitPanelSource = readFileSync(fileURLToPath(new URL('../src/client/GitPanel.tsx', import.meta.url)), 'utf8')
const css = readFileSync(fileURLToPath(new URL('../src/client/GitPanel.module.css', import.meta.url)), 'utf8')
const declarationText = css.replace(/\/\*[\s\S]*?\*\//g, ' ')

describe('GitPanel icon sizing and discard glyph', () => {
  it('uses IconDiscardOutline16 for discard actions', () => {
    expect(gitPanelSource).toContain('IconDiscardOutline16')
    expect(gitPanelSource).not.toContain('IconRefreshOutline16')
  })

  it('uses 12px glyphs in compact row actions', () => {
    expect(gitPanelSource).toContain('const ROW_ACTION_ICON_SIZE = 12')
    expect(gitPanelSource).toContain('<IconDiscardOutline16 size={ROW_ACTION_ICON_SIZE} />')
  })

  it('sizes row and gutter icon buttons smaller than section actions', () => {
    const iconRule = /\.iconButton\s*\{([^{}]*)\}/.exec(declarationText)
    expect(iconRule).not.toBeNull()
    const iconDecls = (iconRule![1] ?? '').split(';').map(part => part.trim()).filter(Boolean)
    expect(iconDecls).toContain('width: 20px')
    expect(iconDecls).toContain('height: 20px')

    const compactRule = /\.rowActions \.iconButton,\s*\.diffGutterActions \.iconButton\s*\{([^{}]*)\}/.exec(declarationText)
    expect(compactRule).not.toBeNull()
    const compactDecls = (compactRule![1] ?? '').split(';').map(part => part.trim()).filter(Boolean)
    expect(compactDecls).toContain('width: 18px')
    expect(compactDecls).toContain('height: 18px')
  })
})
