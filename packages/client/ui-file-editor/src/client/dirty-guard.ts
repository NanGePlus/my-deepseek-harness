/** Session switch and dirty-tab close guards for editor-surface (US-26 / US-27). */

import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client'

/** One dirty text tab referenced by a guard dialog. */
export interface DirtyTabRef {
  /** Host-absolute path (tab identity). */
  path: string
  /** File name shown in the dialog body. */
  name: string
}

/** Session-scoped editor callbacks the guard invokes during save / discard. */
export interface SessionEditorBridge {
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
  /** Close every open tab (session switch success). */
  closeAllTabs: () => void
}

/** Active guard mode; idle when no dialog is shown. */
export type DirtyGuardMode =
  | { kind: 'idle' }
  | { kind: 'close-tab'; sessionId: SessionId; queue: readonly DirtyTabRef[]; saveError?: string }
  | {
    kind: 'session-switch'
    sessionId: SessionId
    targetSessionId: SessionId
    queue: readonly DirtyTabRef[]
    saveError?: string
    commit: () => void
  }

/** Observable guard snapshot for React subscriptions. */
export interface DirtyGuardSnapshot {
  mode: DirtyGuardMode
}

/** Per-session dirty guard coordinator (one instance per web client). */
export interface DirtyGuard {
  /** uSES-compatible subscription for guard dialog state. */
  subscribe(listener: () => void): () => void
  /** Current guard snapshot (stable reference until the mode moves). */
  getSnapshot(): DirtyGuardSnapshot
  /**
   * Register editor callbacks for one session scope.
   * @param sessionId - owning session.
   * @param bridge - save/discard/close hooks.
   * @returns disposer removing the bridge.
   */
  registerBridge(sessionId: SessionId, bridge: SessionEditorBridge): () => void
  /**
   * Begin a dirty-tab close guard when needed.
   * @param sessionId - current session.
   * @param path - tab path the user closed.
   * @returns true when a guard dialog opened (caller must not close directly).
   */
  requestCloseTab(sessionId: SessionId, path: string): boolean
  /**
   * Intercept session selection when dirty tabs remain.
   * @param fromSessionId - current session, if any.
   * @param toSessionId - requested session.
   * @param commit - invokes the real `sessions.open`.
   */
  tryOpenSession(fromSessionId: SessionId | undefined, toSessionId: SessionId, commit: () => void): void
  /** Save the head of the current guard queue. */
  saveCurrent(): Promise<void>
  /** Discard the head of the current guard queue. */
  discardCurrent(): void
  /** Cancel the active guard (abort session switch or tab close). */
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
  const bridges = new Map<SessionId, SessionEditorBridge>()

  const publish = (next: DirtyGuardSnapshot): void => {
    snapshot = next
    for (const listener of listeners) listener()
  }

  const bridgeFor = (sessionId: SessionId): SessionEditorBridge | undefined => bridges.get(sessionId)

  const head = (mode: Exclude<DirtyGuardMode, { kind: 'idle' }>): DirtyTabRef | undefined => mode.queue[0]

  const finishQueue = (mode: Exclude<DirtyGuardMode, { kind: 'idle' }>): void => {
    const rest = mode.queue.slice(1)
    if (rest.length > 0) {
      publish({ mode: { ...mode, queue: rest, saveError: undefined } })
      return
    }
    if (mode.kind === 'close-tab') {
      publish(IDLE)
      return
    }
    const sessionBridge = bridgeFor(mode.sessionId)
    sessionBridge?.closeAllTabs()
    mode.commit()
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
    registerBridge(sessionId, bridge) {
      bridges.set(sessionId, bridge)
      return () => { bridges.delete(sessionId) }
    },
    requestCloseTab(sessionId, path) {
      const bridge = bridgeFor(sessionId)
      if (bridge === undefined) return false
      const tab = bridge.dirtyTabs().find(item => item.path === path)
      if (tab === undefined) return false
      publish({ mode: { kind: 'close-tab', sessionId, queue: [tab] } })
      return true
    },
    tryOpenSession(fromSessionId, toSessionId, commit) {
      if (fromSessionId === undefined || fromSessionId === toSessionId) {
        commit()
        return
      }
      const bridge = bridgeFor(fromSessionId)
      const queue = bridge?.dirtyTabs() ?? []
      if (queue.length === 0) {
        commit()
        return
      }
      publish({
        mode: {
          kind: 'session-switch',
          sessionId: fromSessionId,
          targetSessionId: toSessionId,
          queue,
          commit,
        },
      })
    },
    async saveCurrent() {
      const mode = snapshot.mode
      if (mode.kind === 'idle') return
      const current = head(mode)
      /* v8 ignore next -- queue head is always defined while the guard is active */
      if (current === undefined) return
      const bridge = bridgeFor(mode.sessionId)
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
      bridgeFor(mode.sessionId)?.discardTab(current.path)
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
