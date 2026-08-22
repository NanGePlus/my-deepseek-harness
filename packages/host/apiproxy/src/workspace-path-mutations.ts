/**
 * host.deletePath / host.renamePath / host.createWorkspaceDirectory:
 * bounded path mutations inside a Workspace root.
 */

import { mkdir, rename, rm, stat } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import {
  pathWithinWorkspace,
  WorkspacePathOutOfBoundsError,
} from './list-workspace-entries.ts'

/** Injectable filesystem steps for host integration tests. */
export interface WorkspacePathMutationInternals {
  stat?: (path: string) => ReturnType<typeof stat>
  mkdir?: (...args: Parameters<typeof mkdir>) => ReturnType<typeof mkdir>
  rename?: (...args: Parameters<typeof rename>) => ReturnType<typeof rename>
  rm?: (...args: Parameters<typeof rm>) => ReturnType<typeof rm>
}

/** Shared success shape for delete, rename, and workspace directory creation. */
export interface PathMutationResult {
  /** Absolute host path affected by the mutation. */
  path: string
}

/** A path inside a Workspace was not found on disk. */
export class WorkspacePathNotFoundError extends Error {
  constructor(readonly path: string) {
    super(`path not found: ${path}`)
    this.name = 'WorkspacePathNotFoundError'
  }
}

/** A path inside a Workspace could not be deleted. */
export class WorkspacePathDeleteFailedError extends Error {
  constructor(readonly path: string, cause: string) {
    super(`cannot delete ${path}: ${cause}`)
    this.name = 'WorkspacePathDeleteFailedError'
  }
}

/** A path inside a Workspace could not be renamed. */
export class WorkspacePathRenameFailedError extends Error {
  constructor(readonly path: string, cause: string) {
    super(`cannot rename ${path}: ${cause}`)
    this.name = 'WorkspacePathRenameFailedError'
  }
}

/** A child directory inside a Workspace already exists. */
export class WorkspaceDirectoryExistsError extends Error {
  constructor(readonly path: string) {
    super(`directory already exists: ${path}`)
    this.name = 'WorkspaceDirectoryExistsError'
  }
}

/** A child directory inside a Workspace could not be created. */
export class WorkspaceDirectoryCreateFailedError extends Error {
  constructor(readonly path: string, cause: string) {
    super(`cannot create directory ${path}: ${cause}`)
    this.name = 'WorkspaceDirectoryCreateFailedError'
  }
}

function isEnoent(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT'
}

