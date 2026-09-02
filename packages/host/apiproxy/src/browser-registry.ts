/**
 * Workspace-scoped Playwright browser registry for host.browser.* RPC.
 */

import { randomUUID } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { chromium, type Browser, type BrowserContext, type CDPSession, type Page } from 'playwright'
import type { WorkspaceId } from './api/workspace.ts'
import type { BrowserScreencastFrame } from './api/host.ts'
import {
  BrowserNavigationFailedError,
  isChromiumInternalErrorUrl,
} from './browser-navigation-url.ts'
import {
  type BrowserDelivery,
  type DesktopBrowserSurface,
  getDesktopBrowserSurface,
  notifyDesktopBrowserHumanReveal,
  requireDesktopBrowserSurface,
} from './browser-delivery.ts'
import {
  APPLY_SCROLL_AT_POINT, DISPATCH_FOCUSED_INPUT, FOCUS_EDITABLE_AT_POINT, READ_CSS_CURSOR_AT_POINT,
  asPageFunction,
} from './browser-page-scripts.ts'

/** One live browser tab row of host.browserList. */
export interface BrowserTabSummary {
  tabId: string
  url: string
  title: string
  selected: boolean
  canGoBack: boolean
  canGoForward: boolean
}

/** host.browserList success value. */
export interface BrowserListResult {
  tabs: BrowserTabSummary[]
}

/** host.browserCreateTab success value. */
export interface BrowserCreateTabResult {
  tabId: string
}

/** host.browserNavigate / reload success value. */
export interface BrowserPageMetadata {
  url: string
  title: string
  canGoBack: boolean
  canGoForward: boolean
}

/** host.browserSnapshot success value. */
export interface BrowserSnapshotResult {
  tree: string
}

/** Distinguishable browser-unavailable reasons for Client empty states. */
export type BrowserUnavailableReason = 'chromium-missing' | 'context-start-failed'

/** Raised when Playwright Chromium cannot serve browser RPC. */
export class BrowserUnavailableError extends Error {
  /** @param message - user-visible reason. */
  constructor(
    message: string,
    readonly reason: BrowserUnavailableReason,
  ) {
    super(message)
    this.name = 'BrowserUnavailableError'
  }
}

/** Supported Host screencast device scale factor bounds. */
export const BROWSER_DEVICE_PIXEL_RATIO_MIN = 1
export const BROWSER_DEVICE_PIXEL_RATIO_MAX = 3

/** Clamp one Client-reported device pixel ratio to supported Host bounds. */
export function clampBrowserDevicePixelRatio(devicePixelRatio: number): number {
  if (!Number.isFinite(devicePixelRatio) || devicePixelRatio <= 0) return BROWSER_DEVICE_PIXEL_RATIO_MIN
  return Math.min(
    BROWSER_DEVICE_PIXEL_RATIO_MAX,
    Math.max(BROWSER_DEVICE_PIXEL_RATIO_MIN, devicePixelRatio),
  )
}

/** True when Playwright rejected an operation because the page or Context is gone. */
function isTargetClosedError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return /has been closed|TargetClosedError/i.test(message)
}

/** Raised when a browser tab id is unknown within a workspace. */
export class BrowserTabNotFoundError extends Error {
  /** @param tabId - requested tab id. */
  constructor(readonly tabId: string) {
    super(`browser tab not found: ${tabId}`)
    this.name = 'BrowserTabNotFoundError'
  }
}

/** Injectable Playwright hooks for host integration tests. */
export interface BrowserRegistryInternals {
  profilesRoot?: string
  launchPersistentContext?: typeof chromium.launchPersistentContext
  connectOverCDP?: typeof chromium.connectOverCDP
  chromiumExecutablePath?: () => string
  /** Browser delivery shape; web keeps the headed Playwright OS window. */
  delivery?: BrowserDelivery
  /** Desktop BrowserView surface; required when {@link delivery} is `desktop`. */
  desktopSurface?: DesktopBrowserSurface
  /** When true, Chromium stays headless. Product default is a visible window. */
  headless?: boolean
}

