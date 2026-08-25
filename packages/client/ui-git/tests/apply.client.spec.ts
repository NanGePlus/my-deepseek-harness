import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it, vi } from 'vitest'
import { SlotRegistry } from '@deepseek-ai/dsh-client-runtime/client'
import type { WorkspaceId } from '@deepseek-ai/dsh-client-runtime/client'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { apply as applyNode } from '../src/index.ts'
import { apply, inject } from '../src/client/index.ts'
import { GitPanel, type GitPanelInjected } from '../src/client/GitPanel.tsx'

async function bench() {
  const ctx = new Context()
  await ctx.plugin(SlotRegistry).await()
  const slots = ctx.get('slots') as SlotRegistry
  ctx.provide('locale', new LocaleRuntime(ctx))
  const workspaces = {
    gitWorkingTree: vi.fn(() => Promise.resolve({ availability: 'not-a-repository' as const })),
    gitInit: vi.fn(() => Promise.resolve({ repoRoot: '/w' })),
  }
  ctx.provide('workspaces', workspaces)
  slots.register({
    name: 'root',
    children: { details: { kind: 'single', scope: 'session' } },
  } as never, () => null)
  return { ctx, slots, workspaces }
}

describe('ui-git apply', () => {
  it('declares the services it drives', () => {
    expect(inject).toEqual(['slots', 'workspaces', 'locale'])
  })

  it('host half has no behavior', () => {
    applyNode()
  })

  it('registers the Git panel into the declared details child slot', async () => {
    const b = await bench()
    b.slots.register({
      name: 'details',
      children: { 'conversation.details.git': { kind: 'single', scope: 'root' } },
    } as never, () => null)
    await b.ctx.plugin({ inject: [...inject], apply }).await()
    const entry = b.slots.entries('conversation.details.git')[0]
    expect(entry?.component).toBe(GitPanel)
    expect(entry?.locale).toBe('gitPanel')
    const face = entry?.inject?.({} as never) as unknown as GitPanelInjected
    await expect(face.gitWorkingTree('ws' as WorkspaceId)).resolves.toEqual({
      availability: 'not-a-repository',
    })
    await expect(face.gitInit('ws' as WorkspaceId)).resolves.toEqual({ repoRoot: '/w' })
    expect(b.workspaces.gitWorkingTree).toHaveBeenCalledWith('ws', undefined)
    expect(b.workspaces.gitInit).toHaveBeenCalledWith('ws', undefined)
  })

  it('unregisters the Git occupant when the plugin fiber disposes', async () => {
    const b = await bench()
    b.slots.register({
      name: 'details',
      children: { 'conversation.details.git': { kind: 'single', scope: 'root' } },
    } as never, () => null)
    const fiber = b.ctx.plugin({ inject: [...inject], apply })
    await fiber.await()
    expect(b.slots.entries('conversation.details.git')).toHaveLength(1)
    await fiber.dispose()
    expect(b.slots.entries('conversation.details.git')).toHaveLength(0)
  })
})
