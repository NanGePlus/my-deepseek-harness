/**
 * Main-window geometry persistence under userData.
 * @module @deepseek-ai/dsh-desktop-shell/window-bounds
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/** userData filename for persisted main-window bounds. */
export const WINDOW_BOUNDS_STORAGE_KEY = 'desktop.windowBounds.v1'

/** Persisted rectangle for BrowserWindow. */
export interface WindowBounds {
  x: number
  y: number
  width: number
  height: number
}

/** Visible display work area used for clamping. */
export interface DisplayWorkArea {
  x: number
  y: number
  width: number
  height: number
}

/** Default main-window size when nothing is stored or bounds are invalid. */
export const DEFAULT_WINDOW_BOUNDS: WindowBounds = {
  x: 0,
  y: 0,
  width: 1280,
  height: 840,
}

function boundsFile(userDataPath: string): string {
  return join(userDataPath, WINDOW_BOUNDS_STORAGE_KEY)
}

function parseBounds(raw: unknown): WindowBounds | undefined {
  if (raw === null || typeof raw !== 'object') return undefined
  const candidate = raw as Partial<WindowBounds>
  if (
    typeof candidate.x !== 'number'
    || typeof candidate.y !== 'number'
    || typeof candidate.width !== 'number'
    || typeof candidate.height !== 'number'
    || !Number.isFinite(candidate.x)
    || !Number.isFinite(candidate.y)
    || !Number.isFinite(candidate.width)
    || !Number.isFinite(candidate.height)
    || candidate.width < 320
    || candidate.height < 240
  ) {
    return undefined
  }
  return {
    x: candidate.x,
    y: candidate.y,
    width: candidate.width,
    height: candidate.height,
  }
}

function intersectsWorkArea(bounds: WindowBounds, workArea: DisplayWorkArea): boolean {
  const right = bounds.x + bounds.width
  const bottom = bounds.y + bounds.height
  const workRight = workArea.x + workArea.width
  const workBottom = workArea.y + workArea.height
  return right > workArea.x && bounds.x < workRight && bottom > workArea.y && bounds.y < workBottom
}

/**
 * Clamp bounds into a display work area, or return centered defaults when fully off-screen.
 * @param bounds - candidate rectangle.
 * @param workArea - visible display work area.
 * @param defaults - fallback size when off-screen.
 * @returns clamped rectangle.
 */
export function clampWindowBounds(
  bounds: WindowBounds,
  workArea: DisplayWorkArea,
  defaults: WindowBounds = DEFAULT_WINDOW_BOUNDS,
): WindowBounds {
  if (!intersectsWorkArea(bounds, workArea)) {
    const width = Math.min(defaults.width, workArea.width)
    const height = Math.min(defaults.height, workArea.height)
    return {
      x: workArea.x + Math.max(0, Math.floor((workArea.width - width) / 2)),
      y: workArea.y + Math.max(0, Math.floor((workArea.height - height) / 2)),
      width,
      height,
    }
  }
  const width = Math.min(bounds.width, workArea.width)
  const height = Math.min(bounds.height, workArea.height)
  const maxX = workArea.x + workArea.width - width
  const maxY = workArea.y + workArea.height - height
  return {
    x: Math.min(Math.max(bounds.x, workArea.x), maxX),
    y: Math.min(Math.max(bounds.y, workArea.y), maxY),
    width,
    height,
  }
}

/**
 * Read persisted bounds from userData, clamped to the current work area.
 * @param userDataPath - Electron `app.getPath('userData')`.
 * @param workArea - primary display work area.
 * @returns bounds to apply when creating BrowserWindow.
 */
export function loadWindowBounds(userDataPath: string, workArea: DisplayWorkArea): WindowBounds {
  const file = boundsFile(userDataPath)
  if (!existsSync(file)) {
    return clampWindowBounds(DEFAULT_WINDOW_BOUNDS, workArea)
  }
  try {
    const parsed = parseBounds(JSON.parse(readFileSync(file, 'utf8')) as unknown)
    if (parsed === undefined) return clampWindowBounds(DEFAULT_WINDOW_BOUNDS, workArea)
    return clampWindowBounds(parsed, workArea)
  } catch {
    return clampWindowBounds(DEFAULT_WINDOW_BOUNDS, workArea)
  }
}

/**
 * Persist main-window bounds before quit.
 * @param userDataPath - Electron `app.getPath('userData')`.
 * @param bounds - latest BrowserWindow bounds.
 */
export function saveWindowBounds(userDataPath: string, bounds: WindowBounds): void {
  mkdirSync(userDataPath, { recursive: true })
  writeFileSync(boundsFile(userDataPath), `${JSON.stringify(bounds)}\n`)
}