interface LiveTab {
  tabId: string
  page: Page
  url: string
  title: string
  canGoBack: boolean
  canGoForward: boolean
  viewportWidth: number
  viewportHeight: number
  devicePixelRatio: number
  cdp?: CDPSession
  lastRequestedUrl?: string
}

interface WorkspaceBrowser {
  context?: BrowserContext
  tabs: Map<string, LiveTab>
  selectedTabId: string | undefined
  devicePixelRatio: number
}

interface TabSnapshot {
  tabId: string
  url: string
  selected: boolean
  viewportWidth: number
  viewportHeight: number
}

/** Workspace-indexed Playwright BrowserContext pool. */
export class BrowserRegistry {
  private readonly workspaces = new Map<WorkspaceId, WorkspaceBrowser>()
  private readonly recreating = new Map<WorkspaceId, Promise<WorkspaceBrowser>>()
  private readonly profilesRoot: string
  private readonly launchPersistentContext: typeof chromium.launchPersistentContext
  private readonly connectOverCDP: typeof chromium.connectOverCDP
  private readonly chromiumExecutablePath: () => string
  private readonly delivery: BrowserDelivery
  private readonly desktopSurface: DesktopBrowserSurface | undefined
  private readonly headless: boolean
  private desktopBrowser: Browser | undefined

  /**
   * @param cwd - Host project directory; profiles live under `.sessions/browser-profiles/`.
   * @param internals - optional test hooks.
   */
  constructor(cwd: string, internals: BrowserRegistryInternals = {}) {
    this.profilesRoot = internals.profilesRoot ?? join(cwd, '.sessions', 'browser-profiles')
    this.launchPersistentContext = internals.launchPersistentContext ?? chromium.launchPersistentContext.bind(chromium)
    this.connectOverCDP = internals.connectOverCDP ?? chromium.connectOverCDP.bind(chromium)
    this.chromiumExecutablePath = internals.chromiumExecutablePath ?? (() => chromium.executablePath())
    const registeredSurface = internals.desktopSurface ?? getDesktopBrowserSurface()
    this.delivery = registeredSurface !== undefined ? 'desktop' : (internals.delivery ?? 'web')
    this.desktopSurface = registeredSurface
    this.headless = internals.headless ?? false
  }

  /** List live tabs for one workspace. Empty when the headed window has closed the Context. */
  list(workspaceId: WorkspaceId): BrowserListResult {
    const workspace = this.workspaces.get(workspaceId)
    if (workspace === undefined) return { tabs: [] }
    return {
      tabs: [...workspace.tabs.values()].map(tab => ({
        tabId: tab.tabId,
        url: tab.url,
        title: tab.title,
        selected: tab.tabId === workspace.selectedTabId,
        canGoBack: tab.canGoBack,
        canGoForward: tab.canGoForward,
      })),
    }
  }

  /**
   * Open one tab in the workspace browser pool.
   * Relaunches the persistent Context when the previous headed window was closed.
   * @param workspaceId - owning workspace.
   * @param url - initial document URL; defaults to `about:blank`.
   */
  async createTab(workspaceId: WorkspaceId, url = 'about:blank'): Promise<BrowserCreateTabResult> {
    if (this.delivery === 'desktop') {
      const workspace = await this.ensureWorkspace(workspaceId)
      const surface = this.desktopSurface ?? requireDesktopBrowserSurface()
      const tabId = randomUUID()
      // ensureTab already loadURL; a second Playwright goto doubled wait and
      // raced the 30s unary deadline while the guest document was on screen.
      await surface.ensureTab(workspaceId, tabId, url)
      const page = await surface.pageForTab(workspaceId, tabId)
      const tab = this.trackTab(workspace, tabId, page)
      tab.lastRequestedUrl = url
      workspace.selectedTabId = tabId
      await this.syncTabMetadata(tab)
      await this.recoverNetErrorDocument(workspaceId, tab)
      await this.revealTab(workspaceId, tab)
      if (url !== 'about:blank') this.notifyHumanToolboxReveal(workspaceId, tab)
      return { tabId }
    }

    let workspace = await this.ensureWorkspace(workspaceId)
    let page: Page
    try {
      page = await this.requireContext(workspace).newPage()
    } catch (error: unknown) {
      if (!isTargetClosedError(error)) throw error
      this.forgetWorkspace(workspaceId, workspace)
      workspace = await this.launchWorkspace(workspaceId, workspace.devicePixelRatio)
      page = await this.requireContext(workspace).newPage()
    }
    const tabId = randomUUID()
    if (url !== 'about:blank') {
      await page.goto(url, { waitUntil: 'domcontentloaded' })
    }
    const tab = this.trackTab(workspace, tabId, page)
    tab.lastRequestedUrl = url
    workspace.selectedTabId = tabId
    await this.syncTabMetadata(tab)
    await this.recoverNetErrorDocument(workspaceId, tab)
    await this.revealTab(workspaceId, tab)
    if (url !== 'about:blank') this.notifyHumanToolboxReveal(workspaceId, tab)
    return { tabId }
  }

