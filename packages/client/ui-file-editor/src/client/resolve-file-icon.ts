/** Resolve Material Icon Theme SVG URLs for file-tree rows. */

import { getMaterialIconCdnUrl } from 'material-icon-resolver'
import type { WorkspaceEntry } from '@deepseek-ai/dsh-client-runtime/client'
import { FILE_ICON_BASE_URL } from './file-icon-base.ts'
import { languageForPath } from './open-kind.ts'

/**
 * Local SVG URL for a workspace tree entry.
 * @param entry - Host-owned tree row.
 * @param expanded - True when a directory row is expanded.
 * @returns an absolute web path under {@link FILE_ICON_BASE_URL}.
 */
export function fileIconUrlForEntry(entry: WorkspaceEntry, expanded: boolean): string {
  const fallback = entry.isDirectory ? 'folder.svg' : 'file.svg'
  const options = entry.isDirectory
    ? {
      type: 'folder' as const,
      open: expanded,
      baseUrl: FILE_ICON_BASE_URL,
    }
    : {
      type: 'file' as const,
      open: expanded,
      baseUrl: FILE_ICON_BASE_URL,
      languageId: languageForPath(entry.path),
    }
  const url = getMaterialIconCdnUrl(entry.name, options)
  return url ?? `${FILE_ICON_BASE_URL}/${fallback}`
}
