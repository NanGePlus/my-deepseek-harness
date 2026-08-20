import { describe, expect, it, vi } from 'vitest'
import { watchWorkspacePath } from '../src/watch-path.ts'
import { WorkspacePathOutOfBoundsError } from '../src/list-workspace-entries.ts'

describe('watchWorkspacePath', () => {
  it('yields host/path-changed when the injected watcher reports change', async () => {
    let listener: ((eventType: string) => void) | undefined
    const controller = new AbortController()
    const stream = watchWorkspacePath(
      '/workspace',
      '/workspace/src/app.ts',
      controller.signal,
      {
        watch: ((_path, handler) => {
          listener = handler as (eventType: string) => void
          return { close: () => {}, on: () => {} } as never
        }),
      },
    )

    const pending = stream.next()
    listener?.('change')
    const frame = await pending
    expect(frame.value).toEqual({ type: 'host/path-changed', path: '/workspace/src/app.ts' })
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

  it('rejects paths outside the Workspace root', async () => {
    const controller = new AbortController()
    const stream = watchWorkspacePath('/workspace', '/outside/file.ts', controller.signal)
    await expect(stream.next()).rejects.toBeInstanceOf(WorkspacePathOutOfBoundsError)
    controller.abort()
  })
})
