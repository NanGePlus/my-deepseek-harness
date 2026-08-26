/**
 * Git panel change-row layout: status badge trailing, row actions reveal on hover/selection.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const css = readFileSync(
  fileURLToPath(new URL('../src/client/GitPanel.module.css', import.meta.url)),
  'utf8',
)
const source = readFileSync(
  fileURLToPath(new URL('../src/client/GitPanel.tsx', import.meta.url)),
  'utf8',
)

function ruleBlock(selector: string): string | undefined {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, ' ')
  for (const match of withoutComments.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selectorList = match[1] ?? ''
    if (!selectorList.split(',').map(value => value.trim()).includes(selector)) continue
    return match[2] ?? ''
  }
  return undefined
}

describe('GitPanel change row layout', () => {
  it('places the status badge after row actions inside rowTail', () => {
    expect(source).toContain('className={css.rowTail}')
    expect(source.indexOf('className={css.rowActions}')).toBeLessThan(source.indexOf('className={`${css.rowBadge}'))
  })

  it('hides row actions until hover, selection, or focus within the row', () => {
    const actions = ruleBlock('.rowActions')
    expect(actions).toContain('opacity: 0')
    expect(actions).toContain('pointer-events: none')
    expect(css).toContain('.row:hover .rowActions')
    expect(css).toContain('.rowSelected .rowActions')
    expect(css).toContain('.row:focus-within .rowActions')
    expect(css).toContain('opacity: 1')
  })

  it('anchors the trailing cluster on the right edge of the row', () => {
    expect(ruleBlock('.rowTail')?.replace(/\s+/g, ' ')).toContain('margin-left: auto')
  })
})
