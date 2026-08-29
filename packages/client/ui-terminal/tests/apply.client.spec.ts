import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it, vi } from 'vitest'
import { SlotRegistry } from '@deepseek-ai/dsh-client-runtime/client'
import type { WorkspaceId } from '@deepseek-ai/dsh-client-runtime/client'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { apply as applyNode } from '../src/index.ts'
import { apply, inject } from '../src/client/index.ts'
import { TerminalPanel, type TerminalPanelInjected } from '../src/client/TerminalPanel.tsx'

async function bench() {
  const ctx = new Context()
  await ctx.plugin(SlotRegistry).await()
  const slots = ctx.get('slots') as SlotRegistry
  ctx.provide('locale', new LocaleRuntime(ctx))
  const workspaces = {
    terminalProfiles: vi.fn(() => Promise.resolve({ profiles: [{ id: 'zsh', name: 'zsh' }], defaultProfileId: 'zsh' })),
    terminalList: vi.fn(() => Promise.resolve({ sessions: [] })),
    terminalSpawn: vi.fn(() => Promise.resolve({ sessionId: 'fake-terminal-1' })),
    terminalWrite: vi.fn(() => Promise.resolve({ written: true as const })),
    terminalResize: vi.fn(() => Promise.resolve({ resized: true as const })),
    terminalStream: vi.fn(),
  }
  ctx.provide('workspaces', workspaces)
  slots.register({
    name: 'root',
    children: { details: { kind: 'single', scope: 'session' } },
  } as never, () => null)
  return { ctx, slots, workspaces }
}

describe('ui-terminal apply', () => {
  it('declares the services it drives', () => {
    expect(inject).toEqual(['slots', 'workspaces', 'locale'])
  })

  it('host half has no behavior', () => {
    applyNode()
  })

  it('registers the human terminal into the declared details child slot', async () => {
    const b = await bench()
    b.slots.register({
      name: 'details',
      children: { 'conversation.details.terminal': { kind: 'single', scope: 'root' } },
    } as never, () => null)
    await b.ctx.plugin({ inject: [...inject], apply }).await()
    const entry = b.slots.entries('conversation.details.terminal')[0]
    expect(entry?.component).toBe(TerminalPanel)
    expect(entry?.locale).toBe('terminalPanel')
    const face = entry?.inject?.({} as never) as unknown as TerminalPanelInjected
    await expect(face.terminalProfiles()).resolves.toEqual({
      profiles: [{ id: 'zsh', name: 'zsh' }],
      defaultProfileId: 'zsh',
    })
    await expect(face.terminalList('ws' as WorkspaceId)).resolves.toEqual({ sessions: [] })
    await expect(face.terminalSpawn('ws' as WorkspaceId, 'zsh', '/w')).resolves.toEqual({
      sessionId: 'fake-terminal-1',
    })
    expect(b.workspaces.terminalProfiles).toHaveBeenCalled()
    expect(b.workspaces.terminalList).toHaveBeenCalledWith('ws', undefined)
    expect(b.workspaces.terminalSpawn).toHaveBeenCalledWith('ws', 'zsh', '/w', undefined)
    face.terminalStream('ws' as WorkspaceId, 'term-1', () => {}, new AbortController().signal, () => {})
    face.terminalWrite('ws' as WorkspaceId, 'term-1', 'ls\n')
    face.terminalResize('ws' as WorkspaceId, 'term-1', 80, 24)
    expect(b.workspaces.terminalStream).toHaveBeenCalled()
    expect(b.workspaces.terminalWrite).toHaveBeenCalledWith('ws', 'term-1', 'ls\n', undefined)
    expect(b.workspaces.terminalResize).toHaveBeenCalledWith('ws', 'term-1', 80, 24, undefined)
  })

  it('unregisters the Terminal occupant when the plugin fiber disposes', async () => {
    const b = await bench()
    b.slots.register({
      name: 'details',
      children: { 'conversation.details.terminal': { kind: 'single', scope: 'root' } },
    } as never, () => null)
    const fiber = b.ctx.plugin({ inject: [...inject], apply })
    await fiber.await()
    expect(b.slots.entries('conversation.details.terminal')).toHaveLength(1)
    await fiber.dispose()
    expect(b.slots.entries('conversation.details.terminal')).toHaveLength(0)
  })
})
