import { describe, expect, it, vi } from 'vitest'
import type { GitDiffPreview, WorkspaceId } from '@deepseek-ai/dsh-client-runtime/client'
import { gitDiffPreviewWithFullFile } from '../src/client/diff-preview-enrich.ts'

describe('gitDiffPreviewWithFullFile', () => {
  it('returns the host preview when fileText is already present', async () => {
    const preview = {
      kind: 'text' as const,
      fileText: 'full\n',
      hunks: [{ header: '@@ -1 +1 @@', lines: [{ origin: 'context' as const, text: 'full' }] }],
    }
    const host = {
      gitDiffPreview: vi.fn(async () => preview),
      readFile: vi.fn(),
    }
    await expect(gitDiffPreviewWithFullFile(
      host,
      'ws' as WorkspaceId,
      '/w/a.md',
      'unstaged',
    )).resolves.toBe(preview)
    expect(host.readFile).not.toHaveBeenCalled()
  })

  it('reads the file when a text preview omits fileText', async () => {
    const host = {
      gitDiffPreview: vi.fn(async () => ({
        kind: 'text' as const,
        hunks: [{ header: '@@ -5 +5 @@', lines: [{ origin: 'add' as const, text: 'new' }] }],
      }) as GitDiffPreview),
      readFile: vi.fn(async () => ({ kind: 'text' as const, path: '/w/a.md', text: 'head\nnew\n' })),
    }
    await expect(gitDiffPreviewWithFullFile(
      host,
      'ws' as WorkspaceId,
      '/w/a.md',
      'unstaged',
    )).resolves.toEqual({
      kind: 'text',
      hunks: [{ header: '@@ -5 +5 @@', lines: [{ origin: 'add', text: 'new' }] }],
      fileText: 'head\nnew\n',
    })
  })
})
