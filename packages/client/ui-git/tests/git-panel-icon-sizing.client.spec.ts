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
    expect(listsDecls).toContain('overflow: hidden')

    const bodyRule = /\.changesBody\s*\{([^{}]*)\}/.exec(declarationText)
    expect(bodyRule).not.toBeNull()
    const bodyDecls = (bodyRule![1] ?? '').split(';').map(part => part.trim()).filter(Boolean)
    expect(bodyDecls).toContain('overflow: auto')
    expect(bodyDecls).toContain('padding-left: 14px')

    const sectionRule = /\.section\s*\{([^{}]*)\}/.exec(declarationText)
    expect(sectionRule).not.toBeNull()
    const sectionDecls = (sectionRule![1] ?? '').split(';').map(part => part.trim()).filter(Boolean)
    expect(sectionDecls.some(part => part.startsWith('min-height:'))).toBe(false)

    const innerSectionRule = /\.changesFiles \.section\s*\{([^{}]*)\}/.exec(declarationText)
    expect(innerSectionRule).not.toBeNull()
    const innerDecls = (innerSectionRule![1] ?? '').split(';').map(part => part.trim()).filter(Boolean)
    expect(innerDecls).toContain('flex: none')
  })

  it('styles CHANGES/GRAPH as folder chrome and pins Graph while Changes is open', () => {
    const titleRule = /\.folderTitle\s*\{([^{}]*)\}/.exec(declarationText)
    expect(titleRule).not.toBeNull()
    const titleDecls = (titleRule![1] ?? '').split(';').map(part => part.trim()).filter(Boolean)
    expect(titleDecls).toContain('font-size: 13px')
    expect(titleDecls).toContain('font-weight: 700')
    expect(titleDecls).toContain('text-transform: uppercase')

    const graphRule = /\.graphFolder\s*\{([^{}]*)\}/.exec(declarationText)
    expect(graphRule).not.toBeNull()
    const graphDecls = (graphRule![1] ?? '').split(';').map(part => part.trim()).filter(Boolean)
    expect(graphDecls).toContain('max-height: 48%')
    expect(graphDecls).toContain('margin-top: auto')

    const graphListRule = /\.graphList\s*\{([^{}]*)\}/.exec(declarationText)
    expect(graphListRule).not.toBeNull()
    const graphListDecls = (graphListRule![1] ?? '').split(';').map(part => part.trim()).filter(Boolean)
    expect(graphListDecls).toContain('padding-left: 14px')

    const canvasRule = /\.graphCanvas\s*\{([^{}]*)\}/.exec(declarationText)
    expect(canvasRule).not.toBeNull()
    const canvasDecls = (canvasRule![1] ?? '').split(';').map(part => part.trim()).filter(Boolean)
    expect(canvasDecls).toContain('left: 14px')

    const opsRule = /\.ops\s*\{([^{}]*)\}/.exec(declarationText)
    expect(opsRule).not.toBeNull()
    const opsDecls = (opsRule![1] ?? '').split(';').map(part => part.trim()).filter(Boolean)
    expect(opsDecls).toContain('padding: 4px 8px 8px')
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
