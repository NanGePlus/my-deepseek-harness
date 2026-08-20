/**
 * File editor plugin, browser half. Registers the editor-surface occupant into
 * the details column child slot declared by ui-conversation.
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import { EditorSurface, editorDirtyGuard, type FileEditorInjected } from './EditorSurface.tsx'
import { createFileEditorStore } from './stores.ts'
import { en, zh, type FileEditorKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** File editor surface copy (empty state, dialogs, tree chrome). */
    fileEditor: FileEditorKey
  }
}

/** Dictionary namespace owned by this plugin. */
const NS = 'fileEditor'

/** Required services for slot injection, Workspace Host RPC, locale, and session guard. */
export const inject = ['slots', 'workspaces', 'locale', 'sessions']

/**
 * Register the editor-surface occupant once the details child slot is declared.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-file-editor: dictionaries')

  const commitOpen = ctx.sessions.open.bind(ctx.sessions)
  ctx.sessions.open = (sessionId) => {
    const current = ctx.sessions.list.getSnapshot().current
    editorDirtyGuard.tryOpenSession(current, sessionId, () => { commitOpen(sessionId) })
  }

  const injected = (): FileEditorInjected & { dirtyGuard: typeof editorDirtyGuard } => ({
    listWorkspaceEntries: (workspaceId, path, signal) =>
      ctx.workspaces.listWorkspaceEntries(workspaceId, path, signal),
    gitStatus: (workspaceId, signal) => ctx.workspaces.gitStatus(workspaceId, signal),
    readFile: (workspaceId, path, kind, signal) =>
      ctx.workspaces.readFile(workspaceId, path, kind, signal),
    writeFile: (workspaceId, path, text, signal) =>
      ctx.workspaces.writeFile(workspaceId, path, text, signal),
    deletePath: (workspaceId, path, signal) =>
      ctx.workspaces.deletePath(workspaceId, path, signal),
    renamePath: (workspaceId, path, newName, signal) =>
      ctx.workspaces.renamePath(workspaceId, path, newName, signal),
    createWorkspaceDirectory: (workspaceId, path, name, signal) =>
      ctx.workspaces.createWorkspaceDirectory(workspaceId, path, name, signal),
    watchPath: (workspaceId, path, onChanged, signal) =>
      ctx.workspaces.watchPath(workspaceId, path, onChanged, signal),
    dirtyGuard: editorDirtyGuard,
  })

  ctx.slots.inject('conversation.details.editor', () => ctx.slots.register({
    name: 'conversation.details.editor',
    locale: NS,
    store: createFileEditorStore,
    inject: injected,
  }, EditorSurface))
}
