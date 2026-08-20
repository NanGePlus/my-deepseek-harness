// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { bindSnapshotSelector } from '@deepseek-ai/dsh-client-web-react'
import {
  createSnapshotStore, EMPTY_CHAT_SNAPSHOT, EMPTY_CONVERSATION_VIEWS,
} from '@deepseek-ai/dsh-client-runtime/client'
import type { UseSession } from '@deepseek-ai/dsh-client-web-react'
import type { ConversationSnapshot, SessionId, SessionListState, WorkspaceListState } from '@deepseek-ai/dsh-client-runtime/client'
import type { SessionProviderComponent } from '@deepseek-ai/dsh-client-ui-slots'
import type { DetailsSlotProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { zh as commonZh } from '@deepseek-ai/dsh-client-locale/src/locales/zh.ts'
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
  const chat = createChatStore().create()
  const emptyList = createSnapshotStore<SessionListState>(
    { ids: [], byId: {}, current: undefined, phase: 'ready', subagentsByParent: {}, jobsBySession: {}, currentAddress: undefined })
  const emptyWorkspaces = createSnapshotStore<WorkspaceListState>({
    items: [], archivedSessionIds: [], state: 'idle', phase: 'ready', error: null,
    baselinesReady: true, recentWorkspaceId: undefined,
  })
  const openDetails = vi.fn()
  const closeDetails = vi.fn()
  const renderSlot: DetailsSlotProps['renderSlot'] = overrides?.renderSlot ?? ((key) => {
    if (key === 'conversation.details.editor') return <div data-testid="editor-surface-seat" />
    return null
  })
  const useSessionStub = bindSnapshotSelector({
    getSnapshot: () => snap,
    subscribe: () => () => {},
  }) as unknown as UseSession<ConversationSnapshot>
  const view = render(
    <DetailsPanel
      SessionProvider={SessionProviderStub}
      renderSlot={renderSlot}
      sessionId={SID}
      useSession={useSessionStub}
      useSessions={bindSnapshotSelector(emptyList)}
      useWorkspaces={bindSnapshotSelector(emptyWorkspaces)}
      useProjection={(() => undefined)}
      useInput={(() => { throw new Error('unused') })}
      inputActions={{
        setDraft: () => {},
        addImages: () => true,
        removeImage: () => {},
        pruneImages: () => {},
        submit: () => {},
      }}
      useStore={bindSnapshotSelector(chat)}
      actions={chat.actions}
      openDetails={openDetails}
      closeDetails={closeDetails}
      t={t}
    />,
  )
  return { view, chat, openDetails, closeDetails }
}

describe('DetailsPanel segmented tabs', () => {
  it('default: renders Tool 详情 and 文件编辑器 tab labels', () => {
    const { view } = bench()
    expect(view.getByRole('tab', { name: 'Tool 详情' })).toBeTruthy()
    expect(view.getByRole('tab', { name: '文件编辑器' })).toBeTruthy()
    expect(view.getByRole('tab', { name: 'Tool 详情' }).getAttribute('aria-selected')).toBe('true')
  })

  it('tab-selected: selecting 文件编辑器 renders the editor surface seat and opens details', () => {
    const { view, chat, openDetails } = bench()
    fireEvent.click(view.getByRole('tab', { name: '文件编辑器' }))
    expect(chat.store.getSnapshot().detailsTab).toBe('editor')
    expect(openDetails).toHaveBeenCalledTimes(1)
    expect(view.getByTestId('editor-surface-seat')).toBeTruthy()
    expect(view.queryByText('点击消息流中的工具行查看详情')).toBeNull()
  })

  it('tab-selected: switching back to Tool 详情 closes the editor view', () => {
    const { view, chat } = bench()
    fireEvent.click(view.getByRole('tab', { name: '文件编辑器' }))
    fireEvent.click(view.getByRole('tab', { name: 'Tool 详情' }))
    expect(chat.store.getSnapshot().detailsTab).toBe('tool')
    expect(view.queryByTestId('editor-surface-seat')).toBeNull()
    expect(view.getByText('点击消息流中的工具行查看详情')).toBeTruthy()
  })
})
