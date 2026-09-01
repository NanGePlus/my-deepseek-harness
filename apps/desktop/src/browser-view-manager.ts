/**
 * Electron Main BrowserView pool + Playwright CDP surface for desktop delivery.
 * @module @deepseek-ai/dsh-desktop-shell/browser-view-manager
 */

import { BrowserView, type BrowserWindow } from 'electron'
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright'
import type { WorkspaceId } from '@deepseek-ai/dsh-host-apiproxy/api/workspace'
import type { DesktopBrowserHumanRevealRequest, DesktopBrowserSurface } from '@deepseek-ai/dsh-host-apiproxy'
import {
  applyBrowserOccupantBounds,
  type BrowserOccupantBounds,
  type BrowserViewAttachmentState,
  type BrowserViewHost,
  type BrowserViewLike,
} from './browser-view-bounds.ts'
import {
  findCdpPageByUrl,
  isDesktopCdpBrowserLive,
  normalizeDesktopBrowserUrl,
} from './desktop-browser-cdp.ts'

interface TabRecord {
  view: BrowserView
  attachment: BrowserViewAttachmentState
  lastUrl: string
}

/** Factory for one sandbox BrowserView (injectable in tests). */
export type DesktopBrowserViewFactory = () => BrowserView

function defaultCreateBrowserView(): BrowserView {
  return new BrowserView({
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
}

/** Default BrowserView factory for {@link DesktopBrowserViewManager}. */
export const defaultDesktopBrowserViewFactory: DesktopBrowserViewFactory = defaultCreateBrowserView

/** Owns BrowserView instances and resolves Playwright pages over CDP. */
export class DesktopBrowserViewManager implements DesktopBrowserSurface {
  private readonly tabs = new Map<string, TabRecord>()
  private readonly pages = new Map<string, Page>()
  private cdpBrowser: Browser | undefined
  private selectedKey: string | undefined
  private occupantBounds: BrowserOccupantBounds | undefined

  /**
   * @param getMainWindow - returns the primary BrowserWindow hosting BrowserViews.
   * @param cdpPort - Electron remote-debugging-port for Playwright connectOverCDP.
   * @param createView - BrowserView constructor; tests inject a double.
   * @param onRevealForHuman - forwards toolbox browser reveal to the Renderer.
   */
  constructor(
    private readonly getMainWindow: () => BrowserWindow | undefined,
    private readonly cdpPort: number,
    private readonly createView: DesktopBrowserViewFactory = defaultCreateBrowserView,
    private readonly onRevealForHuman?: (request: DesktopBrowserHumanRevealRequest) => void,
  ) {}

  /** @inheritdoc */
  revealForHuman(request: DesktopBrowserHumanRevealRequest): void {
    this.onRevealForHuman?.(request)
  }

  /** @inheritdoc */
  cdpEndpoint(): string {
    return `http://127.0.0.1:${this.cdpPort}`
  }

  /** @inheritdoc */
  async ensureTab(workspaceId: WorkspaceId, tabId: string, url: string): Promise<void> {
    const key = tabKey(workspaceId, tabId)
    let record = this.tabs.get(key)
    if (record !== undefined && this.viewDestroyed(record.view)) {
      record = this.replaceDestroyedView(key, record)
    }
    if (record === undefined) {
      record = this.insertView(key, url)
    }
    record.lastUrl = url
    this.pages.delete(key)
    // Fresh BrowserView reports getURL() === '' until a load; skipping about:blank
    // left Playwright's about:blank unmatched and waitForEvent('page') timed out.
    await record.view.webContents.loadURL(normalizeDesktopBrowserUrl(url))
  }

  /** @inheritdoc */
  async pageForTab(workspaceId: WorkspaceId, tabId: string): Promise<Page> {
    const key = tabKey(workspaceId, tabId)
    const cached = this.pages.get(key)
    if (cached !== undefined) return cached
    let record = this.tabs.get(key)
    if (record === undefined) throw new Error(`desktop browser tab not found: ${key}`)
    if (this.viewDestroyed(record.view)) {
      record = this.reviveView(key, record)
    }
    const browser = await this.ensureCdpBrowser()
    const targetUrl = record.view.webContents.getURL()
    const page = await this.resolvePage(browser, targetUrl)
    this.pages.set(key, page)
    return page
  }

  /** @inheritdoc */
  async selectTab(workspaceId: WorkspaceId, tabId: string): Promise<void> {
    const key = tabKey(workspaceId, tabId)
    this.selectedKey = key
    const record = this.tabs.get(key)
    if (record !== undefined) this.reviveView(key, record)
    this.syncOccupantBounds()
  }

  /** @inheritdoc */
  async closeTab(workspaceId: WorkspaceId, tabId: string): Promise<void> {
    const key = tabKey(workspaceId, tabId)
    const record = this.tabs.get(key)
    if (record === undefined) return
    this.tabs.delete(key)
    this.pages.delete(key)
    if (this.selectedKey === key) this.selectedKey = undefined
    this.detachQuietly(record)
    if (!this.viewDestroyed(record.view)) record.view.webContents.close()
  }

  /**
   * Apply Renderer-reported occupant bounds to the selected tab BrowserView.
   * @param bounds - screen-space occupant rectangle from the toolbox browser segment.
   */
  applyOccupantBounds(bounds: BrowserOccupantBounds): void {
    this.occupantBounds = bounds
    this.syncOccupantBounds()
  }

  /** Detach every BrowserView and drop CDP handles (App quit). */
  destroy(): void {
    const window = this.getMainWindow()
    for (const record of this.tabs.values()) {
      if (record.attachment.attached && window !== undefined && !this.viewDestroyed(record.view)) {
        window.removeBrowserView(record.view)
        record.attachment.attached = false
      }
      if (!this.viewDestroyed(record.view)) record.view.webContents.close()
    }
    this.tabs.clear()
    this.pages.clear()
    void this.dropCdpBrowser()
  }

  private syncOccupantBounds(): void {
    const window = this.getMainWindow()
    const bounds = this.occupantBounds
    if (window === undefined || bounds === undefined) return
    for (const [key, record] of [...this.tabs]) {
      if (key === this.selectedKey) this.attachSelected(window, key, record, bounds)
      else this.detachQuietly(record)
    }
  }

  private attachSelected(
    window: BrowserWindow,
    key: string,
    record: TabRecord,
    bounds: BrowserOccupantBounds,
  ): void {
    const live = this.reviveView(key, record)
    this.applyOccupant(window, live, bounds)
    if (!bounds.visible || bounds.width <= 0 || bounds.height <= 0 || live.attachment.attached) return
    const retry = this.reviveView(key, live)
    this.applyOccupant(window, retry, bounds)
  }

  private applyOccupant(
    window: BrowserWindow,
    record: TabRecord,
    bounds: BrowserOccupantBounds,
  ): void {
    applyBrowserOccupantBounds(
      this.occupantHost(window, record.view),
      this.occupantLike(record.view),
      record.attachment,
      bounds,
    )
  }

  private occupantHost(window: BrowserWindow, view: BrowserView): BrowserViewHost {
    return {
      addBrowserView: () => { window.addBrowserView(view) },
      removeBrowserView: () => { window.removeBrowserView(view) },
    }
  }

  private occupantLike(view: BrowserView): BrowserViewLike {
    return {
      setBounds: (bounds) => { view.setBounds(bounds) },
      isDestroyed: () => this.viewDestroyed(view),
    }
  }

  private viewDestroyed(view: BrowserView): boolean {
    return view.webContents.isDestroyed()
  }

  private insertView(key: string, lastUrl: string): TabRecord {
    const view = this.createView()
    const record: TabRecord = { view, attachment: { attached: false }, lastUrl }
    this.tabs.set(key, record)
    this.watchDestroyed(key, view)
    return record
  }

  private replaceDestroyedView(key: string, record: TabRecord): TabRecord {
    this.detachQuietly(record)
    this.pages.delete(key)
    return this.insertView(key, record.lastUrl)
  }

  private reviveView(key: string, record: TabRecord): TabRecord {
    if (!this.viewDestroyed(record.view)) return record
    const next = this.replaceDestroyedView(key, record)
    void next.view.webContents.loadURL(normalizeDesktopBrowserUrl(next.lastUrl))
    return next
  }

  private detachQuietly(record: TabRecord): void {
    if (!record.attachment.attached) return
    const window = this.getMainWindow()
    if (window !== undefined && !this.viewDestroyed(record.view)) {
      window.removeBrowserView(record.view)
    }
    record.attachment.attached = false
  }

  private watchDestroyed(key: string, view: BrowserView): void {
    view.webContents.once('destroyed', () => {
      const current = this.tabs.get(key)
      if (current === undefined || current.view !== view) return
      const window = this.getMainWindow()
      if (current.attachment.attached && window !== undefined) {
        try {
          window.removeBrowserView(view)
        } catch {
          // parent already dropped the native child when webContents died
        }
      }
      current.attachment.attached = false
      this.pages.delete(key)
    })
  }

  private async ensureCdpBrowser(): Promise<Browser> {
    if (this.cdpBrowser !== undefined && isDesktopCdpBrowserLive(this.cdpBrowser)) {
      return this.cdpBrowser
    }
    await this.dropCdpBrowser()
    for (let attempt = 0; attempt < 2; attempt++) {
      const browser = await chromium.connectOverCDP(this.cdpEndpoint())
      if (isDesktopCdpBrowserLive(browser)) {
        this.cdpBrowser = browser
        return browser
      }
      try {
        await browser.close()
      } catch {
        // CDP socket already dropped; try one fresh connect.
      }
    }
    throw new Error('desktop browser CDP: no default context')
  }

  private async dropCdpBrowser(): Promise<void> {
    if (this.cdpBrowser === undefined) return
    try {
      await this.cdpBrowser.close()
    } catch {
      // CDP socket already dropped; discard the dead handle.
    }
    this.cdpBrowser = undefined
    this.pages.clear()
  }

  private async resolvePage(browser: Browser, targetUrl: string): Promise<Page> {
    const existing = findCdpPageByUrl(
      browser.contexts().flatMap(context => context.pages()),
      targetUrl,
    )
    if (existing !== undefined) return existing
    const context = await this.waitForDefaultContext(browser)
    return context.waitForEvent('page', {
      predicate: page => findCdpPageByUrl([page], targetUrl) !== undefined,
      timeout: 10_000,
    })
  }

  private async waitForDefaultContext(browser: Browser): Promise<BrowserContext> {
    const deadline = Date.now() + 10_000
    while (Date.now() < deadline) {
      const context = browser.contexts()[0]
      if (context !== undefined) return context
      await new Promise<void>((resolve) => { setTimeout(resolve, 50) })
    }
    throw new Error('desktop browser CDP: no default context')
  }
}

function tabKey(workspaceId: WorkspaceId, tabId: string): string {
  return `${workspaceId}:${tabId}`
}
