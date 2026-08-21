import { describe, expect, it } from 'vitest'
import {
  clampTreeWidth, EDITOR_PANE_MIN, TREE_WIDTH_DEFAULT, TREE_WIDTH_MAX_RATIO, TREE_WIDTH_MIN,
} from '../src/client/tree-layout.ts'

describe('tree layout constants', () => {
  it('defaults to the minimum practical tree width', () => {
    expect(TREE_WIDTH_DEFAULT).toBe(TREE_WIDTH_MIN)
  })
})

describe('clampTreeWidth', () => {
  it('clamps to the minimum tree width', () => {
    expect(clampTreeWidth(80, 800)).toBe(TREE_WIDTH_MIN)
  })

  it('clamps to the ratio and editor minimum ceilings', () => {
    const container = 1000
    const ratioMax = container * TREE_WIDTH_MAX_RATIO
    const editorMax = container - EDITOR_PANE_MIN - 4
    expect(clampTreeWidth(900, container)).toBe(Math.min(ratioMax, editorMax))
  })

  it('keeps widths inside the allowed range', () => {
    expect(clampTreeWidth(320, 1000)).toBe(320)
  })
})
