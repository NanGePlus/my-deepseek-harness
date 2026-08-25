import { describe, expect, it } from 'vitest'
import {
  clampOpsWidth, OPS_WIDTH_DEFAULT, OPS_WIDTH_MAX_RATIO, OPS_WIDTH_MIN, PREVIEW_PANE_MIN,
} from '../src/client/git-panel-layout.ts'

describe('git panel layout constants', () => {
  it('defaults to the minimum practical ops-pane width', () => {
    expect(OPS_WIDTH_DEFAULT).toBe(OPS_WIDTH_MIN)
  })
})

describe('clampOpsWidth', () => {
  it('clamps to the minimum ops-pane width', () => {
    expect(clampOpsWidth(80, 800)).toBe(OPS_WIDTH_MIN)
  })

  it('clamps to the ratio and preview minimum ceilings', () => {
    const container = 1000
    const ratioMax = container * OPS_WIDTH_MAX_RATIO
    const previewMax = container - PREVIEW_PANE_MIN - 4
    expect(clampOpsWidth(900, container)).toBe(Math.min(ratioMax, previewMax))
  })

  it('keeps widths inside the allowed range', () => {
    expect(clampOpsWidth(320, 1000)).toBe(320)
  })
})
