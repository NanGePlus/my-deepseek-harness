/**
 * BrowserView bounds IPC seam (Issue #118 / PRD BrowserView bounds seam).
 */

import { describe, expect, it, vi } from 'vitest'
import {
  applyBrowserOccupantBounds,
  isDestroyedChildViewError,
  type BrowserViewAttachmentState,
  type BrowserViewHost,
  type BrowserViewLike,
} from '../src/browser-view-bounds.ts'

function harness(): {
  host: BrowserViewHost
  view: BrowserViewLike
  state: BrowserViewAttachmentState
  setBounds: ReturnType<typeof vi.fn>
  hostCalls: { added: number; removed: number }
} {
  const setBounds = vi.fn()
  const view: BrowserViewLike = { setBounds }
  const hostCalls = { added: 0, removed: 0 }
  const host: BrowserViewHost = {
    addBrowserView: () => { hostCalls.added += 1 },
    removeBrowserView: () => { hostCalls.removed += 1 },
  }
  const state: BrowserViewAttachmentState = { attached: false }
  return { host, view, state, setBounds, hostCalls }
}

describe('BrowserView bounds seam', () => {
  it('attaches and setBounds when occupant becomes visible', () => {
    const fixture = harness()
    applyBrowserOccupantBounds(fixture.host, fixture.view, fixture.state, {
      x: 120,
      y: 240,
      width: 800,
      height: 600,
      visible: true,
    })
    expect(fixture.hostCalls.added).toBe(1)
    expect(fixture.hostCalls.removed).toBe(0)
    expect(fixture.state.attached).toBe(true)
    expect(fixture.setBounds).toHaveBeenCalledWith({ x: 120, y: 240, width: 800, height: 600 })
  })

  it('updates setBounds when bounds change while visible', () => {
    const fixture = harness()
    applyBrowserOccupantBounds(fixture.host, fixture.view, fixture.state, {
      x: 10,
      y: 20,
      width: 400,
      height: 300,
      visible: true,
    })
    applyBrowserOccupantBounds(fixture.host, fixture.view, fixture.state, {
      x: 15,
      y: 25,
      width: 420,
      height: 310,
      visible: true,
    })
    expect(fixture.setBounds).toHaveBeenLastCalledWith({ x: 15, y: 25, width: 420, height: 310 })
  })

  it('detaches when visible=false', () => {
    const fixture = harness()
    applyBrowserOccupantBounds(fixture.host, fixture.view, fixture.state, {
      x: 0,
      y: 0,
      width: 640,
      height: 480,
      visible: true,
    })
    applyBrowserOccupantBounds(fixture.host, fixture.view, fixture.state, {
      x: 0,
      y: 0,
      width: 640,
      height: 480,
      visible: false,
    })
    expect(fixture.hostCalls.removed).toBe(1)
    expect(fixture.state.attached).toBe(false)
  })

  it('does not throw when Electron refuses to add a destroyed child view', () => {
    const setBounds = vi.fn()
    const view: BrowserViewLike = { setBounds, isDestroyed: () => true }
    const host: BrowserViewHost = {
      addBrowserView: () => {
        throw new Error("Can't add a destroyed child view to a parent view")
      },
      removeBrowserView: () => {},
    }
    expect(() => applyBrowserOccupantBounds(host, view, { attached: false }, {
      x: 10,
      y: 20,
      width: 800,
      height: 600,
      visible: true,
    })).not.toThrow()
    expect(setBounds).not.toHaveBeenCalled()
  })

  it('swallows Electron destroyed-child errors when isDestroyed still reports live', () => {
    const setBounds = vi.fn()
    const view: BrowserViewLike = { setBounds, isDestroyed: () => false }
    const host: BrowserViewHost = {
      addBrowserView: () => {
        throw new Error("Can't add a destroyed child view to a parent view")
      },
      removeBrowserView: () => {},
    }
    const state: BrowserViewAttachmentState = { attached: false }
    expect(() => applyBrowserOccupantBounds(host, view, state, {
      x: 10,
      y: 20,
      width: 800,
      height: 600,
      visible: true,
    })).not.toThrow()
    expect(state.attached).toBe(false)
    expect(setBounds).not.toHaveBeenCalled()
  })

  it('rethrows non-destroyed errors from addBrowserView', () => {
    const view: BrowserViewLike = { setBounds: vi.fn() }
    const host: BrowserViewHost = {
      addBrowserView: () => { throw new Error('unrelated') },
      removeBrowserView: () => {},
    }
    expect(() => applyBrowserOccupantBounds(host, view, { attached: false }, {
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      visible: true,
    })).toThrow('unrelated')
  })

  it('skips removeBrowserView when detaching an already destroyed view', () => {
    const hostCalls = { removed: 0 }
    const view: BrowserViewLike = { setBounds: vi.fn(), isDestroyed: () => true }
    const host: BrowserViewHost = {
      addBrowserView: () => {},
      removeBrowserView: () => { hostCalls.removed += 1 },
    }
    applyBrowserOccupantBounds(host, view, { attached: true }, {
      x: 0,
      y: 0,
      width: 640,
      height: 480,
      visible: false,
    })
    expect(hostCalls.removed).toBe(0)
  })
})

describe('isDestroyedChildViewError', () => {
  it('matches the Electron addBrowserView refusal', () => {
    expect(isDestroyedChildViewError(new Error("Can't add a destroyed child view to a parent view"))).toBe(true)
    expect(isDestroyedChildViewError(new Error('unrelated'))).toBe(false)
    expect(isDestroyedChildViewError('nope')).toBe(false)
  })
})
