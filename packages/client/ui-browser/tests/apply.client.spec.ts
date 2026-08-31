import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it, vi } from 'vitest'
import { SlotRegistry } from '@deepseek-ai/dsh-client-runtime/client'
import type { WorkspaceId } from '@deepseek-ai/dsh-client-runtime/client'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { apply as applyNode } from '../src/index.ts'
import { apply, inject } from '../src/client/index.ts'
import { BrowserPanel, type BrowserPanelInjected } from '../src/client/BrowserPanel.tsx'

const BLANK_PAGE = { url: 'about:blank', title: '', canGoBack: false, canGoForward: false } as const

async function bench() {
  const ctx = new Context()
  await ctx.plugin(SlotRegistry).await()
  const slots = ctx.get('slots') as SlotRegistry
  ctx.provide('locale', new LocaleRuntime(ctx))
  const workspaces = {
    browserList: vi.fn(() => Promise.resolve({ tabs: [] })),
    browserCreateTab: vi.fn(() => Promise.resolve({ tabId: 'fake-browser-1' })),
    browserCloseTab: vi.fn(() => Promise.resolve({ closed: true as const })),
    browserSelectTab: vi.fn(() => Promise.resolve({ selected: true as const })),
    browserShowWindow: vi.fn(() => Promise.resolve({ shown: true as const })),
    browserNavigate: vi.fn(() => Promise.resolve(BLANK_PAGE)),
    browserGoBack: vi.fn(() => Promise.resolve(BLANK_PAGE)),
    browserGoForward: vi.fn(() => Promise.resolve(BLANK_PAGE)),
    browserReload: vi.fn(() => Promise.resolve(BLANK_PAGE)),
  }
  ctx.provide('workspaces', workspaces)
  slots.register({
    name: 'root',
    children: { details: { kind: 'single', scope: 'session' } },
  } as never, () => null)
  return { ctx, slots, workspaces }
}

describe('ui-browser apply', () => {
  it('declares the services it drives', () => {
    expect(inject).toEqual(['slots', 'workspaces', 'locale'])
  })

  it('host half has no behavior', () => {
    applyNode()
  })

  it('registers the embedded browser into the declared details child slot', async () => {
    const b = await bench()
    b.slots.register({
      name: 'details',
      children: { 'conversation.details.browser': { kind: 'single', scope: 'root' } },
    } as never, () => null)
    await b.ctx.plugin({ inject: [...inject], apply }).await()
    const entry = b.slots.entries('conversation.details.browser')[0]
    expect(entry?.component).toBe(BrowserPanel)
    expect(entry?.locale).toBe('browserPanel')
    const face = entry?.inject?.({} as never) as unknown as BrowserPanelInjected
    await expect(face.browserList('ws' as WorkspaceId)).resolves.toEqual({ tabs: [] })
    await expect(face.browserCreateTab('ws' as WorkspaceId, 'about:blank')).resolves.toEqual({
      tabId: 'fake-browser-1',
    })
    expect(b.workspaces.browserList).toHaveBeenCalledWith('ws', undefined)
    expect(b.workspaces.browserCreateTab).toHaveBeenCalledWith('ws', 'about:blank', undefined)
    await expect(face.browserShowWindow('ws' as WorkspaceId, 'tab-1')).resolves.toEqual({ shown: true })
    await expect(face.browserCloseTab('ws' as WorkspaceId, 'tab-1')).resolves.toEqual({ closed: true })
    await expect(face.browserSelectTab('ws' as WorkspaceId, 'tab-1')).resolves.toEqual({ selected: true })
    await expect(face.browserNavigate('ws' as WorkspaceId, 'tab-1', 'https://example.com')).resolves.toEqual(BLANK_PAGE)
    await expect(face.browserGoBack('ws' as WorkspaceId, 'tab-1')).resolves.toEqual(BLANK_PAGE)
    await expect(face.browserGoForward('ws' as WorkspaceId, 'tab-1')).resolves.toEqual(BLANK_PAGE)
    await expect(face.browserReload('ws' as WorkspaceId, 'tab-1', true)).resolves.toEqual(BLANK_PAGE)
    expect(b.workspaces.browserShowWindow).toHaveBeenCalled()
    expect(b.workspaces.browserCloseTab).toHaveBeenCalled()
    expect(b.workspaces.browserSelectTab).toHaveBeenCalled()
    expect(b.workspaces.browserNavigate).toHaveBeenCalled()
    expect(b.workspaces.browserGoBack).toHaveBeenCalled()
    expect(b.workspaces.browserGoForward).toHaveBeenCalled()
    expect(b.workspaces.browserReload).toHaveBeenCalled()
  })

  it('unregisters the Browser occupant when the plugin fiber disposes', async () => {
    const b = await bench()
    b.slots.register({
      name: 'details',
      children: { 'conversation.details.browser': { kind: 'single', scope: 'root' } },
    } as never, () => null)
    const fiber = b.ctx.plugin({ inject: [...inject], apply })
    await fiber.await()
    expect(b.slots.entries('conversation.details.browser')).toHaveLength(1)
    await fiber.dispose()
    expect(b.slots.entries('conversation.details.browser')).toHaveLength(0)
  })
})
