/**
 * Workspace-scoped human terminal PTY registry for host.terminal.* RPC.
 */

import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { accessSync, constants } from 'node:fs'
import { basename, resolve } from 'node:path'
import nodePty from 'node-pty'
import type { IPty, IPtyForkOptions } from 'node-pty'
import type { SubprocessTerminalHandle } from '@deepseek-ai/dsh-subprocess'
import { LocalTerminalHandle } from '@deepseek-ai/dsh-subprocess-local/src/terminal.ts'
import {
  createProcessInspector,
  type ProcessInspector,
  type ProcessInspectorInternals,
} from '@deepseek-ai/dsh-subprocess-local/src/process-inspector.ts'
import type { WorkspaceId } from './api/workspace.ts'
import type { TerminalStreamFrame } from './api/host.ts'
import { pathWithinWorkspace, WorkspacePathOutOfBoundsError } from './list-workspace-entries.ts'
import {
  resolveTerminalSessionTitleParts,
  type TerminalSessionTitleParts,
} from './terminal-session-title.ts'

/** Default PTY column count for new human terminal sessions. */
export const HUMAN_TERMINAL_DEFAULT_COLS = 80

/** Default PTY row count for new human terminal sessions. */
export const HUMAN_TERMINAL_DEFAULT_ROWS = 24

/** TERM-to-KILL grace passed to the subprocess-local terminal handle. */
export const HUMAN_TERMINAL_GRACE_MS = 1_000

/** Host-side scrollback byte cap before truncation. */
export const HUMAN_TERMINAL_SCROLLBACK_MAX_BYTES = 512 * 1024

/** One selectable interactive shell profile exposed by host.terminalProfiles. */
export interface TerminalShellProfile {
  /** Stable profile id (for example `zsh`). */
  id: string
  /** Human label shown in the Shell picker. */
  name: string
}

/** host.terminalProfiles success value. */
export interface TerminalProfilesResult {
  profiles: TerminalShellProfile[]
  defaultProfileId: string
}

/** host.terminalSpawn success value. */
export interface TerminalSpawnResult {
  sessionId: string
}

/** One live session row of host.terminalList. */
export interface TerminalSessionSummary {
  sessionId: string
  title: string
  titlePath: string
  titleCommand: string
  profileId: string
}

/** host.terminalList success value. */
export interface TerminalListResult {
  sessions: TerminalSessionSummary[]
}

/** Raised when the host cannot allocate an interactive PTY. */
export class TerminalUnavailableError extends Error {
  /** @param message - user-visible reason. */
  constructor(message: string) {
    super(message)
    this.name = 'TerminalUnavailableError'
  }
}

/** Raised when a terminal session id is unknown within a workspace. */
export class TerminalSessionNotFoundError extends Error {
  /** @param sessionId - requested session id. */
  constructor(readonly sessionId: string) {
    super(`terminal session not found: ${sessionId}`)
    this.name = 'TerminalSessionNotFoundError'
  }
}

interface ResolvedProfile {
  id: string
  name: string
  argv: readonly [string, ...string[]]
}

interface ProfileCandidate {
  id: string
  name: string
  paths: readonly string[]
  args: readonly string[]
}

const PROFILE_CANDIDATES: readonly ProfileCandidate[] = [
  { id: 'zsh', name: 'zsh', paths: ['/bin/zsh', '/usr/bin/zsh'], args: ['-l'] },
  { id: 'bash', name: 'bash', paths: ['/bin/bash', '/usr/bin/bash'], args: ['-l'] },
]

/** Injectable spawn and filesystem hooks for host integration tests. */
export interface HumanTerminalInternals {
  access?: (path: string) => void
  spawn?: (
    file: string,
    args: string[],
    options: IPtyForkOptions,
  ) => IPty
  createInspector?: () => ProcessInspector
  exec?: ProcessInspectorInternals['exec']
  scrollbackMaxBytes?: number
  titlePollMs?: number
}

interface ScrollbackSnapshot {
  text: string
  truncated: boolean
}

class BoundedScrollback {
  private text = ''
  private truncated = false

  /** @param maxBytes - retained tail bound. */
  constructor(private readonly maxBytes: number) {}

