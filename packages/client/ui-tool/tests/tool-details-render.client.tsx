/** Test adapter for the production conversation.details.tool registration. */
import { vi } from 'vitest'
import { bindSnapshotSelector } from '@deepseek-ai/dsh-client-web-react'
import {
  createSnapshotStore, type ChatSnapshot, type ConversationNode, type ConversationSnapshot,
  type RunningToolCall, type SessionId, type SessionListState, type WorkspaceListState,
} from '@deepseek-ai/dsh-client-runtime/client'
import type { SessionProviderComponent, TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { DetailsSlotProps, DetailsToolOwnerProps } from '@deepseek-ai/dsh-client-ui-conversation/src/client/contract/slots.ts'
import type { createChatStore } from '@deepseek-ai/dsh-client-ui-conversation/src/client/stores.ts'
import type { SessionChatBinding } from '@deepseek-ai/dsh-client-ui-conversation/src/client/session-bound-source.ts'

type ChatInstance = ReturnType<ReturnType<typeof createChatStore>['create']>
import { ToolDetails } from '../src/client/tool/ToolDetails.tsx'

/** Framework session-area seat used by direct DetailsPanel tests. */
export const SessionProviderStub: SessionProviderComponent = ({ children }) => children('s1' as SessionId)

/** Build the canonical Chat slice consumed by Tool rows and details tests. */
export function toolChatSnapshot(
  settled: readonly ConversationNode[] = [],
  running: readonly RunningToolCall[] = [],
): ChatSnapshot {
  const roots = [...settled.filter(node => node.kind === 'tool-result'), ...running]
  const nodes: import('@deepseek-ai/dsh-client-runtime/client').ChatConversationViewNode[] = roots.map(root => ({
    key: `tool:${root.callId}`,
    kind: 'tool-call',
    id: root.callId,
    target: 'chat',
    anchorSeq: 'kind' in root ? root.seq : Number.MAX_SAFE_INTEGER,
    location: { kind: 'session' },
    visibility: 'visible',
    data: { root },
  }))
  const byKey = new Map(nodes.map(node => [node.key, node]))
  const empty: readonly string[] = []
  return {
    order: nodes.map(node => node.key),
    nodes: {
      get: key => byKey.get(key),
      values: () => nodes,
    },
    locations: {
      getTurn: () => empty,
      getStep: () => empty,
    },
    timeline: { turnOrder: [], turns: new Map() },
    legacy: {
      nodes: settled,
      runningCalls: running,
      partial: null,
      turnTimings: new Map(),
      turnEnds: new Map(),
    },
  }
}

/**
 * Compose DetailsPanel props for direct ui-tool card tests.
 * @param input - snapshot, chat store, renderSlot, and locale seat.
 */
export function detailsPanelTestProps(input: {
  snapshot: ConversationSnapshot
  chat: ChatInstance
  renderSlot: DetailsSlotProps['renderSlot']
  t: DetailsSlotProps['t']
  /** Session cwd surfaced through useSessions for Tool details. */
  cwd?: string | undefined
}): DetailsSlotProps {
  const row = {
    id: input.snapshot.sessionId,
    displayTitle: 's1',
    running: false,
    blank: false,
    updatedAt: 0,
    ...(input.cwd !== undefined ? { cwd: input.cwd } : {}),
  }
  const sessionList = createSnapshotStore<SessionListState>({
    ids: [input.snapshot.sessionId],
    byId: { [input.snapshot.sessionId]: row },
    current: input.snapshot.sessionId,
    phase: 'ready',
    subagentsByParent: {},
    jobsBySession: {},
    currentAddress: undefined,
  })
  const workspaces = createSnapshotStore<WorkspaceListState>({
    items: [], archivedSessionIds: [], state: 'idle', phase: 'ready', error: null,
    baselinesReady: true, recentWorkspaceId: undefined,
  })
  const chatBinding = {
    getSnapshot: (): SessionChatBinding => ({
      sessionId: input.snapshot.sessionId,
      state: input.chat.getSnapshot(),
      actions: input.chat.actions,
    }),
    subscribe: (listener: () => void) => input.chat.subscribe(listener),
  }
  return {
    SessionProvider: SessionProviderStub,
    renderSlot: input.renderSlot,
    useSessions: bindSnapshotSelector(sessionList),
    useWorkspaces: bindSnapshotSelector(workspaces),
    useChat: bindSnapshotSelector(chatBinding),
    useConversation: bindSnapshotSelector({
      getSnapshot: () => input.snapshot,
      subscribe: () => () => {},
    }),
    openDetails: vi.fn(),
    closeDetails: vi.fn(),
    t: input.t,
  }
}

/**
 * Bind ui-tool's details renderer to the conversation slot callback shape.
 * @param t - conversation locale seat used by Tool cards.
 * @returns a direct-test renderSlot implementation.
 */
export function renderToolDetails(t: TranslateNS<'conversation'>): DetailsSlotProps['renderSlot'] {
  return (_key, owner) => {
    const details = owner as unknown as DetailsToolOwnerProps
    return <ToolDetails block={details.block} cwd={details.cwd} t={t} />
  }
}
