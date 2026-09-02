/**
 * Desktop BrowserView pool: hide/show and destroyed-guest reattach.
 */

import { describe, expect, it, vi } from 'vitest'
import type { BrowserView, BrowserWindow } from 'electron'
import type { WorkspaceId } from '@deepseek-ai/dsh-host-apiproxy/api/workspace'
import { DesktopBrowserViewManager } from '../src/browser-view-manager.ts'

const connectOverCDP = vi.fn()
vi.mock('electron', () => ({
  BrowserView: class BrowserView {
    readonly stub = true
  },
}))

vi.mock('playwright', () => ({
  chromium: { connectOverCDP: (...args: unknown[]) => connectOverCDP(...args) },
}))

const DESTROYED_CHILD = "Can't add a destroyed child view to a parent view"
const workspaceId = 'ws-bv' as WorkspaceId

function createFakeView(options: { keepIntendedUrlOnFail?: boolean } = {}) {
  const destroyedListeners: Array<() => void> = []
  const eventListeners = new Map<string, Array<(...args: unknown[]) => void>>()
  const webContents = {
    url: '',
    destroyed: false,
    isDestroyed() { return this.destroyed },
    stop: vi.fn(),
    async loadURL(url: string) {
      if (url === 'http://127.0.0.1:3080/') {
        this.url = options.keepIntendedUrlOnFail === true
          ? url
          : 'chrome-error://chromewebdata/'
        for (const listener of eventListeners.get('did-fail-load') ?? []) {
          listener({}, -102, 'ERR_CONNECTION_REFUSED', url, true)
        }
        throw new Error('ERR_CONNECTION_REFUSED (-102) loading \'http://127.0.0.1:3080/\'')
      }
      this.url = url
      for (const listener of eventListeners.get('did-finish-load') ?? []) {
        listener()
      }
    },
    getURL() { return this.url },
    close() {
      this.destroyed = true
      for (const listener of destroyedListeners.splice(0)) listener()
    },
    once(event: string, listener: (...args: unknown[]) => void) {
      const wrapper = (...args: unknown[]) => {
        this.removeListener(event, wrapper)
        listener(...args)
      }
      this.on(event, wrapper)
    },
    on(event: string, listener: (...args: unknown[]) => void) {
      if (event === 'destroyed') {
        destroyedListeners.push(listener as () => void)
        return
      }
      const listeners = eventListeners.get(event) ?? []
      listeners.push(listener)
      eventListeners.set(event, listeners)
    },
    removeListener(event: string, listener: (...args: unknown[]) => void) {
      const listeners = eventListeners.get(event)
      if (listeners === undefined) return
      eventListeners.set(event, listeners.filter(item => item !== listener))
    },
  }
  return {
    webContents,
    setBounds: vi.fn(),
  }
}

function createFakeWindow() {
  const attached: object[] = []
  return {
    attached,
    addBrowserView(view: { webContents: { destroyed: boolean } }) {
      if (view.webContents.destroyed) throw new Error(DESTROYED_CHILD)
      if (!attached.includes(view)) attached.push(view)
    },
    removeBrowserView(view: object) {
      const index = attached.indexOf(view)
      if (index >= 0) attached.splice(index, 1)
    },
  }
}

