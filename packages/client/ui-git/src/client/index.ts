/**
 * Git panel plugin, browser half. Registers the Git-panel occupant into the
 * details column child slot declared by ui-conversation.
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import { GitPanel, type GitPanelInjected } from './GitPanel.tsx'
import { en, zh, type GitPanelKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Git panel copy (empty states, lists, commit placeholder). */
    gitPanel: GitPanelKey
  }
}

/** Dictionary namespace owned by this plugin. */
const NS = 'gitPanel'

/** Required services for slot injection, Workspace Host RPC, and locale. */
export const inject = ['slots', 'workspaces', 'locale']

/**
 * Register the Git-panel occupant once the details child slot is declared.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-git: dictionaries')

  ctx.slots.inject('conversation.details.git', () => ctx.slots.register({
    name: 'conversation.details.git',
    locale: NS,
    inject: (): GitPanelInjected => ({
      gitWorkingTree: (workspaceId, signal) => ctx.workspaces.gitWorkingTree(workspaceId, signal),
      gitInit: (workspaceId, signal) => ctx.workspaces.gitInit(workspaceId, signal),
    }),
  }, GitPanel))
}
