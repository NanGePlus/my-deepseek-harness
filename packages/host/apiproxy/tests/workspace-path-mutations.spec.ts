import { describe, expect, it, vi } from 'vitest'
import {
  createWorkspaceDirectory,
  deleteWorkspacePath,
  isSinglePathSegment,
  renameWorkspacePath,
  type WorkspacePathMutationInternals,
  WorkspaceDirectoryCreateFailedError,
  WorkspaceDirectoryExistsError,
  WorkspacePathDeleteFailedError,
  WorkspacePathNotFoundError,
  WorkspacePathRenameFailedError,
} from '../src/workspace-path-mutations.ts'
import { WorkspacePathOutOfBoundsError } from '../src/list-workspace-entries.ts'

const fileStat = async () => ({ isFile: () => true, isDirectory: () => false }) as never

describe('isSinglePathSegment', () => {
  it('accepts plain names and rejects traversal segments', () => {
    expect(isSinglePathSegment('src')).toBe(true)
    expect(isSinglePathSegment('')).toBe(false)
    expect(isSinglePathSegment('.')).toBe(false)
    expect(isSinglePathSegment('..')).toBe(false)
    expect(isSinglePathSegment('a/b')).toBe(false)
  })
})

describe('deleteWorkspacePath', () => {
  it('rejects paths outside the workspace root', async () => {
    await expect(deleteWorkspacePath('/w', '/outside.txt')).rejects.toBeInstanceOf(WorkspacePathOutOfBoundsError)
  })

  it('maps a missing path to WorkspacePathNotFoundError', async () => {
    const stat = vi.fn(async () => {
      const error = new Error('missing') as NodeJS.ErrnoException
      error.code = 'ENOENT'
      throw error
    }) as NonNullable<WorkspacePathMutationInternals['stat']>
    await expect(deleteWorkspacePath('/w', '/w/missing.txt', undefined, { stat })).rejects.toBeInstanceOf(
      WorkspacePathNotFoundError,
    )
  })

  it('maps other stat failures to WorkspacePathDeleteFailedError', async () => {
    const stat = vi.fn(async () => {
      throw new Error('permission denied')
    }) as NonNullable<WorkspacePathMutationInternals['stat']>
    await expect(deleteWorkspacePath('/w', '/w/x.txt', undefined, { stat })).rejects.toBeInstanceOf(
      WorkspacePathDeleteFailedError,
    )
  })

  it('maps rm failures after a successful stat', async () => {
    const stat = vi.fn(fileStat) as NonNullable<WorkspacePathMutationInternals['stat']>
    const rm = vi.fn(async () => {
      throw new Error('busy')
    }) as NonNullable<WorkspacePathMutationInternals['rm']>
    await expect(deleteWorkspacePath('/w', '/w/x.txt', undefined, { stat, rm })).rejects.toBeInstanceOf(
      WorkspacePathDeleteFailedError,
    )
  })

  it('maps rm ENOENT after a successful stat to WorkspacePathNotFoundError', async () => {
    const stat = vi.fn(fileStat) as NonNullable<WorkspacePathMutationInternals['stat']>
    const rm = vi.fn(async () => {
      const error = new Error('gone') as NodeJS.ErrnoException
      error.code = 'ENOENT'
      throw error
    }) as NonNullable<WorkspacePathMutationInternals['rm']>
    await expect(deleteWorkspacePath('/w', '/w/x.txt', undefined, { stat, rm })).rejects.toBeInstanceOf(
      WorkspacePathNotFoundError,
    )
  })

  it('deletes when the path exists', async () => {
    const stat = vi.fn(fileStat) as NonNullable<WorkspacePathMutationInternals['stat']>
    const rm = vi.fn(async () => undefined) as NonNullable<WorkspacePathMutationInternals['rm']>
    await expect(deleteWorkspacePath('/w', '/w/x.txt', undefined, { stat, rm })).resolves.toEqual({ path: '/w/x.txt' })
  })
})

