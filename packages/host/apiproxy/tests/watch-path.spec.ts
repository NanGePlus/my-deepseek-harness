import { mkdtempSync, renameSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { watchLocationForPath, watchWorkspacePath } from '../src/watch-path.ts'
import { WorkspacePathOutOfBoundsError } from '../src/list-workspace-entries.ts'

function atomicReplace(path: string, text: string): void {
  const staging = `${path}.${process.pid}.tmp`
  writeFileSync(staging, text)
  renameSync(staging, path)
}

async function nextChanged(
  stream: AsyncGenerator<{ type: string; path?: string }>,
  mutate: () => void,
  timeoutMs = 4000,
): Promise<{ type: string; path?: string }> {
  const pending = new Promise<{ type: string; path?: string }>((resolve, reject) => {
    const timer = setTimeout(() => { reject(new Error('timed out waiting for host/path-changed')) }, timeoutMs)
    void (async () => {
      try {
        while (true) {
          const next = await stream.next()
          if (next.done === true) {
            clearTimeout(timer)
            reject(new Error('watch stream ended before host/path-changed'))
            return
          }
          if (next.value.type === 'host/path-changed') {
            clearTimeout(timer)
            resolve(next.value)
            return
          }
        }
      } catch (error: unknown) {
        clearTimeout(timer)
        reject(error)
      }
    })()
  })
  await new Promise<void>((resolve) => { setTimeout(resolve, 40) })
  mutate()
  return pending
}

describe('watchLocationForPath', () => {
  it('watches a missing file through its parent directory', () => {
    expect(watchLocationForPath('/workspace/src/app.ts')).toEqual({
      watchRoot: '/workspace/src',
      filterName: 'app.ts',
    })
  })
})

describe('watchWorkspacePath', () => {
  it('yields host/path-changed when the injected watcher reports change', async () => {
    let listener: ((eventType: string) => void) | undefined
    const controller = new AbortController()
    const watched: string[] = []
    const stream = watchWorkspacePath(
      '/workspace',
      '/workspace/src/app.ts',
      controller.signal,
      {
        watch: ((path, handler) => {
          watched.push(String(path))
          listener = handler as (eventType: string) => void
          return { close: () => {}, on: () => {} } as never
        }),
      },
    )

    const pending = stream.next()
    listener?.('change')
    const frame = await pending
    expect(watched).toEqual(['/workspace/src'])
    expect(frame.value).toEqual({ type: 'host/path-changed', path: '/workspace/src/app.ts' })
    controller.abort()
    await stream.return(undefined)
  })

  it('ignores sibling filenames when watching a file through its parent directory', async () => {
    let listener: ((eventType: string, filename?: string) => void) | undefined
    const controller = new AbortController()
    const stream = watchWorkspacePath(
      '/workspace',
      '/workspace/notes.txt',
      controller.signal,
      {
        watch: ((_path, handler) => {
          listener = handler as (eventType: string, filename?: string) => void
          return { close: () => {}, on: () => {} } as never
        }),
      },
    )
    const pending = stream.next()
    listener?.('rename', 'other.txt')
    const raced = await Promise.race([
      pending.then(() => 'delivered' as const),
      new Promise<'timeout'>((resolve) => { setTimeout(() => { resolve('timeout') }, 50) }),
    ])
    expect(raced).toBe('timeout')
    listener?.('rename', 'notes.txt')
    const frame = await pending
    expect(frame.value).toEqual({ type: 'host/path-changed', path: '/workspace/notes.txt' })
    controller.abort()
    await stream.return(undefined)
  })

  it('stops yielding after the caller aborts', async () => {
    let listener: ((eventType: string) => void) | undefined
    const controller = new AbortController()
    const stream = watchWorkspacePath(
      '/workspace',
      '/workspace/readme.txt',
      controller.signal,
      {
        watch: ((_path, handler) => {
          listener = handler as (eventType: string) => void
          return { close: vi.fn(), on: () => {} } as never
        }),
      },
    )

    const first = stream.next()
    await Promise.resolve()
    listener?.('change')
    await first
    controller.abort()
    listener?.('change')
    const after = await stream.next()
    expect(after.done).toBe(true)
  })

  it('atomic-replace-twice: a second temp-file rename still yields host/path-changed', async () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-watch-atomic-'))
    const filePath = join(root, 'notes.txt')
    writeFileSync(filePath, 'v1\n')
    const controller = new AbortController()
    const stream = watchWorkspacePath(root, filePath, controller.signal)
    try {
      await nextChanged(stream, () => { atomicReplace(filePath, 'v2\n') })
      const second = await nextChanged(stream, () => { atomicReplace(filePath, 'v3\n') })
      expect(second).toEqual({ type: 'host/path-changed', path: filePath })
    } finally {
      controller.abort()
      await stream.return(undefined)
    }
  }, 10_000)

  it('rejects paths outside the Workspace root', async () => {
    const controller = new AbortController()
    const stream = watchWorkspacePath('/workspace', '/outside/file.ts', controller.signal)
    await expect(stream.next()).rejects.toBeInstanceOf(WorkspacePathOutOfBoundsError)
    controller.abort()
  })
})