describe('DesktopBrowserViewManager occupant attach', () => {
  it('reattaches a live view after the toolbox browser segment hides', async () => {
    const views: Array<ReturnType<typeof createFakeView>> = []
    const window = createFakeWindow()
    const manager = new DesktopBrowserViewManager(
      () => window as unknown as BrowserWindow,
      9222,
      () => {
        const view = createFakeView()
        views.push(view)
        return view as unknown as BrowserView
      },
    )
    await manager.ensureTab(workspaceId, 'tab-1', 'https://example.com')
    await manager.selectTab(workspaceId, 'tab-1')
    manager.applyOccupantBounds({ x: 10, y: 20, width: 800, height: 600, visible: true })
    expect(window.attached).toHaveLength(1)
    manager.applyOccupantBounds({ x: 0, y: 0, width: 0, height: 0, visible: false })
    expect(window.attached).toHaveLength(0)
    manager.applyOccupantBounds({ x: 10, y: 20, width: 800, height: 600, visible: true })
    expect(window.attached).toEqual([views[0]])
    expect(views).toHaveLength(1)
  })

  it('does not throw after the guest webContents is destroyed; recreates the view', async () => {
    const views: Array<ReturnType<typeof createFakeView>> = []
    const window = createFakeWindow()
    const manager = new DesktopBrowserViewManager(
      () => window as unknown as BrowserWindow,
      9222,
      () => {
        const view = createFakeView()
        views.push(view)
        return view as unknown as BrowserView
      },
    )
    await manager.ensureTab(workspaceId, 'tab-1', 'https://chat.deepseek.com/sign_in')
    await manager.selectTab(workspaceId, 'tab-1')
    manager.applyOccupantBounds({ x: 10, y: 20, width: 800, height: 600, visible: true })
    views[0]?.webContents.close()
    expect(() => manager.applyOccupantBounds({
      x: 10,
      y: 20,
      width: 800,
      height: 600,
      visible: true,
    })).not.toThrow()
    expect(views).toHaveLength(2)
    expect(window.attached).toEqual([views[1]])
    expect(views[1]?.webContents.url).toBe('https://chat.deepseek.com/sign_in')
  })

  it('loadGuest: times out when loadURL never settles on unreachable hosts', async () => {
    vi.useFakeTimers()
    try {
      const views: Array<ReturnType<typeof createFakeView>> = []
      const manager = new DesktopBrowserViewManager(
        () => createFakeWindow() as unknown as BrowserWindow,
        9222,
        () => {
          const view = createFakeView()
          const baseLoadURL = view.webContents.loadURL.bind(view.webContents)
          view.webContents.loadURL = vi.fn((url: string) => {
            if (url === 'http://127.0.0.1:3080/') return new Promise(() => {})
            return baseLoadURL(url)
          })
          views.push(view)
          return view as unknown as BrowserView
        },
      )
      const pending = manager.ensureTab(workspaceId, 'tab-1', 'http://127.0.0.1:3080/')
      await vi.advanceTimersByTimeAsync(8_000)
      await pending
      expect(views[0]?.webContents.url).toBe('about:blank')
    } finally {
      vi.useRealTimers()
    }
  })

  it('recoverNetErrorGuest: collapses unreachable loads that leave the intended URL', async () => {
    const views: Array<ReturnType<typeof createFakeView>> = []
    const manager = new DesktopBrowserViewManager(
      () => createFakeWindow() as unknown as BrowserWindow,
      9222,
      () => {
        const view = createFakeView({ keepIntendedUrlOnFail: true })
        views.push(view)
        return view as unknown as BrowserView
      },
    )
    await manager.ensureTab(workspaceId, 'tab-1', 'http://127.0.0.1:3080/')
    expect(views[0]?.webContents.url).toBe('about:blank')
  })

  it('recoverNetErrorGuest: replaces chrome-error with about:blank after unreachable loads', async () => {
    const views: Array<ReturnType<typeof createFakeView>> = []
    const manager = new DesktopBrowserViewManager(
      () => createFakeWindow() as unknown as BrowserWindow,
      9222,
      () => {
        const view = createFakeView()
        views.push(view)
        return view as unknown as BrowserView
      },
    )
    await manager.ensureTab(workspaceId, 'tab-1', 'http://127.0.0.1:3080/')
    expect(views[0]?.webContents.url).toBe('about:blank')
  })

  it('drops a closed tab so later bounds ticks do not reattach it', async () => {
    const window = createFakeWindow()
    const manager = new DesktopBrowserViewManager(
      () => window as unknown as BrowserWindow,
      9222,
      () => createFakeView() as unknown as BrowserView,
    )
    await manager.ensureTab(workspaceId, 'tab-1', 'https://example.com')
    await manager.selectTab(workspaceId, 'tab-1')
    manager.applyOccupantBounds({ x: 10, y: 20, width: 800, height: 600, visible: true })
    await manager.closeTab(workspaceId, 'tab-1')
    expect(window.attached).toHaveLength(0)
    expect(() => manager.applyOccupantBounds({
      x: 10,
      y: 20,
      width: 800,
      height: 600,
      visible: true,
    })).not.toThrow()
    expect(window.attached).toHaveLength(0)
  })

  it('reconnects over CDP when the cached browser has no contexts', async () => {
    const deadBrowser = {
      isConnected: () => true,
      contexts: () => [] as const,
      close: vi.fn(async () => {}),
    }
    const livePage = { url: () => 'https://example.com/' }
    const liveBrowser = {
      isConnected: () => true,
      contexts: () => [{ pages: () => [livePage] }],
      close: vi.fn(async () => {}),
    }
    connectOverCDP
      .mockResolvedValueOnce(deadBrowser)
      .mockResolvedValueOnce(liveBrowser)

    const window = createFakeWindow()
    const manager = new DesktopBrowserViewManager(
      () => window as unknown as BrowserWindow,
      9222,
      () => createFakeView() as unknown as BrowserView,
    )
    await manager.ensureTab(workspaceId, 'tab-1', 'https://example.com/')
    await expect(manager.pageForTab(workspaceId, 'tab-1')).resolves.toBe(livePage)
    expect(deadBrowser.close).toHaveBeenCalledOnce()
    expect(connectOverCDP).toHaveBeenCalledTimes(2)
  })
})
