/**
 * Human terminal plugin, browser half. Registers the Terminal-tab occupant into the
 * details column child slot declared by ui-conversation.
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import { TerminalPanel, type TerminalPanelInjected } from './TerminalPanel.tsx'
import { createTerminalPanelStore } from './stores.ts'
import { en, zh, type TerminalPanelKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Human terminal copy (empty states, loading, tab chrome). */
    terminalPanel: TerminalPanelKey
  }
}

/** Dictionary namespace owned by this plugin. */
const NS = 'terminalPanel'

/** Required services for slot injection, Workspace Host RPC, and locale. */
export const inject = ['slots', 'workspaces', 'locale']

/**
 * Register the human-terminal occupant once the details child slot is declared.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-terminal: dictionaries')

  ctx.slots.inject('conversation.details.terminal', () => ctx.slots.register({
    name: 'conversation.details.terminal',
    locale: NS,
    store: createTerminalPanelStore,
    inject: (): TerminalPanelInjected => ({
      terminalProfiles: signal => ctx.workspaces.terminalProfiles(signal),
      terminalList: (workspaceId, signal) => ctx.workspaces.terminalList(workspaceId, signal),
      terminalSpawn: (workspaceId, profileId, cwd, signal) =>
        ctx.workspaces.terminalSpawn(workspaceId, profileId, cwd, signal),
      terminalWrite: (workspaceId, sessionId, text, signal) =>
        ctx.workspaces.terminalWrite(workspaceId, sessionId, text, signal),
      terminalResize: (workspaceId, sessionId, cols, rows, signal) =>
        ctx.workspaces.terminalResize(workspaceId, sessionId, cols, rows, signal),
      terminalKill: (workspaceId, sessionId, signal) =>
        ctx.workspaces.terminalKill(workspaceId, sessionId, signal),
      terminalStream: (workspaceId, sessionId, onFrame, signal, onOpen) => {
        ctx.workspaces.terminalStream(workspaceId, sessionId, onFrame, signal, onOpen)
      },
    }),
  }, TerminalPanel))
}
