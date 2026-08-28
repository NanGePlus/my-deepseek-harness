import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import AgentRegistry, { Inbox } from '@deepseek-ai/dsh-agent'
import type { Agent, AgentFactory } from '@deepseek-ai/dsh-agent'
import SessionStore from '@deepseek-ai/dsh-session'
import type { Session } from '@deepseek-ai/dsh-session'
import Storage from '@deepseek-ai/dsh-storage'
import { DomainFacility } from '@deepseek-ai/dsh-storage-domain'
import UserQuestionService from '@deepseek-ai/dsh-user-questions'
import WorkspaceRegistry from '@deepseek-ai/dsh-workspace'
import type { RpcRequest, RpcResponse } from '@deepseek-ai/dsh-host-apiproxy/api/rpc'
import { RpcId } from '@deepseek-ai/dsh-host-apiproxy/api/rpc'
import { createApiProxy } from '@deepseek-ai/dsh-host-apiproxy'
import { MemoryStorageBackend } from '../../../storage/storage-domain/tests/helpers/memory-backend.ts'

let nextRpc = 1

function request<P>(payload: P): RpcRequest<P> {
  return { rpcId: RpcId(`delete-rename-path-${String(nextRpc++)}`), payload }
}

function expectOk<T>(response: RpcResponse<T>): T {
  expect(response.result.ok).toBe(true)
  if (!response.result.ok) throw new Error('unreachable')
  return response.result.value
}

function stubAgent(session: Session): Agent {
  return {
    id: session.id,
    options: {},
    session,
    inbox: new Inbox(session, { inserted: () => {}, discarded: () => {}, claimed: () => {} }),
    status: 'idle',
    ctx: new Context(),
    send: () => {},
    followup: () => {},
    steer: () => ({ outcome: Promise.resolve({ status: 'rejected' as const }) }),
    inject: () => {},
    cancel() {},
    runMaintenance: job => job(new AbortController().signal),
    whenIdle: () => Promise.resolve(),
  }
}

async function harness(
  root = realpathSync.native(mkdtempSync(join(tmpdir(), 'dsh-delete-rename-path-'))),
) {
  const ctx = new Context()
  await ctx.plugin(SessionStore)
  await ctx.plugin(AgentRegistry)
  await ctx.plugin(UserQuestionService)
  await ctx.plugin(Storage)
  ctx.storage.backend.register('memory', new MemoryStorageBackend())
  const storageDomain = new DomainFacility(ctx, { backend: 'memory', routes: {} })
  ctx.storage.mount('domain', storageDomain)
  ctx.provide('storageDomain', storageDomain)
  ctx.provide('sessionPersistence', { list: () => Promise.resolve([]) } as never)
  await ctx.plugin(WorkspaceRegistry)

  const factory: AgentFactory = {
    async createAgent(_ownerCtx, options) {
      const session = ctx.sessions.create(
        options.sessionId,
        options.meta === undefined ? {} : { meta: options.meta },
      )
      const agent = stubAgent(session)
      const unregister = ctx.agents.register(agent)
      return {
        agent,
        dispose: () => {
          unregister()
          return Promise.resolve()
        },
      }
    },
    async resume() {
      throw new Error('test harness has no persisted sessions')
    },
  }
  ctx.agents.setFactory(factory)
  ctx.provide('directoryPicker', { capability: () => ({ kind: 'native', pick: async () => null }) } as never)
  const api = createApiProxy(ctx, {
    defaultModelSelection: () => ({ provider: 'test', model: 'test-model' }),
    cwd: root,
  })
  return { api, root }
}

