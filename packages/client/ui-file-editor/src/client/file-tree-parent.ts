import type { WorkspaceEntry } from '@deepseek-ai/dsh-client-runtime/client'

/**
 * Resolve the parent directory that lists {@link path} as a direct child.
 * @param workspaceRoot - bound Workspace root path.
 * @param path - Host-absolute file or directory path under the root.
 * @returns the absolute parent directory whose listing includes {@link path}.
 */
export function parentDirectoryOfPath(workspaceRoot: string, path: string): string {
  const normalizedRoot = workspaceRoot.replace(/[/\\]+$/, '')
  if (path === normalizedRoot) return normalizedRoot
  const slash = path.lastIndexOf('/')
  if (slash < 0) return normalizedRoot
  const parent = path.slice(0, slash)
  return parent.length >= normalizedRoot.length ? parent : normalizedRoot
}

/**
 * Resolve the parent directory that lists {@link entry} as a direct child.
 * @param workspaceRoot - bound Workspace root path.
 * @param entry - tree entry being renamed or deleted.
 * @returns the absolute parent directory whose listing includes {@link entry}.
 */
export function parentDirectoryOfEntry(
  workspaceRoot: string,
  entry: WorkspaceEntry,
): string {
  return parentDirectoryOfPath(workspaceRoot, entry.path)
}

/**
 * Whether {@link candidatePath} is a directory path inside or equal to {@link directoryPath}.
 * @param directoryPath - Host-absolute directory path.
 * @param candidatePath - Host-absolute path to test.
 */
export function isPathInDirectorySubtree(directoryPath: string, candidatePath: string): boolean {
  const normalized = directoryPath.replace(/[/\\]+$/, '')
  return candidatePath === normalized || candidatePath.startsWith(`${normalized}/`)
}

/**
 * Host-absolute path after renaming a file or directory.
 * Descendant paths keep their trailing segments under the new prefix.
 * @param renamedOldPath - Host-absolute path before rename.
 * @param renamedNewPath - Host-absolute path after rename.
 * @param path - Host-absolute path to remap.
 * @returns {@link path} unchanged when outside the renamed subtree.
 */
export function remapPathAfterRename(
  renamedOldPath: string,
  renamedNewPath: string,
  path: string,
): string {
  const normalizedOld = renamedOldPath.replace(/[/\\]+$/, '')
  const normalizedNew = renamedNewPath.replace(/[/\\]+$/, '')
  if (path === normalizedOld) return normalizedNew
  if (path.startsWith(`${normalizedOld}/`)) {
    return `${normalizedNew}${path.slice(normalizedOld.length)}`
  }
  return path
}

/**
 * Resolve the parent directory for a toolbar create operation.
 * @param workspaceRoot - bound Workspace root path.
 * @param selected - currently selected tree entry, if any.
 * @returns the absolute directory that should receive a new child.
 */
export function parentDirectoryForCreate(
  workspaceRoot: string,
  selected: WorkspaceEntry | undefined,
): string {
  if (selected === undefined) return workspaceRoot
  if (selected.isDirectory) return selected.path
  const slash = selected.path.lastIndexOf('/')
  return slash >= 0 ? selected.path.slice(0, slash) : workspaceRoot
}

/**
 * Base name of a Host-absolute path.
 * @param path - file or directory path.
 * @returns the last path segment.
 */
export function baseNameOfPath(path: string): string {
  const normalized = path.replace(/[/\\]+$/, '')
  const slash = Math.max(normalized.lastIndexOf('/'), normalized.lastIndexOf('\\'))
  return slash >= 0 ? normalized.slice(slash + 1) : normalized
}

/** Drop target for a file-tree drag move. */
export type TreeDropTarget =
  | { kind: 'root' }
  | { kind: 'directory'; path: string }
  | { kind: 'file'; path: string }

/**
 * Resolve the destination directory for a tree drag-and-drop move.
 * Files, the source itself, the source's current parent, and descendants of a
 * dragged directory are not valid destinations.
 * @param workspaceRoot - bound Workspace root path.
 * @param sourcePath - Host-absolute path being dragged.
 * @param drop - row or blank-area drop target.
 * @returns the destination directory, or null when the drop must be ignored.
 */
