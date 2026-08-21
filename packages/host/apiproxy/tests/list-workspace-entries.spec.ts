import { mkdirSync, mkdtempSync, realpathSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  boundedInsert,
  listWorkspaceEntriesLevel,
  pathWithinWorkspace,
  WORKSPACE_LISTING_MAX_ENTRIES,
  WORKSPACE_LISTING_MAX_DIRENTS_SCAN,
  WorkspaceDirectoryUnreadableError,
  WorkspacePathOutOfBoundsError,
} from '../src/list-workspace-entries.ts'

describe('pathWithinWorkspace', () => {
  it('accepts the root and descendants and rejects escape attempts', () => {
    const root = realpathSync.native(mkdtempSync(join(tmpdir(), 'dsh-path-within-')))
    const child = join(root, 'child')
    mkdirSync(child)
    expect(pathWithinWorkspace(root, root)).toBe(true)
    expect(pathWithinWorkspace(root, child)).toBe(true)
    expect(pathWithinWorkspace(root, join(root, '..', 'escape'))).toBe(false)
  })
})

describe('boundedInsert', () => {
  it('keeps the window name-sorted and bounded, reporting evictions', () => {
    const window: { name: string; isDirectory: boolean; isSymbolicLink: boolean }[] = []
    const candidate = (name: string) => ({ name, isDirectory: false, isSymbolicLink: false })
    expect(boundedInsert(window, candidate('m'), 2)).toBe(false)
    expect(boundedInsert(window, candidate('z'), 2)).toBe(false)
    expect(window.map(row => row.name)).toEqual(['m', 'z'])
    expect(boundedInsert(window, candidate('a'), 2)).toBe(true)
    expect(window.map(row => row.name)).toEqual(['a', 'm'])
    expect(boundedInsert(window, candidate('t'), 2)).toBe(true)
    expect(window.map(row => row.name)).toEqual(['a', 'm'])
  })
})

describe('listWorkspaceEntriesLevel', () => {
  it('classifies symlinks to directories and broken symlinks as rows', async () => {
    const root = realpathSync.native(mkdtempSync(join(tmpdir(), 'dsh-list-level-')))
    const workspace = join(root, 'ws')
    const targetDir = join(workspace, 'linked-dir')
    mkdirSync(targetDir, { recursive: true })
    writeFileSync(join(workspace, 'file.txt'), '')
    symlinkSync(targetDir, join(workspace, 'link-to-dir'))
    symlinkSync(join(root, 'missing'), join(workspace, 'broken-link'))

    const listed = await listWorkspaceEntriesLevel(workspace, workspace)
    expect(listed.entries).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'file.txt', isDirectory: false }),
      expect.objectContaining({ name: 'link-to-dir', isDirectory: true }),
      expect.objectContaining({ name: 'broken-link', isDirectory: false }),
      expect.objectContaining({ name: 'linked-dir', isDirectory: true }),
    ]))
  })

  it('throws typed errors for out-of-bounds and unreadable targets', async () => {
    const root = realpathSync.native(mkdtempSync(join(tmpdir(), 'dsh-list-level-err-')))
    const workspace = join(root, 'ws')
    mkdirSync(workspace)
    await expect(listWorkspaceEntriesLevel(workspace, join(root, 'outside')))
      .rejects.toBeInstanceOf(WorkspacePathOutOfBoundsError)
    await expect(listWorkspaceEntriesLevel(workspace, join(workspace, 'missing')))
      .rejects.toBeInstanceOf(WorkspaceDirectoryUnreadableError)
  })

  it('honours abort while scanning a large level', async () => {
    const root = realpathSync.native(mkdtempSync(join(tmpdir(), 'dsh-list-level-abort-')))
    const workspace = join(root, 'ws')
    mkdirSync(workspace)
    for (let index = 0; index < WORKSPACE_LISTING_MAX_ENTRIES + 50; index += 1) {
      writeFileSync(join(workspace, `entry-${String(index).padStart(5, '0')}.txt`), '')
    }
    const abort = new AbortController()
    const pending = listWorkspaceEntriesLevel(workspace, workspace, abort.signal)
    abort.abort()
    await expect(pending).rejects.toThrow()
  })

  it('marks truncated when dirent scan exceeds the scan cap', async () => {
    const root = realpathSync.native(mkdtempSync(join(tmpdir(), 'dsh-list-level-cap-')))
    const workspace = join(root, 'ws')
    mkdirSync(workspace)
    for (let index = 0; index < WORKSPACE_LISTING_MAX_DIRENTS_SCAN + 20; index += 1) {
      writeFileSync(join(workspace, `entry-${String(index).padStart(5, '0')}.txt`), '')
    }
    const listed = await listWorkspaceEntriesLevel(workspace, workspace)
    expect(listed.truncated).toBe(true)
    expect(listed.entries.length).toBeLessThanOrEqual(WORKSPACE_LISTING_MAX_ENTRIES)
  })
})
