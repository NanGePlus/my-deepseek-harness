/**
 * File editor plugin, browser half. Registers the editor-surface occupant into
 * the details column child slot declared by ui-conversation.
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import { EditorSurface, type FileEditorInjected } from './EditorSurface.tsx'
import { en, zh, type FileEditorKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** File editor surface copy (empty state, dialogs, tree chrome). */
    fileEditor: FileEditorKey
  }
}

/** Dictionary namespace owned by this plugin. */
const NS = 'fileEditor'

/** Required services for slot injection, Workspace Host RPC, and locale registration. */
export const inject = ['slots', 'workspaces', 'locale']

/**
 * Register the editor-surface occupant once the details child slot is declared.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-file-editor: dictionaries')

  const injected = (): FileEditorInjected => ({
    listWorkspaceEntries: (workspaceId, path, signal) =>
      ctx.workspaces.listWorkspaceEntries(workspaceId, path, signal),
    gitStatus: (workspaceId, signal) => ctx.workspaces.gitStatus(workspaceId, signal),
  })

  ctx.slots.inject('conversation.details.editor', () => ctx.slots.register({
    name: 'conversation.details.editor',
    locale: NS,
    inject: injected,
  }, EditorSurface))
}