export function destinationDirectoryForTreeDrop(
  workspaceRoot: string,
  sourcePath: string,
  drop: TreeDropTarget,
): string | null {
  if (drop.kind === 'file') return null
  const normalizedRoot = workspaceRoot.replace(/[/\\]+$/, '')
  const normalizedSource = sourcePath.replace(/[/\\]+$/, '')
  const destRaw = drop.kind === 'root' ? workspaceRoot : drop.path
  const dest = destRaw.replace(/[/\\]+$/, '')
  if (dest === normalizedSource) return null
  if (dest.startsWith(`${normalizedSource}/`) || dest.startsWith(`${normalizedSource}\\`)) return null
  const currentParent = parentDirectoryOfPath(workspaceRoot, sourcePath).replace(/[/\\]+$/, '')
  if (dest === currentParent) return null
  if (
    dest !== normalizedRoot
    && !dest.startsWith(`${normalizedRoot}/`)
    && !dest.startsWith(`${normalizedRoot}\\`)
  ) {
    return null
  }
  return dest
}

/**
 * Join a parent directory and single-segment child name.
 * @param parent - absolute parent directory.
 * @param name - single path segment.
 * @returns the absolute child path.
 */
export function joinChildPath(parent: string, name: string): string {
  return `${parent}/${name}`
}

/**
 * Whether a name already exists among sibling entries of the same kind.
 * @param siblings - direct children of the target parent.
 * @param name - candidate single-segment name.
 * @param isDirectory - whether the candidate is a directory.
 * @returns true when a same-kind sibling uses the same base name.
 */
export function siblingKindNameExists(
  siblings: readonly WorkspaceEntry[],
  name: string,
  isDirectory: boolean,
): boolean {
  return siblings.some(entry => entry.name === name && entry.isDirectory === isDirectory)
}

/** Locale key for a sibling name collision in the name dialog. */
export type SiblingNameConflictKey = 'editor.error.fileNameConflict' | 'editor.error.folderNameConflict'

/**
 * Resolve the name-dialog field error key for a candidate sibling name.
 * @param siblings - direct children of the target parent.
 * @param name - candidate single-segment name.
 * @param isDirectory - whether the candidate is a directory.
 * @returns a locale key when the name cannot be used, otherwise null.
 */
export function siblingNameConflictKey(
  siblings: readonly WorkspaceEntry[],
  name: string,
  isDirectory: boolean,
): SiblingNameConflictKey | null {
  if (siblingKindNameExists(siblings, name, isDirectory)) {
    return isDirectory ? 'editor.error.folderNameConflict' : 'editor.error.fileNameConflict'
  }
  if (!isDirectory && siblings.some(entry => entry.name === name && entry.isDirectory)) {
    return 'editor.error.folderNameConflict'
  }
  if (isDirectory && siblings.some(entry => entry.name === name && !entry.isDirectory)) {
    return 'editor.error.fileNameConflict'
  }
  return null
}

/**
 * Directory paths from the workspace root down to the parent of a file.
 * @param workspaceRoot - bound Workspace root path.
 * @param filePath - Host-absolute file path under the root.
 * @returns ordered directory paths to expand so the file row can appear.
 */
export function directoryChainToFile(workspaceRoot: string, filePath: string): readonly string[] {
  const normalizedRoot = workspaceRoot.replace(/[/\\]+$/, '')
  if (filePath === normalizedRoot) return [normalizedRoot]
  const prefix = `${normalizedRoot}/`
  if (!filePath.startsWith(prefix)) return []
  const relative = filePath.slice(prefix.length)
  const parts = relative.split(/[/\\]/).filter(part => part !== '')
  if (parts.length <= 1) return [normalizedRoot]
  const dirs = [normalizedRoot]
  let current = normalizedRoot
  for (let index = 0; index < parts.length - 1; index += 1) {
    const segment = parts[index]
    if (segment === undefined) continue
    current = joinChildPath(current, segment)
    dirs.push(current)
  }
  return dirs
}