  /**
   * Close one tab and select another when the closed tab was selected.
   * Succeeds when the tab or Context is already gone.
   */
  async closeTab(workspaceId: WorkspaceId, tabId: string): Promise<{ closed: true }> {
    const workspace = this.workspaces.get(workspaceId)
    if (workspace === undefined) return { closed: true }
    const tab = workspace.tabs.get(tabId)
    if (tab === undefined) return { closed: true }
    workspace.tabs.delete(tabId)
    if (this.delivery === 'desktop') {
      const surface = this.desktopSurface ?? requireDesktopBrowserSurface()
      await surface.closeTab(workspaceId, tabId)
    }
    if (tab.cdp !== undefined) {
      try {
        await tab.cdp.detach()
      } catch {
        // session already closed with a crashed or closing page
      }
    }
    try {
      await tab.page.close()
    } catch (error: unknown) {
      if (!isTargetClosedError(error)) throw error
    }
    if (workspace.selectedTabId === tabId) {
      const remaining = [...workspace.tabs.keys()]
      workspace.selectedTabId = remaining[0]
    }
    return { closed: true }
  }

  /** Mark one tab selected within its workspace pool and raise its window. */
  async selectTab(workspaceId: WorkspaceId, tabId: string): Promise<{ selected: true }> {
    const workspace = this.requireWorkspace(workspaceId)
    const tab = this.requireTab(workspace, tabId)
    workspace.selectedTabId = tabId
    await this.revealTab(workspaceId, tab)
    return { selected: true }
  }

  /**
   * Raise one tab for human viewing and mark it selected.
   * Web delivery brings the headed Chromium window forward; desktop attaches the BrowserView.
   */
  async showWindow(workspaceId: WorkspaceId, tabId: string): Promise<{ shown: true }> {
    const workspace = this.requireWorkspace(workspaceId)
    const tab = this.requireTab(workspace, tabId)
    workspace.selectedTabId = tabId
    await this.revealTab(workspaceId, tab)
    return { shown: true }
  }

  /** Navigate one tab to a reachable http(s) URL. */
  async navigate(workspaceId: WorkspaceId, tabId: string, url: string): Promise<BrowserPageMetadata> {
    const tab = this.requireTab(this.requireWorkspace(workspaceId), tabId)
    tab.lastRequestedUrl = url
    if (this.delivery === 'desktop') {
      const surface = this.desktopSurface ?? requireDesktopBrowserSurface()
      await surface.ensureTab(workspaceId, tab.tabId, url)
      tab.page = await surface.pageForTab(workspaceId, tab.tabId)
    } else {
      await tab.page.goto(url, { waitUntil: 'domcontentloaded' })
    }
    await this.revealTab(workspaceId, tab)
    await this.syncTabMetadata(tab)
    this.notifyHumanToolboxReveal(workspaceId, tab)
    return this.pageMetadata(workspaceId, tab)
  }

