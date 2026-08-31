/** WorkspaceRuntime projects the Workspace object manager for UI consumers. */

import type { Context } from '@deepseek-ai/cordis'
import type {
  DirectoryListing, GitStatusListing, IApiClient, RpcError,
  SessionId, WorkspaceEntriesListing, WorkspaceId, WorkspaceView,
  FileReadKind, FileReadResult, FileWriteResult, PathMutationResult,
  GitWorkingTreeResult, GitInitResult, GitLogResult, GitCommitDiffResult, GitDiffSide, GitDiffPreview,
  LspSyncDocumentResult, LspCloseDocumentResult, LspHoverDocumentResult,
  TerminalProfilesResult, TerminalSpawnResult, TerminalListResult, TerminalStreamFrame,
  BrowserListResult, BrowserCreateTabResult, BrowserPageMetadata, BrowserSnapshotResult, BrowserScreencastFrame,
} from '@deepseek-ai/dsh-api-remotes/client'
import type { SnapshotStore } from '../contract/store.ts'
import { createSnapshotStore } from '../contract/store.ts'
import type { SessionsPort, SessionsPortList } from '../contract/sessions-port.ts'
import type { IWorkspaces } from '../contract/workspaces.ts'
import { WorkspaceManager, type WorkspaceListPhase } from './manager.ts'

/** Workspace list plus the two-baseline readiness and default-target projection. */
export interface WorkspaceListState {
  items: readonly WorkspaceView[]
  /**
   * Registry-global archive set in Host order: grouping surfaces hide these
   * sessions everywhere (workspace groups and the ungrouped bucket) while
   * their session logs and workspace accounting slots remain. A plain array
   * (store-engine vocabulary; immer drafts reject Sets) — membership lookups
   * build their own transient Set.
   */
  archivedSessionIds: readonly SessionId[]
  state: 'idle' | 'loading' | 'error'
  phase: WorkspaceListPhase
  error: RpcError | null
  /** True only after both workspace.list and session.list have succeeded. */
  baselinesReady: boolean
  /** Most recently active Workspace, derived without changing `items` order. */
  recentWorkspaceId: WorkspaceId | undefined
}

/** Structured create failure for UI flows that distinguish Host business errors. */
export class WorkspaceCreateError extends Error {
  constructor(readonly rpcError: RpcError) {
    super(`workspace create failed: ${rpcError.code}: ${rpcError.message}`)
    this.name = 'WorkspaceCreateError'
  }
}

/** Structured browse failure so the directory browser can branch on Host business codes. */
export class DirectoryBrowseError extends Error {
  constructor(readonly rpcError: RpcError) {
    super(`directory browse failed: ${rpcError.code}: ${rpcError.message}`)
    this.name = 'DirectoryBrowseError'
  }
}

/** Real Workspace object layer and Host actions. */
export class WorkspaceRuntime implements IWorkspaces {
  /** UI-facing immutable projection; the manager remains wire truth. */
  readonly list: SnapshotStore<WorkspaceListState>
  /** Workspace baseline and frame owner. */
  private readonly manager: WorkspaceManager
  /** In-flight blank-session creates keyed by workspace (connectWorkspace coalescing). */
  private readonly connecting = new Map<WorkspaceId, Promise<SessionId>>()
  /** Guards the runtime-owned one-shot initial-selection subscription. */
  private initialSelectionStarted = false

  /**
   * @param ctx - client root context.
   * @param api - shared wire client.
   * @param sessions - cross-domain sessions face used for recency and blank-session reuse.
   */
  constructor(ctx: Context, private readonly api: IApiClient, private readonly sessions: SessionsPort) {
    this.manager = new WorkspaceManager(api)
    this.list = createSnapshotStore<WorkspaceListState>({
      items: [], archivedSessionIds: [], state: 'idle', phase: 'pending', error: null,
      baselinesReady: false, recentWorkspaceId: undefined,
    })
    this.manager.subscribe(() => { this.project() })
    this.sessions.list.subscribe(() => { this.project() })
    ctx.reflect.provide('workspaces', this, undefined)
  }

  /**
   * Resolve the session a New Session flow lands in once this Workspace is
   * chosen: reuse the workspace's existing blank session when one is in the
   * list mirror, else create a fresh one on the host (`session.create` births
   * the full Session+Agent — the client holds no intermediate state). The
   * caller owns navigation: take the returned id to `sessions.open`.
   * Resolution guarantee (both arms): the returned id is already in the list
   * store and `sessions.binding(id)` resolves synchronously — draft hand-off
   * may write the new scope's machine before opening.
   * @param workspaceId - chosen Workspace (must be in the workspace list).
   * @returns the reused or newly created session id.
   */
  async connectWorkspace(workspaceId: WorkspaceId): Promise<SessionId> {
    const workspace = this.list.getSnapshot().items.find(item => item.workspaceId === workspaceId)
    if (workspace === undefined) throw new Error(`workspaces.connectWorkspace: unknown workspace ${workspaceId}`)
    // Coalesce concurrent connects: a create's summary lands without cwd
    // until the host frame arrives, so a second call inside that window
    // would miss the reuse scan and mint another hidden blank session.
    const inflight = this.connecting.get(workspaceId)
    if (inflight !== undefined) return inflight
    // Reuse requires workspace membership (id in sessionIds AND same
    // canonical cwd — the host's own membership rule), never cwd alone:
    // a cwd match can belong to no account (sessions the CLI/TUI birthed at
    // the host cwd, or a deleted/recreated registration) and reusing it
    // would open a session no grouping surface shows under this workspace.
    // An archived blank is never reused either: reuse would open a session
    // no grouping surface can show, so New Session mints a fresh one instead.
    const archived = this.list.getSnapshot().archivedSessionIds
    const sessions = this.sessions.list.getSnapshot()
    for (const id of sessions.ids) {
      const summary = sessions.byId[id]
      if (summary !== undefined && summary.blank && summary.cwd === workspace.path
        && workspace.sessionIds.includes(summary.id)
        && !archived.includes(summary.id)) return summary.id
    }
    const attempt = this.sessions.create({ workspaceId })
      .finally(() => { this.connecting.delete(workspaceId) })
    this.connecting.set(workspaceId, attempt)
    return attempt
  }

