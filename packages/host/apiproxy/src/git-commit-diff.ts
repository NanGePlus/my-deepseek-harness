/**
 * First-parent commit file diffs for the Git panel Graph selection.
 */

import { realpathSync } from 'node:fs'
import { runNativeCommand, type NativeCommandRunner } from '@deepseek-ai/dsh-native-command'
import type {
  GitCommitDiffFile, GitCommitDiffFileStatus, GitCommitDiffResult, GitDiffPreview,
} from './api/host.ts'
import { isGitUiVisibleRelativePath } from './git-status.ts'
import {
  GitCommandFailedError, isGitUnavailable, isNotAGitRepository, parseUnifiedDiff,
} from './git-working-tree.ts'

/** Maximum files returned for one commit; extra files set `truncated`. */
export const GIT_COMMIT_DIFF_MAX_FILES = 80

/** One name-status row after a first-parent commit diff. */
export interface ParsedNameStatus {
  status: GitCommitDiffFileStatus
  path: string
}

/**
 * Run `git -C repo …` and return stdout.
 * @param run - command runner.
 * @param repo - directory passed to `-C`.
 * @param args - git argv after `-C repo`.
 * @param signal - caller lifetime.
 */
async function git(
  run: NativeCommandRunner,
  repo: string,
  args: readonly string[],
  signal: AbortSignal,
): Promise<string> {
  const { stdout } = await run('git', ['-C', repo, ...args], signal)
  return stdout
}

function gitFailureMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'stderr' in error && typeof error.stderr === 'string' && error.stderr.trim() !== '') {
    return error.stderr.trim()
  }
  return error instanceof Error ? error.message : String(error)
}

function numstatIsBinary(numstat: string): boolean {
  return numstat.trimStart().startsWith('-\t-')
}

function mapStatusLetter(letter: string): GitCommitDiffFileStatus | undefined {
  if (letter === 'A' || letter === 'C') return 'added'
  if (letter === 'D') return 'deleted'
  if (letter === 'R') return 'renamed'
  if (letter === 'M' || letter === 'T' || letter === 'U') return 'modified'
  return undefined
}

function pushStatus(
  rows: ParsedNameStatus[],
  letter: string,
  path: string | undefined,
): void {
  if (path === undefined || path === '') return
  const status = mapStatusLetter(letter)
  if (status === undefined) return
  rows.push({ status, path })
}

/**
 * Parse `git diff --name-status` / `git diff-tree --name-status` stdout. NUL-delimited (`-z`) and
 * newline/tab records are both accepted.
 * @param stdout - raw name-status output.
 */
export function parseNameStatus(stdout: string): ParsedNameStatus[] {
  if (stdout.includes('\0')) return parseNameStatusNul(stdout)
  const rows: ParsedNameStatus[] = []
  for (const line of stdout.split('\n')) {
    if (line === '') continue
    const letter = line.charAt(0)
    const parts = line.split('\t')
    if (letter === 'R' || letter === 'C') {
      pushStatus(rows, letter, parts[2])
      continue
    }
    pushStatus(rows, letter, parts[1])
  }
  return rows
}

function parseNameStatusNul(stdout: string): ParsedNameStatus[] {
  const parts = stdout.split('\0')
  const rows: ParsedNameStatus[] = []
  let index = 0
  while (index < parts.length) {
    const code = parts[index]
    if (code === undefined || code === '') {
      index += 1
      continue
    }
    const letter = code.charAt(0)
    if (letter === 'R' || letter === 'C') {
      pushStatus(rows, letter, parts[index + 2])
      index += 3
      continue
    }
    pushStatus(rows, letter, parts[index + 1])
    index += 2
  }
  return rows
}

function nameStatusArgv(resolved: string, isRoot: boolean): string[] {
  if (isRoot) {
    return ['diff-tree', '--no-commit-id', '-r', '--find-renames', '--root', '-z', '--name-status', resolved]
  }
  return ['diff', '--find-renames', '-z', '--name-status', `${resolved}^`, resolved]
}

