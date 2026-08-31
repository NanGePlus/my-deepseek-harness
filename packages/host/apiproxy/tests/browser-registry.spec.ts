import { mkdtempSync, realpathSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import type { WorkspaceId } from '../src/api/workspace.ts'
import {
  BROWSER_DEVICE_PIXEL_RATIO_MAX,
  BROWSER_DEVICE_PIXEL_RATIO_MIN,
  BrowserRegistry,
  BrowserTabNotFoundError,
  clampBrowserDevicePixelRatio,
} from '../src/browser-registry.ts'

const CLOSED_TARGET = 'Target page, context or browser has been closed'

type MockPage = {
  url: () => string
  title: () => Promise<string>
  viewportSize: () => { width: number; height: number }
  on: (event: string, handler: () => void) => void
  goto: ReturnType<typeof vi.fn>
  close: () => Promise<void>
  bringToFront: () => Promise<void>
  emitClose: () => void
}

type MockContext = {
  newPage: () => Promise<MockPage>
  on: (event: string, handler: () => void) => void
  close: () => Promise<void>
}

function createMockPage(closed: { value: boolean }): MockPage {
  const pageCloseHandlers: Array<() => void> = []
  const page: MockPage = {
    url: () => 'about:blank',
    title: async () => '',
    viewportSize: () => ({ width: 1280, height: 720 }),
    on: (event: string, handler: () => void) => {
      if (event === 'close') pageCloseHandlers.push(handler)
    },
    goto: vi.fn(async () => {}),
    close: async () => {
      if (closed.value) throw new Error(`page.close: ${CLOSED_TARGET}`)
    },
    bringToFront: async () => {
      if (closed.value) throw new Error(`page.bringToFront: ${CLOSED_TARGET}`)
    },
    emitClose: () => {
      for (const handler of pageCloseHandlers) handler()
    },
  }
  return page
}

function createMockContext(): MockContext {
  const closed = { value: false }
  const closeHandlers: Array<() => void> = []
  return {
    newPage: async () => {
      if (closed.value) throw new Error(`browserContext.newPage: ${CLOSED_TARGET}`)
      return createMockPage(closed)
    },
    on: (event: string, handler: () => void) => {
      if (event === 'close') closeHandlers.push(handler)
    },
    close: async () => {
      closed.value = true
      for (const handler of closeHandlers) handler()
    },
  }
}

function registryWithMockLaunch(launch: ReturnType<typeof vi.fn>): BrowserRegistry {
  const root = realpathSync.native(mkdtempSync(join(tmpdir(), 'dsh-closed-ctx-')))
  return new BrowserRegistry(root, {
    headless: true,
    launchPersistentContext: launch as never,
    chromiumExecutablePath: () => '/chromium',
  })
}

describe('browser registry helpers', () => {
  it('clamps device pixel ratio to supported Host bounds', () => {
    expect(clampBrowserDevicePixelRatio(0)).toBe(BROWSER_DEVICE_PIXEL_RATIO_MIN)
    expect(clampBrowserDevicePixelRatio(Number.NaN)).toBe(BROWSER_DEVICE_PIXEL_RATIO_MIN)
    expect(clampBrowserDevicePixelRatio(1)).toBe(1)
    expect(clampBrowserDevicePixelRatio(2)).toBe(2)
    expect(clampBrowserDevicePixelRatio(4)).toBe(BROWSER_DEVICE_PIXEL_RATIO_MAX)
  })

  it('asks Playwright for a headed window by default', async () => {
    const root = realpathSync.native(mkdtempSync(join(tmpdir(), 'dsh-headed-')))
    const launch = vi.fn(async () => {
      throw new Error('stop-before-pages')
    })
    const registry = new BrowserRegistry(root, {
      launchPersistentContext: launch as never,
      chromiumExecutablePath: () => '/chromium',
    })
    await expect(registry.createTab('ws-headed' as WorkspaceId)).rejects.toThrow(/stop-before-pages|failed to start/)
    expect(launch).toHaveBeenCalledWith(
      expect.stringContaining('ws-headed'),
      expect.objectContaining({ headless: false, viewport: null }),
    )
  })

  it('keeps Chromium headless when internals.headless is true', async () => {
    const root = realpathSync.native(mkdtempSync(join(tmpdir(), 'dsh-headless-')))
    const launch = vi.fn(async () => {
      throw new Error('stop-before-pages')
    })
    const registry = new BrowserRegistry(root, {
      headless: true,
      launchPersistentContext: launch as never,
      chromiumExecutablePath: () => '/chromium',
    })
    await expect(registry.createTab('ws-headless' as WorkspaceId)).rejects.toThrow(/stop-before-pages|failed to start/)
    expect(launch).toHaveBeenCalledWith(
      expect.stringContaining('ws-headless'),
      expect.objectContaining({ headless: true, viewport: { width: 1280, height: 720 } }),
    )
  })

  it('relaunches after the headed window closes the persistent context', async () => {
    const contexts: MockContext[] = []
    const launch = vi.fn(async () => {
      const context = createMockContext()
      contexts.push(context)
      return context
    })
    const registry = registryWithMockLaunch(launch)
    const workspaceId = 'ws-closed' as WorkspaceId
    await registry.createTab(workspaceId)
    expect(launch).toHaveBeenCalledTimes(1)
    await contexts[0]!.close()
    const created = await registry.createTab(workspaceId)
    expect(created.tabId.length).toBeGreaterThan(0)
    expect(launch).toHaveBeenCalledTimes(2)
    expect(registry.list(workspaceId).tabs).toHaveLength(1)
  })

  it('treats closeTab as success after the persistent context is already gone', async () => {
    const contexts: MockContext[] = []
    const launch = vi.fn(async () => {
      const context = createMockContext()
      contexts.push(context)
      return context
    })
    const registry = registryWithMockLaunch(launch)
    const workspaceId = 'ws-close-dead' as WorkspaceId
    const first = await registry.createTab(workspaceId)
    await registry.createTab(workspaceId)
    await contexts[0]!.close()
    await expect(registry.closeTab(workspaceId, first.tabId)).resolves.toEqual({ closed: true })
  })

  it('reports tab-not-found from showWindow after the persistent context closes', async () => {
    const contexts: MockContext[] = []
    const launch = vi.fn(async () => {
      const context = createMockContext()
      contexts.push(context)
      return context
    })
    const registry = registryWithMockLaunch(launch)
    const workspaceId = 'ws-show-dead' as WorkspaceId
    const created = await registry.createTab(workspaceId)
    await contexts[0]!.close()
    await expect(registry.showWindow(workspaceId, created.tabId)).rejects.toBeInstanceOf(BrowserTabNotFoundError)
  })

  it('drops a tab when Playwright emits page close', async () => {
    let lastPage: MockPage | undefined
    const launch = vi.fn(async () => {
      const closed = { value: false }
      return {
        newPage: async () => {
          lastPage = createMockPage(closed)
          return lastPage
        },
        on: vi.fn(),
        close: async () => {},
      }
    })
    const registry = registryWithMockLaunch(launch)
    const workspaceId = 'ws-page-close' as WorkspaceId
    await registry.createTab(workspaceId)
    expect(registry.list(workspaceId).tabs).toHaveLength(1)
    lastPage?.emitClose()
    expect(registry.list(workspaceId).tabs).toHaveLength(0)
  })
})