  /**
   * Follow the first complete Workspace/Session baseline and select a default
   * session exactly once. A restored current session wins; otherwise the most
   * recent Workspace is connected (reusing or creating its blank session).
   * Later explicit clears stay cleared instead of retriggering this startup
   * policy. A failed connect may retry on the next baseline projection.
   * @returns disposer for the baseline subscription; late work cannot navigate after disposal.
   */
  startInitialSelection(): () => void {
    if (this.initialSelectionStarted) {
      throw new Error('workspaces.startInitialSelection: already started')
    }
    this.initialSelectionStarted = true
    let state: 'waiting' | 'connecting' | 'done' = 'waiting'
    let disposed = false
    const reconcile = (): void => {
      if (disposed || state !== 'waiting') return
      const workspace = this.list.getSnapshot()
      if (!workspace.baselinesReady) return
      const current = this.sessions.list.getSnapshot().current
      const target = workspace.recentWorkspaceId
      if (current !== undefined || target === undefined) {
        state = 'done'
        return
      }
      state = 'connecting'
      void this.connectWorkspace(target).then(
        (sessionId) => {
          if (disposed) return
          if (this.sessions.list.getSnapshot().current === undefined) {
            this.sessions.open(sessionId)
          }
          state = 'done'
        },
        (reason: unknown) => {
          if (disposed) return
          state = 'waiting'
          console.warn('initial workspace selection failed:', reason)
        },
      )
    }
    const unsubscribe = this.list.subscribe(reconcile)
    reconcile()
    return () => {
      disposed = true
      unsubscribe()
    }
  }

  /**
   * The shared New Session action behind the shell entry points (sidebar
   * button, workspace browser): resolve the target Workspace — explicit wins,
   * then the current Session's Workspace, then the recent-Workspace
   * projection — connect its blank session and navigate there; with no
   * Workspace at all, clear the selection into the New Session view state.
   * Connect failures are non-fatal (console diagnostics; the current view
   * stays usable).
   * @param workspaceId - explicit target Workspace for scoped actions.
   */
  startSession(workspaceId?: WorkspaceId): void {
    const workspace = this.list.getSnapshot()
    const current = this.sessions.list.getSnapshot().current
    const currentWorkspaceId = current === undefined
      ? undefined
      : workspace.items.find(item => item.sessionIds.includes(current))?.workspaceId
    const target = workspaceId ?? currentWorkspaceId ?? workspace.recentWorkspaceId
    if (target === undefined) {
      this.sessions.clear()
      return
    }
    void this.connectWorkspace(target).then(
      (sessionId) => { this.sessions.open(sessionId) },
      (reason: unknown) => { console.warn('new session failed:', reason) },
    )
  }

  /**
   * Register an existing path as a Workspace.
   * @param input - the Host create payload.
   * @returns the created or idempotently resolved Workspace.
   */
  async create(input: { path: string }): Promise<WorkspaceView> {
    const result = await this.manager.create(input)
    if (!result.ok) throw new WorkspaceCreateError(result.error)
    return result.value.workspace
  }

  /**
   * Open the Host's native directory picker (the `native` capability).
   * @returns the selected path, or null when the user cancelled.
   */
  async pickDirectory(): Promise<string | null> {
    const response = await this.api.host.pickDirectory({})
    if (!response.result.ok) {
      throw new Error(`directory picker failed: ${response.result.error.message}`)
    }
    return response.result.value.path
  }

  /**
   * List one directory level through the Host's `browse` capability.
   * @param path - absolute directory to list; absent lists the Host home directory.
   * @param signal - aborts the wire request (and the Host's scan) when the caller supersedes it.
   * @returns the level's listing with breadcrumb ancestry.
   */
  async listDirectory(path?: string, signal?: AbortSignal): Promise<DirectoryListing> {
    const response = await this.api.host.listDirectory(path === undefined ? {} : { path }, signal)
    if (!response.result.ok) throw new DirectoryBrowseError(response.result.error)
    return response.result.value
  }

  /**
   * List one directory level of files and folders inside a registered Workspace.
   * @param workspaceId - Workspace whose root bounds the path.
   * @param path - absolute directory inside that Workspace.
   * @param signal - aborts the wire request (and the Host's scan) when the caller supersedes it.
   * @returns the level's listing; `truncated` means the client must not treat it as exhaustive.
   */
  async listWorkspaceEntries(
    workspaceId: WorkspaceId,
    path: string,
    signal?: AbortSignal,
  ): Promise<WorkspaceEntriesListing> {
    const response = await this.api.host.listWorkspaceEntries({ workspaceId, path }, signal)
    if (!response.result.ok) throw new DirectoryBrowseError(response.result.error)
    return response.result.value
  }

  /**
   * Read Git working-tree badge letters for a registered Workspace.
   * Non-repositories and hosts without git return an empty list without throwing.
   * @param workspaceId - Workspace whose root is the `git status` directory.
   * @param signal - aborts the wire request when the caller supersedes it.
   * @returns badge rows; empty when Git is absent or the root is not a repository.
   */
  async gitStatus(workspaceId: WorkspaceId, signal?: AbortSignal): Promise<GitStatusListing> {
    const response = await this.api.host.gitStatus({ workspaceId }, signal)
    if (!response.result.ok) throw new DirectoryBrowseError(response.result.error)
    return response.result.value
  }

