import { describe, expect, it } from 'vitest'
import type { WorkspaceEntry } from '@deepseek-ai/dsh-client-runtime/client'
import {
  directoryChainToFile, isPathInDirectorySubtree, joinChildPath, parentDirectoryForCreate,
  parentDirectoryOfEntry, parentDirectoryOfPath, remapPathAfterRename, siblingKindNameExists,
  siblingNameConflictKey,
} from '../src/client/file-tree-parent.ts'

const ROOT = '/w/alpha'

function entry(name: string, isDirectory: boolean): WorkspaceEntry {
  return { name, path: `${ROOT}/${name}`, isDirectory, hidden: false }
}

describe('file-tree-parent helpers', () => {
  it('uses the workspace root when nothing is selected', () => {
    expect(parentDirectoryForCreate(ROOT, undefined)).toBe(ROOT)
  })

  it('uses a selected directory as the create parent', () => {
    expect(parentDirectoryForCreate(ROOT, entry('src', true))).toBe(`${ROOT}/src`)
  })

  it('uses the parent of a selected file as the create parent', () => {
    expect(parentDirectoryForCreate(ROOT, entry('README.md', false))).toBe(ROOT)
  })

  it('uses the parent directory that lists an entry as a direct child', () => {
    expect(parentDirectoryOfEntry(ROOT, entry('README.md', false))).toBe(ROOT)
    expect(parentDirectoryOfEntry(ROOT, entry('src', true))).toBe(ROOT)
    expect(parentDirectoryOfEntry(ROOT, {
      name: 'app.ts',
      path: `${ROOT}/src/app.ts`,
      isDirectory: false,
      hidden: false,
    })).toBe(`${ROOT}/src`)
  })

  it('uses the parent directory that lists a host path as a direct child', () => {
    expect(parentDirectoryOfPath(ROOT, `${ROOT}/README.md`)).toBe(ROOT)
    expect(parentDirectoryOfPath(ROOT, `${ROOT}/src/app.ts`)).toBe(`${ROOT}/src`)
    expect(parentDirectoryOfPath(ROOT, ROOT)).toBe(ROOT)
  })

  it('detects paths inside a deleted directory subtree', () => {
    expect(isPathInDirectorySubtree(`${ROOT}/test03`, `${ROOT}/test03`)).toBe(true)
    expect(isPathInDirectorySubtree(`${ROOT}/test03`, `${ROOT}/test03/a.md`)).toBe(true)
    expect(isPathInDirectorySubtree(`${ROOT}/test03`, `${ROOT}/test03-old/a.md`)).toBe(false)
  })

  it('remaps renamed directory paths and their descendants', () => {
    const oldDir = `${ROOT}/test`
    const newDir = `${ROOT}/test02`
    expect(remapPathAfterRename(oldDir, newDir, oldDir)).toBe(newDir)
    expect(remapPathAfterRename(oldDir, newDir, `${oldDir}/test01.md`)).toBe(`${newDir}/test01.md`)
    expect(remapPathAfterRename(oldDir, newDir, `${ROOT}/other.ts`)).toBe(`${ROOT}/other.ts`)
  })

  it('joins a parent directory and child segment', () => {
    expect(joinChildPath(`${ROOT}/src`, 'app.ts')).toBe(`${ROOT}/src/app.ts`)
  })

  it('detects same-kind sibling name collisions only', () => {
    const siblings = [entry('README.md', false), entry('src', true)]
    expect(siblingKindNameExists(siblings, 'README.md', false)).toBe(true)
    expect(siblingKindNameExists(siblings, 'README.md', true)).toBe(false)
    expect(siblingKindNameExists(siblings, 'src', true)).toBe(true)
    expect(siblingKindNameExists(siblings, 'src', false)).toBe(false)
    expect(siblingKindNameExists(siblings, 'notes.ts', false)).toBe(false)
  })

  it('maps sibling conflicts to file or folder copy keys', () => {
    const siblings = [entry('README.md', false), entry('src', true)]
    expect(siblingNameConflictKey(siblings, 'README.md', false)).toBe('editor.error.fileNameConflict')
    expect(siblingNameConflictKey(siblings, 'src', true)).toBe('editor.error.folderNameConflict')
    expect(siblingNameConflictKey(siblings, 'src', false)).toBe('editor.error.folderNameConflict')
    expect(siblingNameConflictKey(siblings, 'README.md', true)).toBe('editor.error.fileNameConflict')
  })

  it('lists workspace-root and intermediate directories for a nested file', () => {
    expect(directoryChainToFile(ROOT, `${ROOT}/README.md`)).toEqual([ROOT])
    expect(directoryChainToFile(ROOT, `${ROOT}/src/app.ts`)).toEqual([ROOT, `${ROOT}/src`])
    expect(directoryChainToFile(ROOT, `${ROOT}/docs/adr/0001.md`)).toEqual([
      ROOT, `${ROOT}/docs`, `${ROOT}/docs/adr`,
    ])
    expect(directoryChainToFile(ROOT, '/other/app.ts')).toEqual([])
  })
})