function isEexist(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'EEXIST'
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/**
 * Validate a single non-blank path segment for rename or directory creation.
 * @param name - candidate segment name.
 * @returns whether the segment is one valid child name.
 */
export function isSinglePathSegment(name: string): boolean {
  return name.trim() !== '' && name !== '.' && name !== '..' && !/[/\\]/.test(name)
}

/**
 * Resolve one path and require it to stay within the Workspace root.
 * @param workspaceRoot - canonical bound Workspace directory.
 * @param path - absolute path candidate.
 * @returns the resolved absolute path.
 */
function resolveWithinWorkspace(workspaceRoot: string, path: string): string {
  const target = resolve(path)
  if (!pathWithinWorkspace(workspaceRoot, target)) {
    throw new WorkspacePathOutOfBoundsError(workspaceRoot, target)
  }
  return target
}

/**
 * Delete one file or directory tree inside a Workspace root.
 * @param workspaceRoot - canonical bound Workspace directory.
 * @param path - absolute path to delete; must lie within the root.
 * @param signal - caller lifetime forwarded to filesystem I/O.
 * @returns the deleted absolute path.
 */
export async function deleteWorkspacePath(
  workspaceRoot: string,
  path: string,
  signal?: AbortSignal,
  internals: WorkspacePathMutationInternals = {},
): Promise<PathMutationResult> {
  const rmFn = internals.rm ?? rm
  const statFn = internals.stat ?? stat
  const target = resolveWithinWorkspace(workspaceRoot, path)
  try {
    await statFn(target)
  } catch (error: unknown) {
    if (isEnoent(error)) throw new WorkspacePathNotFoundError(target)
    throw new WorkspacePathDeleteFailedError(target, messageOf(error))
  }
  signal?.throwIfAborted()
  try {
    await rmFn(target, { recursive: true, force: false })
    return { path: target }
  } catch (error: unknown) {
    signal?.throwIfAborted()
    if (isEnoent(error)) throw new WorkspacePathNotFoundError(target)
    throw new WorkspacePathDeleteFailedError(target, messageOf(error))
  }
}

/**
 * Rename one file or directory within the same parent directory inside a Workspace root.
 * @param workspaceRoot - canonical bound Workspace directory.
 * @param path - absolute source path; must lie within the root.
 * @param newName - single-segment new base name within the same parent directory.
 * @param signal - caller lifetime forwarded to filesystem I/O.
 * @returns the renamed absolute path.
 */
export async function renameWorkspacePath(
  workspaceRoot: string,
  path: string,
  newName: string,
  signal?: AbortSignal,
  internals: WorkspacePathMutationInternals = {},
): Promise<PathMutationResult> {
  const statFn = internals.stat ?? stat
  const renameFn = internals.rename ?? rename
  const source = resolveWithinWorkspace(workspaceRoot, path)
  if (!isSinglePathSegment(newName)) {
    throw new WorkspacePathRenameFailedError(source, `"${newName}" is not a single path segment`)
  }
  const target = resolveWithinWorkspace(workspaceRoot, join(dirname(source), newName))
  let sourceIsDirectory: boolean
  try {
    sourceIsDirectory = (await statFn(source)).isDirectory()
  } catch (error: unknown) {
    if (isEnoent(error)) throw new WorkspacePathNotFoundError(source)
    throw new WorkspacePathRenameFailedError(source, messageOf(error))
  }
  try {
    const targetStat = await statFn(target)
    if (targetStat.isDirectory() === sourceIsDirectory) {
      throw new WorkspaceDirectoryExistsError(target)
    }
    throw new WorkspacePathRenameFailedError(
      source,
      'a file and folder cannot share the same path',
    )
  } catch (error: unknown) {
    if (error instanceof WorkspaceDirectoryExistsError) throw error
    if (error instanceof WorkspacePathRenameFailedError) throw error
    if (!isEnoent(error)) throw new WorkspacePathRenameFailedError(source, messageOf(error))
  }
  signal?.throwIfAborted()
  try {
    await renameFn(source, target)
    return { path: target }
  } catch (error: unknown) {
    signal?.throwIfAborted()
    if (isEnoent(error)) throw new WorkspacePathNotFoundError(source)
    if (isEexist(error)) throw new WorkspaceDirectoryExistsError(target)
    throw new WorkspacePathRenameFailedError(source, messageOf(error))
  }
}

/**
 * Create one child directory under an existing parent inside a Workspace root.
 * @param workspaceRoot - canonical bound Workspace directory.
 * @param path - absolute existing parent directory; must lie within the root.
 * @param name - single non-blank path segment for the new directory.
 * @param signal - caller lifetime forwarded to filesystem I/O.
 * @returns the created directory's absolute path.
 */
export async function createWorkspaceDirectory(
  workspaceRoot: string,
  path: string,
  name: string,
  signal?: AbortSignal,
  internals: WorkspacePathMutationInternals = {},
): Promise<PathMutationResult> {
  const mkdirFn = internals.mkdir ?? mkdir
  const statFn = internals.stat ?? stat
  const parent = resolveWithinWorkspace(workspaceRoot, path)
  if (!isSinglePathSegment(name)) {
    throw new WorkspaceDirectoryCreateFailedError(join(parent, name), `"${name}" is not a single path segment`)
  }
  const target = resolveWithinWorkspace(workspaceRoot, join(parent, name))
  signal?.throwIfAborted()
  try {
    await mkdirFn(target)
    return { path: target }
  } catch (error: unknown) {
    signal?.throwIfAborted()
    if (isEexist(error)) {
      try {
        const existing = await statFn(target)
        if (existing.isDirectory()) throw new WorkspaceDirectoryExistsError(target)
        throw new WorkspaceDirectoryCreateFailedError(target, 'a file already exists at this path')
      } catch (statError: unknown) {
        if (statError instanceof WorkspaceDirectoryExistsError) throw statError
        if (statError instanceof WorkspaceDirectoryCreateFailedError) throw statError
        throw new WorkspaceDirectoryExistsError(target)
      }
    }
    throw new WorkspaceDirectoryCreateFailedError(target, messageOf(error))
  }
}