  /** Navigate back when history allows. */
  async goBack(workspaceId: WorkspaceId, tabId: string): Promise<BrowserPageMetadata> {
    const tab = this.requireTab(this.requireWorkspace(workspaceId), tabId)
    await tab.page.goBack({ waitUntil: 'domcontentloaded' })
    await this.revealTab(workspaceId, tab)
    return this.pageMetadata(workspaceId, tab)
  }

  /** Navigate forward when history allows. */
  async goForward(workspaceId: WorkspaceId, tabId: string): Promise<BrowserPageMetadata> {
    const tab = this.requireTab(this.requireWorkspace(workspaceId), tabId)
    await tab.page.goForward({ waitUntil: 'domcontentloaded' })
    await this.revealTab(workspaceId, tab)
    return this.pageMetadata(workspaceId, tab)
  }

  /**
   * Reload the current document.
   * @param hard - when true, bypass cache via CDP.
   */
  async reload(workspaceId: WorkspaceId, tabId: string, hard = false): Promise<BrowserPageMetadata> {
    await this.awaitWorkspaceReady(workspaceId)
    const tab = this.requireTab(this.requireWorkspace(workspaceId), tabId)
    if (hard) {
      const cdp = await this.pageCdp(tab)
      await cdp.send('Page.reload', { ignoreCache: true })
      await tab.page.waitForLoadState('domcontentloaded')
    } else {
      await tab.page.reload({ waitUntil: 'domcontentloaded' })
    }
    await this.revealTab(workspaceId, tab)
    return this.pageMetadata(workspaceId, tab)
  }

  /** Return the accessibility tree for one tab. */
  async snapshot(workspaceId: WorkspaceId, tabId: string): Promise<BrowserSnapshotResult> {
    const tab = this.requireTab(this.requireWorkspace(workspaceId), tabId)
    const tree = await tab.page.locator('body').ariaSnapshot()
    return { tree }
  }

  /** Click by coordinates on one tab. */
  async click(workspaceId: WorkspaceId, tabId: string, x: number, y: number): Promise<{ clicked: true }> {
    const tab = this.requireTab(this.requireWorkspace(workspaceId), tabId)
    await tab.page.mouse.click(x, y)
    await this.revealTab(workspaceId, tab)
    await this.syncTabMetadata(tab)
    return { clicked: true }
  }

  /** Type UTF-8 text into the focused element. */
  async type(workspaceId: WorkspaceId, tabId: string, text: string): Promise<{ typed: true }> {
    const tab = this.requireTab(this.requireWorkspace(workspaceId), tabId)
    await tab.page.keyboard.type(text)
    await this.revealTab(workspaceId, tab)
    return { typed: true }
  }

  /** Scroll one tab by pixel deltas at optional viewport coordinates. */
  async scroll(
    workspaceId: WorkspaceId,
    tabId: string,
    deltaX: number,
    deltaY: number,
    x?: number,
    y?: number,
  ): Promise<{ scrolled: true }> {
    await this.awaitWorkspaceReady(workspaceId)
    const tab = this.requireTab(this.requireWorkspace(workspaceId), tabId)
    const wheelX = x ?? Math.floor(tab.viewportWidth / 2)
    const wheelY = y ?? Math.floor(tab.viewportHeight / 2)
    await tab.page.evaluate(
      asPageFunction<{ px: number; py: number; dx: number; dy: number }, void>(APPLY_SCROLL_AT_POINT),
      { px: wheelX, py: wheelY, dx: deltaX, dy: deltaY },
    )
    return { scrolled: true }
  }

  /** Select option values on a `<select>` element. */
  async selectOption(
    workspaceId: WorkspaceId,
    tabId: string,
    selector: string,
    values: string[],
  ): Promise<{ selected: true }> {
    const tab = this.requireTab(this.requireWorkspace(workspaceId), tabId)
    await tab.page.selectOption(selector, values)
    await this.revealTab(workspaceId, tab)
    return { selected: true }
  }

