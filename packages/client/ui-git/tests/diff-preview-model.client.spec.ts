import { describe, expect, it } from 'vitest'
import { buildDiffPreviewRows, MAX_DIFF_PREVIEW_ROWS } from '../src/client/diff-preview-model.ts'
import { buildMinimapBuckets, MINIMAP_BUCKET_COUNT } from '../src/client/diff-minimap-model.ts'

describe('buildDiffPreviewRows', () => {
  it('fills gaps from fileText and renders hunk headers', () => {
    const rows = buildDiffPreviewRows({
      kind: 'text',
      fileText: 'keep\nnew\nline4\nline5\nline6\nline7\npad\ntail-new\n',
      hunks: [
        {
          header: '@@ -1,3 +1,3 @@',
          lines: [
            { origin: 'context', text: 'keep' },
            { origin: 'del', text: 'old' },
            { origin: 'add', text: 'new' },
          ],
        },
        {
          header: '@@ -8,2 +8,2 @@',
          lines: [
            { origin: 'del', text: 'tail-old' },
            { origin: 'add', text: 'tail-new' },
          ],
        },
      ],
    })
    expect(rows.filter(row => row.kind === 'header').map(row => row.header)).toEqual([
      '@@ -1,3 +1,3 @@',
      '@@ -8,2 +8,2 @@',
    ])
    expect(rows.filter(row => row.kind === 'line').map(row => row.text)).toEqual([
      'keep',
      'old',
      'new',
      'line4',
      'line5',
      'line6',
      'line7',
      'pad',
      'tail-old',
      'tail-new',
    ])
  })

  it('adds character spans for adjacent delete/add pairs', () => {
    const rows = buildDiffPreviewRows({
      kind: 'text',
      fileText: 'x\n',
      hunks: [{
        header: '@@ -1 +1 @@',
        lines: [
          { origin: 'del', text: 'old' },
          { origin: 'add', text: 'new' },
        ],
      }],
    })
    const del = rows.find((row): row is Extract<typeof row, { kind: 'line' }> =>
      row.kind === 'line' && row.origin === 'del')
    const add = rows.find((row): row is Extract<typeof row, { kind: 'line' }> =>
      row.kind === 'line' && row.origin === 'add')
    expect(del?.charSpans).toEqual([{ kind: 'delete', text: 'old' }])
    expect(add?.charSpans).toEqual([{ kind: 'insert', text: 'new' }])
  })

  it('truncates very large previews and tolerates missing fileText', () => {
    const text = `${'line\n'.repeat(MAX_DIFF_PREVIEW_ROWS + 50)}`
    const rows = buildDiffPreviewRows({ kind: 'untracked-text', text })
    expect(rows).toHaveLength(MAX_DIFF_PREVIEW_ROWS + 1)
    expect(rows.at(-1)).toEqual({ kind: 'truncated', omitted: 50 })
    expect(buildDiffPreviewRows({
      kind: 'text',
      hunks: [],
      fileText: undefined as unknown as string,
    })).toEqual([])
  })
})

describe('buildMinimapBuckets', () => {
  it('compresses many rows into a fixed bucket count', () => {
    const rows = buildDiffPreviewRows({
      kind: 'untracked-text',
      text: `${'x\n'.repeat(500)}`,
    })
    expect(buildMinimapBuckets(rows)).toHaveLength(MINIMAP_BUCKET_COUNT)
  })
})
