/**
 * BrowserRegistry desktop CDP seam (Issue #118 / PRD BrowserRegistry desktop CDP seam).
 */

import { mkdtempSync, realpathSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import type { Browser, BrowserContext, Page } from 'playwright'
import type { WorkspaceId } from '../src/api/workspace.ts'
import { BrowserRegistry } from '../src/browser-registry.ts'
import type { DesktopBrowserSurface } from '../src/browser-delivery.ts'
import { setDesktopBrowserHumanRevealListener } from '../src/browser-delivery.ts'

function createMockPage(initialUrl = 'about:blank'): Page & {
  bringToFront: ReturnType<typeof vi.fn>
  setPageUrl: (next: string) => void
} {
  let url = initialUrl
  const bringToFront = vi.fn(async () => {})
  return {
    url: () => url,
    setPageUrl(next: string) { url = next },
    title: async () => 'Mock title',
    viewportSize: () => ({ width: 1280, height: 720 }),
    on: vi.fn(),
    goto: vi.fn(async (next: string) => { url = next }),
    close: vi.fn(async () => {}),
    bringToFront,
    goBack: vi.fn(async () => {}),
    goForward: vi.fn(async () => {}),
    reload: vi.fn(async () => {}),
    locator: () => ({
      ariaSnapshot: async () => '- document',
      count: async () => 0,
      focus: async () => {},
    }),
    mouse: { click: vi.fn(), move: vi.fn(), down: vi.fn(), up: vi.fn() },
    keyboard: { type: vi.fn(), down: vi.fn(), up: vi.fn(), insertText: vi.fn() },
    evaluate: vi.fn(),
    selectOption: vi.fn(),
    setViewportSize: vi.fn(),
    waitForLoadState: vi.fn(),
    context: () => ({ newCDPSession: vi.fn() } as unknown as BrowserContext),
    screenshot: vi.fn(),
  } as unknown as Page & {
    bringToFront: ReturnType<typeof vi.fn>
    setPageUrl: (next: string) => void
  }
}

function desktopRegistry(page: Page, surface: Partial<DesktopBrowserSurface> = {}): BrowserRegistry {
  const root = realpathSync.native(mkdtempSync(join(tmpdir(), 'dsh-desktop-cdp-')))
  const mockBrowser = {
    contexts: () => [{ pages: () => [page], on: vi.fn(), close: vi.fn() }],
    on: vi.fn(),
    close: vi.fn(),
  } as unknown as Browser
  const connectOverCDP = vi.fn(async () => mockBrowser)
  const desktopSurface: DesktopBrowserSurface = {
    cdpEndpoint: () => 'http://127.0.0.1:9222',
    ensureTab: vi.fn(async () => {}),
    pageForTab: async () => page,
    selectTab: vi.fn(async () => {}),
    closeTab: vi.fn(async () => {}),
    ...surface,
  }
  return new BrowserRegistry(root, {
    delivery: 'desktop',
    connectOverCDP: connectOverCDP as never,
    desktopSurface,
    chromiumExecutablePath: () => '/chromium',
  })
}

describe('BrowserRegistry desktop CDP seam', () => {
  it('creates, navigates, and snapshots a tab via CDP without bringToFront', async () => {
    const page = createMockPage()
    const ensureTab = vi.fn(async () => {})
    const selectTab = vi.fn(async () => {})
    const registry = desktopRegistry(page, { ensureTab, selectTab })
    const workspaceId = 'ws-desktop' as WorkspaceId

    const created = await registry.createTab(workspaceId, 'https://example.com')
    expect(created.tabId.length).toBeGreaterThan(0)
    expect(ensureTab).toHaveBeenCalledWith(workspaceId, created.tabId, 'https://example.com')
    expect(selectTab).toHaveBeenCalledWith(workspaceId, created.tabId)
    expect(page.goto).not.toHaveBeenCalled()
    expect(page.bringToFront).not.toHaveBeenCalled()

    selectTab.mockClear()
    const metadata = await registry.navigate(workspaceId, created.tabId, 'https://example.org')
    expect(metadata.url).toBe('https://example.org')
    expect(selectTab).toHaveBeenCalledWith(workspaceId, created.tabId)
    expect(page.bringToFront).not.toHaveBeenCalled()

    const snapshot = await registry.snapshot(workspaceId, created.tabId)
    expect(snapshot.tree).toBe('- document')
    expect(page.bringToFront).not.toHaveBeenCalled()
  })

  it('selectTab raises the desktop BrowserView', async () => {
    const page = createMockPage()
    const selectTab = vi.fn(async () => {})
    const registry = desktopRegistry(page, { selectTab })
    const workspaceId = 'ws-select' as WorkspaceId
    const created = await registry.createTab(workspaceId)
    selectTab.mockClear()
    await expect(registry.selectTab(workspaceId, created.tabId)).resolves.toEqual({ selected: true })
    expect(selectTab).toHaveBeenCalledWith(workspaceId, created.tabId)
    expect(page.bringToFront).not.toHaveBeenCalled()
  })

  it('showWindow raises the desktop BrowserView without bringToFront', async () => {
    const page = createMockPage()
    const selectTab = vi.fn(async () => {})
    const registry = desktopRegistry(page, { selectTab })
    const workspaceId = 'ws-show' as WorkspaceId
    const created = await registry.createTab(workspaceId)
    selectTab.mockClear()
    await expect(registry.showWindow(workspaceId, created.tabId)).resolves.toEqual({ shown: true })
    expect(selectTab).toHaveBeenCalledWith(workspaceId, created.tabId)
    expect(page.bringToFront).not.toHaveBeenCalled()
  })

  it('reuses the same Playwright page for agent operations after ensureTab', async () => {
    const page = createMockPage()
    const ensureTab = vi.fn(async () => {})
    const pageForTab = vi.fn(async () => page)
    const registry = desktopRegistry(page, { ensureTab, pageForTab })
    const workspaceId = 'ws-shared' as WorkspaceId
    const created = await registry.createTab(workspaceId)
    expect(ensureTab).toHaveBeenCalledTimes(1)
    expect(pageForTab).toHaveBeenCalledWith(workspaceId, created.tabId)
    await registry.click(workspaceId, created.tabId, 10, 20)
    expect(page.mouse.click).toHaveBeenCalledWith(10, 20)
    expect(ensureTab).toHaveBeenCalledTimes(1)
  })

  it('closes the desktop BrowserView before Playwright page.close', async () => {
    const page = createMockPage()
    const order: string[] = []
    page.close = vi.fn(async () => { order.push('page') })
    const closeTab = vi.fn(async () => { order.push('surface') })
    const registry = desktopRegistry(page, { closeTab })
    const workspaceId = 'ws-close' as WorkspaceId
    const created = await registry.createTab(workspaceId)
    await expect(registry.closeTab(workspaceId, created.tabId)).resolves.toEqual({ closed: true })
    expect(closeTab).toHaveBeenCalledWith(workspaceId, created.tabId)
    expect(order).toEqual(['surface', 'page'])
  })

  it('notifies desktop Renderer to reveal toolbox browser after createTab with a URL', async () => {
    const reveals: Array<{ workspaceId: string; tabId: string; url: string }> = []
    const revealForHuman = vi.fn((request) => { reveals.push(request) })
    const page = createMockPage()
    const selectTab = vi.fn(async () => {})
    const registry = desktopRegistry(page, { selectTab, revealForHuman })
    const workspaceId = 'ws-reveal' as WorkspaceId
    const created = await registry.createTab(workspaceId, 'https://example.com')
    expect(selectTab).toHaveBeenCalledWith(workspaceId, created.tabId)
    expect(revealForHuman).toHaveBeenCalledWith({
      workspaceId,
      tabId: created.tabId,
      url: 'about:blank',
    })
    expect(reveals).toEqual([{
      workspaceId,
      tabId: created.tabId,
      url: 'about:blank',
    }])
  })

  it('does not notify human reveal after blank createTab or selectTab', async () => {
    const revealForHuman = vi.fn()
    const page = createMockPage()
    const registry = desktopRegistry(page, { revealForHuman })
    const workspaceId = 'ws-no-reveal-select' as WorkspaceId
    const created = await registry.createTab(workspaceId)
    expect(revealForHuman).not.toHaveBeenCalled()
    await registry.selectTab(workspaceId, created.tabId)
    expect(revealForHuman).not.toHaveBeenCalled()
  })

  it('notifies human reveal after navigate', async () => {
    const revealForHuman = vi.fn()
    const page = createMockPage()
    const registry = desktopRegistry(page, { revealForHuman })
    const workspaceId = 'ws-nav-reveal' as WorkspaceId
    const created = await registry.createTab(workspaceId)
    revealForHuman.mockClear()
    await registry.navigate(workspaceId, created.tabId, 'https://example.org')
    expect(revealForHuman).toHaveBeenCalledWith({
      workspaceId,
      tabId: created.tabId,
      url: 'https://example.org',
    })
  })

  it('falls back to the module reveal listener when the surface omits revealForHuman', async () => {
    const reveals: Array<{ workspaceId: string; tabId: string; url: string }> = []
    setDesktopBrowserHumanRevealListener((request) => { reveals.push(request) })
    try {
      const page = createMockPage()
      const registry = desktopRegistry(page)
      const workspaceId = 'ws-reveal-listener' as WorkspaceId
      const created = await registry.createTab(workspaceId, 'https://example.com')
      expect(reveals).toEqual([{
        workspaceId,
        tabId: created.tabId,
        url: 'about:blank',
      }])
    } finally {
      setDesktopBrowserHumanRevealListener(undefined)
    }
  })

  it('rejects navigation that lands on a Chromium net-error page', async () => {
    const page = createMockPage()
    page.goto = vi.fn(async () => {
      page.setPageUrl('chrome-error://chromewebdata/')
      return null
    })
    const registry = desktopRegistry(page)
    const workspaceId = 'ws-nav-fail' as WorkspaceId
    const created = await registry.createTab(workspaceId)
    await expect(
      registry.navigate(workspaceId, created.tabId, 'http://127.0.0.1:3080/'),
    ).rejects.toThrow('Failed to load http://127.0.0.1:3080/')
    const listed = registry.list(workspaceId)
    expect(listed.tabs[0]?.url).not.toContain('chrome-error://')
  })
})

describe('BrowserRegistry web delivery regression', () => {
  it('still asks Playwright for a headed window on web delivery', async () => {
    const root = realpathSync.native(mkdtempSync(join(tmpdir(), 'dsh-web-regression-')))
    const launch = vi.fn(async () => {
      throw new Error('stop-before-pages')
    })
    const registry = new BrowserRegistry(root, {
      delivery: 'web',
      launchPersistentContext: launch as never,
      chromiumExecutablePath: () => '/chromium',
    })
    await expect(registry.createTab('ws-web' as WorkspaceId)).rejects.toThrow(/stop-before-pages|failed to start/)
    expect(launch).toHaveBeenCalledWith(
      expect.stringContaining('ws-web'),
      expect.objectContaining({ headless: false, viewport: null }),
    )
  })
})
