// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { bindSnapshotSelector } from '@deepseek-ai/dsh-client-web-react'
import {
  createSnapshotStore, EMPTY_CHAT_SNAPSHOT, EMPTY_CONVERSATION_VIEWS,
} from '@deepseek-ai/dsh-client-runtime/client'
import type { ConversationSnapshot, SessionId, SessionListState, WorkspaceListState } from '@deepseek-ai/dsh-client-runtime/client'
import type { SessionProviderComponent } from '@deepseek-ai/dsh-client-ui-slots'
import type { DetailsSlotProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { zh as commonZh } from '@deepseek-ai/dsh-client-locale/src/locales/zh.ts'
import {
  createSessionBoundSource,
} from '../src/client/session-bound-source.ts'
import { createChatStore } from '../src/client/stores.ts'
import { DetailsPanel } from '../src/client/skeleton/DetailsPanel.tsx'
import { zh } from '../src/client/locales.ts'

const t: DetailsSlotProps['t'] = makeTranslate(zh, commonZh)

class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

beforeEach(() => { vi.stubGlobal('ResizeObserver', ResizeObserverStub) })
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const SID = 's1' as SessionId
const SessionProviderStub: SessionProviderComponent = ({ children }) => children(SID)

function snapshotBase(): ConversationSnapshot {
  return {
    sessionId: SID, views: EMPTY_CONVERSATION_VIEWS, chat: EMPTY_CHAT_SNAPSHOT,
    nodes: [], turnTimings: new Map(), turnEnds: new Map(), partial: null, runningCalls: [],
    pending: [], queue: [], running: false, composerPhase: 'active', removed: false, openState: 'open', openError: null,
    hasMore: false, loadingOlder: false, promptError: null, blank: false, subagent: null, lastAgentError: null,
  }
}

function bench(overrides?: Partial<Pick<DetailsSlotProps, 'renderSlot'>>) {
  localStorage.clear()
  const snap = snapshotBase()
  const chat = createChatStore().create(SID)
  const sessionList = createSnapshotStore<SessionListState>({
    ids: [SID],
    byId: {
      [SID]: {
        id: SID,
        displayTitle: 's1',
        cwd: '/tmp',
        running: false,
        blank: false,
        updatedAt: 0,
      },
    },
    current: SID, phase: 'ready', subagentsByParent: {}, jobsBySession: {}, currentAddress: undefined })
  const emptyWorkspaces = createSnapshotStore<WorkspaceListState>({
    items: [], archivedSessionIds: [], state: 'idle', phase: 'ready', error: null,
    baselinesReady: true, recentWorkspaceId: undefined,
  })
  const conversation = createSnapshotStore(snap)
  const openDetails = vi.fn()
  const closeDetails = vi.fn()
  const renderSlot: DetailsSlotProps['renderSlot'] = overrides?.renderSlot ?? ((key) => {
    if (key === 'conversation.details.editor') return <div data-testid="editor-surface-seat" />
    return null
  })
  const view = render(
    <DetailsPanel
      SessionProvider={SessionProviderStub}
      renderSlot={renderSlot}
      useSessions={bindSnapshotSelector(sessionList)}
      useWorkspaces={bindSnapshotSelector(emptyWorkspaces)}
      openDetails={openDetails}
      closeDetails={closeDetails}
      useChat={bindSnapshotSelector({
        getSnapshot: () => ({
          sessionId: SID,
          state: chat.getSnapshot(),
          actions: chat.actions,
        }),
        subscribe: listener => chat.subscribe(listener),
      })}
      useConversation={bindSnapshotSelector(createSessionBoundSource(sessionList, () => conversation, snap))}
      t={t}
    />,
  )
  return { view, chat, openDetails, closeDetails }
}

describe('DetailsPanel segmented tabs', () => {
  function toolPanel(view: ReturnType<typeof bench>['view']) {
    return view.getAllByRole('tabpanel', { hidden: true })[1]!
  }

  it('default: selects the file editor tab and renders its seat', () => {
    const { view } = bench()
    expect(view.getByRole('tab', { name: 'Tool 详情' })).toBeTruthy()
    expect(view.getByRole('tab', { name: '文件编辑器' })).toBeTruthy()
    expect(view.getByRole('tab', { name: '文件编辑器' }).getAttribute('aria-selected')).toBe('true')
    expect(view.getByTestId('editor-surface-seat')).toBeTruthy()
    expect(toolPanel(view).getAttribute('aria-hidden')).toBe('true')
  })

  it('tab-selected: selecting 文件编辑器 keeps the editor surface visible', () => {
    const { view, chat, openDetails } = bench()
    expect(view.getByTestId('editor-surface-seat')).toBeTruthy()
    fireEvent.click(view.getByRole('tab', { name: '文件编辑器' }))
    expect(chat.store.getSnapshot().detailsTab).toBe('editor')
    expect(openDetails).toHaveBeenCalledTimes(1)
    expect(view.getByTestId('editor-surface-seat')).toBeTruthy()
    expect(toolPanel(view).getAttribute('aria-hidden')).toBe('true')
  })

  it('tab-selected: switching back to Tool 详情 hides the editor view without unmounting it', () => {
    const { view, chat } = bench()
    fireEvent.click(view.getByRole('tab', { name: '文件编辑器' }))
    fireEvent.click(view.getByRole('tab', { name: 'Tool 详情' }))
    expect(chat.store.getSnapshot().detailsTab).toBe('tool')
    expect(view.getByTestId('editor-surface-seat')).toBeTruthy()
    expect(view.getAllByRole('tabpanel', { hidden: true })[0]!.getAttribute('aria-hidden')).toBe('true')
    expect(view.getByText('点击消息流中的工具行查看详情')).toBeTruthy()
  })
})