  /**
   * Discover the Git repository and list unstaged and staged disk changes.
   * Git unavailable and not-a-repository ride the success discriminant.
   * @param workspaceId - Workspace whose bound root is the discovery start.
   * @param signal - aborts the wire request when the caller supersedes it.
   * @returns Git unavailable, not-a-repository, or repository state with both change lists.
   */
  async gitWorkingTree(workspaceId: WorkspaceId, signal?: AbortSignal): Promise<GitWorkingTreeResult> {
    const response = await this.api.host.gitWorkingTree({ workspaceId }, signal)
    if (!response.result.ok) throw new DirectoryBrowseError(response.result.error)
    return response.result.value
  }

  /**
   * Initialize a Git repository at the bound Workspace root.
   * @param workspaceId - Workspace whose root receives `git init`.
   * @param signal - aborts the wire request when the caller supersedes it.
   * @returns the bound Workspace path after a successful `git init`.
   */
  async gitInit(workspaceId: WorkspaceId, signal?: AbortSignal): Promise<GitInitResult> {
    const response = await this.api.host.gitInit({ workspaceId }, signal)
    if (!response.result.ok) throw new DirectoryBrowseError(response.result.error)
    return response.result.value
  }

  /**
   * Read a disk-only diff preview for one working-tree change.
   * @param workspaceId - Workspace whose bound root is the discovery start.
   * @param path - Host-absolute path under the discovered repository root.
   * @param side - unstaged vs staged list.
   * @param signal - aborts the wire request when the caller supersedes it.
   * @returns hunks, whole-file text, a binary marker, or deleted content.
   */
  async gitDiffPreview(
    workspaceId: WorkspaceId,
    path: string,
    side: GitDiffSide,
    signal?: AbortSignal,
  ): Promise<GitDiffPreview> {
    const response = await this.api.host.gitDiffPreview({ workspaceId, path, side }, signal)
    if (!response.result.ok) throw new DirectoryBrowseError(response.result.error)
    return response.result.value
  }

  /**
   * Stage one unstaged working-tree change (whole file or one hunk).
   * @param workspaceId - Workspace whose bound root is the discovery start.
   * @param path - Host-absolute path under the discovered repository root.
   * @param hunkHeader - optional unified-diff hunk header from gitDiffPreview.
   * @param signal - aborts the wire request when the caller supersedes it.
   * @returns the refreshed working tree.
   */
  async gitStage(
    workspaceId: WorkspaceId,
    path: string,
    hunkHeader?: string,
    signal?: AbortSignal,
  ): Promise<GitWorkingTreeResult> {
    const response = await this.api.host.gitStage(
      hunkHeader === undefined ? { workspaceId, path } : { workspaceId, path, hunkHeader },
      signal,
    )
    if (!response.result.ok) throw new DirectoryBrowseError(response.result.error)
    return response.result.value
  }

  /**
   * Unstage one staged working-tree change (whole file or one hunk).
   * @param workspaceId - Workspace whose bound root is the discovery start.
   * @param path - Host-absolute path under the discovered repository root.
   * @param hunkHeader - optional unified-diff hunk header from gitDiffPreview.
   * @param signal - aborts the wire request when the caller supersedes it.
   * @returns the refreshed working tree.
   */
  async gitUnstage(
    workspaceId: WorkspaceId,
    path: string,
    hunkHeader?: string,
    signal?: AbortSignal,
  ): Promise<GitWorkingTreeResult> {
    const response = await this.api.host.gitUnstage(
      hunkHeader === undefined ? { workspaceId, path } : { workspaceId, path, hunkHeader },
      signal,
    )
    if (!response.result.ok) throw new DirectoryBrowseError(response.result.error)
    return response.result.value
  }

  /**
   * Discard one unstaged working-tree change (whole file or one hunk).
   * @param workspaceId - Workspace whose bound root is the discovery start.
   * @param path - Host-absolute path under the discovered repository root.
   * @param hunkHeader - optional unified-diff hunk header from gitDiffPreview.
   * @param signal - aborts the wire request when the caller supersedes it.
   * @returns the refreshed working tree.
   */
  async gitDiscard(
    workspaceId: WorkspaceId,
    path: string,
    hunkHeader?: string,
    signal?: AbortSignal,
  ): Promise<GitWorkingTreeResult> {
    const response = await this.api.host.gitDiscard(
      hunkHeader === undefined ? { workspaceId, path } : { workspaceId, path, hunkHeader },
      signal,
    )
    if (!response.result.ok) throw new DirectoryBrowseError(response.result.error)
    return response.result.value
  }

  /**
   * Create one new commit from the current index.
   * @param workspaceId - Workspace whose bound root is the discovery start.
   * @param message - commit message; empty after trim is allowed by the Host.
   * @param push - when true, run `git push` after commit.
   * @param signal - aborts the wire request when the caller supersedes it.
   * @returns the refreshed working tree.
   */
  async gitCommit(
    workspaceId: WorkspaceId,
    message: string,
    push?: boolean,
    signal?: AbortSignal,
  ): Promise<GitWorkingTreeResult> {
    const response = await this.api.host.gitCommit(
      { workspaceId, message, ...(push === true ? { push: true } : {}) },
      signal,
    )
    if (!response.result.ok) throw new DirectoryBrowseError(response.result.error)
    return response.result.value
  }

