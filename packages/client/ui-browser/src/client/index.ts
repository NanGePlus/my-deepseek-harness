/**
 * Embedded browser plugin, browser half. Registers the Browser-tab occupant into the
 * details column child slot declared by ui-conversation.
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import { BrowserPanel, type BrowserPanelInjected } from './BrowserPanel.tsx'
import { createBrowserPanelStore } from './stores.ts'
import { en, zh, type BrowserPanelKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Embedded browser copy (empty states, loading, tab chrome). */
    browserPanel: BrowserPanelKey
  }
}

/** Dictionary namespace owned by this plugin. */
const NS = 'browserPanel'

/** Required services for slot injection, Workspace Host RPC, and locale. */
export const inject = ['slots', 'workspaces', 'locale']

/**
 * Register the embedded-browser occupant once the details child slot is declared.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-browser: dictionaries')

  ctx.slots.inject('conversation.details.browser', () => ctx.slots.register({
    name: 'conversation.details.browser',
    locale: NS,
    store: createBrowserPanelStore,
    inject: (): BrowserPanelInjected => ({
      browserList: (workspaceId, signal) => ctx.workspaces.browserList(workspaceId, signal),
      browserCreateTab: (workspaceId, url, signal) =>
        ctx.workspaces.browserCreateTab(workspaceId, url, signal),
      browserCloseTab: (workspaceId, tabId, signal) =>
        ctx.workspaces.browserCloseTab(workspaceId, tabId, signal),
      browserSelectTab: (workspaceId, tabId, signal) =>
        ctx.workspaces.browserSelectTab(workspaceId, tabId, signal),
      browserNavigate: (workspaceId, tabId, url, signal) =>
        ctx.workspaces.browserNavigate(workspaceId, tabId, url, signal),
      browserGoBack: (workspaceId, tabId, signal) =>
        ctx.workspaces.browserGoBack(workspaceId, tabId, signal),
      browserGoForward: (workspaceId, tabId, signal) =>
        ctx.workspaces.browserGoForward(workspaceId, tabId, signal),
      browserReload: (workspaceId, tabId, hard, signal) =>
        ctx.workspaces.browserReload(workspaceId, tabId, hard, signal),
      browserResizeViewport: (workspaceId, tabId, width, height, signal) =>
        ctx.workspaces.browserResizeViewport(workspaceId, tabId, width, height, signal),
      browserSendPointer: (workspaceId, tabId, event, signal) =>
        ctx.workspaces.browserSendPointer(workspaceId, tabId, event, signal),
      browserSendKeyboard: (workspaceId, tabId, event, signal) =>
        ctx.workspaces.browserSendKeyboard(workspaceId, tabId, event, signal),
      browserWatchScreencast: (workspaceId, tabId, onFrame, signal, onOpen, onError) => {
        ctx.workspaces.browserWatchScreencast(workspaceId, tabId, onFrame, signal, onOpen, onError)
      },
    }),
  }, BrowserPanel))
}