  /** Append UTF-8 terminal output and drop bytes beyond the bound. */
  append(chunk: string): void {
    if (chunk.length === 0) return
    const combined = this.text + chunk
    const size = Buffer.byteLength(combined, 'utf8')
    if (size <= this.maxBytes) {
      this.text = combined
      return
    }
    this.truncated = true
    let bytes = Buffer.from(combined, 'utf8')
    if (bytes.length > this.maxBytes) {
      bytes = bytes.subarray(bytes.length - this.maxBytes)
    }
    this.text = bytes.toString('utf8')
  }

  /** Current retained scrollback for SSE reconnect. */
  snapshot(): ScrollbackSnapshot {
    return { text: this.text, truncated: this.truncated }
  }
}

interface StreamSubscriber {
  push(frame: TerminalStreamFrame): void
}

interface LiveSession {
  sessionId: string
  workspaceId: WorkspaceId
  profile: ResolvedProfile
  cwd: string
  handle: SubprocessTerminalHandle
  pty: IPty
  scrollback: BoundedScrollback
  title: string
  titlePath: string
  titleCommand: string
  subscribers: Set<StreamSubscriber>
  titleTimer: ReturnType<typeof setInterval> | undefined
  inspector: ProcessInspector
  exec: ProcessInspectorInternals['exec']
}

/**
 * Resolve one shell profile executable on disk.
 * @param candidate - profile metadata and candidate paths.
 * @param access - filesystem access hook.
 */
function resolveProfileCandidate(
  candidate: ProfileCandidate,
  access: (path: string) => void,
): ResolvedProfile | undefined {
  for (const path of candidate.paths) {
    try {
      access(path)
      return { id: candidate.id, name: candidate.name, argv: [path, ...candidate.args] }
    } catch {
      // try next path
    }
  }
  return undefined
}

/**
 * Map the login shell path to a known profile id when possible.
 * @param shellPath - value of SHELL or equivalent.
 * @param profiles - currently available profiles.
 */
function defaultProfileId(shellPath: string | undefined, profiles: TerminalShellProfile[]): string {
  if (shellPath !== undefined) {
    const base = basename(shellPath)
    const match = profiles.find(profile => profile.id === base)
    if (match !== undefined) return match.id
  }
  return profiles[0]?.id ?? 'zsh'
}

/**
 * Resolve VS Code-style tab title parts for one live session.
 * @param session - live terminal session state.
 */
function resolveSessionTitle(session: LiveSession): TerminalSessionTitleParts {
  const foregroundPgid = session.inspector.foregroundPgid(session.handle.pid)
  return resolveTerminalSessionTitleParts(
    foregroundPgid,
    session.cwd,
    session.profile.name,
    { exec: session.exec },
  )
}

/** Workspace-indexed human terminal PTY pool. */
export class HumanTerminalRegistry {
  private readonly sessions = new Map<WorkspaceId, Map<string, LiveSession>>()
  private readonly access: (path: string) => void
  private readonly spawnPty: NonNullable<HumanTerminalInternals['spawn']>
  private readonly createInspector: () => ProcessInspector
  private readonly exec: ProcessInspectorInternals['exec']
  private readonly scrollbackMaxBytes: number
  private readonly titlePollMs: number

  /** @param internals - optional test hooks. */
  constructor(internals: HumanTerminalInternals = {}) {
    this.access = internals.access ?? ((path: string) => {
      accessSync(path, constants.X_OK)
    })
    this.spawnPty = internals.spawn ?? ((file, args, options) => nodePty.spawn(file, args, options))
    this.createInspector = internals.createInspector ?? (() => createProcessInspector())
    this.exec = internals.exec ?? ((file, args) => execFileSync(file, args, { encoding: 'utf8' }))
    this.scrollbackMaxBytes = internals.scrollbackMaxBytes ?? HUMAN_TERMINAL_SCROLLBACK_MAX_BYTES
    this.titlePollMs = internals.titlePollMs ?? 500
  }

