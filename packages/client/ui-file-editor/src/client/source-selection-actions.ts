/** Shared Add to Chat toolbar actions for Monaco source selections. */

import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { MonacoSourceSelectionActions } from './MonacoEditor.tsx'

/**
 * Build Monaco source-selection toolbar actions for Add to Chat.
 * @param t - localized copy.
 * @param variant - Markdown source uses a distinct toolbar label.
 * @param onAddToChat - insert callback for the current line range.
 */
export function sourceSelectionActionsFor(
  t: TranslateNS<'fileEditor'>,
  variant: 'markdown' | 'code',
  onAddToChat: (range: { startLine: number; endLine: number }) => void,
): MonacoSourceSelectionActions {
  return {
    toolbarLabel: variant === 'markdown'
      ? t('editor.markdown.sourceSelection.toolbar')
      : t('editor.sourceSelection.toolbar'),
    addToChatLabel: t('editor.sourceSelection.addToChat'),
    onAddToChat,
  }
}
