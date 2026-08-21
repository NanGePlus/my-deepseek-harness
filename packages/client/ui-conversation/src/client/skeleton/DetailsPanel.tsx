// DetailsPanel: segmented Tool 详情 | 文件编辑器 tabs over the details column
// content seats. Reads selection and tab state from the current session chat store.

import clsx from 'clsx'
import type { DetailsSlotProps } from '../contract/slots.ts'
import { ToolDetailsBody } from './ToolDetailsBody.tsx'
import css from './DetailsPanel.module.css'

/** Full props composed by reference from the contract (automatic shares & injected share). */
export type DetailsPanelProps = DetailsSlotProps

/** Renders the details column shell: segmented tabs and tab bodies. */
export function DetailsPanel({
  useSessions, renderSlot, openDetails, t,
  useChat, useConversation,
}: DetailsPanelProps) {
  const detailsTab = useChat(binding => binding.state.detailsTab ?? 'editor')
  const chatActions = useChat(binding => binding.actions)
  const boundSessionId = useChat(binding => binding.sessionId)
  const currentSessionId = useSessions(list => list.current)
  const sessionId = boundSessionId ?? currentSessionId

  return (
    <div className={css.root}>
      <div className={css.header}>
        <div className={css.tabBar} role="tablist" aria-label={t('details.tablist')}>
          <button
            type="button"
            role="tab"
            aria-selected={detailsTab === 'editor'}
            className={clsx(css.tab, detailsTab === 'editor' && css.tabActive)}
            onClick={() => {
              chatActions.setDetailsTab('editor')
              openDetails()
            }}
          >
            {t('details.tab.editor')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={detailsTab === 'tool'}
            className={clsx(css.tab, detailsTab === 'tool' && css.tabActive)}
            onClick={() => { chatActions.setDetailsTab('tool') }}
          >
            {t('details.tab.tool')}
          </button>
        </div>
      </div>
      <div className={clsx(css.body, detailsTab === 'editor' && css.bodyFlush)}>
        <div
          className={clsx(css.tabPanel, detailsTab !== 'editor' && css.tabPanelHidden)}
          role="tabpanel"
          aria-hidden={detailsTab !== 'editor'}
        >
          {renderSlot('conversation.details.editor', {})}
        </div>
        <div
          className={clsx(css.tabPanel, detailsTab !== 'tool' && css.tabPanelHidden)}
          role="tabpanel"
          aria-hidden={detailsTab !== 'tool'}
        >
          <ToolDetailsBody
            useChat={useChat}
            useSession={useConversation}
            useSessions={useSessions}
            sessionId={sessionId}
            renderSlot={renderSlot}
            t={t}
          />
        </div>
      </div>
    </div>
  )
}
