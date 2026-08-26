/**
 * Workspace-scoped editor tabs and edit buffers. Dirty is derived
 * (`buffer !== saved`); nothing here is written to the Session log.
 */
import type { WorkspaceId } from '@deepseek-ai/dsh-client-runtime/client'
import { defineStore, type EngineStoreHandle } from '@deepseek-ai/dsh-client-runtime/client'
import { remapPathAfterRename } from './file-tree-parent.ts'

/** Editable-text tab: buffer is the unsaved copy; saved is the last explicit write. */
export interface TextEditorTab {
  kind: 'text'
  /** Host-absolute path (tab identity). */
  path: string
  /** File name shown on the tab. */
  name: string
  /** Monaco language id. */
  language: string
  /** In-memory edit buffer. */
  buffer: string
  /** Last explicitly saved text. */
  saved: string
  /** Incremented on external disk reload so focused editors still apply the new text. */
  diskReloadTicket: number
}

/** Read-only image preview tab. */
export interface PreviewEditorTab {
  kind: 'preview'
  /** Host-absolute path (tab identity). */
  path: string
  /** File name shown on the tab. */
  name: string
  /** Image media type from Host `readFile`. */
  mediaType: string
  /** Canonical base64 of the image bytes. */
  data: string
}

/** Non-openable hint tab: no content is loaded. */
export interface NonOpenableEditorTab {
  kind: 'non-openable'
  /** Host-absolute path (tab identity). */
  path: string
  /** File name shown on the tab. */
  name: string
}

/** One open editor tab. */
export type EditorTab = TextEditorTab | PreviewEditorTab | NonOpenableEditorTab

/** Editor-surface store: open tabs and the active path for one Workspace. */
export interface FileEditorState {
  tabs: EditorTab[]
  /** Path of the focused tab; undefined when no tab is open. */
  activePath: string | undefined
  /** One-shot Monaco source selection request for the active tab. */
  sourceSelection?: SourceSelectionRequest
}

/** Pending source line-range selection for one editor tab. */
export interface SourceSelectionRequest {
  /** Host-absolute file path. */
  path: string
  /** One-based inclusive start line. */
  startLine: number
  /** One-based inclusive end line. */
  endLine: number
  /** Monotonic ticket so repeat requests still apply. */
  ticket: number
}

/** Root store: one editor partition per registered Workspace. */
export interface FileEditorRootState {
  byWorkspace: Partial<Record<WorkspaceId, FileEditorState>>
}

const EMPTY_PARTITION: FileEditorState = { tabs: [], activePath: undefined }

/**
 * Read one Workspace editor partition (empty when never opened).
 * @param root - root store snapshot.
 * @param workspaceId - bound Workspace id.
 */
export function workspaceEditorState(
  root: FileEditorRootState,
  workspaceId: WorkspaceId,
): FileEditorState {
  return root.byWorkspace[workspaceId] ?? EMPTY_PARTITION
}

function partition(draft: FileEditorRootState, workspaceId: WorkspaceId): FileEditorState {
  let state = draft.byWorkspace[workspaceId]
  if (state === undefined) {
    state = { tabs: [], activePath: undefined }
    draft.byWorkspace[workspaceId] = state
  }
  return state
}

/** Annotation twin of the actions literal; drift fails at defineStore. */
type FileEditorActions = {
  openTab: (draft: FileEditorRootState, workspaceId: WorkspaceId, tab: EditorTab) => void
  focusTab: (draft: FileEditorRootState, workspaceId: WorkspaceId, path: string) => void
  closeTab: (draft: FileEditorRootState, workspaceId: WorkspaceId, path: string) => void
  setBuffer: (draft: FileEditorRootState, workspaceId: WorkspaceId, path: string, buffer: string) => void
  markSaved: (draft: FileEditorRootState, workspaceId: WorkspaceId, path: string) => void
  reloadTextTab: (draft: FileEditorRootState, workspaceId: WorkspaceId, path: string, text: string) => void
  renameTabPath: (
    draft: FileEditorRootState,
    workspaceId: WorkspaceId,
    oldPath: string,
    newPath: string,
    newName: string,
  ) => void
  closeAllTabs: (draft: FileEditorRootState, workspaceId: WorkspaceId) => void
  requestSourceSelection: (
    draft: FileEditorRootState,
    workspaceId: WorkspaceId,
    path: string,
    startLine: number,
    endLine: number,
  ) => void
  clearSourceSelection: (
    draft: FileEditorRootState,
    workspaceId: WorkspaceId,
    ticket: number,
  ) => void
}

