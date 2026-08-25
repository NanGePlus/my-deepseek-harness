import { describe, expect, it } from 'vitest'
import { parseWorkingTreePorcelain } from '../src/git-working-tree.ts'

const ROOT = '/repos/app'

describe('parseWorkingTreePorcelain', () => {
  it('labels untracked, tracked-modified, and tracked-deleted unstaged rows', () => {
    const parsed = parseWorkingTreePorcelain(
      [
        ' M src/a.ts',
        ' D gone.ts',
        '?? new.txt',
      ].join('\n'),
      ROOT,
    )
    expect(parsed.unstaged).toEqual([
      { path: 'gone.ts', absolutePath: `${ROOT}/gone.ts`, kind: 'deleted' },
      { path: 'new.txt', absolutePath: `${ROOT}/new.txt`, kind: 'untracked' },
      { path: 'src/a.ts', absolutePath: `${ROOT}/src/a.ts`, kind: 'modified' },
    ])
    expect(parsed.staged).toEqual([])
  })

  it('labels a staged new file as untracked and a staged deletion as deleted', () => {
    const parsed = parseWorkingTreePorcelain(
      [
        'A  added.ts',
        'D  removed.ts',
        'M  edited.ts',
      ].join('\n'),
      ROOT,
    )
    expect(parsed.staged).toEqual([
      { path: 'added.ts', absolutePath: `${ROOT}/added.ts`, kind: 'untracked' },
      { path: 'edited.ts', absolutePath: `${ROOT}/edited.ts`, kind: 'modified' },
      { path: 'removed.ts', absolutePath: `${ROOT}/removed.ts`, kind: 'deleted' },
    ])
    expect(parsed.unstaged).toEqual([])
  })

  it('gives each side its own kind when a path is partially staged', () => {
    const parsed = parseWorkingTreePorcelain('MD mixed.ts\n', ROOT)
    expect(parsed.staged).toEqual([
      { path: 'mixed.ts', absolutePath: `${ROOT}/mixed.ts`, kind: 'modified' },
    ])
    expect(parsed.unstaged).toEqual([
      { path: 'mixed.ts', absolutePath: `${ROOT}/mixed.ts`, kind: 'deleted' },
    ])
  })

  it('decodes quoted UTF-8 porcelain paths', () => {
    const parsed = parseWorkingTreePorcelain('?? "others/\\345\\237\\272/file.txt"\n', ROOT)
    expect(parsed.unstaged).toEqual([
      { path: 'others/基/file.txt', absolutePath: `${ROOT}/others/基/file.txt`, kind: 'untracked' },
    ])
  })

  it('omits .DS_Store rows from both change lists', () => {
    const parsed = parseWorkingTreePorcelain(
      [
        '?? .DS_Store',
        '?? others/.DS_Store',
        '?? src/readme.md',
      ].join('\n'),
      ROOT,
    )
    expect(parsed.unstaged).toEqual([
      { path: 'src/readme.md', absolutePath: `${ROOT}/src/readme.md`, kind: 'untracked' },
    ])
  })
})
