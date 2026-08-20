/**
 * Session-scoped editor tabs and edit buffers. Dirty is derived
 * (`buffer !== saved`); nothing here is written to the Session log.
 */
import { defineStore, type EngineStoreHandle } from '@deepseek-ai/dsh-client-runtime/client'

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

/** Editor-surface store: open tabs and the active path. */
export interface FileEditorState {
  tabs: EditorTab[]
  /** Path of the focused tab; undefined when no tab is open. */
  activePath: string | undefined
}

/** Annotation twin of the actions literal; drift fails at defineStore. */
type FileEditorActions = {
  openTab: (draft: FileEditorState, tab: EditorTab) => void
  focusTab: (draft: FileEditorState, path: string) => void
  closeTab: (draft: FileEditorState, path: string) => void
  setBuffer: (draft: FileEditorState, path: string, buffer: string) => void
  markSaved: (draft: FileEditorState, path: string) => void
  renameTabPath: (draft: FileEditorState, oldPath: string, newPath: string, newName: string) => void
}

/**
 * Create the exclusive file-editor store handle (one instance per Session).
 * @returns the store handle for `slots.register`.
 */
export function createFileEditorStore(): EngineStoreHandle<FileEditorState, FileEditorActions> {
  return defineStore({
    init: (): FileEditorState => ({ tabs: [], activePath: undefined }),
    actions: {
      openTab: (draft, tab: EditorTab) => {
        draft.tabs.push(tab)
        draft.activePath = tab.path
      },
      focusTab: (draft, path: string) => {
        draft.activePath = path
      },
      closeTab: (draft, path: string) => {
        draft.tabs = draft.tabs.filter(item => item.path !== path)
        if (draft.activePath === path) draft.activePath = draft.tabs.at(-1)?.path
      },
      setBuffer: (draft, path: string, buffer: string) => {
        const tab = draft.tabs.find(item => item.path === path)
        if (tab?.kind === 'text') tab.buffer = buffer
      },
      markSaved: (draft, path: string) => {
        const tab = draft.tabs.find(item => item.path === path)
        if (tab?.kind === 'text') tab.saved = tab.buffer
      },
      renameTabPath: (draft, oldPath: string, newPath: string, newName: string) => {
        for (const tab of draft.tabs) {
          if (tab.path === oldPath) {
            tab.path = newPath
            tab.name = newName
          }
        }
        if (draft.activePath === oldPath) draft.activePath = newPath
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
