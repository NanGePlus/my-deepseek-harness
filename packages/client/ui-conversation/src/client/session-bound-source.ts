/** Follows the current session id and rebinds to a per-session observable source. */

import type { SessionId, SessionListState } from '@deepseek-ai/dsh-client-runtime/client'
import type { CallId, ChatStoreState, DetailsTab, SelectionTarget } from './contract/views.ts'

/** Minimal subscribe/getSnapshot face shared by store and session sources. */
export interface ObservableSource<T> {
  getSnapshot(): T
  subscribe(listener: () => void): () => void
}

/** Session list source used to detect the current session. */
export interface SessionListSource extends ObservableSource<SessionListState> {}

/**
 * Create a source that tracks `sessions.current` and mirrors one child source
 * per active session.
 * @param sessions - authoritative session list.
 * @param resolve - child source for one session, or undefined when absent.
 * @param empty - snapshot while no session is current or the child is absent.
 */
export function createSessionBoundSource<T>(
  sessions: SessionListSource,
  resolve: (sessionId: SessionId) => ObservableSource<T> | undefined,
  empty: T,
): ObservableSource<T> {
  let activeSessionId: SessionId | undefined
  let innerUnsub: (() => void) | undefined
  let cached = empty
  const listeners = new Set<() => void>()

  const publish = (): void => {
    for (const listener of listeners) listener()
  }

  const rebind = (): void => {
    const nextSessionId = sessions.getSnapshot().current
    if (nextSessionId === activeSessionId) return
    activeSessionId = nextSessionId
    innerUnsub?.()
    innerUnsub = undefined
    if (nextSessionId === undefined) {
      cached = empty
      return
    }
    const source = resolve(nextSessionId)
    if (source === undefined) {
      cached = empty
      return
    }
    cached = source.getSnapshot()
    innerUnsub = source.subscribe(() => {
      cached = source.getSnapshot()
      publish()
    })
  }

  const listUnsub = sessions.subscribe(() => {
    rebind()
    publish()
  })
  rebind()

  return {
    getSnapshot() {
      return cached
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
        if (listeners.size === 0) {
          listUnsub()
          innerUnsub?.()
        }
      }
    },
  }
}

/** Live chat-store binding for the current session. */
export interface SessionChatBinding {
  /** Current session id, if any. */
  sessionId: SessionId | undefined
  /** Per-session chat-store snapshot. */
  state: ChatStoreState
  /** Per-session chat-store actions; no-ops when no session is current. */
  actions: SessionChatBindingActions
}

/** Chat-store write surface exposed through {@link SessionChatBinding}. */
export type SessionChatBindingActions = {
  select: (target: SelectionTarget | null) => void
  setDraft: (text: string) => void
  setView: (view: string) => void
  setInspect: (target: { callId: CallId } | null) => void
  setDetailsTab: (tab: DetailsTab) => void
}

const NOOP_CHAT_ACTIONS: SessionChatBindingActions = {
  select: () => {},
  setDraft: () => {},
  setView: () => {},
  setInspect: () => {},
  setDetailsTab: () => {},
}

const EMPTY_CHAT_BINDING: SessionChatBinding = {
  sessionId: undefined,
  state: { selection: null, draft: '', view: null, inspect: null, detailsTab: 'editor' },
  actions: NOOP_CHAT_ACTIONS,
}

/**
 * Bind the shared chat-store handle to whichever session is currently open.
 * @param sessions - authoritative session list.
 * @param resolveStore - materializes the per-session chat-store instance.
 */
export function createSessionChatBindingSource(
  sessions: SessionListSource,
  resolveStore: (sessionId: SessionId) => {
    getSnapshot(): ChatStoreState
    subscribe(listener: () => void): () => void
    actions: SessionChatBindingActions
  } | undefined,
): ObservableSource<SessionChatBinding> {
  return createSessionBoundSource(
    sessions,
    (sessionId) => {
      const store = resolveStore(sessionId)
      if (store === undefined) return undefined
      return {
        getSnapshot: () => ({
          sessionId,
          state: store.getSnapshot(),
          actions: store.actions,
        }),
        subscribe: listener => store.subscribe(listener),
      }
    },
    EMPTY_CHAT_BINDING,
  )
}
