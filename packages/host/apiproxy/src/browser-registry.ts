/**
 * Workspace-scoped Playwright browser registry for host.browser.* RPC.
 */

import { randomUUID } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { chromium, type BrowserContext, type Page } from 'playwright'
import type { WorkspaceId } from './api/workspace.ts'
import type { BrowserScreencastFrame } from './api/host.ts'

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
  chromiumExecutablePath?: () => string
}

interface LiveTab {
  tabId: string
  page: Page
  url: string
  title: string
  canGoBack: boolean
  canGoForward: boolean
}

interface WorkspaceBrowser {
  context: BrowserContext
  tabs: Map<string, LiveTab>
  selectedTabId: string | undefined
}

/** Workspace-indexed Playwright BrowserContext pool. */
export class BrowserRegistry {
  private readonly workspaces = new Map<WorkspaceId, WorkspaceBrowser>()
  private readonly profilesRoot: string
  private readonly launchPersistentContext: typeof chromium.launchPersistentContext
  private readonly chromiumExecutablePath: () => string

  /**
   * @param cwd - Host project directory; profiles live under `.sessions/browser-profiles/`.
   * @param internals - optional test hooks.
   */
  constructor(cwd: string, internals: BrowserRegistryInternals = {}) {
    this.profilesRoot = internals.profilesRoot ?? join(cwd, '.sessions', 'browser-profiles')
    this.launchPersistentContext = internals.launchPersistentContext ?? chromium.launchPersistentContext.bind(chromium)
    this.chromiumExecutablePath = internals.chromiumExecutablePath ?? (() => chromium.executablePath())
  }

  /** List live tabs for one workspace. */
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
   * @param workspaceId - owning workspace.
   * @param url - initial document URL; defaults to `about:blank`.
   */
  async createTab(workspaceId: WorkspaceId, url = 'about:blank'): Promise<BrowserCreateTabResult> {
    const workspace = await this.ensureWorkspace(workspaceId)
    const page = await workspace.context.newPage()
    const tabId = randomUUID()
    if (url !== 'about:blank') {
      await page.goto(url, { waitUntil: 'domcontentloaded' })
    }
    const tab = this.trackTab(workspace, tabId, page)
    workspace.selectedTabId = tabId
    await this.syncTabMetadata(tab)
    return { tabId }
  }

  /** Close one tab and select another when the closed tab was selected. */
  async closeTab(workspaceId: WorkspaceId, tabId: string): Promise<{ closed: true }> {
    const workspace = this.requireWorkspace(workspaceId)
    const tab = this.requireTab(workspace, tabId)
    workspace.tabs.delete(tabId)
    await tab.page.close()
    if (workspace.selectedTabId === tabId) {
      const remaining = [...workspace.tabs.keys()]
      workspace.selectedTabId = remaining[0]
    }
    return { closed: true }
  }

  /** Mark one tab selected within its workspace pool. */
  selectTab(workspaceId: WorkspaceId, tabId: string): { selected: true } {
    const workspace = this.requireWorkspace(workspaceId)
    this.requireTab(workspace, tabId)
    workspace.selectedTabId = tabId
    return { selected: true }
  }

  /** Navigate one tab to a reachable http(s) URL. */
  async navigate(workspaceId: WorkspaceId, tabId: string, url: string): Promise<BrowserPageMetadata> {
    const tab = this.requireTab(this.requireWorkspace(workspaceId), tabId)
    await tab.page.goto(url, { waitUntil: 'domcontentloaded' })
    return this.pageMetadata(tab)
  }

  /** Navigate back when history allows. */
  async goBack(workspaceId: WorkspaceId, tabId: string): Promise<BrowserPageMetadata> {
    const tab = this.requireTab(this.requireWorkspace(workspaceId), tabId)
    await tab.page.goBack({ waitUntil: 'domcontentloaded' })
    return this.pageMetadata(tab)
  }

  /** Navigate forward when history allows. */
  async goForward(workspaceId: WorkspaceId, tabId: string): Promise<BrowserPageMetadata> {
    const tab = this.requireTab(this.requireWorkspace(workspaceId), tabId)
    await tab.page.goForward({ waitUntil: 'domcontentloaded' })
    return this.pageMetadata(tab)
  }

  /**
   * Reload the current document.
   * @param hard - when true, bypass cache via CDP.
   */
  async reload(workspaceId: WorkspaceId, tabId: string, hard = false): Promise<BrowserPageMetadata> {
    const tab = this.requireTab(this.requireWorkspace(workspaceId), tabId)
    if (hard) {
      const cdp = await tab.page.context().newCDPSession(tab.page)
      await cdp.send('Page.reload', { ignoreCache: true })
      await tab.page.waitForLoadState('domcontentloaded')
    } else {
      await tab.page.reload({ waitUntil: 'domcontentloaded' })
    }
    return this.pageMetadata(tab)
  }

  /** Return the accessibility tree for one tab. */
  async snapshot(workspaceId: WorkspaceId, tabId: string): Promise<BrowserSnapshotResult> {
    const tab = this.requireTab(this.requireWorkspace(workspaceId), tabId)
    const tree = await tab.page.locator('body').ariaSnapshot()
    return { tree }
  }

