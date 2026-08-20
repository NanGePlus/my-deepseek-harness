/**
 * host.listWorkspaceEntries: one bounded directory level within a Workspace root.
 */

import { opendir, stat } from 'node:fs/promises'
import { isAbsolute, relative, resolve, sep } from 'node:path'
import type { WorkspaceEntry, WorkspaceEntriesListing } from './api/host.ts'

/** Complete-result bound for one workspace listing level (matches directory-picker browse). */
export const WORKSPACE_LISTING_MAX_ENTRIES = 1000

/** One streamed listing candidate retained only while building the name-sorted window. */
interface ListingCandidate {
  name: string
  isDirectory: boolean
  isSymbolicLink: boolean
}

/**
 * Insert a streamed candidate into the name-sorted bounded window, evicting
 * the name-largest candidate when the window exceeds `keep`.
 * @param window - the name-ascending window, mutated in place.
 * @param candidate - the streamed candidate to place.
 * @param keep - the window bound.
 * @returns true when an eviction happened.
 */
export function boundedInsert(window: ListingCandidate[], candidate: ListingCandidate, keep: number): boolean {
  // oxlint-disable-next-line typescript/no-non-null-assertion -- a full window (length === keep >= 1) has a tail
  if (window.length === keep && candidate.name.localeCompare(window[window.length - 1]!.name) >= 0) return true
  let lo = 0
  let hi = window.length
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    // oxlint-disable-next-line typescript/no-non-null-assertion -- bounded by the loop condition
    if (candidate.name.localeCompare(window[mid]!.name) < 0) hi = mid
    else lo = mid + 1
  }
  window.splice(lo, 0, candidate)
  if (window.length <= keep) return false
  window.pop()
  return true
}

/**
 * True when `target` resolves under `workspaceRoot` inclusive.
 * @param workspaceRoot - canonical Workspace directory.
 * @param target - candidate absolute path.
 * @returns whether the target stays inside the Workspace root.
 */
export function pathWithinWorkspace(workspaceRoot: string, target: string): boolean {
  const rel = relative(resolve(workspaceRoot), resolve(target))
  return rel === '' || (!rel.startsWith(`..${sep}`) && rel !== '..' && !isAbsolute(rel))
}

/** The thrown value as an Error (wire/abort reasons may be anything). */
function asError(reason: unknown): Error {
  return reason instanceof Error ? reason : new Error(String(reason))
}

/** Message text of an unknown thrown value. */
function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/**
 * Await `operation`, but reject with the signal's reason the moment it aborts.
 * @param operation - the in-flight filesystem step.
 * @param signal - caller lifetime; absent means plain awaiting.
 * @returns the operation's value.
 */
function raceAbort<T>(operation: Promise<T>, signal: AbortSignal | undefined): Promise<T> {
  if (signal === undefined) return operation
  return new Promise<T>((resolvePromise, reject) => {
    const onAbort = (): void => {
      operation.catch(() => {
        // Abandoned read: its handle is being closed by the aborting caller.
      })
      reject(asError(signal.reason))
    }
    if (signal.aborted) {
      onAbort()
      return
    }
    signal.addEventListener('abort', onAbort, { once: true })
    operation.then(
      (value) => {
        signal.removeEventListener('abort', onAbort)
        resolvePromise(value)
      },
      (reason: unknown) => {
        signal.removeEventListener('abort', onAbort)
        reject(asError(reason))
      },
    )
  })
}

/* v8 ignore start -- a close failure of an abandoned handle has no consumer. */
function swallowCloseFailure(): void {}
/* v8 ignore stop */

/**
 * One listing row for a dirent; symlinks to directories count as directories.
 * @param parent - listed directory path.
 * @param name - entry base name.
 * @param isDirectory - dirent directory flag.
 * @param isSymbolicLink - dirent symlink flag.
 * @param signal - caller lifetime.
 * @returns the row, or null when a broken symlink cannot be classified.
 */
async function workspaceEntryRow(
  parent: string,
  name: string,
  isDirectory: boolean,
  isSymbolicLink: boolean,
  signal: AbortSignal | undefined,
): Promise<WorkspaceEntry | null> {
  const path = resolve(parent, name)
  let directory = isDirectory
  if (!directory && isSymbolicLink) {
    try {
      directory = (await raceAbort(stat(path), signal)).isDirectory()
    } catch {
      if (signal?.aborted) throw asError(signal.reason)
      directory = false
    }
  }
  return {
    name,
    path,
    isDirectory: directory,
    hidden: name.startsWith('.'),
  }
}

/**
 * List one directory level inside a Workspace root.
 * @param workspaceRoot - absolute Workspace directory.
 * @param path - absolute directory to list; must lie within the root.
 * @param signal - caller lifetime for the directory scan.
 * @returns the listing, or throws when the target is unreadable.
 */
export async function listWorkspaceEntriesLevel(
  workspaceRoot: string,
  path: string,
  signal?: AbortSignal,
): Promise<WorkspaceEntriesListing> {
  const target = resolve(path)
  if (!pathWithinWorkspace(workspaceRoot, target)) {
    throw new WorkspacePathOutOfBoundsError(workspaceRoot, target)
  }

  const keep = WORKSPACE_LISTING_MAX_ENTRIES + 1
  const window: ListingCandidate[] = []
  let evicted = false
  try {
    const opening = opendir(target)
    const level = await raceAbort(opening, signal).catch((error: unknown) => {
      void opening.then(dir => dir.close().catch(swallowCloseFailure), () => {})
      throw error
    })
    try {
      for (;;) {
        const dirent = await raceAbort(level.read(), signal)
        if (dirent === null) break
        const candidate: ListingCandidate = {
          name: dirent.name,
          isDirectory: dirent.isDirectory(),
          isSymbolicLink: dirent.isSymbolicLink(),
        }
        if (boundedInsert(window, candidate, keep)) evicted = true
      }
    } finally {
      const closing = level.close()
      if (signal?.aborted) {
        closing.catch(swallowCloseFailure)
      } else {
        await closing
      }
    }
  } catch (error: unknown) {
    signal?.throwIfAborted()
    if (error instanceof WorkspacePathOutOfBoundsError) throw error
    throw new WorkspaceDirectoryUnreadableError(target, messageOf(error))
  }

  const entries: WorkspaceEntry[] = []
  let truncated = evicted
  for (const candidate of window) {
    signal?.throwIfAborted()
    const row = await workspaceEntryRow(
      target, candidate.name, candidate.isDirectory, candidate.isSymbolicLink, signal,
    )
    if (row === null) continue
    if (entries.length === WORKSPACE_LISTING_MAX_ENTRIES) {
      truncated = true
      break
    }
    entries.push(row)
  }
  return { path: target, entries, truncated }
}

/** A requested path lies outside its Workspace root. */
export class WorkspacePathOutOfBoundsError extends Error {
  constructor(readonly workspaceRoot: string, readonly path: string) {
    super(`path "${path}" is outside workspace root "${workspaceRoot}"`)
    this.name = 'WorkspacePathOutOfBoundsError'
  }
}

/** A directory inside a Workspace could not be read. */
export class WorkspaceDirectoryUnreadableError extends Error {
  constructor(readonly path: string, cause: string) {
    super(`cannot list ${path}: ${cause}`)
    this.name = 'WorkspaceDirectoryUnreadableError'
  }
}
