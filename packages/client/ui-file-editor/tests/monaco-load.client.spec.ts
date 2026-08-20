import { describe, expect, it, vi } from 'vitest'

describe('loadMonacoEditor', () => {
  it('returns undefined when monaco-editor cannot be imported', async () => {
    vi.resetModules()
    vi.doMock('monaco-editor', () => {
      throw new Error('monaco-editor missing')
    })
    const { loadMonacoEditor } = await import('../src/client/monaco-load.ts')
    await expect(loadMonacoEditor()).resolves.toBeUndefined()
  })
})
