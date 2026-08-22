/** Session header control: toggle the right details column open or closed. */

import { IconPanelLeftOutline16, Tooltip } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { DetailsOpenSource } from '@deepseek-ai/dsh-client-ui-layout/client'
import type { NS } from '../locales.ts'
import css from './DetailsPanelToggle.module.css'

/** Injected layout actions and details-open observable for the header toggle. */
export interface DetailsPanelToggleInjected {
  toggleDetails: () => void
  hooks: { detailsOpen: DetailsOpenSource }
}

/** Full props for the details-panel header toggle button. */
export type DetailsPanelToggleProps =
  PropsRuntime<'conversation.session.header.utilities'>
  & PropsLocale<typeof NS>
  & InjectFace<DetailsPanelToggleInjected>

/**
 * Labeled capsule toggle in the session header utilities row.
 * @param props - layout toggle action, open-state hook, and localized labels.
 */
export function DetailsPanelToggle({
  toggleDetails, useDetailsOpen, t,
}: DetailsPanelToggleProps) {
  const open = useDetailsOpen(open => open)
  const actionLabel = open ? t('details.toggle.close') : t('details.toggle.open')

  return (
    <Tooltip label={actionLabel} side="bottom" delayMs={500}>
      <button
        type="button"
        className={css.toolboxButton}
        aria-label={actionLabel}
        aria-pressed={open}
        onClick={() => { toggleDetails() }}
      >
        <IconPanelLeftOutline16 className={css.panelRight} size={12} />
        <span>{t('details.toggle.label')}</span>
      </button>
    </Tooltip>
  )
}