  /**
   * Push the current branch without creating a new commit.
   * @param workspaceId - Workspace whose bound root is the discovery start.
   * @param signal - aborts the wire request when the caller supersedes it.
   * @returns the refreshed working tree.
   */
  async gitPush(workspaceId: WorkspaceId, signal?: AbortSignal): Promise<GitWorkingTreeResult> {
    const response = await this.api.host.gitPush({ workspaceId }, signal)
    if (!response.result.ok) throw new DirectoryBrowseError(response.result.error)
    return response.result.value
  }

  /**
   * Add `origin` with the given URL. Does not fetch or push.
   * @param workspaceId - Workspace whose bound root is the discovery start.
   * @param url - remote URL passed to `git remote add origin`.
   * @param signal - aborts the wire request when the caller supersedes it.
   * @returns the refreshed working tree.
   */
  async gitAddRemote(
    workspaceId: WorkspaceId,
    url: string,
    signal?: AbortSignal,
  ): Promise<GitWorkingTreeResult> {
    const response = await this.api.host.gitAddRemote({ workspaceId, url }, signal)
    if (!response.result.ok) throw new DirectoryBrowseError(response.result.error)
    return response.result.value
  }

  /**
   * Remove remote `origin`. Does not fetch or push.
   * @param workspaceId - Workspace whose bound root is the discovery start.
   * @param signal - aborts the wire request when the caller supersedes it.
   * @returns the refreshed working tree.
   */
  async gitRemoveRemote(
    workspaceId: WorkspaceId,
    signal?: AbortSignal,
  ): Promise<GitWorkingTreeResult> {
    const response = await this.api.host.gitRemoveRemote({ workspaceId }, signal)
    if (!response.result.ok) throw new DirectoryBrowseError(response.result.error)
    return response.result.value
  }

  /**
   * Read one page of commit history for the Git repository discovered from a registered Workspace.
   * @param workspaceId - Workspace whose bound root is the discovery start.
   * @param query - optional page size and skip from the newest end of history.
   * @param signal - aborts the wire request when the caller supersedes it.
   * @returns commit rows or availability discriminants.
   */
  async gitLog(
    workspaceId: WorkspaceId,
    query?: { limit?: number; skip?: number },
    signal?: AbortSignal,
  ): Promise<GitLogResult> {
    const payload: { workspaceId: WorkspaceId; limit?: number; skip?: number } = { workspaceId }
    if (query?.limit !== undefined) payload.limit = query.limit
    if (query?.skip !== undefined && query.skip > 0) payload.skip = query.skip
    const response = await this.api.host.gitLog(payload, signal)
    if (!response.result.ok) throw new DirectoryBrowseError(response.result.error)
    return response.result.value
  }

  /**
   * Read first-parent file diffs for one Graph commit.
   * @param workspaceId - Workspace whose bound root is the discovery start.
   * @param hash - abbreviated or full commit hash from gitLog.
   * @param signal - aborts the wire request when the caller supersedes it.
   * @returns changed files or availability discriminants.
   */
  async gitCommitDiff(
    workspaceId: WorkspaceId,
    hash: string,
    signal?: AbortSignal,
  ): Promise<GitCommitDiffResult> {
    const response = await this.api.host.gitCommitDiff({ workspaceId, hash }, signal)
    if (!response.result.ok) throw new DirectoryBrowseError(response.result.error)
    return response.result.value
  }

  /**
   * Read one file inside a registered Workspace.
   * @param workspaceId - Workspace whose root bounds the path.
   * @param path - absolute file path.
   * @param kind - `text` for editable sources; `bytes` for image preview.
   * @param signal - aborts the wire request when the caller supersedes it.
   * @returns the text or byte payload.
   */
  async readFile(
    workspaceId: WorkspaceId,
    path: string,
    kind: FileReadKind,
    signal?: AbortSignal,
  ): Promise<FileReadResult> {
    const response = await this.api.host.readFile({ workspaceId, path, kind }, signal)
    if (!response.result.ok) throw new DirectoryBrowseError(response.result.error)
    return response.result.value
  }

  /**
   * Write UTF-8 text to one path inside a registered Workspace.
   * @param workspaceId - Workspace whose root bounds the path.
   * @param path - absolute file path.
   * @param text - UTF-8 body to write (creates the file when absent).
   * @param signal - aborts the wire request when the caller supersedes it.
   * @returns the written path.
   */
  async writeFile(
    workspaceId: WorkspaceId,
    path: string,
    text: string,
    signal?: AbortSignal,
  ): Promise<FileWriteResult> {
    const response = await this.api.host.writeFile({ workspaceId, path, text }, signal)
    if (!response.result.ok) throw new DirectoryBrowseError(response.result.error)
    return response.result.value
  }

  /**
   * Delete one file or directory tree inside a registered Workspace.
   * @param workspaceId - Workspace whose root bounds the path.
   * @param path - absolute file or directory path.
   * @param signal - aborts the wire request when the caller supersedes it.
   * @returns the deleted absolute path.
   */
  async deletePath(
    workspaceId: WorkspaceId,
    path: string,
    signal?: AbortSignal,
  ): Promise<PathMutationResult> {
    const response = await this.api.host.deletePath({ workspaceId, path }, signal)
    if (!response.result.ok) throw new DirectoryBrowseError(response.result.error)
    return response.result.value
  }

  /**
   * Rename one file or directory within the same parent directory inside a registered Workspace.
   * @param workspaceId - Workspace whose root bounds the path.
   * @param path - absolute source path.
   * @param newName - single-segment new base name.
   * @param signal - aborts the wire request when the caller supersedes it.
   * @returns the renamed absolute path.
   */
  async renamePath(
    workspaceId: WorkspaceId,
    path: string,
    newName: string,
    signal?: AbortSignal,
  ): Promise<PathMutationResult> {
    const response = await this.api.host.renamePath({ workspaceId, path, newName }, signal)
    if (!response.result.ok) throw new DirectoryBrowseError(response.result.error)
    return response.result.value
  }

