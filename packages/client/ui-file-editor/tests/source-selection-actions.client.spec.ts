import { describe, expect, it, vi } from 'vitest'
import { sourceSelectionActionsFor } from '../src/client/source-selection-actions.ts'

describe('sourceSelectionActionsFor', () => {
  const t = vi.fn((key: string) => key)

  it('uses the code toolbar label for non-markdown editors', () => {
    const onAddToChat = vi.fn()
    expect(sourceSelectionActionsFor(t, 'code', onAddToChat)).toEqual({
      toolbarLabel: 'editor.sourceSelection.toolbar',
      addToChatLabel: 'editor.sourceSelection.addToChat',
      onAddToChat,
    })
  })

  it('uses the markdown toolbar label for markdown source mode', () => {
    const onAddToChat = vi.fn()
    expect(sourceSelectionActionsFor(t, 'markdown', onAddToChat)).toEqual({
      toolbarLabel: 'editor.markdown.sourceSelection.toolbar',
      addToChatLabel: 'editor.sourceSelection.addToChat',
      onAddToChat,
    })
  })
})
