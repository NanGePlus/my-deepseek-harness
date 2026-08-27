/**
 * Git panel row actions use compact icon buttons and the discard (not refresh) glyph.
 * Change sections keep content height so a long unstaged list does not paint over 待提交.
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

  it('stacks the unpushed copy and push button under the branch line', () => {
    const branchRowRule = /\.branchRow\s*\{([^{}]*)\}/.exec(declarationText)
    expect(branchRowRule).not.toBeNull()
    const branchRowDecls = (branchRowRule![1] ?? '').split(';').map(part => part.trim()).filter(Boolean)
    expect(branchRowDecls).toContain('flex-direction: column')

    const pushRowRule = /\.pushRow\s*\{([^{}]*)\}/.exec(declarationText)
    expect(pushRowRule).not.toBeNull()
    const pushRowDecls = (pushRowRule![1] ?? '').split(';').map(part => part.trim()).filter(Boolean)
    expect(pushRowDecls).toContain('display: flex')
    expect(pushRowDecls).toContain('align-items: center')
  })

  it('keeps each change section at content height so a long unstaged list pushes 待提交 down', () => {
    const listsRule = /\.lists\s*\{([^{}]*)\}/.exec(declarationText)
    expect(listsRule).not.toBeNull()
    const listsDecls = (listsRule![1] ?? '').split(';').map(part => part.trim()).filter(Boolean)
    expect(listsDecls).toContain('overflow: auto')

    const sectionRule = /\.section\s*\{([^{}]*)\}/.exec(declarationText)
    expect(sectionRule).not.toBeNull()
    const sectionDecls = (sectionRule![1] ?? '').split(';').map(part => part.trim()).filter(Boolean)
    expect(sectionDecls).toContain('flex: none')
    expect(sectionDecls.some(part => part.startsWith('min-height:'))).toBe(false)
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