  /**
   * Move one file or directory to another existing directory inside a registered Workspace.
   * @param workspaceId - Workspace whose root bounds the path.
   * @param path - absolute source path.
   * @param destinationDirectory - absolute existing directory that will receive the source.
   * @param signal - aborts the wire request when the caller supersedes it.
   * @returns the destination absolute path.
   */
  async movePath(
    workspaceId: WorkspaceId,
    path: string,
    destinationDirectory: string,
    signal?: AbortSignal,
  ): Promise<PathMutationResult> {
    const response = await this.api.host.movePath({ workspaceId, path, destinationDirectory }, signal)
    if (!response.result.ok) throw new DirectoryBrowseError(response.result.error)
    return response.result.value
  }

  /**
   * Create one child directory under an existing parent inside a registered Workspace.
   * @param workspaceId - Workspace whose root bounds the path.
   * @param path - absolute existing parent directory.
   * @param name - single non-blank path segment.
   * @param signal - aborts the wire request when the caller supersedes it.
   * @returns the created directory's absolute path.
   */
  async createWorkspaceDirectory(
    workspaceId: WorkspaceId,
    path: string,
    name: string,
    signal?: AbortSignal,
  ): Promise<PathMutationResult> {
    const response = await this.api.host.createWorkspaceDirectory({ workspaceId, path, name }, signal)
    if (!response.result.ok) throw new DirectoryBrowseError(response.result.error)
    return response.result.value
  }

  /**
   * Subscribe to external disk changes for one opened path until `signal` aborts.
   * @param workspaceId - Workspace whose root bounds the path.
   * @param path - absolute file path to watch.
   * @param onChanged - invoked once per Host path-changed frame.
   * @param signal - aborts the stream and closes the subscription.
   */
  watchPath(
    workspaceId: WorkspaceId,
    path: string,
    onChanged: () => void,
    signal?: AbortSignal,
  ): void {
    const lifetime = signal ?? new AbortController().signal
    void (async () => {
      try {
        for await (const frame of this.api.host.watchPath({ workspaceId, path }, lifetime)) {
          if (lifetime.aborted) return
          if (frame.payload.type === 'host/path-changed') onChanged()
        }
      } catch (error: unknown) {
        void error
      }
    })()
  }

  /**
   * Sync one editor buffer with the host language server.
   * @param workspaceId - Workspace whose root bounds the path.
   * @param path - absolute file path.
   * @param text - current edit-buffer text.
   * @param version - monotonic document version (>= 1).
   * @param signal - aborts the wire request when the caller supersedes it.
   */
  async lspSyncDocument(
    workspaceId: WorkspaceId,
    path: string,
    text: string,
    version: number,
    signal?: AbortSignal,
  ): Promise<LspSyncDocumentResult> {
    const response = await this.api.host.lspSyncDocument({ workspaceId, path, text, version }, signal)
    if (!response.result.ok) throw new Error(`LSP sync failed: ${response.result.error.message}`)
    return response.result.value
  }

  /**
   * Close one editor document in the host language server.
   * @param workspaceId - Workspace whose root bounds the path.
   * @param path - absolute file path.
   * @param signal - aborts the wire request when the caller supersedes it.
   */
  async lspCloseDocument(
    workspaceId: WorkspaceId,
    path: string,
    signal?: AbortSignal,
  ): Promise<LspCloseDocumentResult> {
    const response = await this.api.host.lspCloseDocument({ workspaceId, path }, signal)
    if (!response.result.ok) throw new Error(`LSP close failed: ${response.result.error.message}`)
    return response.result.value
  }

  /**
   * Query hover for one open editor document.
   * @param workspaceId - Workspace whose root bounds the path.
   * @param path - absolute file path.
   * @param text - current edit-buffer text.
   * @param version - monotonic document version (>= 1).
   * @param line - zero-based UTF-16 line.
   * @param character - zero-based UTF-16 character.
   * @param signal - aborts the wire request when the caller supersedes it.
   */
  async lspHoverDocument(
    workspaceId: WorkspaceId,
    path: string,
    text: string,
    version: number,
    line: number,
    character: number,
    signal?: AbortSignal,
  ): Promise<LspHoverDocumentResult> {
    const response = await this.api.host.lspHoverDocument({
      workspaceId, path, text, version, line, character,
    }, signal)
    if (!response.result.ok) throw new Error(`LSP hover failed: ${response.result.error.message}`)
    return response.result.value
  }

  /**
   * List selectable interactive shell profiles for human terminals.
   * @param signal - aborts the wire request when the caller supersedes it.
   */
  async terminalProfiles(signal?: AbortSignal): Promise<TerminalProfilesResult> {
    const response = await this.api.host.terminalProfiles({}, signal)
    if (!response.result.ok) throw new DirectoryBrowseError(response.result.error)
    return response.result.value
  }

  /**
   * Spawn one interactive human terminal session in a registered Workspace.
   * @param workspaceId - Workspace whose root bounds the default cwd.
   * @param profileId - optional shell profile; omitted uses the Host login shell.
   * @param cwd - optional initial cwd; omitted uses the Workspace root.
   * @param signal - aborts the wire request when the caller supersedes it.
   */
  async terminalSpawn(
    workspaceId: WorkspaceId,
    profileId?: string,
    cwd?: string,
    signal?: AbortSignal,
  ): Promise<TerminalSpawnResult> {
    const payload = {
      workspaceId,
      ...(profileId !== undefined ? { profileId } : {}),
      ...(cwd !== undefined ? { cwd } : {}),
    }
    const response = await this.api.host.terminalSpawn(payload, signal)
    if (!response.result.ok) throw new DirectoryBrowseError(response.result.error)
    return response.result.value
  }