function fileStatArgv(resolved: string, isRoot: boolean, path: string): string[] {
  if (isRoot) {
    return ['diff-tree', '--no-commit-id', '-r', '--find-renames', '--root', '--numstat', resolved, '--', path]
  }
  return ['diff', '--find-renames', '--numstat', `${resolved}^`, resolved, '--', path]
}

function filePatchArgv(resolved: string, isRoot: boolean, path: string): string[] {
  if (isRoot) {
    return ['diff-tree', '--no-commit-id', '-r', '--find-renames', '--root', '-p', resolved, '--', path]
  }
  return ['diff', '--find-renames', `${resolved}^`, resolved, '--', path]
}

/**
 * Build one file's preview versus the first parent (empty tree for a root).
 * @param run - command runner.
 * @param repoRoot - absolute Git repository root.
 * @param resolved - full commit hash.
 * @param isRoot - true when the commit has no parents.
 * @param file - name-status row.
 * @param signal - caller lifetime.
 */
async function previewForFile(
  run: NativeCommandRunner,
  repoRoot: string,
  resolved: string,
  isRoot: boolean,
  file: ParsedNameStatus,
  signal: AbortSignal,
): Promise<GitDiffPreview> {
  const numstat = await git(run, repoRoot, fileStatArgv(resolved, isRoot, file.path), signal)
  const binary = numstatIsBinary(numstat)
  if (file.status === 'added') {
    if (binary) return { kind: 'binary' }
    return { kind: 'untracked-text', text: await git(run, repoRoot, ['show', `${resolved}:${file.path}`], signal) }
  }
  if (file.status === 'deleted') {
    if (binary) return { kind: 'deleted-binary' }
    return { kind: 'deleted-text', text: await git(run, repoRoot, ['show', `${resolved}^:${file.path}`], signal) }
  }
  if (binary) return { kind: 'binary' }
  const diff = await git(run, repoRoot, filePatchArgv(resolved, isRoot, file.path), signal)
  const fileText = await git(run, repoRoot, ['show', `${resolved}:${file.path}`], signal)
  return { kind: 'text', hunks: parseUnifiedDiff(diff), fileText }
}

/**
 * Read first-parent file diffs for one commit discovered from a bound Workspace root.
 * @param workspaceRoot - canonical bound Workspace directory.
 * @param hash - abbreviated or full commit hash from the Graph.
 * @param signal - caller lifetime.
 * @param run - injectable command runner for tests.
 * @param maxFiles - file cap; tests may lower it.
 */
export async function readGitCommitDiff(
  workspaceRoot: string,
  hash: string,
  signal: AbortSignal,
  run: NativeCommandRunner = runNativeCommand,
  maxFiles: number = GIT_COMMIT_DIFF_MAX_FILES,
): Promise<GitCommitDiffResult> {
  try {
    const toplevel = await git(run, workspaceRoot, ['rev-parse', '--show-toplevel'], signal)
    const repoRoot = realpathSync.native(toplevel.trim())
    const resolved = (await git(run, repoRoot, ['rev-parse', '--verify', `${hash}^{commit}`], signal)).trim()
    const parentsLine = (await git(run, repoRoot, ['rev-list', '--parents', '-n', '1', resolved], signal)).trim()
    const isRoot = parentsLine.split(/\s+/).length <= 1
    const nameStatus = await git(run, repoRoot, nameStatusArgv(resolved, isRoot), signal)
    const listed = parseNameStatus(nameStatus).filter(file => isGitUiVisibleRelativePath(file.path))
    const truncated = listed.length > maxFiles
    const slice = truncated ? listed.slice(0, maxFiles) : listed
    const files: GitCommitDiffFile[] = []
    for (const file of slice) {
      files.push({
        path: file.path,
        status: file.status,
        preview: await previewForFile(run, repoRoot, resolved, isRoot, file, signal),
      })
    }
    return { availability: 'repository', hash: resolved, files, truncated }
  } catch (error: unknown) {
    if (error instanceof GitCommandFailedError) throw error
    if (signal.aborted) throw error
    if (isGitUnavailable(error)) return { availability: 'git-unavailable' }
    if (isNotAGitRepository(error)) return { availability: 'not-a-repository' }
    throw new GitCommandFailedError(gitFailureMessage(error))
  }
}
