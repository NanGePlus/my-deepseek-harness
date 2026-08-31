/** Dirty-tab close guards for editor-surface (US-27). */

import type { WorkspaceId } from '@deepseek-ai/dsh-client-runtime/client'

/** One dirty text tab referenced by a guard dialog. */
export interface DirtyTabRef {
  /** Host-absolute path (tab identity). */
  path: string
  /** File name shown in the dialog body. */
  name: string
}

/** Dirty tab scoped to a Workspace for app-exit guard queues. */
export interface ExitDirtyTabRef extends DirtyTabRef {
  /** Owning Workspace for save/discard callbacks. */
  workspaceId: WorkspaceId
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
  | { kind: 'exit-app'; queue: readonly ExitDirtyTabRef[]; saveError?: string }

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
  /**
   * Begin a dirty-tab close guard for a bulk close when any target path is dirty.
   * @param workspaceId - current Workspace.
   * @param paths - tab paths slated to close (dirty subset is queued in tab-bar order).
   * @returns true when a guard dialog opened (caller must not close directly).
   */
  requestCloseTabs(workspaceId: WorkspaceId, paths: readonly string[]): boolean
  /**
   * Begin desktop app-exit guard when any registered Workspace has dirty tabs.
   * @returns true when a guard dialog opened (caller must wait for completion).
   */
  requestExit(): boolean
  /**
   * Resolve when an exit-app guard finishes or is cancelled.
   * @returns `'proceed'` after all dirty tabs are saved/discarded; `'cancel'` when aborted.
   */
  waitForExitDecision(): Promise<'proceed' | 'cancel'>
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
  let exitDecision: ((decision: 'proceed' | 'cancel') => void) | undefined

  const publish = (next: DirtyGuardSnapshot): void => {
    snapshot = next
    for (const listener of listeners) listener()
  }

  const bridgeFor = (workspaceId: WorkspaceId): WorkspaceEditorBridge | undefined => bridges.get(workspaceId)

  const headCloseTab = (mode: { kind: 'close-tab'; queue: readonly DirtyTabRef[] }): DirtyTabRef | undefined =>
    mode.queue[0]

  const headExitTab = (mode: { kind: 'exit-app'; queue: readonly ExitDirtyTabRef[] }): ExitDirtyTabRef | undefined =>
    mode.queue[0]

  const resolveExitDecision = (decision: 'proceed' | 'cancel'): void => {
    exitDecision?.(decision)
    exitDecision = undefined
  }

  const finishQueue = (mode: Exclude<DirtyGuardMode, { kind: 'idle' }>): void => {
    if (mode.kind === 'exit-app') {
      const rest = mode.queue.slice(1)
      if (rest.length > 0) {
        publish({ mode: { kind: 'exit-app', queue: rest } })
        return
      }
      resolveExitDecision('proceed')
      publish(IDLE)
      return
    }
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
      return this.requestCloseTabs(workspaceId, [path])
    },
    requestCloseTabs(workspaceId, paths) {
      const bridge = bridgeFor(workspaceId)
      if (bridge === undefined) return false
      const targets = new Set(paths)
      const queue = bridge.dirtyTabs().filter(item => targets.has(item.path))
      if (queue.length === 0) return false
      publish({ mode: { kind: 'close-tab', workspaceId, queue } })
      return true
    },
    requestExit() {
      const queue: ExitDirtyTabRef[] = []
      for (const [workspaceId, bridge] of bridges) {
        for (const tab of bridge.dirtyTabs()) {
          queue.push({ ...tab, workspaceId })
        }
      }
      if (queue.length === 0) return false
      publish({ mode: { kind: 'exit-app', queue } })
      return true
    },
    waitForExitDecision() {
      if (snapshot.mode.kind !== 'exit-app') {
        if (this.requestExit()) {
          return new Promise<'proceed' | 'cancel'>((resolve) => { exitDecision = resolve })
        }
        return Promise.resolve('proceed')
      }
      return new Promise<'proceed' | 'cancel'>((resolve) => { exitDecision = resolve })
    },
    async saveCurrent() {
      const mode = snapshot.mode
      if (mode.kind === 'idle') return
      if (mode.kind === 'exit-app') {
        const current = headExitTab(mode)
        /* v8 ignore next -- queue head is always defined while the guard is active */
        if (current === undefined) return
        const bridge = bridgeFor(current.workspaceId)
        if (bridge === undefined) return
        const ok = await bridge.saveTab(current.path)
        if (!ok) {
          publish({ mode: { ...mode, saveError: 'save-failed' } })
          return
        }
        bridge.discardTab(current.path)
        finishQueue(mode)
        return
      }
      const current = headCloseTab(mode)
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
      if (mode.kind === 'exit-app') {
        const current = headExitTab(mode)
        /* v8 ignore next -- queue head is always defined while the guard is active */
        if (current === undefined) return
        bridgeFor(current.workspaceId)?.discardTab(current.path)
        finishQueue(mode)
        return
      }
      const current = headCloseTab(mode)
      /* v8 ignore next -- queue head is always defined while the guard is active */
      if (current === undefined) return
      bridgeFor(mode.workspaceId)?.discardTab(current.path)
      finishQueue(mode)
    },
    cancel() {
      if (snapshot.mode.kind === 'idle') return
      if (snapshot.mode.kind === 'exit-app') resolveExitDecision('cancel')
      publish(IDLE)
    },
  }
}

/** Test-only reset hook (not exported from the package entry). */
export function resetDirtyGuardForTest(guard: DirtyGuard): void {
  guard.cancel()
}
