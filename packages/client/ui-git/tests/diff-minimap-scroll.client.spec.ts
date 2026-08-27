// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { buildMinimapMarkers } from '../src/client/diff-minimap-model.ts'
import {
  scrollPreviewToMinimapMarker,
  scrollPreviewToMinimapTrackClick,
  scrollTopForMinimapRatio,
} from '../src/client/diff-minimap-scroll.ts'
import { buildDiffPreviewRows } from '../src/client/diff-preview-model.ts'

describe('scrollTopForMinimapRatio', () => {
  it('maps ratio to the scrollable range', () => {
    expect(scrollTopForMinimapRatio(0, 1000, 400)).toBe(0)
    expect(scrollTopForMinimapRatio(1, 1000, 400)).toBe(600)
    expect(scrollTopForMinimapRatio(0.5, 1000, 400)).toBe(300)
  })

  it('clamps out-of-range ratios', () => {
    expect(scrollTopForMinimapRatio(-0.2, 1000, 400)).toBe(0)
    expect(scrollTopForMinimapRatio(1.5, 1000, 400)).toBe(600)
  })
})

describe('scrollPreviewToMinimapMarker', () => {
  it('scrolls the preview row for the marker into view', () => {
    const rows = buildDiffPreviewRows({
      kind: 'text',
      fileText: 'keep\nnew\n',
      hunks: [{
        header: '@@ -1,2 +1,2 @@',
        lines: [
          { origin: 'context', text: 'keep' },
          { origin: 'del', text: 'old' },
          { origin: 'add', text: 'new' },
        ],
      }],
    })
    const marker = buildMinimapMarkers(rows)[0]
    expect(marker).toBeDefined()

    const scrollEl = document.createElement('div')
    const rowEls = rows.map((_, index) => {
      const el = document.createElement('div')
      el.setAttribute('data-diff-row', '')
      if (index === marker!.rowIndex) {
        el.scrollIntoView = vi.fn()
      }
      scrollEl.append(el)
      return el
    })

    scrollPreviewToMinimapMarker(scrollEl, marker!)
    expect(rowEls[marker!.rowIndex]?.scrollIntoView).toHaveBeenCalledWith({ block: 'center' })
  })
})

describe('scrollPreviewToMinimapTrackClick', () => {
  it('uses track geometry instead of the clicked child offsetY', () => {
    const scrollEl = document.createElement('div')
    Object.defineProperty(scrollEl, 'scrollHeight', { value: 1000, configurable: true })
    Object.defineProperty(scrollEl, 'clientHeight', { value: 400, configurable: true })

    const trackEl = document.createElement('div')
    trackEl.getBoundingClientRect = () => ({
      top: 100,
      left: 0,
      right: 20,
      bottom: 500,
      width: 20,
      height: 400,
      x: 0,
      y: 100,
      toJSON: () => ({}),
    })

    scrollPreviewToMinimapTrackClick(scrollEl, trackEl, 300)
    expect(scrollEl.scrollTop).toBe(300)
  })
})
