/**
 * host.watchPath: per-file external change notifications inside a Workspace root.
 */

import { statSync, watch, type FSWatcher } from 'node:fs'
import { basename, dirname, resolve } from 'node:path'
import type { WatchPathFrame } from './api/host.ts'
import {
  pathWithinWorkspace,
  WorkspacePathOutOfBoundsError,
} from './list-workspace-entries.ts'

/** Injectable watch factory for host integration tests. */
export interface WatchPathInternals {
  watch?: typeof watch
}

/** Directory to `fs.watch` and optional child-name filter for a bound path. */
export interface WatchLocation {
  /** Absolute directory Node watches; the target file's parent, or the target itself when it is a directory. */
  watchRoot: string
  /** Basename that must match `filename` for a file target; omitted for directory targets. */
  filterName: string | undefined
}

/**
 * True when an fs.watch event type can signal content changed on the watched path.
 * @param eventType - Node fs.watch event name.
 */
function isContentChangeEvent(eventType: string): boolean {
  return eventType === 'change' || eventType === 'rename'
}

/**
 * Choose the `fs.watch` root so atomic publish (temp + rename) does not drop the subscription.
 * File targets watch the parent directory and filter by basename; directory targets watch themselves.
 * @param target - resolved absolute path inside the Workspace.
 * @returns watch root and optional filename filter.
 */
export function watchLocationForPath(target: string): WatchLocation {
  try {
    if (statSync(target).isDirectory()) {
      return { watchRoot: target, filterName: undefined }
    }
  } catch {
    // Missing path: still watch the parent so a later create/replace is visible.
  }
  return { watchRoot: dirname(target), filterName: basename(target) }
}

/**
 * True when a directory-watch `filename` belongs to the subscribed file.
 * @param filterName - basename of the file target; `undefined` accepts every child.
 * @param filename - name Node reported for the event; omitted on some platforms and in tests.
 */
function filenameMatchesFilter(
  filterName: string | undefined,
  filename: string | Buffer | null | undefined,
): boolean {
  if (filterName === undefined) return true
  if (filename == null) return true
  const name = typeof filename === 'string' ? filename : filename.toString()
  return name === filterName
}

/**
 * Stream external disk changes for one path inside a Workspace root until `signal` aborts.
 * File targets use `fs.watch` on the parent directory (filtered by basename) so a same-directory
 * atomic rename keeps delivering events; directory targets watch themselves. Does not recurse
 * the Workspace root.
 * @param workspaceRoot - canonical bound Workspace directory.
 * @param path - absolute file or directory path; must lie within the root.
 * @param signal - caller lifetime; abort ends the stream and closes the watcher.
 * @param internals - optional watch injection for tests.
 */
export async function* watchWorkspacePath(
  workspaceRoot: string,
  path: string,
  signal: AbortSignal,
  internals: WatchPathInternals = {},
): AsyncGenerator<WatchPathFrame> {
  const watchFn = internals.watch ?? watch
  const target = resolve(path)
  if (!pathWithinWorkspace(workspaceRoot, target)) {
    throw new WorkspacePathOutOfBoundsError(workspaceRoot, target)
  }
  const { watchRoot, filterName } = watchLocationForPath(target)

  const queue: WatchPathFrame[] = []
  let notify: (() => void) | undefined
  let closed = false

  const push = (frame: WatchPathFrame): void => {
    if (closed || signal.aborted) return
    queue.push(frame)
    notify?.()
  }

  let watcher: FSWatcher | undefined
  try {
    watcher = watchFn(watchRoot, (eventType, filename) => {
      if (!isContentChangeEvent(eventType)) return
      if (!filenameMatchesFilter(filterName, filename)) return
      push({ type: 'host/path-changed', path: target })
    })
    watcher.on('error', (error) => {
      push({
        type: 'stream/error',
        error: {
          code: 'internal',
          message: error instanceof Error ? error.message : String(error),
          details: {},
        },
      })
      closed = true
      notify?.()
    })
  } catch (error: unknown) {
    yield {
      type: 'stream/error',
      error: {
        code: 'internal',
        message: error instanceof Error ? error.message : String(error),
        details: {},
      },
    }
    return
  }

  const onAbort = (): void => {
    closed = true
    watcher?.close()
    notify?.()
  }
  signal.addEventListener('abort', onAbort, { once: true })

  try {
    while (!closed && !signal.aborted) {
      while (queue.length > 0) {
        yield queue.shift() as WatchPathFrame
      }
      if (closed || signal.aborted) return
      await new Promise<void>((resolveWait) => { notify = resolveWait })
      notify = undefined
    }
  } finally {
    signal.removeEventListener('abort', onAbort)
    closed = true
    watcher?.close()
  }
}
