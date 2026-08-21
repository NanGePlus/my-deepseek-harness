/** Dirty-tab close guards for editor-surface (US-27). */

import type { WorkspaceId } from '@deepseek-ai/dsh-client-runtime/client'

/** One dirty text tab referenced by a guard dialog. */
export interface DirtyTabRef {
  /** Host-absolute path (tab identity). */
  path: string
  /** File name shown in the dialog body. */
  name: string
}

/** Workspace-scoped editor callbacks the guard invokes during save / discard. */
export interface WorkspaceEditorBridge {
  /** Dirty tabs in stable tab-bar order. */
  dirtyTabs: () => readonly DirtyTabRef[]
  /**
   * Explicitly save one text tab.
   * @param path - tab path.
   * @returns whether the write succeeded.
   */
  saveTab: (path: string) => Promise<boolean>
  /**
   * Close one tab without saving.
   * @param path - tab path.
   */
  discardTab: (path: string) => void
}

/** Active guard mode; idle when no dialog is shown. */
export type DirtyGuardMode =
  | { kind: 'idle' }
  | { kind: 'close-tab'; workspaceId: WorkspaceId; queue: readonly DirtyTabRef[]; saveError?: string }

/** Observable guard snapshot for React subscriptions. */
export interface DirtyGuardSnapshot {
  mode: DirtyGuardMode
}

/** Per-Workspace dirty guard coordinator (one instance per web client). */
export interface DirtyGuard {
  /** uSES-compatible subscription for guard dialog state. */
  subscribe(listener: () => void): () => void
  /** Current guard snapshot (stable reference until the mode moves). */
  getSnapshot(): DirtyGuardSnapshot
  /**
   * Register editor callbacks for one Workspace scope.
   * @param workspaceId - owning Workspace.
   * @param bridge - save/discard hooks.
   * @returns disposer removing the bridge.
   */
  registerBridge(workspaceId: WorkspaceId, bridge: WorkspaceEditorBridge): () => void
  /**
   * Begin a dirty-tab close guard when needed.
   * @param workspaceId - current Workspace.
   * @param path - tab path the user closed.
   * @returns true when a guard dialog opened (caller must not close directly).
   */
  requestCloseTab(workspaceId: WorkspaceId, path: string): boolean
  /** Save the head of the current guard queue. */
  saveCurrent(): Promise<void>
  /** Discard the head of the current guard queue. */
  discardCurrent(): void
  /** Cancel the active guard (abort tab close). */
  cancel(): void
}

const IDLE: DirtyGuardSnapshot = { mode: { kind: 'idle' } }

/**
 * Create the editor dirty guard coordinator.
 * @returns guard instance wired from apply and EditorSurface.
 */
export function createDirtyGuard(): DirtyGuard {
  let snapshot: DirtyGuardSnapshot = IDLE
  const listeners = new Set<() => void>()
  const bridges = new Map<WorkspaceId, WorkspaceEditorBridge>()

  const publish = (next: DirtyGuardSnapshot): void => {
    snapshot = next
    for (const listener of listeners) listener()
  }

  const bridgeFor = (workspaceId: WorkspaceId): WorkspaceEditorBridge | undefined => bridges.get(workspaceId)

  const head = (mode: Exclude<DirtyGuardMode, { kind: 'idle' }>): DirtyTabRef | undefined => mode.queue[0]

  const finishQueue = (mode: Exclude<DirtyGuardMode, { kind: 'idle' }>): void => {
    const rest = mode.queue.slice(1)
    if (rest.length > 0) {
      publish({ mode: { kind: 'close-tab', workspaceId: mode.workspaceId, queue: rest } })
      return
    }
    publish(IDLE)
  }

  return {
    subscribe(listener) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    getSnapshot() {
      return snapshot
    },
    registerBridge(workspaceId, bridge) {
      bridges.set(workspaceId, bridge)
      return () => { bridges.delete(workspaceId) }
    },
    requestCloseTab(workspaceId, path) {
      const bridge = bridgeFor(workspaceId)
      if (bridge === undefined) return false
      const tab = bridge.dirtyTabs().find(item => item.path === path)
      if (tab === undefined) return false
      publish({ mode: { kind: 'close-tab', workspaceId, queue: [tab] } })
      return true
    },
    async saveCurrent() {
      const mode = snapshot.mode
      if (mode.kind === 'idle') return
      const current = head(mode)
      /* v8 ignore next -- queue head is always defined while the guard is active */
      if (current === undefined) return
      const bridge = bridgeFor(mode.workspaceId)
      if (bridge === undefined) return
      const ok = await bridge.saveTab(current.path)
      if (!ok) {
        publish({ mode: { ...mode, saveError: 'save-failed' } })
        return
      }
      bridge.discardTab(current.path)
      finishQueue(mode)
    },
    discardCurrent() {
      const mode = snapshot.mode
      if (mode.kind === 'idle') return
      const current = head(mode)
      /* v8 ignore next -- queue head is always defined while the guard is active */
      if (current === undefined) return
      bridgeFor(mode.workspaceId)?.discardTab(current.path)
      finishQueue(mode)
    },
    cancel() {
      if (snapshot.mode.kind === 'idle') return
      publish(IDLE)
    },
  }
}

/** Test-only reset hook (not exported from the package entry). */
export function resetDirtyGuardForTest(guard: DirtyGuard): void {
  guard.cancel()
}
