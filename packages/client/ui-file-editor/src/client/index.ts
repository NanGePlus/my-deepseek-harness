/**
 * File editor plugin, browser half. Registers the editor-surface occupant into
 * the details column child slot declared by ui-conversation.
 */
import type { ClientContext, SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import type { FileEditorOpen } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { InputTriggerServiceContract, InputTriggerSource } from '@deepseek-ai/dsh-client-ui-input-trigger/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import { insertFileContextIntoComposer } from './composer-file-context-insert.ts'
import { EditorSurface, editorDirtyGuard, type FileEditorInjected } from './EditorSurface.tsx'
import { wireDesktopExitGuard } from './desktop-shell.ts'
import {
  FILE_CONTEXT_SOURCE,
  decodeFileContextRef,
  fileContextChipLabel,
} from './file-context-ref.ts'
import { serializeFileContextReference } from './file-context-serialize.ts'
import { openPathInEditor, type OpenPathStore } from './open-path.ts'
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

/** Required services for slot injection, Workspace Host RPC, composer bridge, and locale. */
export const inject = ['slots', 'workspaces', 'locale', 'sessions', 'conversation', 'inputTriggers']

/**
 * Register the editor-surface occupant once the details child slot is declared.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-file-editor: dictionaries')
  ctx.effect(() => wireDesktopExitGuard(editorDirtyGuard), 'ui-file-editor: desktop exit guard')

  const fileEditorStore = createFileEditorStore()

  const fileEditorOpen: FileEditorOpen = {
    openPath: (workspaceId, absolutePath) => {
      const handle = ctx.slots.sessionStore(fileEditorStore, '' as SessionId)
      return openPathInEditor(
        handle as unknown as OpenPathStore,
        (wid, path, kind, signal) => ctx.workspaces.readFile(wid, path, kind, signal),
        workspaceId,
        absolutePath,
      )
    },
    openReference: async (source: string, ref: string) => {
      if (source !== FILE_CONTEXT_SOURCE) return false
      const payload = decodeFileContextRef(ref)
      const handle = ctx.slots.sessionStore(fileEditorStore, '' as SessionId)
      const ok = await openPathInEditor(
        handle as unknown as OpenPathStore,
        (wid, path, kind, readSignal) => ctx.workspaces.readFile(wid, path, kind, readSignal),
        payload.workspaceId,
        payload.path,
      )
      if (!ok) return false
      if (handle.actions !== undefined) {
        const { requestSourceSelection } = handle.actions as {
          requestSourceSelection: (
            workspaceId: typeof payload.workspaceId,
            path: string,
            startLine: number,
            endLine: number,
          ) => void
        }
        requestSourceSelection(
          payload.workspaceId,
          payload.path,
          payload.startLine,
          payload.endLine,
        )
      }
      return true
    },
  }
  ctx.provide('fileEditorOpen', fileEditorOpen)

  const fileContextSource: InputTriggerSource = {
    trigger: '/',
    name: FILE_CONTEXT_SOURCE,
    candidates: () => Promise.resolve([]),
    onPick: () => undefined,
    codec: {
      clipboardText: (ref: string) => fileContextChipLabel(decodeFileContextRef(ref)),
      serialize: (ref, signal) => serializeFileContextReference(
        (workspaceId, path, kind, readSignal) => ctx.workspaces.readFile(workspaceId, path, kind, readSignal),
        ref,
        signal,
      ),
    },
  }
  ctx.effect(() => {
    const inputTriggers = ctx.get('inputTriggers') as InputTriggerServiceContract | undefined
    if (inputTriggers === undefined) return () => {}
    return inputTriggers.registerSource(fileContextSource)
  }, 'ui-file-editor: file-context source')

  const hostInjected = (): Omit<FileEditorInjected, 'insertFileContextToComposer'> & {
    dirtyGuard: typeof editorDirtyGuard
  } => ({
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
    movePath: (workspaceId, path, destinationDirectory, signal) =>
      ctx.workspaces.movePath(workspaceId, path, destinationDirectory, signal),
    createWorkspaceDirectory: (workspaceId, path, name, signal) =>
      ctx.workspaces.createWorkspaceDirectory(workspaceId, path, name, signal),
    watchPath: (workspaceId, path, onChanged, signal) =>
      ctx.workspaces.watchPath(workspaceId, path, onChanged, signal),
    lspSyncDocument: (workspaceId, path, text, version, signal) =>
      ctx.workspaces.lspSyncDocument(workspaceId, path, text, version, signal),
    lspCloseDocument: (workspaceId, path, signal) =>
      ctx.workspaces.lspCloseDocument(workspaceId, path, signal),
    lspHoverDocument: (workspaceId, path, text, version, line, character, signal) =>
      ctx.workspaces.lspHoverDocument(workspaceId, path, text, version, line, character, signal),
    dirtyGuard: editorDirtyGuard,
  })

  ctx.slots.inject('conversation.details.editor', () => ctx.slots.register({
    name: 'conversation.details.editor',
    locale: NS,
    store: fileEditorStore,
    inject: (_actions: unknown): FileEditorInjected & { dirtyGuard: typeof editorDirtyGuard } => ({
      ...hostInjected(),
      insertFileContextToComposer: (sessionId, request) => {
        const actx = ctx.sessions.scope(sessionId)
        const conversation = actx?.get('conversation')
        if (actx === undefined || conversation === undefined) return false
        return insertFileContextIntoComposer(actx, conversation, request)
      },
    }),
  }, EditorSurface))
}
