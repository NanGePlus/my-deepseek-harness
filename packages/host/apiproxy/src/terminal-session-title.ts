/** VS Code-style human terminal tab titles: shortened cwd plus foreground command. */

import { homedir } from 'node:os'
import { basename } from 'node:path'
import type { ProcessInspectorInternals } from '@deepseek-ai/dsh-subprocess-local/src/process-inspector.ts'

/** Structured tab title parts mirrored on Host list rows and SSE title frames. */
export interface TerminalSessionTitleParts {
  title: string
  titlePath: string
  titleCommand: string
  cwd: string
}

/** Injectable hooks for unit tests. */
export interface TerminalSessionTitleInternals {
  exec?: ProcessInspectorInternals['exec']
  homeDir?: string
  platform?: NodeJS.Platform
}

const SHELL_NAMES = new Set(['zsh', 'bash', 'sh', '-zsh', '-bash', '-sh'])

/**
 * Shorten an absolute path with a leading home directory prefix.
 * @param path - absolute filesystem path.
 * @param home - home directory prefix.
 */
export function shortenHomePath(path: string, home: string): string {
  if (home.length === 0) return path
  if (path === home) return '~'
  if (path.startsWith(`${home}/`)) return `~${path.slice(home.length)}`
  return path
}

/**
 * Build the user-visible command label from one process comm and args line.
 * @param comm - short process name from ps.
 * @param args - full args line from ps.
 */
export function formatForegroundCommandLabel(comm: string, args: string): string {
  const commBase = basename(comm.trim())
  const trimmedArgs = args.trim()
  if (trimmedArgs.length === 0) return commBase
  const tokens = trimmedArgs.split(/\s+/).filter(token => token.length > 0)
  if (tokens.length === 0) return commBase
  const firstToken = tokens[0] ?? ''
  const firstBase = basename(firstToken)
  const rest = (firstBase === commBase || firstToken.endsWith(`/${commBase}`))
    ? tokens.slice(1).join(' ')
    : trimmedArgs
  return rest.length > 0 ? `${commBase} ${rest}` : commBase
}

interface ForegroundProcessRow {
  pid: number
  comm: string
  args: string
}

/**
 * Read one process cwd from the platform process table.
 * @param pid - target process id.
 * @param exec - injectable exec hook.
 * @param platform - host platform id.
 */
export function readProcessCwd(
  pid: number,
  exec: ProcessInspectorInternals['exec'],
  platform: NodeJS.Platform,
): string | undefined {
  if (platform === 'linux') {
    try {
      const cwd = exec('readlink', [`/proc/${pid}/cwd`]).trim()
      return cwd.length > 0 ? cwd : undefined
    } catch {
      return undefined
    }
  }
  try {
    const output = exec('lsof', ['-a', '-p', String(pid), '-d', 'cwd', '-Fn'])
    const line = output.split('\n').find(entry => entry.startsWith('n'))
    const cwd = line?.slice(1).trim()
    return cwd !== undefined && cwd.length > 0 ? cwd : undefined
  } catch {
    return undefined
  }
}

function listProcessGroupRows(
  pgid: number,
  exec: ProcessInspectorInternals['exec'],
): ForegroundProcessRow[] {
  try {
    const pidLines = exec('ps', ['-g', String(pgid), '-o', 'pid='])
      .split('\n')
      .map(line => Number.parseInt(line.trim(), 10))
      .filter(pid => Number.isFinite(pid) && pid > 0)
    return pidLines.map((pid) => {
      const comm = exec('ps', ['-p', String(pid), '-o', 'comm=']).trim()
      const args = exec('ps', ['-p', String(pid), '-o', 'args=']).trim()
      return { pid, comm, args }
    })
  } catch {
    return []
  }
}

function pickForegroundRow(rows: readonly ForegroundProcessRow[]): ForegroundProcessRow | undefined {
  const nonShell = rows.find(row => !SHELL_NAMES.has(basename(row.comm.trim())))
  return nonShell ?? rows[0]
}

/**
 * Resolve VS Code-style tab title parts from one foreground process group.
 * @param pgid - foreground process group id.
 * @param fallbackCwd - session cwd when process cwd is unavailable.
 * @param profileName - idle shell profile label.
 * @param internals - injectable hooks for tests.
 */
export function resolveTerminalSessionTitleParts(
  pgid: number | undefined,
  fallbackCwd: string,
  profileName: string,
  internals: TerminalSessionTitleInternals = {},
): TerminalSessionTitleParts {
  const exec = internals.exec ?? (() => { throw new Error('exec hook is required') })
  const home = internals.homeDir ?? homedir()
  const platform = internals.platform ?? process.platform

  let cwd = fallbackCwd
  let titleCommand = profileName

  if (pgid !== undefined) {
    const row = pickForegroundRow(listProcessGroupRows(pgid, exec))
    if (row !== undefined) {
      const processCwd = readProcessCwd(row.pid, exec, platform)
      if (processCwd !== undefined) cwd = processCwd
      const commBase = basename(row.comm.trim())
      if (!SHELL_NAMES.has(commBase)) {
        titleCommand = formatForegroundCommandLabel(row.comm, row.args)
      }
    }
  }

  const titlePath = shortenHomePath(cwd, home)
  const title = `${titlePath} — ${titleCommand}`
  return { title, titlePath, titleCommand, cwd }
}
