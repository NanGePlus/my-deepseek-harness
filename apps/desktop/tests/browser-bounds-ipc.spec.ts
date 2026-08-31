/**
 * Browser bounds IPC handler seam (Issue #118).
 */

import { describe, expect, it } from 'vitest'
import { createBrowserBoundsHandler, parseBrowserOccupantBounds } from '../src/browser-bounds-handler.ts'

describe('browser bounds IPC parsing', () => {
  it('accepts valid occupant bounds payloads', () => {
    expect(parseBrowserOccupantBounds({
      x: 1,
      y: 2,
      width: 800,
      height: 600,
      visible: true,
    })).toEqual({
      x: 1,
      y: 2,
      width: 800,
      height: 600,
      visible: true,
    })
  })

  it('rejects malformed payloads', () => {
    expect(parseBrowserOccupantBounds(null)).toBeUndefined()
    expect(parseBrowserOccupantBounds({ x: 1 })).toBeUndefined()
  })
})

describe('browser bounds IPC handler wiring', () => {
  it('applies parsed bounds through a manager seam', () => {
    const applied: unknown[] = []
    const handler = createBrowserBoundsHandler({
      applyOccupantBounds: (bounds) => { applied.push(bounds) },
    } as never)
    handler({}, {
      x: 10,
      y: 20,
      width: 400,
      height: 300,
      visible: true,
    })
    expect(applied).toEqual([{
      x: 10,
      y: 20,
      width: 400,
      height: 300,
      visible: true,
    }])
    handler({}, { x: 0, y: 0, width: 100, height: 100, visible: false })
    expect(applied).toHaveLength(2)
    expect(applied[1]).toMatchObject({ visible: false })
  })
})