  /** Resize the Playwright viewport for one tab. */
  async resizeViewport(
    workspaceId: WorkspaceId,
    tabId: string,
    width: number,
    height: number,
    devicePixelRatio = BROWSER_DEVICE_PIXEL_RATIO_MIN,
  ): Promise<{ resized: true }> {
    const scale = clampBrowserDevicePixelRatio(devicePixelRatio)
    let workspace = this.workspaces.get(workspaceId)
    if (workspace === undefined) throw new BrowserTabNotFoundError('workspace-browser-not-initialized')
    if (workspace.devicePixelRatio !== scale) {
      workspace = await this.recreateWorkspaceWithDevicePixelRatio(workspaceId, scale)
    }
    const tab = this.requireTab(workspace, tabId)
    await this.applyViewportMetrics(tab, width, height, scale)
    return { resized: true }
  }

  /**
   * Forward one pointer event through Playwright `page.mouse` (same path as Agent `click`).
   * CSS cursor is read only on `mouseMoved` so press/release is not blocked by `page.evaluate`.
   */
  async sendPointer(
    workspaceId: WorkspaceId,
    tabId: string,
    event: {
      type: 'mousePressed' | 'mouseReleased' | 'mouseMoved'
      x: number
      y: number
      button?: 'left' | 'right' | 'middle'
    },
  ): Promise<{ sent: true; cursor?: string }> {
    const tab = this.requireTab(this.requireWorkspace(workspaceId), tabId)
    const button = event.button ?? 'left'
    await tab.page.mouse.move(event.x, event.y)
    if (event.type === 'mousePressed') await tab.page.mouse.down({ button })
    else if (event.type === 'mouseReleased') {
      await tab.page.mouse.up({ button })
      try {
        await tab.page.evaluate(
          asPageFunction<{ px: number; py: number }, boolean>(FOCUS_EDITABLE_AT_POINT),
          { px: event.x, py: event.y },
        )
        const focused = tab.page.locator(':focus')
        if (await focused.count() > 0) await focused.focus()
      } catch {
        // page closed or navigated while focusing the control under the click
      }
      await this.syncTabMetadata(tab)
    }
    const cursor = event.type === 'mouseMoved'
      ? await this.readCssCursor(tab.page, event.x, event.y)
      : undefined
    return cursor === undefined ? { sent: true } : { sent: true, cursor }
  }

  /** Forward one keyboard event through Playwright `page.keyboard`. */
  async sendKeyboard(
    workspaceId: WorkspaceId,
    tabId: string,
    event: { type: 'keyDown' | 'keyUp' | 'char'; key?: string; text?: string },
  ): Promise<{ sent: true }> {
    const tab = this.requireTab(this.requireWorkspace(workspaceId), tabId)
    if (event.type === 'char' && event.text !== undefined && event.text !== '') {
      await tab.page.keyboard.insertText(event.text)
      try {
        await tab.page.evaluate(
          asPageFunction<{ text: string }, void>(DISPATCH_FOCUSED_INPUT),
          { text: event.text },
        )
      } catch {
        // page closed or navigated while dispatching the input event
      }
      await this.syncTabMetadata(tab)
      return { sent: true }
    }
    if (event.key !== undefined && event.key !== '') {
      if (event.type === 'keyDown') await tab.page.keyboard.down(event.key)
      else if (event.type === 'keyUp') await tab.page.keyboard.up(event.key)
    }
    return { sent: true }
  }

  /**
   * Stream JPEG screencast frames for one tab until `signal` aborts.
   * Disconnecting the stream does not close the BrowserContext.
   */
  async *watchScreencast(
    workspaceId: WorkspaceId,
    tabId: string,
    signal: AbortSignal,
  ): AsyncGenerator<BrowserScreencastFrame> {
    await this.awaitWorkspaceReady(workspaceId)
    this.requireTab(this.requireWorkspace(workspaceId), tabId)
    let lastJpeg: Buffer | undefined
    while (!signal.aborted) {
      await this.awaitWorkspaceReady(workspaceId)
      const tab = this.requireTab(this.requireWorkspace(workspaceId), tabId)
      const viewport = { width: tab.viewportWidth, height: tab.viewportHeight }
      let buffer: Buffer
      try {
        buffer = await this.captureScreencastJpeg(tab.page)
      } catch (error: unknown) {
        await this.awaitWorkspaceReady(workspaceId)
        const current = this.workspaces.get(workspaceId)?.tabs.get(tabId)
        if (current === undefined || current.page === tab.page) throw error
        continue
      }
      if (lastJpeg === undefined || !buffer.equals(lastJpeg)) {
        lastJpeg = buffer
        yield {
          type: 'host/browser-screencast',
          data: buffer.toString('base64'),
          width: viewport.width,
          height: viewport.height,
        }
      }
      await new Promise(resolve => setTimeout(resolve, 200))
    }
  }