describe('host.deletePath', () => {
  it('removes a file from disk and returns the deleted absolute path', async () => {
    const { api, root } = await harness()
    const workspacePath = join(root, 'repo')
    mkdirSync(workspacePath)
    const filePath = join(workspacePath, 'notes.txt')
    writeFileSync(filePath, 'delete me\n')

    const workspace = expectOk(await api.workspace.create(request({ path: workspacePath }))).workspace
    const deleted = expectOk(await api.host.deletePath(
      request({ workspaceId: workspace.workspaceId, path: filePath }),
      new AbortController().signal,
    ))

    expect(deleted).toEqual({ path: filePath })
    expect(existsSync(filePath)).toBe(false)
  })

  it('removes a directory tree from disk and returns the deleted absolute path', async () => {
    const { api, root } = await harness()
    const workspacePath = join(root, 'repo')
    mkdirSync(workspacePath)
    const dirPath = join(workspacePath, 'pkg')
    mkdirSync(dirPath)
    writeFileSync(join(dirPath, 'index.ts'), 'export {}\n')

    const workspace = expectOk(await api.workspace.create(request({ path: workspacePath }))).workspace
    const deleted = expectOk(await api.host.deletePath(
      request({ workspaceId: workspace.workspaceId, path: dirPath }),
      new AbortController().signal,
    ))

    expect(deleted).toEqual({ path: dirPath })
    expect(existsSync(dirPath)).toBe(false)
  })
})

describe('host.renamePath', () => {
  it('renames a file within the same parent directory and returns the new absolute path', async () => {
    const { api, root } = await harness()
    const workspacePath = join(root, 'repo')
    mkdirSync(workspacePath)
    const oldPath = join(workspacePath, 'old.txt')
    const newPath = join(workspacePath, 'new.txt')
    writeFileSync(oldPath, 'rename me\n')

    const workspace = expectOk(await api.workspace.create(request({ path: workspacePath }))).workspace
    const renamed = expectOk(await api.host.renamePath(
      request({ workspaceId: workspace.workspaceId, path: oldPath, newName: 'new.txt' }),
      new AbortController().signal,
    ))

    expect(renamed).toEqual({ path: newPath })
    expect(existsSync(oldPath)).toBe(false)
    expect(readFileSync(newPath, 'utf8')).toBe('rename me\n')
  })

  it('fails when the rename target already exists and leaves disk unchanged', async () => {
    const { api, root } = await harness()
    const workspacePath = join(root, 'repo')
    mkdirSync(workspacePath)
    const sourcePath = join(workspacePath, 'source.txt')
    const targetPath = join(workspacePath, 'target.txt')
    writeFileSync(sourcePath, 'source\n')
    writeFileSync(targetPath, 'target\n')

    const workspace = expectOk(await api.workspace.create(request({ path: workspacePath }))).workspace
    const response = await api.host.renamePath(
      request({ workspaceId: workspace.workspaceId, path: sourcePath, newName: 'target.txt' }),
      new AbortController().signal,
    )

    expect(response.result).toMatchObject({
      ok: false,
      error: { code: 'directory-exists', details: { path: targetPath } },
    })
    expect(readFileSync(sourcePath, 'utf8')).toBe('source\n')
    expect(readFileSync(targetPath, 'utf8')).toBe('target\n')
  })
})

