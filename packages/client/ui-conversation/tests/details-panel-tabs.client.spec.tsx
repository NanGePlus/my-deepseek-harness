// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { bindSnapshotSelector } from '@deepseek-ai/dsh-client-web-react'
import {
  createSnapshotStore, EMPTY_CHAT_SNAPSHOT, EMPTY_CONVERSATION_VIEWS,
} from '@deepseek-ai/dsh-client-runtime/client'
import type { ConversationSnapshot, SessionId, SessionListState, WorkspaceListState } from '@deepseek-ai/dsh-client-runtime/client'
import type { SessionProviderComponent } from '@deepseek-ai/dsh-client-ui-slots'
import type {
  DetailsEditorOwnerProps, DetailsGitOwnerProps, DetailsSlotProps, DetailsTerminalOwnerProps,
} from '@deepseek-ai/dsh-client-ui-conversation/client'
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
  const renderSlot: DetailsSlotProps['renderSlot'] = overrides?.renderSlot ?? ((key, owner) => {
    if (key === 'conversation.details.editor') {
      const editorOwner = owner as unknown as DetailsEditorOwnerProps
      return (
        <div data-testid="editor-surface-seat" data-visible={String(editorOwner.visible)} />
      )
    }
    if (key === 'conversation.details.git') {
      const gitOwner = owner as unknown as DetailsGitOwnerProps
      return (
        <div data-testid="git-panel-seat" data-visible={String(gitOwner.visible)}>
          <textarea data-testid="git-commit-draft" defaultValue="wip message" />
        </div>
      )
    }
    if (key === 'conversation.details.terminal') {
      const terminalOwner = owner as unknown as DetailsTerminalOwnerProps
      return (
        <div data-testid="terminal-seat" data-visible={String(terminalOwner.visible)} />
      )
    }
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
  function tabLabels(view: ReturnType<typeof bench>['view']): string[] {
    return view.getAllByRole('tab').map(el => el.textContent ?? '')
  }

  function selectedTab(view: ReturnType<typeof bench>['view']): string {
    return view.getByRole('tab', { selected: true }).textContent ?? ''
  }

  function panels(view: ReturnType<typeof bench>['view']) {
    return view.getAllByRole('tabpanel', { hidden: true })
  }

  it('chrome-reduced: does not force-open the toolbox on mount', () => {
    const { openDetails } = bench()
    expect(openDetails).not.toHaveBeenCalled()
  })

  it('default: shows 资源管理器 | Git | 终端 | 工具详情 with the editor selected', () => {
    const { view } = bench()
    expect(tabLabels(view)).toEqual(['资源管理器', 'Git面板', '终端', '工具详情'])
    expect(selectedTab(view)).toBe('资源管理器')
    expect(view.getByTestId('editor-surface-seat').getAttribute('data-visible')).toBe('true')
    expect(view.getByTestId('git-panel-seat').getAttribute('data-visible')).toBe('false')
    expect(view.getByTestId('terminal-seat').getAttribute('data-visible')).toBe('false')
    expect(panels(view)[1]!.getAttribute('aria-hidden')).toBe('true')
    expect(panels(view)[2]!.getAttribute('aria-hidden')).toBe('true')
    expect(panels(view)[3]!.getAttribute('aria-hidden')).toBe('true')
  })

  it('tab-selected: selecting 资源管理器 keeps the editor surface visible', () => {
    const { view, chat, openDetails } = bench()
    fireEvent.click(view.getByRole('tab', { name: '资源管理器' }))
    expect(chat.store.getSnapshot().detailsTab).toBe('editor')
    expect(openDetails).toHaveBeenCalledTimes(1)
    expect(selectedTab(view)).toBe('资源管理器')
    expect(view.getByTestId('editor-surface-seat').getAttribute('data-visible')).toBe('true')
    expect(panels(view)[1]!.getAttribute('aria-hidden')).toBe('true')
    expect(panels(view)[2]!.getAttribute('aria-hidden')).toBe('true')
  })

  it('tab-selected: selecting Git shows only the Git panel and opens the toolbox', () => {
    const { view, chat, openDetails } = bench()
    expect(view.getByTestId('git-panel-seat').getAttribute('data-visible')).toBe('false')
    fireEvent.click(view.getByRole('tab', { name: 'Git面板' }))
    expect(chat.store.getSnapshot().detailsTab).toBe('git')
    expect(openDetails).toHaveBeenCalledTimes(1)
    expect(selectedTab(view)).toBe('Git面板')
    expect(view.getByTestId('git-panel-seat')).toBeTruthy()
    expect(view.getByTestId('git-panel-seat').getAttribute('data-visible')).toBe('true')
    expect(view.getByTestId('editor-surface-seat').getAttribute('data-visible')).toBe('false')
    expect(view.getByTestId('terminal-seat').getAttribute('data-visible')).toBe('false')
    expect(panels(view)[0]!.getAttribute('aria-hidden')).toBe('true')
    expect(panels(view)[1]!.getAttribute('aria-hidden')).toBe('false')
    expect(panels(view)[2]!.getAttribute('aria-hidden')).toBe('true')
    expect(panels(view)[3]!.getAttribute('aria-hidden')).toBe('true')
  })

  it('tab-selected-terminal: selecting 终端 renders the human-terminal seat', () => {
    const { view, chat, openDetails } = bench()
    fireEvent.click(view.getByRole('tab', { name: '终端' }))
    expect(chat.store.getSnapshot().detailsTab).toBe('terminal')
    expect(openDetails).toHaveBeenCalledTimes(1)
    expect(selectedTab(view)).toBe('终端')
    expect(view.getByTestId('terminal-seat').getAttribute('data-visible')).toBe('true')
    expect(view.getByTestId('editor-surface-seat').getAttribute('data-visible')).toBe('false')
    expect(view.getByTestId('git-panel-seat').getAttribute('data-visible')).toBe('false')
    expect(panels(view)[2]!.getAttribute('aria-hidden')).toBe('false')
  })

  it('tab-leave-terminal: leaving 终端 hides the seat without unmounting it', () => {
    const { view, chat } = bench()
    fireEvent.click(view.getByRole('tab', { name: '终端' }))
    fireEvent.click(view.getByRole('tab', { name: '资源管理器' }))
    expect(chat.store.getSnapshot().detailsTab).toBe('editor')
    expect(view.getByTestId('terminal-seat')).toBeTruthy()
    expect(view.getByTestId('terminal-seat').getAttribute('data-visible')).toBe('false')
    expect(panels(view)[2]!.getAttribute('aria-hidden')).toBe('true')
  })

  it('tab-selected: switching back to 工具详情 hides the other views without unmounting them', () => {
    const { view, chat } = bench()
    fireEvent.click(view.getByRole('tab', { name: '资源管理器' }))
    fireEvent.click(view.getByRole('tab', { name: '工具详情' }))
    expect(chat.store.getSnapshot().detailsTab).toBe('tool')
    expect(selectedTab(view)).toBe('工具详情')
    expect(view.getByTestId('editor-surface-seat')).toBeTruthy()
    expect(view.getByTestId('git-panel-seat')).toBeTruthy()
    expect(panels(view)[0]!.getAttribute('aria-hidden')).toBe('true')
    expect(panels(view)[1]!.getAttribute('aria-hidden')).toBe('true')
    expect(view.getByText('点击消息流中的工具行查看详情')).toBeTruthy()
  })

  it('tab-leave-git: leaving Git hides the panel and keeps the injected occupant and draft', () => {
    const { view, chat } = bench()
    fireEvent.click(view.getByRole('tab', { name: 'Git面板' }))
    expect((view.getByTestId('git-commit-draft') as HTMLTextAreaElement).value).toBe('wip message')
    fireEvent.click(view.getByRole('tab', { name: '资源管理器' }))
    expect(chat.store.getSnapshot().detailsTab).toBe('editor')
    expect(view.getByTestId('git-panel-seat')).toBeTruthy()
    expect((view.getByTestId('git-commit-draft') as HTMLTextAreaElement).value).toBe('wip message')
    expect(panels(view)[1]!.getAttribute('aria-hidden')).toBe('true')
  })

  it('terminal-enter-git-disk-refresh: leaving 终端 for Git bumps segmentDiskRefreshEpoch once', () => {
    let gitEpoch = -1
    const { view } = bench({
      renderSlot: (key, owner) => {
        if (key === 'conversation.details.git') {
          gitEpoch = (owner as unknown as DetailsGitOwnerProps).segmentDiskRefreshEpoch
          return <div data-testid="git-panel-seat" />
        }
        if (key === 'conversation.details.terminal') {
          return <div data-testid="terminal-seat" />
        }
        return null
      },
    })
    fireEvent.click(view.getByRole('tab', { name: '终端' }))
    fireEvent.click(view.getByRole('tab', { name: 'Git面板' }))
    expect(gitEpoch).toBe(1)
  })

  it('terminal-leave-disk-refresh: leaving 终端 bumps segmentDiskRefreshEpoch on Explorer and Git seats', () => {
    let editorEpoch = -1
    let gitEpoch = -1
    const { view, chat } = bench({
      renderSlot: (key, owner) => {
        if (key === 'conversation.details.editor') {
          editorEpoch = (owner as unknown as DetailsEditorOwnerProps).segmentDiskRefreshEpoch
          return <div data-testid="editor-surface-seat" />
        }
        if (key === 'conversation.details.git') {
          gitEpoch = (owner as unknown as DetailsGitOwnerProps).segmentDiskRefreshEpoch
          return <div data-testid="git-panel-seat" />
        }
        if (key === 'conversation.details.terminal') {
          return <div data-testid="terminal-seat" />
        }
        return null
      },
    })
    expect(editorEpoch).toBe(0)
    expect(gitEpoch).toBe(0)
    fireEvent.click(view.getByRole('tab', { name: '终端' }))
    expect(editorEpoch).toBe(0)
    fireEvent.click(view.getByRole('tab', { name: '资源管理器' }))
    expect(chat.store.getSnapshot().detailsTab).toBe('editor')
    expect(editorEpoch).toBe(1)
    expect(gitEpoch).toBe(1)
  })

  it('terminal-stay-no-refresh: staying on 终端 does not bump segmentDiskRefreshEpoch', () => {
    let editorEpoch = -1
    const { view } = bench({
      renderSlot: (key, owner) => {
        if (key === 'conversation.details.editor') {
          editorEpoch = (owner as unknown as DetailsEditorOwnerProps).segmentDiskRefreshEpoch
          return null
        }
        if (key === 'conversation.details.terminal') {
          return <div data-testid="terminal-seat" />
        }
        return null
      },
    })
    fireEvent.click(view.getByRole('tab', { name: '终端' }))
    expect(editorEpoch).toBe(0)
    fireEvent.click(view.getByRole('tab', { name: '终端' }))
    expect(editorEpoch).toBe(0)
  })

  it('git-action-guard: Explorer writes dirty paths and Git reads them', () => {
    const { view } = bench({
      renderSlot: (key, owner) => {
        if (key === 'conversation.details.editor') {
          const editorOwner = owner as unknown as DetailsEditorOwnerProps
          return (
            <>
              <button
                type="button"
                data-testid="publish-dirty"
                onClick={() => { editorOwner.setDirtyPaths(['/w/alpha/README.md']) }}
              />
              <button
                type="button"
                data-testid="publish-dirty-other"
                onClick={() => { editorOwner.setDirtyPaths(['/w/alpha/OTHER.md']) }}
              />
            </>
          )
        }
        if (key === 'conversation.details.git') {
          const gitOwner = owner as unknown as DetailsGitOwnerProps
          return <div data-testid="git-dirty" data-paths={gitOwner.dirtyPaths.join(',')} />
        }
        return null
      },
    })
    expect(view.getByTestId('git-dirty').getAttribute('data-paths')).toBe('')
    fireEvent.click(view.getByTestId('publish-dirty'))
    expect(view.getByTestId('git-dirty').getAttribute('data-paths')).toBe('/w/alpha/README.md')
    fireEvent.click(view.getByTestId('publish-dirty'))
    expect(view.getByTestId('git-dirty').getAttribute('data-paths')).toBe('/w/alpha/README.md')
    fireEvent.click(view.getByTestId('publish-dirty-other'))
    expect(view.getByTestId('git-dirty').getAttribute('data-paths')).toBe('/w/alpha/OTHER.md')
  })
})
