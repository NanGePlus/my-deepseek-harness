import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { CONFIRM_POPOVER_GAP, confirmPopoverPosition } from '../src/client/git-confirm-popover.ts'

const css = readFileSync(
  fileURLToPath(new URL('../src/client/GitPanel.module.css', import.meta.url)),
  'utf8',
)

describe('confirmPopoverPosition', () => {
  it('puts the origin at the trigger bottom-right plus the gap', () => {
    expect(confirmPopoverPosition(
      { right: 160, bottom: 108 },
      { width: 0, height: 0 },
      { width: 1024, height: 768 },
    )).toEqual({ left: 160 + CONFIRM_POPOVER_GAP, top: 108 + CONFIRM_POPOVER_GAP })
  })

  it('clamps a measured card into the viewport', () => {
    expect(confirmPopoverPosition(
      { right: 1000, bottom: 700 },
      { width: 280, height: 120 },
      { width: 1024, height: 768 },
    )).toEqual({ left: 1024 - 280 - 8, top: 768 - 120 - 8 })
  })
})

describe('Git confirm dialog chrome', () => {
  it('gives the card a hairline border and elevation shadow', () => {
    expect(css).toContain('.dialogCard')
    expect(css).toContain('box-shadow: var(--dsw-shadow-lv3)')
    expect(css).toContain('border: 1px solid var(--dsw-alias-border-l2)')
  })

  it('fixes the action-confirm popover in the viewport', () => {
    expect(css).toContain('.dialogPopover')
    expect(css).toContain('position: fixed')
  })
})