describe('renameWorkspacePath', () => {
  it('rejects invalid new names and out-of-bounds sources', async () => {
    await expect(renameWorkspacePath('/w', '/w/a.txt', '../b')).rejects.toBeInstanceOf(WorkspacePathRenameFailedError)
    await expect(renameWorkspacePath('/w', '/outside/a.txt', 'b.txt')).rejects.toBeInstanceOf(
      WorkspacePathOutOfBoundsError,
    )
  })

  it('fails when the target already exists', async () => {
    const stat = vi.fn(async (path: string) => {
      if (path.endsWith('/new.txt')) return { isFile: () => true, isDirectory: () => false } as never
      return { isFile: () => true, isDirectory: () => false } as never
    }) as NonNullable<WorkspacePathMutationInternals['stat']>
    await expect(renameWorkspacePath('/w', '/w/old.txt', 'new.txt', undefined, { stat })).rejects.toBeInstanceOf(
      WorkspaceDirectoryExistsError,
    )
  })

  it('renames when the target is absent', async () => {
    const stat = vi.fn(async (path: string) => {
      if (path.endsWith('/old.txt')) return { isFile: () => true, isDirectory: () => false } as never
      const error = new Error('missing') as NodeJS.ErrnoException
      error.code = 'ENOENT'
      throw error
    }) as NonNullable<WorkspacePathMutationInternals['stat']>
    const rename = vi.fn(async () => undefined) as NonNullable<WorkspacePathMutationInternals['rename']>
    await expect(renameWorkspacePath('/w', '/w/old.txt', 'new.txt', undefined, { stat, rename })).resolves.toEqual({
      path: '/w/new.txt',
    })
  })

  it('maps target probe failures when the source exists', async () => {
    const stat = vi.fn(async (path: string) => {
      if (path.endsWith('/old.txt')) return { isFile: () => true, isDirectory: () => false } as never
      throw new Error('target probe failed')
    }) as NonNullable<WorkspacePathMutationInternals['stat']>
    await expect(renameWorkspacePath('/w', '/w/old.txt', 'new.txt', undefined, { stat })).rejects.toBeInstanceOf(
      WorkspacePathRenameFailedError,
    )
  })

  it('maps source stat and target probe failures', async () => {
    const stat = vi.fn(async (path: string) => {
      if (path.endsWith('/old.txt')) throw new Error('source unreadable')
      throw new Error('target probe failed')
    }) as NonNullable<WorkspacePathMutationInternals['stat']>
    await expect(renameWorkspacePath('/w', '/w/old.txt', 'new.txt', undefined, { stat })).rejects.toBeInstanceOf(
      WorkspacePathRenameFailedError,
    )

    const missingSource = vi.fn(async () => {
      const error = new Error('missing') as NodeJS.ErrnoException
      error.code = 'ENOENT'
      throw error
    }) as NonNullable<WorkspacePathMutationInternals['stat']>
    await expect(renameWorkspacePath('/w', '/w/old.txt', 'new.txt', undefined, { stat: missingSource })).rejects.toBeInstanceOf(
      WorkspacePathNotFoundError,
    )
  })

  it('continues when the target path is absent during the pre-rename probe', async () => {
    const stat = vi.fn(async (path: string) => {
      if (path.endsWith('/old.txt')) return { isFile: () => true, isDirectory: () => false } as never
      const error = new Error('missing target') as NodeJS.ErrnoException
      error.code = 'ENOENT'
      throw error
    }) as NonNullable<WorkspacePathMutationInternals['stat']>
    const rename = vi.fn(async () => undefined) as NonNullable<WorkspacePathMutationInternals['rename']>
    await expect(renameWorkspacePath('/w', '/w/old.txt', 'new.txt', undefined, { stat, rename })).resolves.toEqual({
      path: '/w/new.txt',
    })
    expect(stat).toHaveBeenCalledTimes(2)
  })

  it('maps rename failures from the filesystem', async () => {
    const stat = vi.fn(async (path: string) => {
      if (path.endsWith('/old.txt')) return { isFile: () => true, isDirectory: () => false } as never
      const error = new Error('missing') as NodeJS.ErrnoException
      error.code = 'ENOENT'
      throw error
    }) as NonNullable<WorkspacePathMutationInternals['stat']>
    const rename = vi.fn(async () => {
      const error = new Error('exists') as NodeJS.ErrnoException
      error.code = 'EEXIST'
      throw error
    }) as NonNullable<WorkspacePathMutationInternals['rename']>
    await expect(renameWorkspacePath('/w', '/w/old.txt', 'new.txt', undefined, { stat, rename })).rejects.toBeInstanceOf(
      WorkspaceDirectoryExistsError,
    )

    const renameBusy = vi.fn(async () => {
      throw new Error('busy')
    }) as NonNullable<WorkspacePathMutationInternals['rename']>
    await expect(renameWorkspacePath('/w', '/w/old.txt', 'new.txt', undefined, { stat, rename: renameBusy })).rejects.toBeInstanceOf(
      WorkspacePathRenameFailedError,
    )

    const renameMissing = vi.fn(async () => {
      const error = new Error('gone') as NodeJS.ErrnoException
      error.code = 'ENOENT'
      throw error
    }) as NonNullable<WorkspacePathMutationInternals['rename']>
    await expect(renameWorkspacePath('/w', '/w/old.txt', 'new.txt', undefined, { stat, rename: renameMissing })).rejects.toBeInstanceOf(
      WorkspacePathNotFoundError,
    )
  })
})

describe('createWorkspaceDirectory', () => {
  it('rejects invalid names and out-of-bounds parents', async () => {
    await expect(createWorkspaceDirectory('/w', '/w', '../bad')).rejects.toBeInstanceOf(
      WorkspaceDirectoryCreateFailedError,
    )
    await expect(createWorkspaceDirectory('/w', '/outside', 'child')).rejects.toBeInstanceOf(
      WorkspacePathOutOfBoundsError,
    )
  })

  it('maps EEXIST to WorkspaceDirectoryExistsError', async () => {
    const mkdir = vi.fn(async () => {
      const error = new Error('exists') as NodeJS.ErrnoException
      error.code = 'EEXIST'
      throw error
    }) as NonNullable<WorkspacePathMutationInternals['mkdir']>
    await expect(createWorkspaceDirectory('/w', '/w', 'src', undefined, { mkdir })).rejects.toBeInstanceOf(
      WorkspaceDirectoryExistsError,
    )
  })

  it('creates a directory when absent', async () => {
    const mkdir = vi.fn(async () => undefined) as NonNullable<WorkspacePathMutationInternals['mkdir']>
    await expect(createWorkspaceDirectory('/w', '/w', 'src', undefined, { mkdir })).resolves.toEqual({
      path: '/w/src',
    })
  })

  it('maps non-EEXIST mkdir failures', async () => {
    const mkdir = vi.fn(async () => {
      throw 'permission denied'
    }) as NonNullable<WorkspacePathMutationInternals['mkdir']>
    await expect(createWorkspaceDirectory('/w', '/w', 'src', undefined, { mkdir })).rejects.toBeInstanceOf(
      WorkspaceDirectoryCreateFailedError,
    )
  })
})