/**
 * Create the exclusive file-editor store handle (one root instance, partitions per Workspace).
 * @returns the store handle for `slots.register`.
 */
export function createFileEditorStore(): EngineStoreHandle<FileEditorRootState, FileEditorActions> {
  return defineStore({
    init: (): FileEditorRootState => ({ byWorkspace: {} }),
    actions: {
      openTab: (draft, workspaceId, tab) => {
        const state = partition(draft, workspaceId)
        state.tabs.push(tab)
        state.activePath = tab.path
      },
      focusTab: (draft, workspaceId, path) => {
        partition(draft, workspaceId).activePath = path
      },
      closeTab: (draft, workspaceId, path) => {
        const state = partition(draft, workspaceId)
        state.tabs = state.tabs.filter(item => item.path !== path)
        if (state.activePath === path) state.activePath = state.tabs.at(-1)?.path
      },
      setBuffer: (draft, workspaceId, path, buffer) => {
        const tab = partition(draft, workspaceId).tabs.find(item => item.path === path)
        if (tab?.kind === 'text') tab.buffer = buffer
      },
      markSaved: (draft, workspaceId, path) => {
        const tab = partition(draft, workspaceId).tabs.find(item => item.path === path)
        if (tab?.kind === 'text') tab.saved = tab.buffer
      },
      reloadTextTab: (draft, workspaceId, path, text) => {
        const tab = partition(draft, workspaceId).tabs.find(item => item.path === path)
        if (tab?.kind === 'text') {
          tab.buffer = text
          tab.saved = text
          tab.diskReloadTicket = (tab.diskReloadTicket ?? 0) + 1
        }
      },
      renameTabPath: (draft, workspaceId, oldPath, newPath, newName) => {
        const state = partition(draft, workspaceId)
        const normalizedOld = oldPath.replace(/[/\\]+$/, '')
        for (const tab of state.tabs) {
          const remapped = remapPathAfterRename(oldPath, newPath, tab.path)
          if (remapped === tab.path) continue
          if (tab.path === normalizedOld) tab.name = newName
          tab.path = remapped
        }
        if (state.activePath !== undefined) {
          state.activePath = remapPathAfterRename(oldPath, newPath, state.activePath)
        }
      },
      closeAllTabs: (draft, workspaceId) => {
        const state = partition(draft, workspaceId)
        state.tabs = []
        state.activePath = undefined
        delete state.sourceSelection
      },
      requestSourceSelection: (draft, workspaceId, path, startLine, endLine) => {
        const state = partition(draft, workspaceId)
        state.activePath = path
        state.sourceSelection = {
          path,
          startLine,
          endLine,
          ticket: (state.sourceSelection?.ticket ?? 0) + 1,
        }
      },
      clearSourceSelection: (draft, workspaceId, ticket) => {
        const state = partition(draft, workspaceId)
        if (state.sourceSelection?.ticket === ticket) delete state.sourceSelection
      },
    },
  })
}

/**
 * Whether a text tab has unsaved edits.
 * @param tab - any open tab.
 * @returns true only for text tabs whose buffer differs from the last save.
 */
export function tabIsDirty(tab: EditorTab): boolean {
  return tab.kind === 'text' && tab.buffer !== tab.saved
}