  /** List available shell profiles and the login-shell default. */
  profiles(): TerminalProfilesResult {
    const resolved = PROFILE_CANDIDATES
      .map(candidate => resolveProfileCandidate(candidate, this.access))
      .filter((profile): profile is ResolvedProfile => profile !== undefined)
      .map(({ id, name }) => ({ id, name }))
    if (resolved.length === 0) {
      throw new TerminalUnavailableError('no interactive shell is available on this host')
    }
    const defaultProfileIdValue = defaultProfileId(process.env.SHELL, resolved)
    return { profiles: resolved, defaultProfileId: defaultProfileIdValue }
  }

  /**
   * Spawn one interactive shell session for a workspace.
   * @param workspaceId - owning workspace.
   * @param workspaceRoot - bound workspace directory.
   * @param profileId - optional shell profile id.
   * @param cwd - optional initial cwd (defaults to workspace root).
   */
  spawn(
    workspaceId: WorkspaceId,
    workspaceRoot: string,
    profileId: string | undefined,
    cwd: string | undefined,
  ): TerminalSpawnResult {
    const { profiles, defaultProfileId: fallbackId } = this.profiles()
    const selectedId = profileId ?? fallbackId
    const profileMeta = profiles.find(profile => profile.id === selectedId)
    if (profileMeta === undefined) {
      throw new TerminalUnavailableError(`unknown shell profile: ${selectedId}`)
    }
    const resolved = PROFILE_CANDIDATES
      .map(candidate => resolveProfileCandidate(candidate, this.access))
      .find(profile => profile?.id === selectedId)
    if (resolved === undefined) {
      throw new TerminalUnavailableError(`shell profile is not executable: ${selectedId}`)
    }
    const initialCwd = cwd === undefined ? workspaceRoot : resolve(cwd)
    try {
      pathWithinWorkspace(workspaceRoot, initialCwd)
    } catch (error) {
      if (error instanceof WorkspacePathOutOfBoundsError) {
        throw new TerminalUnavailableError(error.message)
      }
      throw error
    }
    const sessionId = randomUUID()
    let pty: IPty
    try {
      const options: IPtyForkOptions = {
        name: 'xterm-256color',
        cols: HUMAN_TERMINAL_DEFAULT_COLS,
        rows: HUMAN_TERMINAL_DEFAULT_ROWS,
        cwd: initialCwd,
        env: process.env as Record<string, string>,
      }
      pty = this.spawnPty(resolved.argv[0], [...resolved.argv.slice(1)], options)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      throw new TerminalUnavailableError(`failed to spawn shell: ${message}`)
    }
    const inspector = this.createInspector()
    const handle = new LocalTerminalHandle(pty, inspector, HUMAN_TERMINAL_GRACE_MS)
    const session: LiveSession = {
      sessionId,
      workspaceId,
      profile: resolved,
      cwd: initialCwd,
      handle,
      pty,
      scrollback: new BoundedScrollback(this.scrollbackMaxBytes),
      title: resolved.name,
      titlePath: '',
      titleCommand: resolved.name,
      subscribers: new Set(),
      titleTimer: undefined,
      inspector,
      exec: this.exec,
    }
    this.attachOutputListener(session)
    this.startTitlePolling(session)
    void handle.done.then(() => { this.removeSession(workspaceId, sessionId) })
    const workspaceSessions = this.sessions.get(workspaceId) ?? new Map()
    workspaceSessions.set(sessionId, session)
    this.sessions.set(workspaceId, workspaceSessions)
    this.publishTitle(session)
    return { sessionId }
  }

  /** List live sessions for one workspace. */
  list(workspaceId: WorkspaceId): TerminalListResult {
    const workspaceSessions = this.sessions.get(workspaceId)
    if (workspaceSessions === undefined) return { sessions: [] }
    const sessions = [...workspaceSessions.values()].map(session => ({
      sessionId: session.sessionId,
      title: session.title,
      titlePath: session.titlePath,
      titleCommand: session.titleCommand,
      profileId: session.profile.id,
    }))
    return { sessions }
  }

  /**
   * Write stdin bytes to one session.
   * @param workspaceId - owning workspace.
   * @param sessionId - target session id.
   * @param text - UTF-8 input text.
   */
  async write(workspaceId: WorkspaceId, sessionId: string, text: string): Promise<{ written: true }> {
    const session = this.requireSession(workspaceId, sessionId)
    await session.handle.write(text)
    return { written: true }
  }

