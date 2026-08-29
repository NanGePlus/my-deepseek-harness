/**
 * Per-Workspace human terminal tab state. Tab rows and selection survive
 * segment hide and are not written to the session log.
 */
import type { WorkspaceId } from '@deepseek-ai/dsh-client-runtime/client'
import { defineStore, type EngineStoreHandle } from '@deepseek-ai/dsh-client-runtime/client'

/** One live terminal tab row mirrored from Host list/spawn. */
export interface TerminalTabRow {
  sessionId: string
  title: string
  profileId: string
}

/** Workspace-scoped terminal UI state. */
export interface TerminalWorkspaceState {
  tabs: TerminalTabRow[]
  selectedSessionId: string | undefined
  /** True while the SSE handshake for the active tab is in flight. */
  connecting: boolean
  /** True while a Host spawn request is in flight; disables the + control. */
  spawning: boolean
  /** When true, an empty tab set does not auto-spawn until the Terminal segment is re-entered. */
  deferAutoSpawn: boolean
  /** Host terminal-unavailable reason shown as the full-page empty card when no tabs exist. */
  unavailableMessage: string | undefined
  /** Inline spawn, write, or reconnect failure copy for the active tab body. */
  inlineError: string | undefined
}

/** Root store keyed by bound Workspace id. */
export interface TerminalPanelState {
  byWorkspace: Partial<Record<WorkspaceId, TerminalWorkspaceState>>
}

/** Annotation twin of the actions literal; drift fails at defineStore. */
type TerminalPanelActions = {
  setWorkspaceTabs: (
    root: TerminalPanelState,
    workspaceId: WorkspaceId,
    tabs: TerminalTabRow[],
    selectedSessionId?: string,
  ) => void
  upsertTab: (root: TerminalPanelState, workspaceId: WorkspaceId, tab: TerminalTabRow) => void
  setSelectedSession: (root: TerminalPanelState, workspaceId: WorkspaceId, sessionId: string) => void
  setConnecting: (root: TerminalPanelState, workspaceId: WorkspaceId, connecting: boolean) => void
  setSpawning: (root: TerminalPanelState, workspaceId: WorkspaceId, spawning: boolean) => void
  setUnavailableMessage: (
    root: TerminalPanelState,
    workspaceId: WorkspaceId,
    unavailableMessage: string | undefined,
  ) => void
  setInlineError: (
    root: TerminalPanelState,
    workspaceId: WorkspaceId,
    inlineError: string | undefined,
  ) => void
  updateTabTitle: (
    root: TerminalPanelState,
    workspaceId: WorkspaceId,
    sessionId: string,
    title: string,
  ) => void
  removeTab: (root: TerminalPanelState, workspaceId: WorkspaceId, sessionId: string) => void
  setDeferAutoSpawn: (root: TerminalPanelState, workspaceId: WorkspaceId, deferAutoSpawn: boolean) => void
}

/** Empty workspace partition used when a key is first touched. */
function emptyWorkspaceState(): TerminalWorkspaceState {
  return {
    tabs: [],
    selectedSessionId: undefined,
    connecting: false,
    spawning: false,
    deferAutoSpawn: false,
    unavailableMessage: undefined,
    inlineError: undefined,
  }
}

/** Resolve one workspace partition, creating it when absent. */
function workspaceState(root: TerminalPanelState, workspaceId: WorkspaceId): TerminalWorkspaceState {
  return root.byWorkspace[workspaceId] ?? emptyWorkspaceState()
}

/**
 * Create the human-terminal store handle (one root instance; tabs partitioned by Workspace).
 * @returns the store handle for `slots.register`.
 */
export function createTerminalPanelStore(): EngineStoreHandle<TerminalPanelState, TerminalPanelActions> {
  return defineStore({
    init: (): TerminalPanelState => ({ byWorkspace: {} }),
    actions: {
      setWorkspaceTabs: (root, workspaceId, tabs, selectedSessionId) => {
        const current = workspaceState(root, workspaceId)
        root.byWorkspace[workspaceId] = {
          ...current,
          tabs,
          selectedSessionId: selectedSessionId ?? tabs[0]?.sessionId,
        }
      },
      upsertTab: (root, workspaceId, tab) => {
        const current = workspaceState(root, workspaceId)
        const index = current.tabs.findIndex(row => row.sessionId === tab.sessionId)
        const tabs = index === -1
          ? [...current.tabs, tab]
          : current.tabs.map((row, i) => (i === index ? tab : row))
        root.byWorkspace[workspaceId] = {
          ...current,
          tabs,
          selectedSessionId: current.selectedSessionId ?? tab.sessionId,
        }
      },
      setSelectedSession: (root, workspaceId, sessionId) => {
        const current = workspaceState(root, workspaceId)
        root.byWorkspace[workspaceId] = { ...current, selectedSessionId: sessionId }
      },
      setConnecting: (root, workspaceId, connecting) => {
        const current = workspaceState(root, workspaceId)
        root.byWorkspace[workspaceId] = { ...current, connecting }
      },
      setSpawning: (root, workspaceId, spawning) => {
        const current = workspaceState(root, workspaceId)
        root.byWorkspace[workspaceId] = { ...current, spawning }
      },
      setUnavailableMessage: (root, workspaceId, unavailableMessage) => {
        const current = workspaceState(root, workspaceId)
        root.byWorkspace[workspaceId] = { ...current, unavailableMessage }
      },
      setInlineError: (root, workspaceId, inlineError) => {
        const current = workspaceState(root, workspaceId)
        root.byWorkspace[workspaceId] = { ...current, inlineError }
      },
      updateTabTitle: (root, workspaceId, sessionId, title) => {
        const current = workspaceState(root, workspaceId)
        root.byWorkspace[workspaceId] = {
          ...current,
          tabs: current.tabs.map(row => (row.sessionId === sessionId ? { ...row, title } : row)),
        }
      },
      removeTab: (root, workspaceId, sessionId) => {
        const current = workspaceState(root, workspaceId)
        const index = current.tabs.findIndex(row => row.sessionId === sessionId)
        if (index === -1) return
        const tabs = current.tabs.filter(row => row.sessionId !== sessionId)
        let selectedSessionId = current.selectedSessionId
        if (current.selectedSessionId === sessionId) {
          selectedSessionId = tabs[index]?.sessionId ?? tabs[index - 1]?.sessionId
        }
        root.byWorkspace[workspaceId] = {
          ...current,
          tabs,
          selectedSessionId,
          deferAutoSpawn: tabs.length === 0 ? true : current.deferAutoSpawn,
        }
      },
      setDeferAutoSpawn: (root, workspaceId, deferAutoSpawn) => {
        const current = workspaceState(root, workspaceId)
        root.byWorkspace[workspaceId] = { ...current, deferAutoSpawn }
      },
    },
  })
}

/**
 * Read one workspace partition from the root store snapshot.
 * @param state - root store snapshot.
 * @param workspaceId - bound workspace id.
 * @returns the workspace partition or an empty default.
 */
export function terminalWorkspaceState(
  state: TerminalPanelState,
  workspaceId: WorkspaceId,
): TerminalWorkspaceState {
  return state.byWorkspace[workspaceId] ?? emptyWorkspaceState()
}
