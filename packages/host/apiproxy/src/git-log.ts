/**
 * Typed Git commit-log read for the Git panel graph.
 */

import { realpathSync } from 'node:fs'
import { runNativeCommand, type NativeCommandRunner } from '@deepseek-ai/dsh-native-command'
import type { GitLogEntry, GitLogResult } from './api/host.ts'
import { isGitUnavailable, isNotAGitRepository } from './git-working-tree.ts'

/** Default page size returned by {@link readGitLog}. */
export const GIT_LOG_DEFAULT_LIMIT = 50

const FIELD = '\x1f'
const RECORD = '\x1e'

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

/**
 * Parse `%D` decoration into display labels (current branch, remotes, tags).
 * Remote names keep their `origin/` prefix so the Graph can style them apart
 * from a local branch of the same short name. Symbolic `HEAD` / `origin/HEAD`
 * pointers are omitted.
 * @param decoration - raw `%D` field from git log.
 */
export function parseGitLogRefs(decoration: string): string[] {
  if (decoration.trim() === '') return []
  const refs: string[] = []
  for (const part of decoration.split(',')) {
    let label = part.trim()
    if (label === '') continue
    if (label.startsWith('HEAD -> ')) label = label.slice('HEAD -> '.length)
    if (label.startsWith('tag: ')) label = label.slice('tag: '.length)
    if (label === 'HEAD' || label.endsWith('/HEAD')) continue
    if (!refs.includes(label)) refs.push(label)
  }
  return refs
}

/**
 * Parse `git log` stdout produced by {@link readGitLog}.
 * Git appends a newline after each `--format` record, so hashes after the first
 * record would otherwise keep a leading `\n` and fail to match parent pointers.
 * @param stdout - raw git log output.
 */
export function parseGitLogOutput(stdout: string): GitLogEntry[] {
  const trimmed = stdout.trim()
  if (trimmed === '') return []
  const commits: GitLogEntry[] = []
  for (const record of trimmed.split(RECORD)) {
    const cleaned = record.trim()
    if (cleaned === '') continue
    const parts = cleaned.split(FIELD)
    const [
      hash = '',
      shortHash = '',
      parentsRaw = '',
      subject = '',
      authorName = '',
      authorDate = '',
      decoration = '',
    ] = parts
    if (hash === '') continue
    const parents = parentsRaw.trim() === '' ? [] : parentsRaw.trim().split(/\s+/)
    commits.push({
      hash,
      shortHash,
      parents,
      subject,
      authorName,
      authorDate,
      body: parts.slice(7).join(FIELD),
      refs: parseGitLogRefs(decoration),
    })
  }
  return commits
}

/**
 * Build `git log` paging argv (`--max-count` is `limit + 1` so {@link sliceGitLogPage} can set `hasMore`).
 * @param limit - page size the caller asked for.
 * @param skip - commits to omit from the newest end of history.
 */
export function gitLogPagingArgs(limit: number, skip: number): string[] {
  const args = [`--max-count=${limit + 1}`]
  if (skip > 0) args.push(`--skip=${skip}`)
  return args
}

/**
 * Keep at most `limit` commits and report whether the probe row existed.
 * @param fetched - commits from `git log --max-count=limit+1`.
 * @param limit - page size requested by the caller.
 */
export function sliceGitLogPage(
  fetched: GitLogEntry[],
  limit: number,
): { commits: GitLogEntry[]; hasMore: boolean } {
  const hasMore = fetched.length > limit
  return { commits: hasMore ? fetched.slice(0, limit) : fetched, hasMore }
}

/**
 * Read one page of commits for the repository discovered from a bound Workspace root.
 * @param workspaceRoot - canonical bound Workspace directory.
 * @param signal - caller lifetime.
 * @param limit - maximum commits to return after the skip.
 * @param skip - commits to omit from the newest end of history.
 * @param run - injectable command runner for tests.
 */
export async function readGitLog(
  workspaceRoot: string,
  signal: AbortSignal,
  limit: number = GIT_LOG_DEFAULT_LIMIT,
  skip: number = 0,
  run: NativeCommandRunner = runNativeCommand,
): Promise<GitLogResult> {
  try {
    const toplevel = await git(run, workspaceRoot, ['rev-parse', '--show-toplevel'], signal)
    const repoRoot = realpathSync.native(toplevel.trim())
    const format = ['%H', '%h', '%P', '%s', '%an', '%aI', '%D', '%b'].join(FIELD)
    const stdout = await git(
      run,
      repoRoot,
      ['log', ...gitLogPagingArgs(limit, skip), '--topo-order', `--format=${format}${RECORD}`],
      signal,
    )
    const page = sliceGitLogPage(parseGitLogOutput(stdout), limit)
    return {
      availability: 'repository',
      repoRoot,
      commits: page.commits,
      hasMore: page.hasMore,
    }
  } catch (error: unknown) {
    if (signal.aborted) throw error
    if (isGitUnavailable(error)) return { availability: 'git-unavailable' }
    if (isNotAGitRepository(error)) return { availability: 'not-a-repository' }
    throw error
  }
}
