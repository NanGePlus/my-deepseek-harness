import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'
import { SlotRegistry } from '@deepseek-ai/dsh-client-runtime/client'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { apply, inject } from '../src/client/index.ts'
import { EditorSurface } from '../src/client/EditorSurface.tsx'

async function bench() {
  const ctx = new Context()
  await ctx.plugin(SlotRegistry).await()
  const slots = ctx.get('slots') as SlotRegistry
  ctx.provide('locale', new LocaleRuntime(ctx))
  slots.register({
    name: 'root',
    children: { details: { kind: 'single', scope: 'session' } },
  } as never, () => null)
  return { ctx, slots }
}

describe('ui-file-editor apply', () => {
  it('registers the editor surface into the declared details child slot', async () => {
    const b = await bench()
    b.slots.register({
      name: 'details',
      children: { 'conversation.details.editor': { kind: 'single', scope: 'session' } },
    } as never, () => null)
    await b.ctx.plugin({ inject: [...inject], apply }).await()
    expect(b.slots.entries('conversation.details.editor')[0]?.component).toBe(EditorSurface)
  })
})
