/** Resolve Material Icon Theme SVG URLs for Git panel change rows. */

import { getMaterialIconCdnUrl } from 'material-icon-resolver'

/** URL prefix for Material Icon Theme SVGs copied into the web frontend public dir. */
export const FILE_ICON_BASE_URL = '/material-icons'

/**
 * Last path segment of a repository-relative or Host-absolute path.
 * @param path - POSIX or Windows path.
 * @returns the file name, or the original path when it has no separator.
 */
export function fileNameOf(path: string): string {
  const parts = path.split(/[/\\]/)
  return parts[parts.length - 1] || path
}

/**
 * Local SVG URL for a working-tree change path.
 * @param path - path relative to the Git repository root.
 * @returns an absolute web path under {@link FILE_ICON_BASE_URL}.
 */
export function fileIconUrlForPath(path: string): string {
  const name = fileNameOf(path)
  const url = name === ''
    ? undefined
    : getMaterialIconCdnUrl(name, { type: 'file', open: false, baseUrl: FILE_ICON_BASE_URL })
  return url ?? `${FILE_ICON_BASE_URL}/file.svg`
}
