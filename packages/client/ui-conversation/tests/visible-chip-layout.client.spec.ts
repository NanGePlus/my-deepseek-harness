/**
 * Visible file-context chip layout vs the composer textarea.
 * Horizontal padding on the chip span shifts backdrop glyphs off the
 * textarea caret; the caret then paints inside the pill.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const css = readFileSync(
  fileURLToPath(new URL('../src/client/skeleton/InputBar.module.css', import.meta.url)),
  'utf8',
)

/**
 * Declarations of one selector rule, keyed by property.
 * @param selector - one exact selector, including a leading dot.
 */
function declarations(selector: string): Map<string, string> | undefined {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, ' ')
  const found = new Map<string, string>()
  for (const [, selectorList = '', body = ''] of withoutComments.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!selectorList.split(',').map(value => value.trim()).includes(selector)) continue
    for (const part of body.split(';')) {
      const colon = part.indexOf(':')
      if (colon === -1) continue
      found.set(part.slice(0, colon).trim(), part.slice(colon + 1).trim().replace(/\s+/g, ' '))
    }
  }
  return found.size === 0 ? undefined : found
}

describe('visibleChip layout vs textarea glyphs', () => {
  const chip = declarations('.visibleChip')
  const label = declarations('.visibleChipLabel')

  it('does not add horizontal padding that would shift glyphs off the caret', () => {
    expect(chip).toBeDefined()
    const padding = chip!.get('padding')
    expect(padding).toBeDefined()
    expect(padding).toMatch(/^0(?:px)?$|^\d+px 0(?:px)?$/)
    expect(chip!.get('display')).toBe('inline')
  })

  it('paints exactly one pill fill — no overlay label and no side box-shadow', () => {
    expect(chip!.get('background') ?? chip!.get('background-color')).toBeDefined()
    expect(chip!.has('box-shadow')).toBe(false)
    expect(label).toBeUndefined()
    expect(declarations('.visibleChip::before')).toBeUndefined()
    expect(declarations('.visibleChip::after')).toBeUndefined()
  })

  it('shares the textarea 13px/20px regular face so long ASCII chips do not outrun the caret', () => {
    expect(chip!.get('font-size')).toBe('13px')
    expect(chip!.get('line-height')).toBe('20px')
    expect(chip!.get('font-weight')).toMatch(/^(?:inherit|400|normal)$/)
    expect(declarations('.input')?.get('font-size')).toBe('13px')
    expect(declarations('.input')?.get('line-height')).toBe('20px')
  })
})
