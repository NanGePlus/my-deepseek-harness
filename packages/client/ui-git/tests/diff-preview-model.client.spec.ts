import { describe, expect, it } from 'vitest'
import { buildDiffPreviewRows, MAX_DIFF_PREVIEW_ROWS } from '../src/client/diff-preview-model.ts'
import { buildMinimapMarkers } from '../src/client/diff-minimap-model.ts'

describe('buildDiffPreviewRows', () => {
  it('fills gaps from fileText without rendering hunk headers', () => {
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
    expect(rows.every(row => row.kind === 'line' || row.kind === 'truncated')).toBe(true)
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

  it('prepends unchanged head lines before a hunk that starts below line 1', () => {
    const rows = buildDiffPreviewRows({
      kind: 'text',
      fileText: 'line1\nline2\nline3\nline4\n# Domain\n',
      hunks: [{
        header: '@@ -5,16 +5,15 @@',
        lines: [
          { origin: 'context', text: '# Domain' },
          { origin: 'del', text: '**待办 (Todo)**' },
          { origin: 'add', text: '待办 (Todo)' },
        ],
      }],
    })
    const lineRows = rows.filter((row): row is Extract<typeof row, { kind: 'line' }> => row.kind === 'line')
    expect(lineRows.slice(0, 4).map(row => ({ lineNum: row.lineNum, text: row.text, origin: row.origin }))).toEqual([
      { lineNum: 1, text: 'line1', origin: 'context' },
      { lineNum: 2, text: 'line2', origin: 'context' },
      { lineNum: 3, text: 'line3', origin: 'context' },
      { lineNum: 4, text: 'line4', origin: 'context' },
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

describe('buildMinimapMarkers', () => {
  it('emits one marker per delete/add pair', () => {
    const rows = buildDiffPreviewRows({
      kind: 'text',
      fileText: 'head\nnew\n',
      hunks: [{
        header: '@@ -1,2 +1,2 @@',
        lines: [
          { origin: 'del', text: 'old' },
          { origin: 'add', text: 'new' },
        ],
      }],
    })
    const markers = buildMinimapMarkers(rows)
    expect(markers).toHaveLength(1)
    expect(markers[0]).toMatchObject({ del: true, add: true })
  })

  it('places change markers near the top when edits are early in the scroll order', () => {
    const rows = buildDiffPreviewRows({
      kind: 'text',
      fileText: `${'ctx\n'.repeat(99)}tail\n`,
      hunks: [{
        header: '@@ -2,3 +2,3 @@',
        lines: [
          { origin: 'context', text: 'ctx' },
          { origin: 'del', text: 'old' },
          { origin: 'add', text: 'new' },
        ],
      }],
    })
    const markers = buildMinimapMarkers(rows)
    expect(markers).toHaveLength(1)
    expect(markers[0]?.topRatio).toBeLessThan(0.15)
  })

  it('emits one marker per change across multiple hunks', () => {
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
    const markers = buildMinimapMarkers(rows)
    expect(markers).toHaveLength(2)
    expect(markers.every(marker => marker.del && marker.add)).toBe(true)
    expect(markers[0]?.topRatio).toBeLessThan(markers[1]?.topRatio ?? 1)
  })

  it('centers one marker for a wrapped delete/add pair', () => {
    const rows = buildDiffPreviewRows({
      kind: 'text',
      fileText: 'short\nchanged\n',
      hunks: [{
        header: '@@ -2 +2 @@',
        lines: [
          { origin: 'del', text: 'old-long-line' },
          { origin: 'add', text: 'changed-with-much-longer-wrapped-content' },
        ],
      }],
    })
    const markers = buildMinimapMarkers(rows, [20, 20, 20, 80])
    expect(markers).toHaveLength(1)
    expect(markers[0]?.del).toBe(true)
    expect(markers[0]?.add).toBe(true)
    expect(markers[0]?.topRatio).toBeGreaterThan(0)
    expect(markers[0]?.topRatio).toBeLessThan(1)
  })
})
