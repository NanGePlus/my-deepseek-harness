import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import * as Invariant from '../src/invariant.ts'

describe('ui-terminal invariant companion', () => {
  it('registers under the package name', async () => {
    const ctx = new Context()
    const disposers: Array<() => void> = []
    ctx.provide('invariants', {
      register: (_name: string, install: () => void) => {
        install()
        const dispose = () => {}
        disposers.push(dispose)
        return Promise.resolve(dispose)
      },
    })
    await ctx.plugin({ inject: Invariant.inject, apply: Invariant.apply }).await()
    expect(disposers).toHaveLength(1)
  })
})