  /**
   * Resize one session PTY.
   * @param workspaceId - owning workspace.
   * @param sessionId - target session id.
   * @param cols - terminal width.
   * @param rows - terminal height.
   */
  resize(workspaceId: WorkspaceId, sessionId: string, cols: number, rows: number): { resized: true } {
    const session = this.requireSession(workspaceId, sessionId)
    session.pty.resize(cols, rows)
    return { resized: true }
  }

  /**
   * Kill one session and drop it from the workspace registry.
   * @param workspaceId - owning workspace.
   * @param sessionId - target session id.
   */
  async kill(workspaceId: WorkspaceId, sessionId: string): Promise<{ killed: true }> {
    const session = this.requireSession(workspaceId, sessionId)
    await session.handle.terminate()
    this.removeSession(workspaceId, sessionId)
    return { killed: true }
  }

  /**
   * Stream scrollback, live output, and title updates for one session until `signal` aborts.
   * @param workspaceId - owning workspace.
   * @param sessionId - target session id.
   * @param signal - caller lifetime; abort ends the stream without killing the PTY.
   */
  async *stream(
    workspaceId: WorkspaceId,
    sessionId: string,
    signal: AbortSignal,
  ): AsyncGenerator<TerminalStreamFrame> {
    const session = this.requireSession(workspaceId, sessionId)
    const snapshot = session.scrollback.snapshot()
    yield { type: 'host/terminal-scrollback', text: snapshot.text, truncated: snapshot.truncated }
    yield {
      type: 'host/terminal-title',
      title: session.title,
      titlePath: session.titlePath,
      titleCommand: session.titleCommand,
    }

    const queue: TerminalStreamFrame[] = []
    let pending: (() => void) | undefined
    const subscriber: StreamSubscriber = {
      push(frame) {
        queue.push(frame)
        pending?.()
      },
    }
    session.subscribers.add(subscriber)

    const onAbort = (): void => { pending?.() }
    signal.addEventListener('abort', onAbort)

    try {
      while (!signal.aborted) {
        while (queue.length > 0) {
          const next = queue.shift()
          if (next !== undefined) yield next
        }
        await new Promise<void>((resolve) => { pending = resolve })
        pending = undefined
      }
    } finally {
      session.subscribers.delete(subscriber)
      signal.removeEventListener('abort', onAbort)
    }
  }

  private requireSession(workspaceId: WorkspaceId, sessionId: string): LiveSession {
    const session = this.sessions.get(workspaceId)?.get(sessionId)
    if (session === undefined) throw new TerminalSessionNotFoundError(sessionId)
    return session
  }

  private removeSession(workspaceId: WorkspaceId, sessionId: string): void {
    const workspaceSessions = this.sessions.get(workspaceId)
    const session = workspaceSessions?.get(sessionId)
    if (session === undefined || workspaceSessions === undefined) return
    if (session.titleTimer !== undefined) clearInterval(session.titleTimer)
    session.subscribers.clear()
    workspaceSessions.delete(sessionId)
    if (workspaceSessions.size === 0) this.sessions.delete(workspaceId)
  }

  private attachOutputListener(session: LiveSession): void {
    session.handle.output.on('data', (chunk: Buffer | string) => {
      const text = typeof chunk === 'string' ? chunk : chunk.toString('utf8')
      session.scrollback.append(text)
      const frame: TerminalStreamFrame = { type: 'host/terminal-output', text }
      for (const subscriber of session.subscribers) subscriber.push(frame)
    })
  }

  private startTitlePolling(session: LiveSession): void {
    session.titleTimer = setInterval(() => { this.publishTitle(session) }, this.titlePollMs)
  }

  private publishTitle(session: LiveSession): void {
    const next = resolveSessionTitle(session)
    if (next.title === session.title) return
    session.title = next.title
    session.titlePath = next.titlePath
    session.titleCommand = next.titleCommand
    session.cwd = next.cwd
    const frame: TerminalStreamFrame = {
      type: 'host/terminal-title',
      title: next.title,
      titlePath: next.titlePath,
      titleCommand: next.titleCommand,
    }
    for (const subscriber of session.subscribers) subscriber.push(frame)
  }
}