  private async captureScreencastJpeg(page: Page): Promise<Buffer> {
    return page.screenshot({ type: 'jpeg', quality: 80, scale: 'device' })
  }

  private trackTab(workspace: WorkspaceBrowser, tabId: string, page: Page): LiveTab {
    const viewport = page.viewportSize() ?? { width: 1280, height: 720 }
    const initialUrl = page.url()
    const tab: LiveTab = {
      tabId,
      page,
      url: isChromiumInternalErrorUrl(initialUrl) ? 'about:blank' : initialUrl,
      title: '',
      canGoBack: false,
      canGoForward: false,
      viewportWidth: viewport.width,
      viewportHeight: viewport.height,
      devicePixelRatio: workspace.devicePixelRatio,
    }
    workspace.tabs.set(tabId, tab)
    page.on('framenavigated', () => { void this.syncTabMetadata(tab) })
    page.on('close', () => {
      if (workspace.tabs.get(tabId) !== tab) return
      workspace.tabs.delete(tabId)
      if (workspace.selectedTabId === tabId) {
        workspace.selectedTabId = [...workspace.tabs.keys()][0]
      }
    })
    return tab
  }

  /**
   * Raise the tab for human viewing when the page is still open.
   * Web delivery brings the headed Chromium window forward.
   * Desktop delivery attaches the BrowserView and applies occupant bounds via {@link DesktopBrowserSurface.selectTab}.
   * Headless skips both.
   */
  private async revealTab(workspaceId: WorkspaceId, tab: LiveTab): Promise<void> {
    if (this.headless) return
    if (this.delivery === 'desktop') {
      const surface = this.desktopSurface ?? requireDesktopBrowserSurface()
      await surface.selectTab(workspaceId, tab.tabId)
      return
    }
    try {
      await tab.page.bringToFront()
    } catch (error: unknown) {
      if (isTargetClosedError(error)) throw new BrowserTabNotFoundError(tab.tabId)
    }
  }

  /** Ask the desktop Renderer to open the toolbox browser segment on one tab. */
  private notifyHumanToolboxReveal(workspaceId: WorkspaceId, tab: LiveTab): void {
    if (this.delivery !== 'desktop' || this.headless) return
    const surface = this.desktopSurface ?? getDesktopBrowserSurface()
    const request = {
      workspaceId,
      tabId: tab.tabId,
      url: tab.url,
    }
    if (surface?.revealForHuman !== undefined) surface.revealForHuman(request)
    else notifyDesktopBrowserHumanReveal(request)
  }

  private async pageMetadata(workspaceId: WorkspaceId, tab: LiveTab): Promise<BrowserPageMetadata> {
    await this.syncTabMetadata(tab)
    await this.recoverNetErrorDocument(workspaceId, tab)
    return {
      url: tab.url,
      title: tab.title,
      canGoBack: tab.canGoBack,
      canGoForward: tab.canGoForward,
    }
  }

  /**
   * Desktop delivery lands on `chrome-error://` when a URL is unreachable; reset
   * to `about:blank` so tab creation and the occupant stay usable. Web delivery
   * still surfaces {@link BrowserNavigationFailedError} to the Client.
   */
  private async recoverNetErrorDocument(workspaceId: WorkspaceId, tab: LiveTab): Promise<void> {
    if (this.delivery !== 'desktop') {
      if (isChromiumInternalErrorUrl(tab.page.url())) {
        throw new BrowserNavigationFailedError(tab.lastRequestedUrl ?? tab.url)
      }
      return
    }
    if (!isChromiumInternalErrorUrl(tab.page.url())) return
    const surface = this.desktopSurface ?? requireDesktopBrowserSurface()
    tab.page = await surface.pageForTab(workspaceId, tab.tabId)
    tab.url = 'about:blank'
    await this.syncTabMetadata(tab)
  }

