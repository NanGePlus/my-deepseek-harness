/**
 * host.watchPath: per-file external change notifications inside a Workspace root.
 */

import { watch, type FSWatcher } from 'node:fs'
import { resolve } from 'node:path'
import type { WatchPathFrame } from './api/host.ts'
import {
  pathWithinWorkspace,
  WorkspacePathOutOfBoundsError,
} from './list-workspace-entries.ts'

/** Injectable watch factory for host integration tests. */
export interface WatchPathInternals {
  watch?: typeof watch
}

/**
 * True when an fs.watch event type can signal content changed on the watched path.
 * @param eventType - Node fs.watch event name.
 */
function isContentChangeEvent(eventType: string): boolean {
  return eventType === 'change' || eventType === 'rename'
}

/**
 * Stream external disk changes for one path inside a Workspace root until `signal` aborts.
 * Uses Node `fs.watch` on the single target path; does not recurse the Workspace root.
 * @param workspaceRoot - canonical bound Workspace directory.
 * @param path - absolute file path; must lie within the root.
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
    watcher = watchFn(target, (eventType) => {
      if (isContentChangeEvent(eventType)) {
        push({ type: 'host/path-changed', path: target })
      }
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
