import { describe, expect, it } from 'vitest'
import type { WorkspaceId } from '@deepseek-ai/dsh-client-runtime/client'
import { createTerminalPanelStore, terminalWorkspaceState } from '../src/client/stores.ts'

const WID = 'ws1' as WorkspaceId

describe('terminal panel store', () => {
  it('partitions tabs by workspace and restores selection', () => {
    const store = createTerminalPanelStore().create()
    store.actions.setWorkspaceTabs(WID, [{ sessionId: 'a', title: 'A', profileId: 'zsh' }])
    expect(terminalWorkspaceState(store.getSnapshot(), WID).selectedSessionId).toBe('a')
    store.actions.setSelectedSession(WID, 'a')
    store.actions.setConnecting(WID, true)
    expect(terminalWorkspaceState(store.getSnapshot(), WID).connecting).toBe(true)
    store.actions.updateTabTitle(WID, 'a', 'renamed')
    expect(terminalWorkspaceState(store.getSnapshot(), WID).tabs[0]?.title).toBe('renamed')
  })

  it('upserts tabs and preserves an explicit selection', () => {
    const store = createTerminalPanelStore().create()
    store.actions.upsertTab(WID, { sessionId: 'one', title: 'one', profileId: 'zsh' })
    store.actions.setSelectedSession(WID, 'one')
    store.actions.upsertTab(WID, { sessionId: 'two', title: 'two', profileId: 'bash' })
    const state = terminalWorkspaceState(store.getSnapshot(), WID)
    expect(state.tabs).toHaveLength(2)
    expect(state.selectedSessionId).toBe('one')
    store.actions.upsertTab(WID, { sessionId: 'one', title: 'one-updated', profileId: 'zsh' })
    expect(terminalWorkspaceState(store.getSnapshot(), WID).tabs[0]?.title).toBe('one-updated')
    store.actions.updateTabTitle(WID, 'missing', 'ignored')
    expect(terminalWorkspaceState(store.getSnapshot(), WID).tabs[0]?.title).toBe('one-updated')
  })
})
