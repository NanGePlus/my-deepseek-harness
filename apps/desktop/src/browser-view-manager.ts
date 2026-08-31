/**
 * Electron Main BrowserView pool + Playwright CDP surface for desktop delivery.
 * @module @deepseek-ai/dsh-desktop-shell/browser-view-manager
 */

import { BrowserView, type BrowserWindow } from 'electron'
import { chromium, type Browser, type Page } from 'playwright'
import type { WorkspaceId } from '@deepseek-ai/dsh-host-apiproxy/api/workspace'
import type { DesktopBrowserSurface } from '@deepseek-ai/dsh-host-apiproxy'
import {
  applyBrowserOccupantBounds,
  type BrowserOccupantBounds,
  type BrowserViewAttachmentState,
} from './browser-view-bounds.ts'

interface TabRecord {
  view: BrowserView
  attachment: BrowserViewAttachmentState
}

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
   */
  constructor(
    private readonly getMainWindow: () => BrowserWindow | undefined,
    private readonly cdpPort: number,
  ) {}

  /** @inheritdoc */
  cdpEndpoint(): string {
    return `http://127.0.0.1:${this.cdpPort}`
  }

  /** @inheritdoc */
  async ensureTab(workspaceId: WorkspaceId, tabId: string, url: string): Promise<void> {
    const key = tabKey(workspaceId, tabId)
    let record = this.tabs.get(key)
    if (record === undefined) {
      const view = new BrowserView({
        webPreferences: {
          sandbox: true,
          contextIsolation: true,
          nodeIntegration: false,
        },
      })
      record = { view, attachment: { attached: false } }
      this.tabs.set(key, record)
    }
    this.pages.delete(key)
    if (url !== 'about:blank') {
      await record.view.webContents.loadURL(url)
    }
  }

  /** @inheritdoc */
  async pageForTab(workspaceId: WorkspaceId, tabId: string): Promise<Page> {
    const key = tabKey(workspaceId, tabId)
    const cached = this.pages.get(key)
    if (cached !== undefined) return cached
    const record = this.tabs.get(key)
    if (record === undefined) throw new Error(`desktop browser tab not found: ${key}`)
    const browser = await this.ensureCdpBrowser()
    const targetUrl = record.view.webContents.getURL()
    const page = await this.resolvePage(browser, targetUrl)
    this.pages.set(key, page)
    return page
  }

  /** @inheritdoc */
  async selectTab(workspaceId: WorkspaceId, tabId: string): Promise<void> {
    this.selectedKey = tabKey(workspaceId, tabId)
    this.syncOccupantBounds()
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
      if (record.attachment.attached && window !== undefined) {
        window.removeBrowserView(record.view)
        record.attachment.attached = false
      }
      record.view.webContents.close()
    }
    this.tabs.clear()
    this.pages.clear()
    void this.cdpBrowser?.close()
    this.cdpBrowser = undefined
  }

  private syncOccupantBounds(): void {
    const window = this.getMainWindow()
    if (window === undefined || this.occupantBounds === undefined) return
    for (const [key, record] of this.tabs) {
      const host = window
      if (key === this.selectedKey) {
        applyBrowserOccupantBounds(host, record.view, record.attachment, this.occupantBounds)
      } else if (record.attachment.attached) {
        window.removeBrowserView(record.view)
        record.attachment.attached = false
      }
    }
  }

  private async ensureCdpBrowser(): Promise<Browser> {
    if (this.cdpBrowser !== undefined) return this.cdpBrowser
    this.cdpBrowser = await chromium.connectOverCDP(this.cdpEndpoint())
    return this.cdpBrowser
  }

  private async resolvePage(browser: Browser, targetUrl: string): Promise<Page> {
    for (const context of browser.contexts()) {
      for (const page of context.pages()) {
        if (page.url() === targetUrl) return page
      }
    }
    const context = browser.contexts()[0]
    if (context === undefined) throw new Error('desktop browser CDP: no default context')
    return context.waitForEvent('page', {
      predicate: page => page.url() === targetUrl,
      timeout: 10_000,
    })
  }
}

function tabKey(workspaceId: WorkspaceId, tabId: string): string {
  return `${workspaceId}:${tabId}`
}
