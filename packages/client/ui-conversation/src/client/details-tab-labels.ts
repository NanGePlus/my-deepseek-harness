/**
 * Canonical toolbox segment labels for web and desktop delivery parity.
 * @module @deepseek-ai/dsh-client-ui-conversation/client/details-tab-labels
 */

import { zh } from './locales.ts'

/** Five-segment toolbox tab labels in display order (PRD 功能对等 smoke seam). */
export const DETAILS_TAB_LABELS = [
  zh['details.tab.editor'],
  zh['details.tab.git'],
  zh['details.tab.terminal'],
  zh['details.tab.browser'],
  zh['details.tab.tool'],
] as const
