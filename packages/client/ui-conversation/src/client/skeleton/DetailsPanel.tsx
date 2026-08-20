// DetailsPanel: segmented Tool 详情 | 文件编辑器 tabs over the details column
// content seats. Reads selection and tab state from the shared chat store.

import clsx from 'clsx'
import type { DetailsSlotProps } from '../contract/slots.ts'
import { ToolDetailsBody } from './ToolDetailsBody.tsx'
import css from './DetailsPanel.module.css'

/** Full props composed by reference from the contract (automatic shares & injected share). */
export type DetailsPanelProps = DetailsSlotProps

/** Renders the details column shell: segmented tabs, close control, and tab bodies. */
export function DetailsPanel({
  useStore, actions, renderSlot, openDetails, closeDetails, t, ...toolBodyProps
}: DetailsPanelProps) {
  const detailsTab = useStore(s => s.detailsTab ?? 'tool')

  return (
    <div className={css.root}>
      <div className={css.header}>
        <div className={css.tabBar} role="tablist" aria-label={t('details.tablist')}>
          <button
            type="button"
            role="tab"
            aria-selected={detailsTab === 'tool'}
            className={clsx(css.tab, detailsTab === 'tool' && css.tabActive)}
            onClick={() => { actions.setDetailsTab('tool') }}
          >
            {t('details.tab.tool')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={detailsTab === 'editor'}
            className={clsx(css.tab, detailsTab === 'editor' && css.tabActive)}
            onClick={() => {
              actions.setDetailsTab('editor')
              openDetails()
            }}
          >
            {t('details.tab.editor')}
          </button>
        </div>
        <button
          type="button" className={css.close} aria-label={t('details.close')}
          onClick={() => { closeDetails() }}
        >
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden>
            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      <div className={css.body} role="tabpanel">
        {detailsTab === 'editor'
          ? renderSlot('conversation.details.editor', {})
          : (
            <ToolDetailsBody
              useStore={useStore}
              renderSlot={renderSlot}
              t={t}
              {...toolBodyProps}
            />
          )}
      </div>
    </div>
  )
}