  /**
   * Write stdin bytes to one live human terminal session.
   * @param workspaceId - Workspace that owns the session pool.
   * @param sessionId - live session id from spawn or list.
   * @param text - UTF-8 stdin payload.
   * @param signal - aborts the wire request when the caller supersedes it.
   */
  async terminalWrite(
    workspaceId: WorkspaceId,
    sessionId: string,
    text: string,
    signal?: AbortSignal,
  ): Promise<{ written: true }> {
    const response = await this.api.host.terminalWrite({ workspaceId, sessionId, text }, signal)
    if (!response.result.ok) throw new DirectoryBrowseError(response.result.error)
    return response.result.value
  }

  /**
   * Resize one live human terminal session.
   * @param workspaceId - Workspace that owns the session pool.
   * @param sessionId - live session id from spawn or list.
   * @param cols - terminal column count.
   * @param rows - terminal row count.
   * @param signal - aborts the wire request when the caller supersedes it.
   */
  async terminalResize(
    workspaceId: WorkspaceId,
    sessionId: string,
    cols: number,
    rows: number,
    signal?: AbortSignal,
  ): Promise<{ resized: true }> {
    const response = await this.api.host.terminalResize({ workspaceId, sessionId, cols, rows }, signal)
    if (!response.result.ok) throw new DirectoryBrowseError(response.result.error)
    return response.result.value
  }

  /**
   * Kill one live human terminal session and release its PTY.
   * @param workspaceId - Workspace that owns the session pool.
   * @param sessionId - live session id from spawn or list.
   * @param signal - aborts the wire request when the caller supersedes it.
   */
  async terminalKill(
    workspaceId: WorkspaceId,
    sessionId: string,
    signal?: AbortSignal,
  ): Promise<{ killed: true }> {
    const response = await this.api.host.terminalKill({ workspaceId, sessionId }, signal)
    if (!response.result.ok) throw new DirectoryBrowseError(response.result.error)
    return response.result.value
  }

  /**
   * List live human terminal sessions for one Workspace.
   * @param workspaceId - Workspace whose session pool is queried.
   * @param signal - aborts the wire request when the caller supersedes it.
   */
  async terminalList(
    workspaceId: WorkspaceId,
    signal?: AbortSignal,
  ): Promise<TerminalListResult> {
    const response = await this.api.host.terminalList({ workspaceId }, signal)
    if (!response.result.ok) throw new DirectoryBrowseError(response.result.error)
    return response.result.value
  }

  /**
   * Subscribe to scrollback, incremental output, and title metadata for one
   * human terminal session until `signal` aborts.
   * @param workspaceId - Workspace that owns the session pool.
   * @param sessionId - live session id from spawn or list.
   * @param onFrame - invoked once per Host SSE frame.
   * @param signal - aborts the stream and closes the subscription.
   * @param onOpen - invoked once response headers are readable.
   * @param onError - invoked when the stream fails before `signal` aborts.
   */
  terminalStream(
    workspaceId: WorkspaceId,
    sessionId: string,
    onFrame: (frame: TerminalStreamFrame) => void,
    signal?: AbortSignal,
    onOpen?: () => void,
    onError?: (message: string) => void,
  ): void {
    const lifetime = signal ?? new AbortController().signal
    void (async () => {
      try {
        for await (const frame of this.api.host.terminalStream({ workspaceId, sessionId }, lifetime, onOpen)) {
          if (lifetime.aborted) return
          onFrame(frame.payload)
        }
      } catch (error: unknown) {
        if (lifetime.aborted || onError === undefined) return
        if (error instanceof DirectoryBrowseError) {
          onError(error.rpcError.message)
          return
        }
        if (error instanceof Error) {
          onError(error.message)
          return
        }
        onError(String(error))
      }
    })()
  }

  async browserList(workspaceId: WorkspaceId, signal?: AbortSignal): Promise<BrowserListResult> {
    const response = await this.api.host.browserList({ workspaceId }, signal)
    if (!response.result.ok) throw new DirectoryBrowseError(response.result.error)
    return response.result.value
  }

  async browserCreateTab(workspaceId: WorkspaceId, url?: string, signal?: AbortSignal): Promise<BrowserCreateTabResult> {
    const payload = { workspaceId, ...(url === undefined ? {} : { url }) }
    const response = await this.api.host.browserCreateTab(payload, signal)
    if (!response.result.ok) throw new DirectoryBrowseError(response.result.error)
    return response.result.value
  }

  async browserCloseTab(workspaceId: WorkspaceId, tabId: string, signal?: AbortSignal): Promise<{ closed: true }> {
    const response = await this.api.host.browserCloseTab({ workspaceId, tabId }, signal)
    if (!response.result.ok) throw new DirectoryBrowseError(response.result.error)
    return response.result.value
  }

  async browserSelectTab(workspaceId: WorkspaceId, tabId: string, signal?: AbortSignal): Promise<{ selected: true }> {
    const response = await this.api.host.browserSelectTab({ workspaceId, tabId }, signal)
    if (!response.result.ok) throw new DirectoryBrowseError(response.result.error)
    return response.result.value
  }

  async browserShowWindow(workspaceId: WorkspaceId, tabId: string, signal?: AbortSignal): Promise<{ shown: true }> {
    const response = await this.api.host.browserShowWindow({ workspaceId, tabId }, signal)
    if (!response.result.ok) throw new DirectoryBrowseError(response.result.error)
    return response.result.value
  }

