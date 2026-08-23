import { describe, expect, it, vi } from 'vitest'
import { encodeFileContextRef } from '../src/client/file-context-ref.ts'
import { serializeFileContextReference } from '../src/client/file-context-serialize.ts'

describe('serializeFileContextReference', () => {
  it('reads the file and expands the selected line range into prompt text', async () => {
    const readFile = vi.fn(() => Promise.resolve({
      kind: 'text' as const,
      path: '/w/CONTEXT.md',
      text: 'line1\nline2\nline3\n',
    }))
    const ref = encodeFileContextRef({
      workspaceId: 'ws' as never,
      path: '/w/CONTEXT.md',
      startLine: 2,
      endLine: 3,
    })
    await expect(serializeFileContextReference(readFile, ref, new AbortController().signal))
      .resolves
      .toContain('line2')
    expect(readFile).toHaveBeenCalledWith('ws', '/w/CONTEXT.md', 'text', expect.any(AbortSignal))
  })
})
