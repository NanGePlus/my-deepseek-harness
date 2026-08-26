/**
 * Scroll-reveal rules on the file-tree scroller: the active class the hook
 * toggles rebinds ui-theme's indirection pair to the sidebar elevation.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const fileTreeCss = readFileSync(fileURLToPath(new URL('../src/client/FileTreePane.module.css', import.meta.url)), 'utf8')
const monacoCss = readFileSync(fileURLToPath(new URL('../src/client/MonacoEditor.module.css', import.meta.url)), 'utf8')
const editorPaneCss = readFileSync(fileURLToPath(new URL('../src/client/EditorPane.module.css', import.meta.url)), 'utf8')

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, ' ')
}

function declarationsFor(css: string, selectorPattern: RegExp): string[] {
  const rule = selectorPattern.exec(stripComments(css))
  expect(rule).not.toBeNull()
  return (rule![1] ?? '').split(';').map(part => part.trim()).filter(Boolean)
}

describe('FileTreePane.module.css scroll reveal', () => {
  it('hides the tree scroller thumb by default', () => {
    const declarations = declarationsFor(fileTreeCss, /\.treeScroll\s*\{([^{}]*)\}/)
    expect(declarations).toContain('--dsh-scrollbar-thumb: transparent')
    expect(declarations).toContain('--dsh-scrollbar-thumb-hover: transparent')
  })

  it('rebinds the active tree scroller to the l2 pair', () => {
    const declarations = declarationsFor(fileTreeCss, /\.treeScrollActive\s*\{([^{}]*)\}/).sort()
    expect(declarations).toEqual([
      '--dsh-scrollbar-thumb-hover: var(--dsw-alias-scrollbar-hover-l2)',
      '--dsh-scrollbar-thumb: var(--dsw-alias-scrollbar-bg-l2)',
    ].sort())
  })
})

describe('MonacoEditor.module.css scroll reveal', () => {
  it('hides the editor scrollbar thumb by default', () => {
    const declarations = declarationsFor(monacoCss, /\.wrap\s*\{([^{}]*)\}/)
    expect(declarations).toContain('--dsh-scrollbar-thumb: transparent')
    expect(declarations).toContain('--dsh-monaco-scrollbar-thumb: transparent')
  })

  it('rebinds the active document-surface editor to the l1 pair', () => {
    const declarations = declarationsFor(
      monacoCss,
      /\.wrap\.scrollActive\[data-surface='document'\]\s*\{([^{}]*)\}/,
    ).sort()
    expect(declarations).toEqual([
      '--dsh-scrollbar-thumb-hover: var(--dsw-alias-scrollbar-hover-l1)',
      '--dsh-scrollbar-thumb: var(--dsw-alias-scrollbar-bg-l1)',
      '--dsh-monaco-scrollbar-thumb-hover: var(--dsw-alias-scrollbar-hover-l1)',
      '--dsh-monaco-scrollbar-thumb: var(--dsw-alias-scrollbar-bg-l1)',
    ].sort())
  })

  it('rebinds the active sidebar-surface editor to the l2 pair', () => {
    const declarations = declarationsFor(
      monacoCss,
      /\.wrap\.scrollActive\[data-surface='sidebar'\]\s*\{([^{}]*)\}/,
    ).sort()
    expect(declarations).toEqual([
      '--dsh-scrollbar-thumb-hover: var(--dsw-alias-scrollbar-hover-l2)',
      '--dsh-scrollbar-thumb: var(--dsw-alias-scrollbar-bg-l2)',
      '--dsh-monaco-scrollbar-thumb-hover: var(--dsw-alias-scrollbar-hover-l2)',
      '--dsh-monaco-scrollbar-thumb: var(--dsw-alias-scrollbar-bg-l2)',
    ].sort())
  })
})

describe('EditorPane.module.css scroll reveal', () => {
  it('hides the markdown preview scroller thumb by default', () => {
    const declarations = declarationsFor(editorPaneCss, /\.markdownPreview\s*\{([^{}]*)\}/)
    expect(declarations).toContain('--dsh-scrollbar-thumb: transparent')
    expect(declarations).toContain('--dsh-scrollbar-thumb-hover: transparent')
  })

  it('rebinds the active markdown preview scroller to the l1 pair', () => {
    const declarations = declarationsFor(editorPaneCss, /\.markdownPreviewActive\s*\{([^{}]*)\}/).sort()
    expect(declarations).toEqual([
      '--dsh-scrollbar-thumb-hover: var(--dsw-alias-scrollbar-hover-l1)',
      '--dsh-scrollbar-thumb: var(--dsw-alias-scrollbar-bg-l1)',
    ].sort())
  })
})
