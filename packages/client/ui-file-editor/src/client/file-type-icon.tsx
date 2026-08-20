/** File-type glyphs for file-tree rows (Material-style subset, not content thumbnails). */

import { IconFolderClose16, IconFolderOpenOutline16 } from '@deepseek-ai/dsh-client-ui-primitives'
import type { WorkspaceEntry } from '@deepseek-ai/dsh-client-runtime/client'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'

/** Props for one file-tree type icon. */
export interface FileTypeIconProps {
  /** The Host-owned tree entry. */
  entry: WorkspaceEntry
  /** True when a directory row is expanded. */
  expanded: boolean
  /** Localized accessible name lookup. */
  t: TranslateNS<'fileEditor'>
}

/**
 * Render a 16px type icon for a file-tree row.
 * @param props - entry, expansion, and copy.
 * @returns an img-role glyph (folder vs generic file).
 */
export function FileTypeIcon({ entry, expanded, t }: FileTypeIconProps) {
  if (entry.isDirectory) {
    const Icon = expanded ? IconFolderOpenOutline16 : IconFolderClose16
    return (
      <span role="img" aria-label={t('editor.tree.icon.folder')}>
        <Icon size={16} />
      </span>
    )
  }
  return (
    <span role="img" aria-label={t('editor.tree.icon.file')}>
      <svg width={16} height={16} viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path
          d="M4.2 1.5h5.1L12.8 5v9.5H4.2V1.5Z"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
        <path d="M9.2 1.6V5h3.5" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      </svg>
    </span>
  )
}
