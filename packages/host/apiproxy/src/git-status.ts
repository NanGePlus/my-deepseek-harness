/**
 * host.gitStatus: read-only Git working-tree badges for a Workspace root.
 */

import { basename, isAbsolute, resolve } from 'node:path'
import { runNativeCommand, type NativeCommandRunner } from '@deepseek-ai/dsh-native-command'
import type { GitStatusEntry, GitStatusListing } from './api/host.ts'

/** `git status` argv that lists files inside untracked directories. */
export const GIT_PORCELAIN_UNTRACKED_FILES = ['status', '--porcelain', '--untracked-files=all'] as const

/** Injectable command runner for host integration tests. */
export interface GitStatusInternals {
  run?: NativeCommandRunner
}

/**
 * True when `git` failed because the binary is missing or the directory is not a repository.
 * @param error - rejection from {@link runNativeCommand}.
 * @returns whether the caller should treat Git as absent.
 */
export function isBenignGitAbsence(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false
  const code = 'code' in error ? error.code : undefined
  if (code === 'ENOENT') return true
  const stderr = 'stderr' in error && typeof error.stderr === 'string' ? error.stderr : ''
  const message = error instanceof Error ? error.message : String(error)
  const text = `${message}\n${stderr}`
  return text.includes('not a git repository')
    || text.includes('Not a git repository')
    || text.includes('not a git repo')
}

/**
 * Map one porcelain index/work-tree pair to a Client badge letter.
 * @param indexStatus - first porcelain column.
 * @param workTreeStatus - second porcelain column.
 * @returns the badge letter, or undefined when the row is ignored.
 */
export function porcelainStatusToLetter(indexStatus: string, workTreeStatus: string): string | undefined {
  if (indexStatus === '?' && workTreeStatus === '?') return 'U'
  if (indexStatus === 'D' || workTreeStatus === 'D') return 'D'
  if (indexStatus === 'M' || workTreeStatus === 'M') return 'M'
  if (indexStatus === 'A' || workTreeStatus === 'A') return 'M'
  if (indexStatus === 'R' || workTreeStatus === 'R') return 'M'
  if (indexStatus === 'C' || workTreeStatus === 'C') return 'M'
  return undefined
}

/** Basenames omitted from Git-panel lists and file-tree Git badges. */
const GIT_UI_HIDDEN_BASENAMES = new Set(['.DS_Store'])

/**
 * True when a repository-relative porcelain path should appear in Git UI surfaces.
 * @param relativePath - path after porcelain unquoting and slash normalization.
 */
export function isGitUiVisibleRelativePath(relativePath: string): boolean {
  return !GIT_UI_HIDDEN_BASENAMES.has(basename(relativePath))
}

/**
 * Decode Git's C-style quoted porcelain path body into a UTF-8 path string.
 * @param body - text inside the surrounding quotes.
 */
function unquotePorcelainPath(body: string): string {
  const bytes: number[] = []
  for (let index = 0; index < body.length; index++) {
    const char = body.charAt(index)
    if (char !== '\\') {
      bytes.push(char.charCodeAt(0))
      continue
    }
    const next = body.charAt(index + 1)
    if (next === 'n') { bytes.push(0x0A); index++; continue }
    if (next === 't') { bytes.push(0x09); index++; continue }
    if (next === 'r') { bytes.push(0x0D); index++; continue }
    if (next === 'b') { bytes.push(0x08); index++; continue }
    if (next === 'f') { bytes.push(0x0C); index++; continue }
    if (next === 'v') { bytes.push(0x0B); index++; continue }
    if (next === 'a') { bytes.push(0x07); index++; continue }
    if (next === '\\' || next === '"') { bytes.push(next.charCodeAt(0)); index++; continue }
    const octal = /^[0-7]{1,3}/.exec(body.slice(index + 1))
    if (octal !== null) {
      bytes.push(parseInt(octal[0], 8))
      index += octal[0].length
      continue
    }
    bytes.push(next.charCodeAt(0))
    index++
  }
  return Buffer.from(bytes).toString('utf8')
}

/**
 * Parse the path field from one `git status --porcelain` row.
 * @param raw - text after the two status columns and separating space.
 * @returns the repository-relative path Git named for the row.
 */
export function parsePorcelainPath(raw: string): string {
  const renamed = raw.indexOf(' -> ')
  const pathField = renamed === -1 ? raw.trim() : raw.slice(renamed + 4).trim()
  if (!pathField.startsWith('"') || !pathField.endsWith('"')) return pathField
  return unquotePorcelainPath(pathField.slice(1, -1))
}

/**
 * Parse, unquote, and normalize one porcelain path field to forward slashes.
 * @param raw - text after the two status columns and separating space.
 */
export function normalizePorcelainRelativePath(raw: string): string {
  return parsePorcelainPath(raw).replaceAll('\\', '/').replace(/\/+$/, '')
}

/**
 * Parse porcelain stdout into badge rows relative to `workspaceRoot`.
 * @param stdout - raw `git status --porcelain --untracked-files=all` output.
 * @param workspaceRoot - canonical Workspace directory used as `-C`.
 * @returns sorted absolute-path entries for the Client file tree.
 */
export function parseGitPorcelain(stdout: string, workspaceRoot: string): GitStatusEntry[] {
  const root = resolve(workspaceRoot)
  const entries: GitStatusEntry[] = []
  for (const line of stdout.split('\n')) {
    if (line.length < 4 || line[2] !== ' ') continue
    const indexStatus = line[0]
    const workTreeStatus = line[1]
    if (indexStatus === undefined || workTreeStatus === undefined) continue
    const letter = porcelainStatusToLetter(indexStatus, workTreeStatus)
    if (letter === undefined) continue
    const relativePath = normalizePorcelainRelativePath(line.slice(3))
    if (relativePath === '' || !isGitUiVisibleRelativePath(relativePath)) continue
    const absolutePath = isAbsolute(relativePath) ? resolve(relativePath) : resolve(root, relativePath)
    entries.push({ path: absolutePath, letter })
  }
  entries.sort((left, right) => left.path.localeCompare(right.path))
  return entries
}

/**
 * Read Git badge letters for one Workspace root via `git status --porcelain --untracked-files=all`.
 * @param workspaceRoot - canonical bound Workspace directory.
 * @param signal - caller lifetime; abort terminates the git child.
 * @param internals - optional test doubles.
 * @returns badge rows, or an empty list when Git is absent.
 */
export async function readGitStatus(
  workspaceRoot: string,
  signal: AbortSignal,
  internals: GitStatusInternals = {},
): Promise<GitStatusListing> {
  const run = internals.run ?? runNativeCommand
  try {
    const { stdout } = await run('git', ['-C', workspaceRoot, ...GIT_PORCELAIN_UNTRACKED_FILES], signal)
    return { entries: parseGitPorcelain(stdout, workspaceRoot) }
  } catch (error: unknown) {
    if (signal.aborted) throw error
    if (isBenignGitAbsence(error)) return { entries: [] }
    throw error
  }
}
