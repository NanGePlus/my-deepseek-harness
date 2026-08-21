import { mkdirSync, mkdtempSync, realpathSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  mediaTypeForImagePath,
  readWorkspaceFile,
  writeWorkspaceFile,
  WORKSPACE_FILE_READ_MAX_BYTES,
  WorkspaceFileNotFoundError,
  WorkspaceFileNotRegularError,
  WorkspaceFileTooLargeError,
  WorkspaceFileUnreadableError,
  WorkspaceFileWriteFailedError,
} from '../src/read-write-file.ts'
import { WorkspacePathOutOfBoundsError } from '../src/list-workspace-entries.ts'

describe('mediaTypeForImagePath', () => {
  it('maps known image extensions and falls back for others', () => {
    expect(mediaTypeForImagePath('/a/logo.PNG')).toBe('image/png')
    expect(mediaTypeForImagePath('/a/pic.jpeg')).toBe('image/jpeg')
    expect(mediaTypeForImagePath('/a/icon.svg')).toBe('image/svg+xml')
    expect(mediaTypeForImagePath('/a/unknown.bin')).toBe('application/octet-stream')
  })
})

describe('readWorkspaceFile', () => {
  it('rejects paths outside the workspace root', async () => {
    const root = realpathSync.native(mkdtempSync(join(tmpdir(), 'dsh-read-file-')))
    await expect(readWorkspaceFile(root, join(root, '..', 'outside.txt'), 'text'))
      .rejects.toBeInstanceOf(WorkspacePathOutOfBoundsError)
  })

  it('reports missing files and directories separately', async () => {
    const root = realpathSync.native(mkdtempSync(join(tmpdir(), 'dsh-read-file-')))
    const missing = join(root, 'missing.txt')
    await expect(readWorkspaceFile(root, missing, 'text')).rejects.toBeInstanceOf(WorkspaceFileNotFoundError)

    const dir = join(root, 'folder')
    mkdirSync(dir)
    await expect(readWorkspaceFile(root, dir, 'text')).rejects.toBeInstanceOf(WorkspaceFileNotRegularError)
  })

  it('maps read-time ENOENT and EISDIR failures', async () => {
    const root = realpathSync.native(mkdtempSync(join(tmpdir(), 'dsh-read-file-')))
    const file = join(root, 'race.txt')
    const okStat = async () => ({ isFile: () => true }) as never

    await expect(readWorkspaceFile(root, file, 'text', undefined, {
      stat: okStat,
      readFile: async () => { throw Object.assign(new Error('gone'), { code: 'ENOENT' }) },
    })).rejects.toBeInstanceOf(WorkspaceFileNotFoundError)

    await expect(readWorkspaceFile(root, file, 'text', undefined, {
      stat: okStat,
      readFile: async () => { throw Object.assign(new Error('is dir'), { code: 'EISDIR' }) },
    })).rejects.toBeInstanceOf(WorkspaceFileNotRegularError)

    await expect(readWorkspaceFile(root, file, 'text', undefined, {
      stat: okStat,
      readFile: async () => { throw 'raw' },
    })).rejects.toBeInstanceOf(WorkspaceFileUnreadableError)

    await expect(readWorkspaceFile(root, file, 'text', undefined, {
      stat: okStat,
      readFile: async () => { throw new Error('read denied') },
    })).rejects.toMatchObject({ message: expect.stringContaining('read denied') })
  })

  it('maps stat failures that are neither ENOENT nor a typed file error', async () => {
    const root = realpathSync.native(mkdtempSync(join(tmpdir(), 'dsh-read-file-')))
    const file = join(root, 'stat-fail.txt')
    await expect(readWorkspaceFile(root, file, 'text', undefined, {
      stat: async () => { throw 'raw-stat' },
    })).rejects.toBeInstanceOf(WorkspaceFileUnreadableError)

    await expect(readWorkspaceFile(root, file, 'text', undefined, {
      stat: async () => { throw new Error('stat denied') },
    })).rejects.toMatchObject({ message: expect.stringContaining('stat denied') })
  })

  it('rejects files larger than the read limit before reading', async () => {
    const root = realpathSync.native(mkdtempSync(join(tmpdir(), 'dsh-read-file-')))
    const file = join(root, 'huge.txt')
    const overLimit = WORKSPACE_FILE_READ_MAX_BYTES + 1
    await expect(readWorkspaceFile(root, file, 'text', undefined, {
      stat: async () => ({ isFile: () => true, size: overLimit }) as never,
      readFile: async () => { throw new Error('read should not run') },
    })).rejects.toBeInstanceOf(WorkspaceFileTooLargeError)
  })
})

describe('writeWorkspaceFile', () => {
  it('rejects paths outside the workspace root', async () => {
    const root = realpathSync.native(mkdtempSync(join(tmpdir(), 'dsh-write-file-')))
    await expect(writeWorkspaceFile(root, join(root, '..', 'outside.txt'), 'nope'))
      .rejects.toBeInstanceOf(WorkspacePathOutOfBoundsError)
  })

  it('wraps write failures including non-Error throws', async () => {
    const root = realpathSync.native(mkdtempSync(join(tmpdir(), 'dsh-write-file-')))
    const file = join(root, 'out.txt')
    await expect(writeWorkspaceFile(root, file, 'changed', undefined, {
      writeFile: async () => { throw Object.assign(new Error('denied'), { code: 'EACCES' }) },
    })).rejects.toBeInstanceOf(WorkspaceFileWriteFailedError)

    await expect(writeWorkspaceFile(root, file, 'changed', undefined, {
      writeFile: async () => { throw new Error('write denied') },
    })).rejects.toMatchObject({ message: expect.stringContaining('write denied') })

    await expect(writeWorkspaceFile(root, file, 'changed', undefined, {
      writeFile: async () => { throw 'raw' },
    })).rejects.toBeInstanceOf(WorkspaceFileWriteFailedError)
  })

  it('persists text through the default writer', async () => {
    const root = realpathSync.native(mkdtempSync(join(tmpdir(), 'dsh-write-file-')))
    const file = join(root, 'saved.txt')
    await expect(writeWorkspaceFile(root, file, 'hello')).resolves.toEqual({ path: file })
    expect(await readWorkspaceFile(root, file, 'text')).toEqual({ kind: 'text', path: file, text: 'hello' })
  })
})

describe('readWorkspaceFile error classes', () => {
  it('carry the target path on typed failures', () => {
    expect(new WorkspaceFileNotFoundError('/a').path).toBe('/a')
    expect(new WorkspaceFileNotRegularError('/b').path).toBe('/b')
    expect(new WorkspaceFileTooLargeError('/big', 9, 5).limit).toBe(5)
    expect(new WorkspaceFileUnreadableError('/c', 'denied').path).toBe('/c')
    expect(new WorkspaceFileWriteFailedError('/d', 'denied').path).toBe('/d')
  })
})
