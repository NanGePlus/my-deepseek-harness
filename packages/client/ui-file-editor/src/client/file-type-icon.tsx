/** File-type glyphs for file-tree rows (Material Icon Theme subset, not content thumbnails). */

import type { WorkspaceEntry } from '@deepseek-ai/dsh-client-runtime/client'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import { FILE_ICON_BASE_URL } from './file-icon-base.ts'
import { fileIconUrlForEntry } from './resolve-file-icon.ts'
import css from './file-type-icon.module.css'

/** Props for one file-tree type icon. */
export interface FileTypeIconProps {
  /** The Host-owned tree entry. */
  entry: WorkspaceEntry
  /** True when a directory row is expanded. */
  expanded: boolean
  /** Localized accessible name lookup. */
  t: TranslateNS<'fileEditor'>
}

const FALLBACK_FILE_ICON = `${FILE_ICON_BASE_URL}/file.svg`

/**
 * Render a 16px Material Icon Theme glyph for a file-tree row.
 * @param props - entry, expansion, and copy.
 * @returns an img-role glyph resolved from the entry name and path.
 */
export function FileTypeIcon({ entry, expanded, t }: FileTypeIconProps) {
  const label = entry.isDirectory ? t('editor.tree.icon.folder') : t('editor.tree.icon.file')
  const src = fileIconUrlForEntry(entry, expanded)

  return (
    <span className={css.icon} role="img" aria-label={label}>
      <img
        className={css.glyph}
        src={src}
        width={16}
        height={16}
        alt=""
        decoding="async"
        onError={(event) => {
          const img = event.currentTarget
          if (img.src.endsWith(FALLBACK_FILE_ICON)) return
          img.src = FALLBACK_FILE_ICON
        }}
      />
    </span>
  )
}
