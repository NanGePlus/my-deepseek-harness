import { describe, expect, it } from 'vitest'
import { shouldScheduleDragExpand } from '../src/client/tree-drag-expand.ts'

describe('shouldScheduleDragExpand', () => {
  const dir = { path: '/w/src', name: 'src', isDirectory: true as const, hidden: false }

  it('schedules only for collapsed directories that are not the drag source', () => {
    expect(shouldScheduleDragExpand(dir, new Set(), '/w/a.ts')).toBe(true)
    expect(shouldScheduleDragExpand(dir, new Set(['/w/src']), '/w/a.ts')).toBe(false)
    expect(shouldScheduleDragExpand(dir, new Set(), '/w/src')).toBe(false)
    expect(shouldScheduleDragExpand(
      { path: '/w/a.ts', name: 'a.ts', isDirectory: false, hidden: false },
      new Set(),
      '/w/b.ts',
    )).toBe(false)
  })
})