describe('host.movePath', () => {
  it('moves a file into another directory and returns the new absolute path', async () => {
    const { api, root } = await harness()
    const workspacePath = join(root, 'repo')
    mkdirSync(workspacePath)
    const destDir = join(workspacePath, 'src')
    mkdirSync(destDir)
    const oldPath = join(workspacePath, 'old.txt')
    const newPath = join(destDir, 'old.txt')
    writeFileSync(oldPath, 'move me\n')

    const workspace = expectOk(await api.workspace.create(request({ path: workspacePath }))).workspace
    const moved = expectOk(await api.host.movePath(
      request({ workspaceId: workspace.workspaceId, path: oldPath, destinationDirectory: destDir }),
      new AbortController().signal,
    ))

    expect(moved).toEqual({ path: newPath })
    expect(existsSync(oldPath)).toBe(false)
    expect(readFileSync(newPath, 'utf8')).toBe('move me\n')
  })

  it('fails when the move target already exists and leaves disk unchanged', async () => {
    const { api, root } = await harness()
    const workspacePath = join(root, 'repo')
    mkdirSync(workspacePath)
    const destDir = join(workspacePath, 'src')
    mkdirSync(destDir)
    const sourcePath = join(workspacePath, 'source.txt')
    const targetPath = join(destDir, 'source.txt')
    writeFileSync(sourcePath, 'source\n')
    writeFileSync(targetPath, 'target\n')

    const workspace = expectOk(await api.workspace.create(request({ path: workspacePath }))).workspace
    const response = await api.host.movePath(
      request({ workspaceId: workspace.workspaceId, path: sourcePath, destinationDirectory: destDir }),
      new AbortController().signal,
    )

    expect(response.result).toMatchObject({
      ok: false,
      error: { code: 'directory-exists', details: { path: targetPath } },
    })
    expect(readFileSync(sourcePath, 'utf8')).toBe('source\n')
    expect(readFileSync(targetPath, 'utf8')).toBe('target\n')
  })

  it('fails when moving a directory into itself', async () => {
    const { api, root } = await harness()
    const workspacePath = join(root, 'repo')
    mkdirSync(workspacePath)
    const srcDir = join(workspacePath, 'src')
    mkdirSync(srcDir)

    const workspace = expectOk(await api.workspace.create(request({ path: workspacePath }))).workspace
    const response = await api.host.movePath(
      request({ workspaceId: workspace.workspaceId, path: srcDir, destinationDirectory: srcDir }),
      new AbortController().signal,
    )

    expect(response.result).toMatchObject({
      ok: false,
      error: { code: 'path-move-failed' },
    })
    expect(existsSync(srcDir)).toBe(true)
  })

  it('reports cancelled when the caller aborts a move', async () => {
    const { api, root } = await harness()
    const workspacePath = join(root, 'repo')
    mkdirSync(workspacePath)
    const destDir = join(workspacePath, 'src')
    mkdirSync(destDir)
    const oldPath = join(workspacePath, 'old.txt')
    writeFileSync(oldPath, 'move me\n')

    const workspace = expectOk(await api.workspace.create(request({ path: workspacePath }))).workspace
    const aborted = new AbortController()
    aborted.abort()
    const response = await api.host.movePath(
      request({ workspaceId: workspace.workspaceId, path: oldPath, destinationDirectory: destDir }),
      aborted.signal,
    )
    expect(response.result).toMatchObject({
      ok: false,
      error: { code: 'cancelled' },
    })
    expect(existsSync(oldPath)).toBe(true)
  })

  it('reports workspace-not-found for an unknown workspace id', async () => {
    const { api } = await harness()
    const response = await api.host.movePath(
      request({ workspaceId: 'missing' as never, path: '/w/old.txt', destinationDirectory: '/w/src' }),
      new AbortController().signal,
    )
    expect(response.result).toMatchObject({
      ok: false,
      error: { code: 'workspace-not-found', details: { workspaceId: 'missing' } },
    })
  })

  it('fails when the source path is missing', async () => {
    const { api, root } = await harness()
    const workspacePath = join(root, 'repo')
    mkdirSync(workspacePath)
    const destDir = join(workspacePath, 'src')
    mkdirSync(destDir)
    const missing = join(workspacePath, 'gone.txt')

    const workspace = expectOk(await api.workspace.create(request({ path: workspacePath }))).workspace
    const response = await api.host.movePath(
      request({ workspaceId: workspace.workspaceId, path: missing, destinationDirectory: destDir }),
      new AbortController().signal,
    )
    expect(response.result).toMatchObject({
      ok: false,
      error: { code: 'path-not-found', details: { path: missing } },
    })
  })
})

describe('host.createWorkspaceDirectory', () => {
  it('creates a child directory and returns its absolute path', async () => {
    const { api, root } = await harness()
    const workspacePath = join(root, 'repo')
    mkdirSync(workspacePath)
    const createdPath = join(workspacePath, 'src')

    const workspace = expectOk(await api.workspace.create(request({ path: workspacePath }))).workspace
    const created = expectOk(await api.host.createWorkspaceDirectory(
      request({ workspaceId: workspace.workspaceId, path: workspacePath, name: 'src' }),
      new AbortController().signal,
    ))

    expect(created).toEqual({ path: createdPath })
    expect(existsSync(createdPath)).toBe(true)
  })

  it('fails with directory-exists when the child directory is already present', async () => {
    const { api, root } = await harness()
    const workspacePath = join(root, 'repo')
    mkdirSync(workspacePath)
    const existingPath = join(workspacePath, 'src')
    mkdirSync(existingPath)

    const workspace = expectOk(await api.workspace.create(request({ path: workspacePath }))).workspace
    const response = await api.host.createWorkspaceDirectory(
      request({ workspaceId: workspace.workspaceId, path: workspacePath, name: 'src' }),
      new AbortController().signal,
    )

    expect(response.result).toMatchObject({
      ok: false,
      error: { code: 'directory-exists', details: { path: existingPath } },
    })
    expect(existsSync(existingPath)).toBe(true)
  })
})

