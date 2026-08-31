/**
 * Window bounds persistence + off-screen clamp seam (Issue #117 / PRD 窗口几何持久化).
 */

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  DEFAULT_WINDOW_BOUNDS,
  WINDOW_BOUNDS_STORAGE_KEY,
  clampWindowBounds,
  loadWindowBounds,
  saveWindowBounds,
  type DisplayWorkArea,
  type WindowBounds,
} from '../src/window-bounds.ts'

const WORK_AREA: DisplayWorkArea = { x: 0, y: 25, width: 1440, height: 875 }

describe('desktop window bounds seam', () => {
  let dir = ''

  afterEach(() => {
    if (dir !== '') rmSync(dir, { recursive: true, force: true })
    dir = ''
  })

  it('restores persisted bounds on the next launch', () => {
    dir = mkdtempSync(join(tmpdir(), 'dsh-desktop-bounds-'))
    const stored: WindowBounds = { x: 120, y: 80, width: 1024, height: 768 }
    saveWindowBounds(dir, stored)
    const raw = JSON.parse(readFileSync(join(dir, WINDOW_BOUNDS_STORAGE_KEY), 'utf8')) as WindowBounds
    expect(raw).toEqual(stored)
    expect(loadWindowBounds(dir, WORK_AREA)).toEqual(stored)
  })

  it('falls back to safe defaults when stored bounds are off-screen', () => {
    dir = mkdtempSync(join(tmpdir(), 'dsh-desktop-bounds-off-'))
    writeFileSync(
      join(dir, WINDOW_BOUNDS_STORAGE_KEY),
      `${JSON.stringify({ x: 9000, y: 9000, width: 1280, height: 840 })}\n`,
    )
    const restored = loadWindowBounds(dir, WORK_AREA)
    expect(restored.x).toBeGreaterThanOrEqual(WORK_AREA.x)
    expect(restored.y).toBeGreaterThanOrEqual(WORK_AREA.y)
    expect(restored.x + restored.width).toBeLessThanOrEqual(WORK_AREA.x + WORK_AREA.width)
    expect(restored.y + restored.height).toBeLessThanOrEqual(WORK_AREA.y + WORK_AREA.height)
  })

  it('clamps partially visible bounds into the work area', () => {
    const clamped = clampWindowBounds(
      { x: -200, y: 10, width: 1280, height: 840 },
      WORK_AREA,
      DEFAULT_WINDOW_BOUNDS,
    )
    expect(clamped.x).toBe(WORK_AREA.x)
    expect(clamped.y).toBe(WORK_AREA.y)
  })
})
