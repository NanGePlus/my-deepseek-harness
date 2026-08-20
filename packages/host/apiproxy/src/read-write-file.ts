/**
 * host.readFile / host.writeFile: bounded file I/O inside a Workspace root.
 */

import { readFile, stat, writeFile } from 'node:fs/promises'
import { extname, resolve } from 'node:path'
import {
  pathWithinWorkspace,
  WorkspacePathOutOfBoundsError,
} from './list-workspace-entries.ts'

/** Injectable filesystem steps for host integration tests. */
export interface ReadWriteFileInternals {
  stat?: (path: string) => ReturnType<typeof stat>
  readFile?: (...args: Parameters<typeof readFile>) => ReturnType<typeof readFile>
  writeFile?: (...args: Parameters<typeof writeFile>) => ReturnType<typeof writeFile>
}

/** host.readFile request discriminator: text for editable sources, bytes for image preview. */
export type FileReadKind = 'text' | 'bytes'

/** host.readFile response when `kind` is `text`. */
export interface FileTextRead {
  kind: 'text'
  /** Absolute host path of the read file. */
  path: string
  /** UTF-8 text content. */
  text: string
}

/** host.readFile response when `kind` is `bytes`. */
export interface FileBytesRead {
  kind: 'bytes'
  /** Absolute host path of the read file. */
  path: string
  /** Canonical base64 of the on-disk bytes. */
  data: string
  /** Image media type derived from the file extension. */
  mediaType: string
}

/** host.readFile response value. */
export type FileReadResult = FileTextRead | FileBytesRead

/** host.writeFile response value. */
export interface FileWriteResult {
  /** Absolute host path written. */
  path: string
}

const IMAGE_MEDIA_TYPES: Readonly<Record<string, string>> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
}

/**
 * Map a file extension to an image media type for byte reads.
 * @param path - absolute file path.
 * @returns the media type for known image extensions, otherwise `application/octet-stream`.
 */
export function mediaTypeForImagePath(path: string): string {
  return IMAGE_MEDIA_TYPES[extname(path).toLowerCase()] ?? 'application/octet-stream'
}

/** The thrown value carries Node's `ENOENT` code. */
function isEnoent(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT'
}

/** The thrown value carries Node's `EISDIR` code. */
function isEisdir(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'EISDIR'
}

/** A regular file inside a Workspace was not found on disk. */
export class WorkspaceFileNotFoundError extends Error {
  constructor(readonly path: string) {
    super(`file not found: ${path}`)
    this.name = 'WorkspaceFileNotFoundError'
  }
}

/** A path inside a Workspace is not a regular file. */
export class WorkspaceFileNotRegularError extends Error {
  constructor(readonly path: string) {
    super(`not a regular file: ${path}`)
    this.name = 'WorkspaceFileNotRegularError'
  }
}

/** A regular file inside a Workspace could not be read. */
export class WorkspaceFileUnreadableError extends Error {
  constructor(readonly path: string, cause: string) {
    super(`cannot read ${path}: ${cause}`)
    this.name = 'WorkspaceFileUnreadableError'
  }
}

/** A file inside a Workspace could not be written. */
export class WorkspaceFileWriteFailedError extends Error {
  constructor(readonly path: string, cause: string) {
    super(`cannot write ${path}: ${cause}`)
    this.name = 'WorkspaceFileWriteFailedError'
  }
}

/**
 * Ensure `path` exists and is a regular file before read.
 * @param path - absolute file path.
 * @param signal - caller lifetime.
 */
async function assertRegularFile(
  path: string,
  signal: AbortSignal | undefined,
  statFn: (path: string) => ReturnType<typeof stat>,
): Promise<void> {
  try {
    const info = await statFn(path)
    if (!info.isFile()) throw new WorkspaceFileNotRegularError(path)
  } catch (error: unknown) {
    if (error instanceof WorkspaceFileNotRegularError) throw error
    if (isEnoent(error)) throw new WorkspaceFileNotFoundError(path)
    throw new WorkspaceFileUnreadableError(path, error instanceof Error ? error.message : String(error))
  }
  signal?.throwIfAborted()
}

/**
 * Read one regular file inside a Workspace root.
 * @param workspaceRoot - canonical bound Workspace directory.
 * @param path - absolute file path; must lie within the root.
 * @param kind - text for UTF-8 sources, bytes for image preview payloads.
 * @param signal - caller lifetime forwarded to filesystem I/O.
 * @returns the read payload with the canonical absolute path.
 */
export async function readWorkspaceFile(
  workspaceRoot: string,
  path: string,
  kind: FileReadKind,
  signal?: AbortSignal,
  internals: ReadWriteFileInternals = {},
): Promise<FileReadResult> {
  const statFn = internals.stat ?? stat
  const readFn = internals.readFile ?? readFile
  const target = resolve(path)
  if (!pathWithinWorkspace(workspaceRoot, target)) {
    throw new WorkspacePathOutOfBoundsError(workspaceRoot, target)
  }
  await assertRegularFile(target, signal, statFn)
  try {
    if (kind === 'text') {
      const raw = await readFn(target, { encoding: 'utf8', signal })
      const text = typeof raw === 'string' ? raw : Buffer.from(raw).toString('utf8')
      return { kind: 'text', path: target, text }
    }
    const bytes = await readFn(target, { signal })
    return {
      kind: 'bytes',
      path: target,
      data: Buffer.from(bytes).toString('base64'),
      mediaType: mediaTypeForImagePath(target),
    }
  } catch (error: unknown) {
    signal?.throwIfAborted()
    if (isEnoent(error)) throw new WorkspaceFileNotFoundError(target)
    if (isEisdir(error)) throw new WorkspaceFileNotRegularError(target)
    throw new WorkspaceFileUnreadableError(target, error instanceof Error ? error.message : String(error))
  }
}

/**
 * Write editable text to one path inside a Workspace root, creating the file when absent.
 * @param workspaceRoot - canonical bound Workspace directory.
 * @param path - absolute file path; must lie within the root.
 * @param text - UTF-8 text to persist.
 * @param signal - caller lifetime forwarded to filesystem I/O.
 * @returns the written absolute path.
 */
export async function writeWorkspaceFile(
  workspaceRoot: string,
  path: string,
  text: string,
  signal?: AbortSignal,
  internals: ReadWriteFileInternals = {},
): Promise<FileWriteResult> {
  const writeFn = internals.writeFile ?? writeFile
  const target = resolve(path)
  if (!pathWithinWorkspace(workspaceRoot, target)) {
    throw new WorkspacePathOutOfBoundsError(workspaceRoot, target)
  }
  try {
    await writeFn(target, text, { encoding: 'utf8', signal })
    return { path: target }
  } catch (error: unknown) {
    signal?.throwIfAborted()
    throw new WorkspaceFileWriteFailedError(target, error instanceof Error ? error.message : String(error))
  }
}