  private async syncTabMetadata(tab: LiveTab): Promise<void> {
    const liveUrl = tab.page.url()
    if (!isChromiumInternalErrorUrl(liveUrl)) {
      tab.url = liveUrl
      tab.title = await tab.page.title()
    }
    const navigation = await this.readNavigationState(tab.page)
    tab.canGoBack = navigation.canGoBack
    tab.canGoForward = navigation.canGoForward
  }

  /** Reuse one CDP session per tab for pointer, wheel, and keyboard dispatch. */
  private async pageCdp(tab: LiveTab): Promise<CDPSession> {
    tab.cdp ??= await tab.page.context().newCDPSession(tab.page)
    return tab.cdp
  }

  /** Read the computed CSS cursor at viewport coordinates for the screencast overlay. */
  private async readCssCursor(page: Page, x: number, y: number): Promise<string | undefined> {
    try {
      return await page.evaluate(
        asPageFunction<{ px: number; py: number }, string>(READ_CSS_CURSOR_AT_POINT),
        { px: x, py: y },
      )
    } catch {
      // page closed or navigated while reading computed cursor; overlay keeps last cursor
      return undefined
    }
  }

  private async readNavigationState(page: Page): Promise<{ canGoBack: boolean; canGoForward: boolean }> {
    try {
      const cdp = await page.context().newCDPSession(page)
      const history = await cdp.send('Page.getNavigationHistory') as {
        currentIndex: number
        entries: readonly unknown[]
      }
      return {
        canGoBack: history.currentIndex > 0,
        canGoForward: history.currentIndex < history.entries.length - 1,
      }
    } catch {
      return { canGoBack: false, canGoForward: false }
    }
  }

  private requireWorkspace(workspaceId: WorkspaceId): WorkspaceBrowser {
    const workspace = this.workspaces.get(workspaceId)
    if (workspace === undefined) {
      throw new BrowserTabNotFoundError('workspace-browser-not-initialized')
    }
    return workspace
  }

  private requireTab(workspace: WorkspaceBrowser, tabId: string): LiveTab {
    const tab = workspace.tabs.get(tabId)
    if (tab === undefined) throw new BrowserTabNotFoundError(tabId)
    return tab
  }

  private async applyViewportMetrics(
    tab: LiveTab,
    width: number,
    height: number,
    devicePixelRatio: number,
  ): Promise<void> {
    const scale = clampBrowserDevicePixelRatio(devicePixelRatio)
    tab.viewportWidth = width
    tab.viewportHeight = height
    tab.devicePixelRatio = scale
    await tab.page.setViewportSize({ width, height })
  }

  private async awaitWorkspaceReady(workspaceId: WorkspaceId): Promise<void> {
    const pending = this.recreating.get(workspaceId)
    if (pending !== undefined) await pending
  }

  private async recreateWorkspaceWithDevicePixelRatio(
    workspaceId: WorkspaceId,
    devicePixelRatio: number,
  ): Promise<WorkspaceBrowser> {
    const inflight = this.recreating.get(workspaceId)
    if (inflight !== undefined) return inflight
    const run = this.rebuildWorkspaceWithDevicePixelRatio(workspaceId, devicePixelRatio)
    this.recreating.set(workspaceId, run)
    try {
      return await run
    } finally {
      this.recreating.delete(workspaceId)
    }
  }

