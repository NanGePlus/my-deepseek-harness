// DetailsPanel: segmented 资源管理器 | Git | 工具详情 tabs over the details
// column content seats. Reads selection and tab state from the current
// session chat store. Leaving a tab hides its panel and does not unmount it.

import clsx from 'clsx'
import type { DetailsSlotProps } from '../contract/slots.ts'
import { ToolDetailsBody } from './ToolDetailsBody.tsx'
import css from './DetailsPanel.module.css'

/** Full props composed by reference from the contract (automatic shares & injected share). */
export type DetailsPanelProps = DetailsSlotProps

const SEGMENTS = [
  { id: 'editor', label: 'details.tab.editor', opens: true },
  { id: 'git', label: 'details.tab.git', opens: true },
  { id: 'tool', label: 'details.tab.tool', opens: false },
] as const

/** Renders the details column shell: segmented tabs and tab bodies. */
export function DetailsPanel({
  useSessions, renderSlot, openDetails, t,
  useChat, useConversation,
}: DetailsPanelProps) {
  const detailsTab = useChat(binding => binding.state.detailsTab)
  const chatActions = useChat(binding => binding.actions)
  const boundSessionId = useChat(binding => binding.sessionId)
  const currentSessionId = useSessions(list => list.current)
  const sessionId = boundSessionId ?? currentSessionId
  const flushBody = detailsTab === 'editor' || detailsTab === 'git'

  return (
    <div className={css.root}>
      <div className={css.header}>
        <div className={css.tabBar} role="tablist" aria-label={t('details.tablist')}>
          {SEGMENTS.map(segment => (
            <button
              key={segment.id}
              type="button"
              role="tab"
              aria-selected={detailsTab === segment.id}
              className={clsx(css.tab, detailsTab === segment.id && css.tabActive)}
              onClick={() => {
                chatActions.setDetailsTab(segment.id)
                if (segment.opens) openDetails()
              }}
            >
              {t(segment.label)}
            </button>
          ))}
        </div>
      </div>
      <div className={clsx(css.body, flushBody && css.bodyFlush)}>
        <div
          className={clsx(css.tabPanel, detailsTab !== 'editor' && css.tabPanelHidden)}
          role="tabpanel"
          aria-hidden={detailsTab !== 'editor'}
        >
          {renderSlot('conversation.details.editor', {})}
        </div>
        <div
          className={clsx(css.tabPanel, detailsTab !== 'git' && css.tabPanelHidden)}
          role="tabpanel"
          aria-hidden={detailsTab !== 'git'}
        >
          {renderSlot('conversation.details.git', { visible: detailsTab === 'git' })}
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
