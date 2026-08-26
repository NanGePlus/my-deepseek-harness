/**
 * Git panel icon buttons expose hover tooltips like the file-tree toolbar.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const gitPanelSource = readFileSync(fileURLToPath(new URL('../src/client/GitPanel.tsx', import.meta.url)), 'utf8')

describe('GitPanel icon button tooltips', () => {
  it('wraps icon actions in Tooltip with the same delay as the file tree toolbar', () => {
    expect(gitPanelSource).toContain('const ICON_TOOLTIP_DELAY_MS = 500')
    expect(gitPanelSource).toContain('disabled={suppressTooltip ?? inactive}')
  })

  it('wraps the push button in Tooltip with ahead vs unpublished hints', () => {
    expect(gitPanelSource).toContain("t('git.push.hintAhead'")
    expect(gitPanelSource).toContain("t('git.push.hintUnpublished'")
  })
})
