import type { WorkspaceEntry } from '@deepseek-ai/dsh-client-runtime/client'

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
 * Join a parent directory and single-segment child name.
 * @param parent - absolute parent directory.
 * @param name - single path segment.
 * @returns the absolute child path.
 */
export function joinChildPath(parent: string, name: string): string {
  return `${parent}/${name}`
}

/**
 * Whether a name already exists among sibling entries.
 * @param siblings - direct children of the target parent.
 * @param name - candidate single-segment name.
 * @returns true when a sibling uses the same base name.
 */
export function siblingNameExists(
  siblings: readonly WorkspaceEntry[],
  name: string,
): boolean {
  return siblings.some(entry => entry.name === name)
}
