/**
 * host.gitWorkingTree: typed Git inspect for the Git panel (repo discovery + change lists).
 */

import { realpathSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { relative, resolve, sep } from 'node:path'
import { runNativeCommand, type NativeCommandRunner } from '@deepseek-ai/dsh-native-command'
import type { GitDiffHunk, GitDiffPreview, GitDiffSide, GitWorkingTreeChange, GitWorkingTreeResult } from './api/host.ts'
import { parsePorcelainPath } from './git-status.ts'
import { pathWithinWorkspace } from './list-workspace-entries.ts'

/**
 * True when `git` failed because the binary is missing from PATH.
 * @param error - rejection from {@link runNativeCommand}.
 */
export function isGitUnavailable(error: unknown): boolean {
  /* v8 ignore next -- runNativeCommand rejects with objects. */
  if (typeof error !== 'object' || error === null) return false
  return ('code' in error ? error.code : undefined) === 'ENOENT'
}

/**
 * True when Git ran but the directory (and its ancestors) are not a repository.
 * @param error - rejection from {@link runNativeCommand}.
 */
export function isNotAGitRepository(error: unknown): boolean {
  /* v8 ignore next -- runNativeCommand rejects with objects. */
  if (typeof error !== 'object' || error === null) return false
  const stderr = 'stderr' in error && typeof error.stderr === 'string' ? error.stderr : ''
  const message = error instanceof Error ? error.message : String(error)
  const text = `${message}\n${stderr}`
  return text.includes('not a git repository')
    || text.includes('Not a git repository')
    || text.includes('not a git repo')
}

/**
 * Run `git -C repo …` and return stdout (including a leading porcelain space).
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

/**
 * Read the current branch name, or Git's detached-HEAD description.
 * @param run - command runner.
 * @param repoRoot - absolute Git repository root.
 * @param signal - caller lifetime.
 */
async function readCurrentBranch(
  run: NativeCommandRunner,
  repoRoot: string,
  signal: AbortSignal,
): Promise<string> {
  try {
    return (await git(run, repoRoot, ['symbolic-ref', '-q', '--short', 'HEAD'], signal)).trim()
  } catch (error: unknown) {
    if (signal.aborted) throw error
    const short = (await git(run, repoRoot, ['rev-parse', '--short', 'HEAD'], signal)).trim()
    return `HEAD detached at ${short}`
  }
}

const UNMERGED_PAIRS = new Set(['DD', 'AU', 'UD', 'UA', 'DU', 'AA', 'UU'])

/**
 * Split `git status --porcelain` into unstaged and staged change rows.
 * Ignored paths never appear in default porcelain output. Unmerged paths
 * are listed as unstaged only.
 * @param stdout - raw porcelain v1 stdout.
 * @param repoRoot - absolute Git repository root.
 */
export function parseWorkingTreePorcelain(
  stdout: string,
  repoRoot: string,
): { unstaged: GitWorkingTreeChange[]; staged: GitWorkingTreeChange[] } {
  const unstaged: GitWorkingTreeChange[] = []
  const staged: GitWorkingTreeChange[] = []
  const root = resolve(repoRoot)
  for (const line of stdout.split('\n')) {
    if (line.length < 4 || line[2] !== ' ') continue
    const indexStatus = line.charAt(0)
    const workTreeStatus = line.charAt(1)
    const relativePath = parsePorcelainPath(line.slice(3)).replaceAll('\\', '/')
    /* v8 ignore next -- porcelain never emits an empty path after the status prefix. */
    if (relativePath === '') continue
    const absolutePath = resolve(root, relativePath)
    const row: GitWorkingTreeChange = { path: relativePath, absolutePath }
    const pair = `${indexStatus}${workTreeStatus}`
    if (UNMERGED_PAIRS.has(pair) || (indexStatus === '?' && workTreeStatus === '?')) {
      unstaged.push(row)
      continue
    }
    if (indexStatus !== ' ' && indexStatus !== '?') staged.push(row)
    if (workTreeStatus !== ' ' && workTreeStatus !== '?') unstaged.push(row)
  }
  unstaged.sort((left, right) => left.path.localeCompare(right.path))
  staged.sort((left, right) => left.path.localeCompare(right.path))
  return { unstaged, staged }
}

/**
 * Inspect the Git working tree for one bound Workspace.
 * @param workspaceRoot - canonical bound Workspace directory.
 * @param signal - caller lifetime; abort terminates git children.
 * @returns Git unavailable, not-a-repository, or repository state with both change lists.
 */
export async function inspectGitWorkingTree(
  workspaceRoot: string,
  signal: AbortSignal,
): Promise<GitWorkingTreeResult> {
  const run = runNativeCommand
  try {
    const toplevel = await git(run, workspaceRoot, ['rev-parse', '--show-toplevel'], signal)
    const repoRoot = realpathSync.native(toplevel.trim())
    const branch = await readCurrentBranch(run, repoRoot, signal)
    const porcelain = await git(run, repoRoot, ['status', '--porcelain'], signal)
    const { unstaged, staged } = parseWorkingTreePorcelain(porcelain, repoRoot)
    return {
      availability: 'repository',
      repoRoot,
      branch,
      unstaged,
      staged,
    }
  } catch (error: unknown) {
    if (signal.aborted) throw error
    if (isGitUnavailable(error)) return { availability: 'git-unavailable' }
    if (isNotAGitRepository(error)) return { availability: 'not-a-repository' }
    throw error
  }
}

/** git is missing from PATH. */
export class GitUnavailableError extends Error {
  constructor() {
    super('git is unavailable')
    this.name = 'GitUnavailableError'
  }
}

/** An ancestor of the bound Workspace is already a Git repository. */
export class AlreadyAGitRepositoryError extends Error {
  constructor(readonly repoRoot: string) {
    super(`already a git repository: ${repoRoot}`)
    this.name = 'AlreadyAGitRepositoryError'
  }
}

/** A typed git invocation failed; {@link Error.message} is Git's own text. */
export class GitCommandFailedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'GitCommandFailedError'
  }
}

function gitFailureMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'stderr' in error && typeof error.stderr === 'string' && error.stderr.trim() !== '') {
    return error.stderr.trim()
  }
  return error instanceof Error ? error.message : String(error)
}

/**
 * Initialize a Git repository at the bound Workspace root.
 * @param workspaceRoot - canonical bound Workspace directory.
 * @param signal - caller lifetime.
 * @returns the Workspace path after a successful `git init`.
 */
export async function initGitRepository(
  workspaceRoot: string,
  signal: AbortSignal,
): Promise<{ repoRoot: string }> {
  const run = runNativeCommand
  try {
    const toplevel = await git(run, workspaceRoot, ['rev-parse', '--show-toplevel'], signal)
    throw new AlreadyAGitRepositoryError(realpathSync.native(toplevel.trim()))
  } catch (error: unknown) {
    if (error instanceof AlreadyAGitRepositoryError) throw error
    if (signal.aborted) throw error
    if (isGitUnavailable(error)) throw new GitUnavailableError()
    if (!isNotAGitRepository(error)) throw new GitCommandFailedError(gitFailureMessage(error))
  }
  try {
    await git(run, workspaceRoot, ['init'], signal)
    return { repoRoot: realpathSync.native(workspaceRoot) }
  } catch (error: unknown) {
    if (signal.aborted) throw error
    if (isGitUnavailable(error)) throw new GitUnavailableError()
    throw new GitCommandFailedError(gitFailureMessage(error))
  }
}

/** The requested path is not a working-tree change under the repository root. */
export class GitPathNotFoundError extends Error {
  constructor(readonly path: string) {
    super(`git path not found: ${path}`)
    this.name = 'GitPathNotFoundError'
  }
}

function containsNul(bytes: Uint8Array): boolean {
  return bytes.includes(0)
}

/**
 * Parse a unified diff into hunks. Lines before the first `@@` header are ignored.
 * @param diff - `git diff` stdout.
 */
export function parseUnifiedDiff(diff: string): GitDiffHunk[] {
  const hunks: GitDiffHunk[] = []
  let current: GitDiffHunk | undefined
  for (const line of diff.split('\n')) {
    if (line.startsWith('@@')) {
      current = { header: line, lines: [] }
      hunks.push(current)
      continue
    }
    if (current === undefined) continue
    if (line.startsWith('\\')) continue
    const originChar = line[0]
    if (originChar === '+') current.lines.push({ origin: 'add', text: line.slice(1) })
    else if (originChar === '-') current.lines.push({ origin: 'del', text: line.slice(1) })
    else if (originChar === ' ') current.lines.push({ origin: 'context', text: line.slice(1) })
  }
  return hunks
}

