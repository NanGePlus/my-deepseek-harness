/**
 * Commit input pending border: the highlight sweeps along the frame by animating
 * the conic-gradient angle, not by rotating the masked pseudo-element.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const css = readFileSync(
  fileURLToPath(new URL('../src/client/GitPanel.module.css', import.meta.url)),
  'utf8',
)

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, ' ')
}

function ruleBlock(source: string, selector: string): string | undefined {
  const withoutComments = stripComments(source)
  for (const match of withoutComments.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selectorList = match[1] ?? ''
    if (!selectorList.split(',').map(value => value.trim()).includes(selector)) continue
    return match[2] ?? ''
  }
  return undefined
}

function keyframesBlock(source: string, name: string): string | undefined {
  const withoutComments = stripComments(source)
  const pattern = new RegExp(`@keyframes\\s+${name}\\s*\\{([\\s\\S]*?)\\}`)
  return pattern.exec(withoutComments)?.[1]
}

describe('GitPanel commit input pending border', () => {
  const pendingBefore = ruleBlock(css, '.commitInputShell[data-pending]::before')
  const pushPendingBefore = ruleBlock(css, '.pushButtonShell[data-pending]::before')
  const pendingInput = ruleBlock(css, '.commitInputShell[data-pending] .commitInput')
  const pushPendingButton = ruleBlock(css, '.pushButtonShell[data-pending] .pushButton')
  const spinKeyframes = keyframesBlock(css, 'git-commit-input-border-spin')

  it('animates the gradient angle instead of rotating the pseudo-element', () => {
    expect(css).toContain('@property --git-commit-border-angle')
    expect(pendingBefore).toBeDefined()
    expect(pushPendingBefore).toBeDefined()
    expect(pendingBefore!).toContain('from var(--git-commit-border-angle')
    expect(pushPendingBefore!).toContain('from var(--git-commit-border-angle')
    expect(pendingBefore!).not.toContain('transform: rotate')
    expect(spinKeyframes).toBeDefined()
    expect(spinKeyframes!).toContain('--git-commit-border-angle: 360deg')
    expect(spinKeyframes!).not.toContain('transform')
  })

  it('hides the static input border while pending so the animated ring stays visible', () => {
    expect(pendingInput?.replace(/\s+/g, ' ')).toContain('border-color: transparent')
  })

  it('hides the static push button border while pending so the animated ring stays visible', () => {
    expect(pushPendingButton?.replace(/\s+/g, ' ')).toContain('border-color: transparent')
  })
})