  async browserNavigate(
    workspaceId: WorkspaceId,
    tabId: string,
    url: string,
    signal?: AbortSignal,
  ): Promise<BrowserPageMetadata> {
    const response = await this.api.host.browserNavigate({ workspaceId, tabId, url }, signal)
    if (!response.result.ok) throw new DirectoryBrowseError(response.result.error)
    return response.result.value
  }

  async browserGoBack(workspaceId: WorkspaceId, tabId: string, signal?: AbortSignal): Promise<BrowserPageMetadata> {
    const response = await this.api.host.browserGoBack({ workspaceId, tabId }, signal)
    if (!response.result.ok) throw new DirectoryBrowseError(response.result.error)
    return response.result.value
  }

  async browserGoForward(workspaceId: WorkspaceId, tabId: string, signal?: AbortSignal): Promise<BrowserPageMetadata> {
    const response = await this.api.host.browserGoForward({ workspaceId, tabId }, signal)
    if (!response.result.ok) throw new DirectoryBrowseError(response.result.error)
    return response.result.value
  }

  async browserReload(
    workspaceId: WorkspaceId,
    tabId: string,
    hard?: boolean,
    signal?: AbortSignal,
  ): Promise<BrowserPageMetadata> {
    const payload = { workspaceId, tabId, ...(hard === undefined ? {} : { hard }) }
    const response = await this.api.host.browserReload(payload, signal)
    if (!response.result.ok) throw new DirectoryBrowseError(response.result.error)
    return response.result.value
  }

  async browserSnapshot(workspaceId: WorkspaceId, tabId: string, signal?: AbortSignal): Promise<BrowserSnapshotResult> {
    const response = await this.api.host.browserSnapshot({ workspaceId, tabId }, signal)
    if (!response.result.ok) throw new DirectoryBrowseError(response.result.error)
    return response.result.value
  }

  async browserClick(
    workspaceId: WorkspaceId,
    tabId: string,
    x: number,
    y: number,
    signal?: AbortSignal,
  ): Promise<{ clicked: true }> {
    const response = await this.api.host.browserClick({ workspaceId, tabId, x, y }, signal)
    if (!response.result.ok) throw new DirectoryBrowseError(response.result.error)
    return response.result.value
  }

  async browserType(workspaceId: WorkspaceId, tabId: string, text: string, signal?: AbortSignal): Promise<{ typed: true }> {
    const response = await this.api.host.browserType({ workspaceId, tabId, text }, signal)
    if (!response.result.ok) throw new DirectoryBrowseError(response.result.error)
    return response.result.value
  }

  async browserScroll(
    workspaceId: WorkspaceId,
    tabId: string,
    deltaX: number,
    deltaY: number,
    x?: number,
    y?: number,
    signal?: AbortSignal,
  ): Promise<{ scrolled: true }> {
    const response = await this.api.host.browserScroll({ workspaceId, tabId, deltaX, deltaY, x, y }, signal)
    if (!response.result.ok) throw new DirectoryBrowseError(response.result.error)
    return response.result.value
  }

  async browserSelectOption(
    workspaceId: WorkspaceId,
    tabId: string,
    selector: string,
    values: string[],
    signal?: AbortSignal,
  ): Promise<{ selected: true }> {
    const response = await this.api.host.browserSelectOption({ workspaceId, tabId, selector, values }, signal)
    if (!response.result.ok) throw new DirectoryBrowseError(response.result.error)
    return response.result.value
  }

  async browserResizeViewport(
    workspaceId: WorkspaceId,
    tabId: string,
    width: number,
    height: number,
    devicePixelRatio: number,
    signal?: AbortSignal,
  ): Promise<{ resized: true }> {
    const response = await this.api.host.browserResizeViewport(
      { workspaceId, tabId, width, height, devicePixelRatio },
      signal,
    )
    if (!response.result.ok) throw new DirectoryBrowseError(response.result.error)
    return response.result.value
  }

  async browserSendPointer(
    workspaceId: WorkspaceId,
    tabId: string,
    event: {
      type: 'mousePressed' | 'mouseReleased' | 'mouseMoved'
      x: number
      y: number
      button?: 'left' | 'right' | 'middle'
    },
    signal?: AbortSignal,
  ): Promise<{ sent: true; cursor?: string }> {
    const response = await this.api.host.browserSendPointer({ workspaceId, tabId, ...event }, signal)
    if (!response.result.ok) throw new DirectoryBrowseError(response.result.error)
    return response.result.value
  }

  async browserSendKeyboard(
    workspaceId: WorkspaceId,
    tabId: string,
    event: { type: 'keyDown' | 'keyUp' | 'char'; key?: string; text?: string },
    signal?: AbortSignal,
  ): Promise<{ sent: true }> {
    const response = await this.api.host.browserSendKeyboard({ workspaceId, tabId, ...event }, signal)
    if (!response.result.ok) throw new DirectoryBrowseError(response.result.error)
    return response.result.value
  }

  browserWatchScreencast(
    workspaceId: WorkspaceId,
    tabId: string,
    onFrame: (frame: BrowserScreencastFrame) => void,
    signal?: AbortSignal,
    onOpen?: () => void,
    onError?: (message: string) => void,
  ): void {
    const lifetime = signal ?? new AbortController().signal
    void (async () => {
      try {
        for await (const frame of this.api.host.browserWatchScreencast({ workspaceId, tabId }, lifetime, onOpen)) {
          if (lifetime.aborted) return
          onFrame(frame.payload)
        }
      } catch (error: unknown) {
        if (lifetime.aborted || onError === undefined) return
        if (error instanceof DirectoryBrowseError) {
          onError(error.rpcError.message)
          return
        }
        if (error instanceof Error) {
          onError(error.message)
          return
        }
        onError(String(error))
      }
    })()
  }