function porcelainPairForPath(porcelain: string, relativePath: string): { index: string; work: string } | undefined {
  for (const line of porcelain.split('\n')) {
    if (line.length < 4 || line[2] !== ' ') continue
    const index = line.charAt(0)
    const work = line.charAt(1)
    if (parsePorcelainPath(line.slice(3)).replaceAll('\\', '/') === relativePath) {
      return { index, work }
    }
  }
  return undefined
}

function repoRelativePath(repoRoot: string, absolutePath: string): string {
  if (!pathWithinWorkspace(repoRoot, absolutePath)) {
    throw new GitPathNotFoundError(absolutePath)
  }
  return relative(resolve(repoRoot), resolve(absolutePath)).split(sep).join('/')
}

function numstatIsBinary(numstat: string): boolean {
  return numstat.startsWith('-\t-')
}

/**
 * Read a disk-only diff preview for one path in one change list.
 * @param workspaceRoot - canonical bound Workspace directory.
 * @param absolutePath - Host-absolute path under the Git repository root.
 * @param side - unstaged vs staged list.
 * @param signal - caller lifetime.
 */
export async function readGitDiffPreview(
  workspaceRoot: string,
  absolutePath: string,
  side: GitDiffSide,
  signal: AbortSignal,
): Promise<GitDiffPreview> {
  const run = runNativeCommand
  try {
    const repoRoot = realpathSync.native((await git(run, workspaceRoot, ['rev-parse', '--show-toplevel'], signal)).trim())
    const rel = repoRelativePath(repoRoot, absolutePath)
    const porcelain = await git(run, repoRoot, ['status', '--porcelain', '--', rel], signal)
    const pair = porcelainPairForPath(porcelain, rel)
    if (pair === undefined) throw new GitPathNotFoundError(absolutePath)

    if (side === 'unstaged') {
      if (pair.index === '?' && pair.work === '?') {
        const bytes = await readFile(absolutePath)
        if (containsNul(bytes)) return { kind: 'binary' }
        return { kind: 'untracked-text', text: bytes.toString('utf8') }
      }
      if (UNMERGED_PAIRS.has(`${pair.index}${pair.work}`) || (pair.work !== ' ' && pair.work !== '?')) {
        if (pair.work === 'D') {
          const numstat = await git(run, repoRoot, ['diff', '--numstat', '--', rel], signal)
          if (numstatIsBinary(numstat)) return { kind: 'deleted-binary' }
          const blobSpec = pair.index === ' ' || pair.index === '?' ? `HEAD:${rel}` : `:${rel}`
          return { kind: 'deleted-text', text: await git(run, repoRoot, ['show', blobSpec], signal) }
        }
        const numstat = await git(run, repoRoot, ['diff', '--numstat', '--', rel], signal)
        if (numstatIsBinary(numstat)) return { kind: 'binary' }
        const diff = await git(run, repoRoot, ['diff', '--', rel], signal)
        return { kind: 'text', hunks: parseUnifiedDiff(diff) }
      }
      throw new GitPathNotFoundError(absolutePath)
    }

    if (pair.index === ' ' || pair.index === '?') throw new GitPathNotFoundError(absolutePath)
    if (pair.index === 'D') {
      const numstat = await git(run, repoRoot, ['diff', '--cached', '--numstat', '--', rel], signal)
      if (numstatIsBinary(numstat)) return { kind: 'deleted-binary' }
      return { kind: 'deleted-text', text: await git(run, repoRoot, ['show', `HEAD:${rel}`], signal) }
    }
    const numstat = await git(run, repoRoot, ['diff', '--cached', '--numstat', '--', rel], signal)
    if (numstatIsBinary(numstat)) return { kind: 'binary' }
    const diff = await git(run, repoRoot, ['diff', '--cached', '--', rel], signal)
    return { kind: 'text', hunks: parseUnifiedDiff(diff) }
  } catch (error: unknown) {
    if (error instanceof GitUnavailableError || error instanceof GitPathNotFoundError) throw error
    if (signal.aborted) throw error
    if (isGitUnavailable(error)) throw new GitUnavailableError()
    if (isNotAGitRepository(error)) throw new GitPathNotFoundError(absolutePath)
    throw new GitCommandFailedError(gitFailureMessage(error))
  }
}
