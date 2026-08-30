import { describe, expect, it } from 'vitest'
import {
  clampBrowserZoom, formatBrowserZoomLabel, isDefaultBrowserZoom, stepBrowserZoom,
} from '../src/client/browser-zoom.ts'

describe('browser zoom helpers', () => {
  it('clamps and steps screencast zoom within supported bounds', () => {
    expect(clampBrowserZoom(3)).toBe(2)
    expect(clampBrowserZoom(0.1)).toBe(0.5)
    expect(stepBrowserZoom(1, 1)).toBe(1.25)
    expect(stepBrowserZoom(0.5, -1)).toBe(0.5)
  })

  it('formats zoom labels and detects the default ratio', () => {
    expect(formatBrowserZoomLabel(1)).toBe('100%')
    expect(formatBrowserZoomLabel(1.25)).toBe('125%')
    expect(isDefaultBrowserZoom(1)).toBe(true)
    expect(isDefaultBrowserZoom(1.25)).toBe(false)
  })
})