  /**
   * Create one child directory through the Host's `browse` capability.
   * @param path - absolute existing parent directory.
   * @param name - single non-blank path segment.
   * @returns the created directory's absolute path.
   */
  async createDirectory(path: string, name: string): Promise<string> {
    const response = await this.api.host.createDirectory({ path, name })
    if (!response.result.ok) throw new DirectoryBrowseError(response.result.error)
    return response.result.value.path
  }

  /**
   * Open a filesystem path with the Host operating system's default application.
   * @param path - absolute or host-resolvable path.
   */
  async openPath(path: string): Promise<void> {
    const response = await this.api.host.openPath({ path })
    if (!response.result.ok) {
      throw new Error(`path open failed: ${response.result.error.message}`)
    }
  }

  /**
   * Rename a Workspace.
   * @param workspaceId - target workspace.
   * @param title - new display title (trimmed non-empty by the Host).
   * @returns the renamed Workspace view.
   */
  async rename(workspaceId: WorkspaceId, title: string): Promise<WorkspaceView> {
    const result = await this.manager.rename(workspaceId, title)
    if (!result.ok) throw new Error(`workspace rename failed: ${result.error.code}: ${result.error.message}`)
    return result.value.workspace
  }

  /**
   * Delete one Workspace registration. Sessions, session logs, and the
   * directory remain Host-owned outside this operation.
   * @param workspaceId - target workspace.
   */
  async delete(workspaceId: WorkspaceId): Promise<void> {
    const result = await this.manager.delete(workspaceId)
    if (!result.ok) throw new Error(`workspace delete failed: ${result.error.code}: ${result.error.message}`)
  }

  /**
   * Move a Workspace within the durable registry display order.
   * @param workspaceId - Workspace to move.
   * @param beforeWorkspaceId - Anchor workspace; omitted appends.
   */
  async insertBefore(workspaceId: WorkspaceId, beforeWorkspaceId?: WorkspaceId): Promise<void> {
    const result = await this.manager.insertBefore(workspaceId, beforeWorkspaceId)
    if (!result.ok) throw new Error(`workspace reorder failed: ${result.error.code}: ${result.error.message}`)
  }

  /**
   * Archive a session into the registry-global set. Clearing an archived
   * current selection is the projection sweep's job (one rule for the local
   * echo and a remote tab's frame alike).
   * @param sessionId - session to archive.
   */
  async archiveSession(sessionId: SessionId): Promise<void> {
    const result = await this.manager.archiveSession(sessionId)
    if (!result.ok) throw new Error(`session archive failed: ${result.error.code}: ${result.error.message}`)
  }

  /**
   * Move a session within its Workspace's manual order (DOM-insertBefore-like).
   * @param workspaceId - owning workspace.
   * @param sessionId - accounted session to move.
   * @param beforeSessionId - accounted anchor to insert before; omitted appends.
   * @returns the updated Workspace view.
   */
  async insertSessionBefore(
    workspaceId: WorkspaceId,
    sessionId: SessionId,
    beforeSessionId?: SessionId,
  ): Promise<WorkspaceView> {
    const result = await this.manager.insertSessionBefore(workspaceId, sessionId, beforeSessionId)
    if (!result.ok) throw new Error(`workspace move failed: ${result.error.code}: ${result.error.message}`)
    return result.value.workspace
  }

  /**
   * Refresh the workspace baseline, reusing an in-flight pull.
   * @returns completion of the current or newly started workspace baseline pull.
   */
  refresh(): Promise<void> {
    return this.manager.refresh()
  }

  /**
   * Route a Host stream envelope into the Workspace object layer.
   * @param envelope - validated Host stream envelope.
   */
  handleHostEnvelope(envelope: Parameters<WorkspaceManager['handleHostEnvelope']>[0]): void {
    this.manager.handleHostEnvelope(envelope)
  }

  /** Rebuild the Workspace baseline after connection. */
  handleConnected(): void {
    this.manager.handleConnected()
  }

  private project(): void {
    const workspace = this.manager.getSnapshot()
    const sessions = this.sessions.list.getSnapshot()
    const baselinesReady = workspace.phase === 'ready' && sessions.phase === 'ready'
    // An archived current selection clears into the New Session view state —
    // a hidden row must not stay open behind the list. Sweeping here covers
    // every install path with one rule: the local unary echo, another tab's
    // changed frame, and a reconnect baseline restoring a persisted
    // selection that was archived while this client was away.
    if (sessions.current !== undefined && workspace.archivedSessionIds.includes(sessions.current)) {
      this.sessions.clear()
    }
    this.list.set({
      items: workspace.items,
      archivedSessionIds: workspace.archivedSessionIds,
      state: workspace.state,
      phase: workspace.phase,
      error: workspace.error,
      baselinesReady,
      recentWorkspaceId: baselinesReady ? recentWorkspace(workspace.items, sessions.byId) : undefined,
    })
  }
}

/** Stable tie-breaking follows Host Workspace order. */
function recentWorkspace(
  workspaces: readonly WorkspaceView[],
  sessions: SessionsPortList['byId'],
): WorkspaceId | undefined {
  let selected: WorkspaceId | undefined
  let selectedTime = Number.NEGATIVE_INFINITY
  for (const workspace of workspaces) {
    let latest = Number.NEGATIVE_INFINITY
    for (const sessionId of workspace.sessionIds) {
      const session = sessions[sessionId]
      if (session !== undefined) latest = Math.max(latest, session.updatedAt)
    }
    if (latest === Number.NEGATIVE_INFINITY) latest = Date.parse(workspace.createdAt)
    if (selected === undefined || latest > selectedTime) {
      selected = workspace.workspaceId
      selectedTime = latest
    }
  }
  return selected
}