describe('host.deletePath, host.renamePath, host.movePath, and host.createWorkspaceDirectory path bounds', () => {
  it('reject deletes outside the bound Workspace root', async () => {
    const { api, root } = await harness()
    const workspacePath = join(root, 'repo')
    mkdirSync(workspacePath)
    const outside = join(root, 'outside.txt')
    writeFileSync(outside, 'secret')

    const workspace = expectOk(await api.workspace.create(request({ path: workspacePath }))).workspace
    const response = await api.host.deletePath(
      request({ workspaceId: workspace.workspaceId, path: outside }),
      new AbortController().signal,
    )

    expect(response.result).toMatchObject({
      ok: false,
      error: {
        code: 'workspace-path-out-of-bounds',
        details: { workspaceId: workspace.workspaceId, path: outside },
      },
    })
    expect(existsSync(outside)).toBe(true)
  })

  it('reject renames when the source path is outside the bound Workspace root', async () => {
    const { api, root } = await harness()
    const workspacePath = join(root, 'repo')
    mkdirSync(workspacePath)
    const outside = join(root, 'outside.txt')
    writeFileSync(outside, 'outside\n')

    const workspace = expectOk(await api.workspace.create(request({ path: workspacePath }))).workspace
    const response = await api.host.renamePath(
      request({ workspaceId: workspace.workspaceId, path: outside, newName: 'moved.txt' }),
      new AbortController().signal,
    )
    expect(response.result).toMatchObject({
      ok: false,
      error: {
        code: 'workspace-path-out-of-bounds',
        details: { workspaceId: workspace.workspaceId, path: outside },
      },
    })
    expect(readFileSync(outside, 'utf8')).toBe('outside\n')
  })

  it('reject moves when the source path is outside the bound Workspace root', async () => {
    const { api, root } = await harness()
    const workspacePath = join(root, 'repo')
    mkdirSync(workspacePath)
    const destDir = join(workspacePath, 'src')
    mkdirSync(destDir)
    const outside = join(root, 'outside.txt')
    writeFileSync(outside, 'outside\n')

    const workspace = expectOk(await api.workspace.create(request({ path: workspacePath }))).workspace
    const response = await api.host.movePath(
      request({
        workspaceId: workspace.workspaceId,
        path: outside,
        destinationDirectory: destDir,
      }),
      new AbortController().signal,
    )
    expect(response.result).toMatchObject({
      ok: false,
      error: {
        code: 'workspace-path-out-of-bounds',
        details: { workspaceId: workspace.workspaceId, path: outside },
      },
    })
    expect(readFileSync(outside, 'utf8')).toBe('outside\n')
  })

  it('reject workspace directory creation outside the bound Workspace root', async () => {
    const { api, root } = await harness()
    const workspacePath = join(root, 'repo')
    mkdirSync(workspacePath)
    const outsideParent = join(root, 'outside')
    mkdirSync(outsideParent)

    const workspace = expectOk(await api.workspace.create(request({ path: workspacePath }))).workspace
    const response = await api.host.createWorkspaceDirectory(
      request({ workspaceId: workspace.workspaceId, path: outsideParent, name: 'child' }),
      new AbortController().signal,
    )
    expect(response.result).toMatchObject({
      ok: false,
      error: {
        code: 'workspace-path-out-of-bounds',
        details: { workspaceId: workspace.workspaceId, path: outsideParent },
      },
    })
    expect(existsSync(join(outsideParent, 'child'))).toBe(false)
  })
})