  /** Click by coordinates on the screencast canvas. */
  async click(workspaceId: WorkspaceId, tabId: string, x: number, y: number): Promise<{ clicked: true }> {
    const tab = this.requireTab(this.requireWorkspace(workspaceId), tabId)
    await tab.page.mouse.click(x, y)
    await this.syncTabMetadata(tab)
    return { clicked: true }
  }

  /** Type UTF-8 text into the focused element. */
  async type(workspaceId: WorkspaceId, tabId: string, text: string): Promise<{ typed: true }> {
    const tab = this.requireTab(this.requireWorkspace(workspaceId), tabId)
    await tab.page.keyboard.type(text)
    return { typed: true }
  }

  /** Scroll the page by pixel deltas. */
  async scroll(workspaceId: WorkspaceId, tabId: string, deltaX: number, deltaY: number): Promise<{ scrolled: true }> {
    const tab = this.requireTab(this.requireWorkspace(workspaceId), tabId)
    await tab.page.mouse.wheel(deltaX, deltaY)
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
    return { selected: true }
  }

  /** Resize the Playwright viewport for one tab. */
  async resizeViewport(
    workspaceId: WorkspaceId,
    tabId: string,
    width: number,
    height: number,
  ): Promise<{ resized: true }> {
    const tab = this.requireTab(this.requireWorkspace(workspaceId), tabId)
    await tab.page.setViewportSize({ width, height })
    return { resized: true }
  }

  /** Forward one pointer event through CDP Input.dispatchMouseEvent. */
  async sendPointer(
    workspaceId: WorkspaceId,
    tabId: string,
    event: {
      type: 'mousePressed' | 'mouseReleased' | 'mouseMoved'
      x: number
      y: number
      button?: 'left' | 'right' | 'middle'
    },
  ): Promise<{ sent: true }> {
    const tab = this.requireTab(this.requireWorkspace(workspaceId), tabId)
    const cdp = await tab.page.context().newCDPSession(tab.page)
    await cdp.send('Input.dispatchMouseEvent', {
      type: event.type,
      x: event.x,
      y: event.y,
      button: event.button ?? 'left',
      clickCount: event.type === 'mousePressed' ? 1 : 0,
    })
    if (event.type === 'mouseReleased') await this.syncTabMetadata(tab)
    return { sent: true }
  }

  /** Forward one keyboard event through CDP Input.dispatchKeyEvent. */
  async sendKeyboard(
    workspaceId: WorkspaceId,
    tabId: string,
    event: { type: 'keyDown' | 'keyUp' | 'char'; key?: string; text?: string },
  ): Promise<{ sent: true }> {
    const tab = this.requireTab(this.requireWorkspace(workspaceId), tabId)
    const cdp = await tab.page.context().newCDPSession(tab.page)
    await cdp.send('Input.dispatchKeyEvent', {
      type: event.type,
      ...(event.key === undefined ? {} : { key: event.key }),
      ...(event.text === undefined ? {} : { text: event.text }),
    })
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
    const tab = this.requireTab(this.requireWorkspace(workspaceId), tabId)
    while (!signal.aborted) {
      const viewport = tab.page.viewportSize() ?? { width: 1280, height: 720 }
      const buffer = await tab.page.screenshot({ type: 'jpeg', quality: 80 })
      yield {
        type: 'host/browser-screencast',
        data: buffer.toString('base64'),
        width: viewport.width,
        height: viewport.height,
      }
      await new Promise(resolve => setTimeout(resolve, 200))
    }
  }

  private trackTab(workspace: WorkspaceBrowser, tabId: string, page: Page): LiveTab {
    const tab: LiveTab = {
      tabId,
      page,
      url: page.url(),
      title: '',
      canGoBack: false,
      canGoForward: false,
    }
    workspace.tabs.set(tabId, tab)
    page.on('framenavigated', () => { void this.syncTabMetadata(tab) })
    return tab
  }

  private async pageMetadata(tab: LiveTab): Promise<BrowserPageMetadata> {
    await this.syncTabMetadata(tab)
    return {
      url: tab.url,
      title: tab.title,
      canGoBack: tab.canGoBack,
      canGoForward: tab.canGoForward,
    }
  }

  private async syncTabMetadata(tab: LiveTab): Promise<void> {
    tab.url = tab.page.url()
    tab.title = await tab.page.title()
    const navigation = await this.readNavigationState(tab.page)
    tab.canGoBack = navigation.canGoBack
    tab.canGoForward = navigation.canGoForward
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

  private async ensureWorkspace(workspaceId: WorkspaceId): Promise<WorkspaceBrowser> {
    const existing = this.workspaces.get(workspaceId)
    if (existing !== undefined) return existing
    this.assertChromiumAvailable()
    const profileDir = join(this.profilesRoot, workspaceId)
    mkdirSync(profileDir, { recursive: true })
    let context: BrowserContext
    try {
      context = await this.launchPersistentContext(profileDir, {
        headless: true,
        viewport: { width: 1280, height: 720 },
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
    }
    this.workspaces.set(workspaceId, workspace)
    return workspace
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