  private async rebuildWorkspaceWithDevicePixelRatio(
    workspaceId: WorkspaceId,
    devicePixelRatio: number,
  ): Promise<WorkspaceBrowser> {
    const existing = this.requireWorkspace(workspaceId)
    const snapshots: TabSnapshot[] = [...existing.tabs.values()].map(tab => ({
      tabId: tab.tabId,
      url: tab.url,
      selected: tab.tabId === existing.selectedTabId,
      viewportWidth: tab.viewportWidth,
      viewportHeight: tab.viewportHeight,
    }))
    await existing.context?.close()
    this.workspaces.delete(workspaceId)
    const workspace = await this.launchWorkspace(workspaceId, devicePixelRatio)
    for (const snapshot of snapshots) {
      const page = await this.requireContext(workspace).newPage()
      if (snapshot.url !== '' && snapshot.url !== 'about:blank') {
        await page.goto(snapshot.url, { waitUntil: 'domcontentloaded' })
      }
      const tab = this.trackTab(workspace, snapshot.tabId, page)
      tab.viewportWidth = snapshot.viewportWidth
      tab.viewportHeight = snapshot.viewportHeight
      await this.syncTabMetadata(tab)
    }
    workspace.selectedTabId = snapshots.find(item => item.selected)?.tabId ?? snapshots[0]?.tabId
    const selected = workspace.selectedTabId === undefined
      ? undefined
      : workspace.tabs.get(workspace.selectedTabId)
    if (selected !== undefined) await this.revealTab(workspaceId, selected)
    return workspace
  }

  private async launchWorkspace(
    workspaceId: WorkspaceId,
    devicePixelRatio: number,
  ): Promise<WorkspaceBrowser> {
    const scale = clampBrowserDevicePixelRatio(devicePixelRatio)
    if (this.delivery === 'desktop') {
      this.assertChromiumAvailable()
      const surface = this.desktopSurface ?? requireDesktopBrowserSurface()
      if (this.desktopBrowser === undefined) {
        try {
          this.desktopBrowser = await this.connectOverCDP(surface.cdpEndpoint())
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : String(error)
          throw new BrowserUnavailableError(`failed to connect over CDP: ${message}`, 'context-start-failed')
        }
      }
      const workspace: WorkspaceBrowser = {
        tabs: new Map(),
        selectedTabId: undefined,
        devicePixelRatio: scale,
      }
      this.workspaces.set(workspaceId, workspace)
      return workspace
    }

    this.assertChromiumAvailable()
    const profileDir = join(this.profilesRoot, workspaceId)
    mkdirSync(profileDir, { recursive: true })
    let context: BrowserContext
    try {
      context = await this.launchPersistentContext(profileDir, {
        headless: this.headless,
        ...(this.headless
          ? { viewport: { width: 1280, height: 720 }, deviceScaleFactor: scale }
          : { viewport: null }),
        args: ['--disable-dev-shm-usage'],
      })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      throw new BrowserUnavailableError(`failed to start browser context: ${message}`, 'context-start-failed')
    }
    const workspace: WorkspaceBrowser = {
      context,
      tabs: new Map(),
      selectedTabId: undefined,
      devicePixelRatio: scale,
    }
    this.workspaces.set(workspaceId, workspace)
    context.on('close', () => {
      this.forgetWorkspace(workspaceId, workspace)
    })
    return workspace
  }

  private requireContext(workspace: WorkspaceBrowser): BrowserContext {
    const context = workspace.context
    if (context === undefined) {
      throw new BrowserTabNotFoundError('workspace-browser-not-initialized')
    }
    return context
  }

  /** Drop a workspace pool only when it is still the mapped instance. */
  private forgetWorkspace(workspaceId: WorkspaceId, workspace: WorkspaceBrowser): void {
    if (this.workspaces.get(workspaceId) === workspace) this.workspaces.delete(workspaceId)
  }

  private async ensureWorkspace(workspaceId: WorkspaceId): Promise<WorkspaceBrowser> {
    const existing = this.workspaces.get(workspaceId)
    if (existing !== undefined) return existing
    return this.launchWorkspace(workspaceId, BROWSER_DEVICE_PIXEL_RATIO_MIN)
  }

  private assertChromiumAvailable(): void {
    try {
      this.chromiumExecutablePath()
    } catch {
      throw new BrowserUnavailableError(
        'Chromium is not installed; run `npx playwright install chromium`',
        'chromium-missing',
      )
    }
  }
}
