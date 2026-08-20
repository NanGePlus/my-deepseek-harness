import { describe, expect, it } from 'vitest'
import type { WorkspaceEntry } from '@deepseek-ai/dsh-client-runtime/client'
import { flattenVisibleTree, paintVisibleRows } from '../src/client/flatten-visible.ts'

function file(name: string, path: string, isDirectory = false): WorkspaceEntry {
  return { name, path, isDirectory, hidden: name.startsWith('.') }
}

describe('flattenVisibleTree', () => {
  it('keeps ancestors of a filename match among loaded children', () => {
    const src = file('src', '/w/src', true)
    const app = file('app.ts', '/w/src/app.ts')
    const rows = flattenVisibleTree(
      [src, file('README.md', '/w/README.md')],
      new Set(['/w/src']),
      new Set(),
      new Map([['/w/src', [app]]]),
      'app',
    )
    expect(rows.map(row => row.entry.name)).toEqual(['src', 'app.ts'])
  })
})

describe('paintVisibleRows', () => {
  it('paints every loaded row when the virtualizer window is empty', () => {
    const entry = file('a.ts', '/w/a.ts')
    const rows = [{ entry, depth: 0, expanded: false, loading: false }]
    expect(paintVisibleRows(rows, [], 22)).toEqual([{ row: rows[0], start: 0 }])
  })

  it('paints the virtualizer window and skips holes', () => {
    const rows = [
      { entry: file('a.ts', '/w/a.ts'), depth: 0, expanded: false, loading: false },
      { entry: file('b.ts', '/w/b.ts'), depth: 0, expanded: false, loading: false },
    ]
    expect(paintVisibleRows(rows, [{ index: 1, start: 40 }, { index: 9, start: 200 }], 22))
      .toEqual([{ row: rows[1], start: 40 }])
  })
})
