// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'
import {
  stepTreeDragAutoScroll,
  TREE_DRAG_SCROLL_EDGE_PX,
  TREE_DRAG_SCROLL_STEP_PX,
} from '../src/client/tree-drag-auto-scroll.ts'

describe('stepTreeDragAutoScroll', () => {
  it('scrolls up when the pointer is near the top edge', () => {
    const scroll = document.createElement('div')
    scroll.scrollTop = 120
    Object.defineProperty(scroll, 'getBoundingClientRect', {
      value: () => ({ top: 100, bottom: 400, left: 0, right: 200, width: 200, height: 300 }),
    })
    stepTreeDragAutoScroll(scroll, 100 + TREE_DRAG_SCROLL_EDGE_PX - 1)
    expect(scroll.scrollTop).toBe(120 - TREE_DRAG_SCROLL_STEP_PX)
  })

  it('scrolls down when the pointer is near the bottom edge', () => {
    const scroll = document.createElement('div')
    scroll.scrollTop = 40
    Object.defineProperty(scroll, 'getBoundingClientRect', {
      value: () => ({ top: 100, bottom: 400, left: 0, right: 200, width: 200, height: 300 }),
    })
    stepTreeDragAutoScroll(scroll, 400 - TREE_DRAG_SCROLL_EDGE_PX + 1)
    expect(scroll.scrollTop).toBe(40 + TREE_DRAG_SCROLL_STEP_PX)
  })

  it('does not scroll when the pointer is in the middle band', () => {
    const scroll = document.createElement('div')
    scroll.scrollTop = 80
    Object.defineProperty(scroll, 'getBoundingClientRect', {
      value: () => ({ top: 100, bottom: 400, left: 0, right: 200, width: 200, height: 300 }),
    })
    stepTreeDragAutoScroll(scroll, 250)
    expect(scroll.scrollTop).toBe(80)
  })
})
