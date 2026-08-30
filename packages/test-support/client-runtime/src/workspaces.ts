/** Test-owned workspaces face: the renderer standard-kit observable plus recorded actions. */
import { createSnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import type {
  DirectoryListing, GitStatusListing, IWorkspaces, SessionId, SnapshotStore,
  WorkspaceEntriesListing, WorkspaceId, WorkspaceListState, WorkspaceView,
  FileReadKind, FileReadResult, FileWriteResult, PathMutationResult,
  GitWorkingTreeResult, GitInitResult, GitLogResult, GitCommitDiffResult, GitDiffSide, GitDiffPreview,
  LspSyncDocumentResult, LspCloseDocumentResult, LspHoverDocumentResult,
  TerminalProfilesResult, TerminalSpawnResult, TerminalListResult, TerminalStreamFrame,
  BrowserListResult, BrowserCreateTabResult, BrowserPageMetadata, BrowserSnapshotResult, BrowserScreencastFrame,
} from '@deepseek-ai/dsh-client-runtime/client'
import { workspaceListState } from './fixtures.ts'
import type { Stabilizer } from './fixtures.ts'

/**
 * Workspaces test double. Implements the same IWorkspaces face features
 * receive as `ctx.workspaces`, so a production face change breaks this
 * double at compile time. Every action records into {@link
 * TestWorkspaces.calls}; defaults are inert echoes — feature tests needing
 * richer behavior replace them via {@link TestWorkspaces.stub}.
 */
export class TestWorkspaces implements IWorkspaces {
  /** The useWorkspaces standard feed. */
  readonly list: SnapshotStore<WorkspaceListState>

  /** Calls observed on the action face, newest last. */
  readonly calls: { method: string; args: unknown[] }[] = []

  /** Replaceable action seat: feature tests may stub richer behavior. */
  private readonly stubs = new Map<string, (...args: unknown[]) => unknown>()

  /**
   * @param stabilize - the owning runtime's act wrapper.
   */
  constructor(private readonly stabilize: Stabilizer) {
    this.list = createSnapshotStore<WorkspaceListState>(workspaceListState())
  }

  /**
   * Update the workspace list state through an immer draft.
   * @param mutate - draft mutator.
   */
  async update(mutate: (draft: WorkspaceListState) => void): Promise<void> {
    await this.stabilize(() => { this.list.update(mutate) })
  }

  /**
   * Replace an action's behavior (the recorded call is still appended first).
   * @param method - action name (e.g. 'connectWorkspace').
   * @param impl - replacement behavior.
   */
  stub(method: string, impl: (...args: unknown[]) => unknown): void {
    this.stubs.set(method, impl)
  }

  /**
   * Connect a workspace to its reusable/new blank session (recorded). The
   * default resolves the workspace id back as the session id; stub for
   * cross-session flows.
   * @param workspaceId - target workspace.
   * @returns the connected session id.
   */
  async connectWorkspace(workspaceId: WorkspaceId): Promise<SessionId> {
    this.calls.push({ method: 'connectWorkspace', args: [workspaceId] })
    const stub = this.stubs.get('connectWorkspace')
    if (stub !== undefined) return await (stub(workspaceId) as Promise<SessionId>)
    return `session-of-${workspaceId}` as SessionId
  }

  /**
   * New-session flow (recorded; stubbed behavior runs when installed).
   * @param workspaceId - optional explicit workspace target.
   */
  startSession(workspaceId?: WorkspaceId): void {
    this.calls.push({ method: 'startSession', args: [workspaceId] })
    this.stubs.get('startSession')?.(workspaceId)
  }

  /**
   * Create a Workspace (recorded). The default echoes a view derived from
   * the input; stub for failure or list-coupled flows.
   * @param input - the Host create payload.
   * @returns the created Workspace view.
   */
  async create(input: { path: string }): Promise<WorkspaceView> {
    this.calls.push({ method: 'create', args: [input] })
    const stub = this.stubs.get('create')
    if (stub !== undefined) return await (stub(input) as Promise<WorkspaceView>)
    return {
      workspaceId: `ws-${input.path}` as WorkspaceId,
      title: input.path,
      path: input.path,
      sessionIds: [],
    } as unknown as WorkspaceView
  }

  /**
   * Open a path with the host OS default application (recorded; default no-op).
   * @param path - host-resolvable path.
   */
  async openPath(path: string): Promise<void> {
    this.calls.push({ method: 'openPath', args: [path] })
    await (this.stubs.get('openPath')?.(path) as Promise<void> | undefined)
  }

  /**
   * Directory picker (recorded). The default cancels (null); stub to select.
   * @returns the picked path, or null.
   */
  async pickDirectory(): Promise<string | null> {
    this.calls.push({ method: 'pickDirectory', args: [] })
    const stub = this.stubs.get('pickDirectory')
    if (stub !== undefined) return await (stub() as Promise<string | null>)
    return null
  }

  /**
   * Browse listing (recorded). The default serves an empty home level; stub
   * to shape a tree.
   * @param path - absolute directory to list; absent lists the home level.
   * @returns the level's listing.
   */
  async listDirectory(path?: string, signal?: AbortSignal): Promise<DirectoryListing> {
    // The signal is recorded and forwarded like the production face passes
    // it to the wire, so cancellation integration tests can observe or
    // reject on a superseded scan.
    this.calls.push({ method: 'listDirectory', args: [path, signal] })
    const stub = this.stubs.get('listDirectory')
    if (stub !== undefined) return await (stub(path, signal) as Promise<DirectoryListing>)
    // The chain runs root-to-target inclusive, per the DirectoryListing
    // contract — a bare root crumb would mislabel the level in browsers
    // driven by this double.
    return {
      path: '/home/test',
      home: '/home/test',
      crumbs: [
        { name: '/', path: '/', hidden: false },
        { name: 'home', path: '/home', hidden: false },
        { name: 'test', path: '/home/test', hidden: false },
      ],
      entries: [],
      truncated: false,
    }
  }

  /**
   * Workspace file-tree listing (recorded). The default serves an empty
   * level at the asked path; stub to shape a tree.
   * @param workspaceId - Workspace whose root bounds the path.
   * @param path - absolute directory inside that Workspace.
   * @param signal - optional abort signal forwarded like production.
   * @returns the level's listing.
   */
  async listWorkspaceEntries(
    workspaceId: WorkspaceId,
    path: string,
    signal?: AbortSignal,
  ): Promise<WorkspaceEntriesListing> {
    this.calls.push({ method: 'listWorkspaceEntries', args: [workspaceId, path, signal] })
    const stub = this.stubs.get('listWorkspaceEntries')
    if (stub !== undefined) {
      return await (stub(workspaceId, path, signal) as Promise<WorkspaceEntriesListing>)
    }
    return { path, entries: [], truncated: false }
  }

  /**
   * Git working-tree badges (recorded). The default is an empty list (non-repo).
   * @param workspaceId - Workspace whose root is the `git status` directory.
   * @param signal - optional abort signal forwarded like production.
   * @returns badge rows.
   */
  async gitStatus(workspaceId: WorkspaceId, signal?: AbortSignal): Promise<GitStatusListing> {
    this.calls.push({ method: 'gitStatus', args: [workspaceId, signal] })
    const stub = this.stubs.get('gitStatus')
    if (stub !== undefined) return await (stub(workspaceId, signal) as Promise<GitStatusListing>)
    return { entries: [] }
  }

  /**
   * Git working-tree inspect (recorded). The default is not-a-repository.
   * @param workspaceId - Workspace whose bound root is the discovery start.
   * @param signal - optional abort signal forwarded like production.
   * @returns Git unavailable, not-a-repository, or repository state.
   */
  async gitWorkingTree(workspaceId: WorkspaceId, signal?: AbortSignal): Promise<GitWorkingTreeResult> {
    this.calls.push({ method: 'gitWorkingTree', args: [workspaceId, signal] })
    const stub = this.stubs.get('gitWorkingTree')
    if (stub !== undefined) return await (stub(workspaceId, signal) as Promise<GitWorkingTreeResult>)
    return { availability: 'not-a-repository' }
  }

  /**
   * Initialize a Git repository (recorded). The default echoes an empty repoRoot.
   * @param workspaceId - Workspace whose root receives `git init`.
   * @param signal - optional abort signal forwarded like production.
   * @returns the initialized repository root.
   */
  async gitInit(workspaceId: WorkspaceId, signal?: AbortSignal): Promise<GitInitResult> {
    this.calls.push({ method: 'gitInit', args: [workspaceId, signal] })
    const stub = this.stubs.get('gitInit')
    if (stub !== undefined) return await (stub(workspaceId, signal) as Promise<GitInitResult>)
    return { repoRoot: '' }
  }

  /**
   * Disk-only diff preview (recorded). The default is a binary marker.
   * @param workspaceId - Workspace whose bound root is the discovery start.
   * @param path - Host-absolute path under the discovered repository root.
   * @param side - unstaged vs staged list.
   * @param signal - optional abort signal forwarded like production.
   * @returns hunks, whole-file text, a binary marker, or deleted content.
   */
  async gitDiffPreview(
    workspaceId: WorkspaceId,
    path: string,
    side: GitDiffSide,
    signal?: AbortSignal,
  ): Promise<GitDiffPreview> {
    this.calls.push({ method: 'gitDiffPreview', args: [workspaceId, path, side, signal] })
    const stub = this.stubs.get('gitDiffPreview')
    if (stub !== undefined) return await (stub(workspaceId, path, side, signal) as Promise<GitDiffPreview>)
    return { kind: 'binary' }
  }

  /**
   * Stage a working-tree change (recorded). The default is not-a-repository.
   * @param workspaceId - Workspace whose bound root is the discovery start.
   * @param path - Host-absolute path under the discovered repository root.
   * @param hunkHeader - optional unified-diff hunk header.
   * @param signal - optional abort signal forwarded like production.
   * @returns the refreshed working tree.
   */
  async gitStage(
    workspaceId: WorkspaceId,
    path: string,
    hunkHeader?: string,
    signal?: AbortSignal,
  ): Promise<GitWorkingTreeResult> {
    this.calls.push({ method: 'gitStage', args: [workspaceId, path, hunkHeader, signal] })
    const stub = this.stubs.get('gitStage')
    if (stub !== undefined) return await (stub(workspaceId, path, hunkHeader, signal) as Promise<GitWorkingTreeResult>)
    return { availability: 'not-a-repository' }
  }

  /**
   * Unstage a working-tree change (recorded). The default is not-a-repository.
   * @param workspaceId - Workspace whose bound root is the discovery start.
   * @param path - Host-absolute path under the discovered repository root.
   * @param hunkHeader - optional unified-diff hunk header.
   * @param signal - optional abort signal forwarded like production.
   * @returns the refreshed working tree.
   */
  async gitUnstage(
    workspaceId: WorkspaceId,
    path: string,
    hunkHeader?: string,
    signal?: AbortSignal,
  ): Promise<GitWorkingTreeResult> {
    this.calls.push({ method: 'gitUnstage', args: [workspaceId, path, hunkHeader, signal] })
    const stub = this.stubs.get('gitUnstage')
    if (stub !== undefined) return await (stub(workspaceId, path, hunkHeader, signal) as Promise<GitWorkingTreeResult>)
    return { availability: 'not-a-repository' }
  }

  /**
   * Discard an unstaged working-tree change (recorded). The default is not-a-repository.
   * @param workspaceId - Workspace whose bound root is the discovery start.
   * @param path - Host-absolute path under the discovered repository root.
   * @param hunkHeader - optional unified-diff hunk header.
   * @param signal - optional abort signal forwarded like production.
   * @returns the refreshed working tree.
   */
  async gitDiscard(
    workspaceId: WorkspaceId,
    path: string,
    hunkHeader?: string,
    signal?: AbortSignal,
  ): Promise<GitWorkingTreeResult> {
    this.calls.push({ method: 'gitDiscard', args: [workspaceId, path, hunkHeader, signal] })
    const stub = this.stubs.get('gitDiscard')
    if (stub !== undefined) return await (stub(workspaceId, path, hunkHeader, signal) as Promise<GitWorkingTreeResult>)
    return { availability: 'not-a-repository' }
  }

  /**
   * Commit the current index (recorded). The default is not-a-repository.
   * @param workspaceId - Workspace whose bound root is the discovery start.
   * @param message - commit message.
   * @param signal - optional abort signal forwarded like production.
   * @returns the refreshed working tree.
   */
  async gitCommit(
    workspaceId: WorkspaceId,
    message: string,
    push?: boolean,
    signal?: AbortSignal,
  ): Promise<GitWorkingTreeResult> {
    this.calls.push({ method: 'gitCommit', args: [workspaceId, message, push, signal] })
    const stub = this.stubs.get('gitCommit')
    if (stub !== undefined) {
      return await (stub(workspaceId, message, push, signal) as Promise<GitWorkingTreeResult>)
    }
    return { availability: 'not-a-repository' }
  }

  /**
   * Push the current branch (recorded). The default is not-a-repository.
   * @param workspaceId - Workspace whose bound root is the discovery start.
   * @param signal - optional abort signal forwarded like production.
   * @returns the refreshed working tree.
   */
  async gitPush(
    workspaceId: WorkspaceId,
    signal?: AbortSignal,
  ): Promise<GitWorkingTreeResult> {
    this.calls.push({ method: 'gitPush', args: [workspaceId, signal] })
    const stub = this.stubs.get('gitPush')
    if (stub !== undefined) {
      return await (stub(workspaceId, signal) as Promise<GitWorkingTreeResult>)
    }
    return { availability: 'not-a-repository' }
  }

  /**
   * Add `origin` (recorded). The default is not-a-repository.
   * @param workspaceId - Workspace whose bound root is the discovery start.
   * @param url - remote URL forwarded like production.
   * @param signal - optional abort signal forwarded like production.
   * @returns the refreshed working tree.
   */
  async gitAddRemote(
    workspaceId: WorkspaceId,
    url: string,
    signal?: AbortSignal,
  ): Promise<GitWorkingTreeResult> {
    this.calls.push({ method: 'gitAddRemote', args: [workspaceId, url, signal] })
    const stub = this.stubs.get('gitAddRemote')
    if (stub !== undefined) {
      return await (stub(workspaceId, url, signal) as Promise<GitWorkingTreeResult>)
    }
    return { availability: 'not-a-repository' }
  }

  /**
   * Remove `origin` (recorded). The default is not-a-repository.
   * @param workspaceId - Workspace whose bound root is the discovery start.
   * @param signal - optional abort signal forwarded like production.
   * @returns the refreshed working tree.
   */
  async gitRemoveRemote(
    workspaceId: WorkspaceId,
    signal?: AbortSignal,
  ): Promise<GitWorkingTreeResult> {
    this.calls.push({ method: 'gitRemoveRemote', args: [workspaceId, signal] })
    const stub = this.stubs.get('gitRemoveRemote')
    if (stub !== undefined) {
      return await (stub(workspaceId, signal) as Promise<GitWorkingTreeResult>)
    }
    return { availability: 'not-a-repository' }
  }

  /**
   * Read commit history (recorded). The default is not-a-repository.
   * @param workspaceId - Workspace whose bound root is the discovery start.
   * @param query - optional page size and skip forwarded like production.
   * @param signal - optional abort signal forwarded like production.
   * @returns commit rows or availability discriminants.
   */
  async gitLog(
    workspaceId: WorkspaceId,
    query?: { limit?: number; skip?: number },
    signal?: AbortSignal,
  ): Promise<GitLogResult> {
    this.calls.push({ method: 'gitLog', args: [workspaceId, query, signal] })
    const stub = this.stubs.get('gitLog')
    if (stub !== undefined) {
      return await (stub(workspaceId, query, signal) as Promise<GitLogResult>)
    }
    return { availability: 'not-a-repository' }
  }

  /**
   * Read first-parent commit file diffs (recorded). The default is not-a-repository.
   * @param workspaceId - Workspace whose bound root is the discovery start.
   * @param hash - abbreviated or full commit hash.
   * @param signal - optional abort signal forwarded like production.
   * @returns changed files or availability discriminants.
   */
  async gitCommitDiff(
    workspaceId: WorkspaceId,
    hash: string,
    signal?: AbortSignal,
  ): Promise<GitCommitDiffResult> {
    this.calls.push({ method: 'gitCommitDiff', args: [workspaceId, hash, signal] })
    const stub = this.stubs.get('gitCommitDiff')
    if (stub !== undefined) {
      return await (stub(workspaceId, hash, signal) as Promise<GitCommitDiffResult>)
    }
    return { availability: 'not-a-repository' }
  }

  /**
   * Read a Workspace file (recorded). The default returns empty text or empty bytes.
   * @param workspaceId - Workspace whose root bounds the path.
   * @param path - absolute file path.
   * @param kind - `text` or `bytes`.
   * @param signal - optional abort signal.
   * @returns the Host read payload.
   */
  async readFile(
    workspaceId: WorkspaceId,
    path: string,
    kind: FileReadKind,
    signal?: AbortSignal,
  ): Promise<FileReadResult> {
    this.calls.push({ method: 'readFile', args: [workspaceId, path, kind, signal] })
    const stub = this.stubs.get('readFile')
    if (stub !== undefined) return await (stub(workspaceId, path, kind, signal) as Promise<FileReadResult>)
    if (kind === 'bytes') return { kind: 'bytes', path, data: '', mediaType: 'image/png' }
    return { kind: 'text', path, text: '' }
  }

  /**
   * Write a Workspace file (recorded). The default echoes the path.
   * @param workspaceId - Workspace whose root bounds the path.
   * @param path - absolute file path.
   * @param text - UTF-8 body.
   * @param signal - optional abort signal.
   * @returns the written path.
   */
  async writeFile(
    workspaceId: WorkspaceId,
    path: string,
    text: string,
    signal?: AbortSignal,
  ): Promise<FileWriteResult> {
    this.calls.push({ method: 'writeFile', args: [workspaceId, path, text, signal] })
    const stub = this.stubs.get('writeFile')
    if (stub !== undefined) return await (stub(workspaceId, path, text, signal) as Promise<FileWriteResult>)
    return { path }
  }

  /**
   * Delete a Workspace path (recorded). The default echoes the path.
   * @param workspaceId - Workspace whose root bounds the path.
   * @param path - absolute file or directory path.
   * @param signal - optional abort signal.
   * @returns the deleted absolute path.
   */
  async deletePath(
    workspaceId: WorkspaceId,
    path: string,
    signal?: AbortSignal,
  ): Promise<PathMutationResult> {
    this.calls.push({ method: 'deletePath', args: [workspaceId, path, signal] })
    const stub = this.stubs.get('deletePath')
    if (stub !== undefined) return await (stub(workspaceId, path, signal) as Promise<PathMutationResult>)
    return { path }
  }

  /**
   * Rename a Workspace path (recorded). The default joins the parent with the new name.
   * @param workspaceId - Workspace whose root bounds the path.
   * @param path - absolute source path.
   * @param newName - single-segment new base name.
   * @param signal - optional abort signal.
   * @returns the renamed absolute path.
   */
  async renamePath(
    workspaceId: WorkspaceId,
    path: string,
    newName: string,
    signal?: AbortSignal,
  ): Promise<PathMutationResult> {
    this.calls.push({ method: 'renamePath', args: [workspaceId, path, newName, signal] })
    const stub = this.stubs.get('renamePath')
    if (stub !== undefined) return await (stub(workspaceId, path, newName, signal) as Promise<PathMutationResult>)
    const slash = path.lastIndexOf('/')
    const parent = slash >= 0 ? path.slice(0, slash) : ''
    return { path: parent === '' ? newName : `${parent}/${newName}` }
  }

  /**
   * Move a Workspace path into another directory (recorded). The default joins dest and basename.
   * @param workspaceId - Workspace whose root bounds the path.
   * @param path - absolute source path.
   * @param destinationDirectory - absolute existing directory that will receive the source.
   * @param signal - optional abort signal.
   * @returns the destination absolute path.
   */
  async movePath(
    workspaceId: WorkspaceId,
    path: string,
    destinationDirectory: string,
    signal?: AbortSignal,
  ): Promise<PathMutationResult> {
    this.calls.push({ method: 'movePath', args: [workspaceId, path, destinationDirectory, signal] })
    const stub = this.stubs.get('movePath')
    if (stub !== undefined) {
      return await (stub(workspaceId, path, destinationDirectory, signal) as Promise<PathMutationResult>)
    }
    const slash = path.lastIndexOf('/')
    const name = slash >= 0 ? path.slice(slash + 1) : path
    return { path: `${destinationDirectory}/${name}` }
  }

  /**
   * Create a child directory inside a Workspace (recorded). The default joins parent and name.
   * @param workspaceId - Workspace whose root bounds the path.
   * @param path - absolute existing parent directory.
   * @param name - single path segment.
   * @param signal - optional abort signal.
   * @returns the created directory's absolute path.
   */
  async createWorkspaceDirectory(
    workspaceId: WorkspaceId,
    path: string,
    name: string,
    signal?: AbortSignal,
  ): Promise<PathMutationResult> {
    this.calls.push({ method: 'createWorkspaceDirectory', args: [workspaceId, path, name, signal] })
    const stub = this.stubs.get('createWorkspaceDirectory')
    if (stub !== undefined) return await (stub(workspaceId, path, name, signal) as Promise<PathMutationResult>)
    return { path: `${path}/${name}` }
  }

  /**
   * Subscribe to external disk changes for one opened path (recorded; default no-op).
   * @param workspaceId - Workspace whose root bounds the path.
   * @param path - absolute file path to watch.
   * @param onChanged - invoked on each Host path-changed frame.
   * @param signal - aborts the subscription when the caller supersedes it.
   */
  watchPath(
    workspaceId: WorkspaceId,
    path: string,
    onChanged: () => void,
    signal?: AbortSignal,
  ): void {
    this.calls.push({ method: 'watchPath', args: [workspaceId, path, onChanged, signal] })
    this.stubs.get('watchPath')?.(workspaceId, path, onChanged, signal)
  }

  /**
   * Sync editor buffer to the host LSP (recorded). The default returns no diagnostics.
   * @param workspaceId - Workspace whose root bounds the path.
   * @param path - absolute file path.
   * @param text - current UTF-8 buffer.
   * @param version - monotonic editor version.
   * @param signal - optional abort signal.
   * @returns normalized diagnostics for the path.
   */
  async lspSyncDocument(
    workspaceId: WorkspaceId,
    path: string,
    text: string,
    version: number,
    signal?: AbortSignal,
  ): Promise<LspSyncDocumentResult> {
    this.calls.push({ method: 'lspSyncDocument', args: [workspaceId, path, text, version, signal] })
    const stub = this.stubs.get('lspSyncDocument')
    if (stub !== undefined) {
      return await (stub(workspaceId, path, text, version, signal) as Promise<LspSyncDocumentResult>)
    }
    return { diagnostics: [] }
  }

  /**
   * Close an editor document in the host LSP (recorded). The default reports closed.
   * @param workspaceId - Workspace whose root bounds the path.
   * @param path - absolute file path.
   * @param signal - optional abort signal.
   */
  async lspCloseDocument(
    workspaceId: WorkspaceId,
    path: string,
    signal?: AbortSignal,
  ): Promise<LspCloseDocumentResult> {
    this.calls.push({ method: 'lspCloseDocument', args: [workspaceId, path, signal] })
    const stub = this.stubs.get('lspCloseDocument')
    if (stub !== undefined) return await (stub(workspaceId, path, signal) as Promise<LspCloseDocumentResult>)
    return { closed: true as const }
  }

  /**
   * Fetch hover text from the host LSP (recorded). The default returns no hover.
   * @param workspaceId - Workspace whose root bounds the path.
   * @param path - absolute file path.
   * @param text - current UTF-8 buffer.
   * @param version - monotonic editor version.
   * @param line - zero-based line index.
   * @param character - zero-based character index.
   * @param signal - optional abort signal.
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
    this.calls.push({
      method: 'lspHoverDocument',
      args: [workspaceId, path, text, version, line, character, signal],
    })
    const stub = this.stubs.get('lspHoverDocument')
    if (stub !== undefined) {
      return await (stub(workspaceId, path, text, version, line, character, signal) as Promise<LspHoverDocumentResult>)
    }
    return { hover: null }
  }

  /**
   * List selectable shell profiles (recorded). The default is one zsh profile.
   * @param signal - optional abort signal forwarded like production.
   */
  async terminalProfiles(signal?: AbortSignal): Promise<TerminalProfilesResult> {
    this.calls.push({ method: 'terminalProfiles', args: [signal] })
    const stub = this.stubs.get('terminalProfiles')
    if (stub !== undefined) return await (stub(signal) as Promise<TerminalProfilesResult>)
    return { profiles: [{ id: 'zsh', name: 'zsh' }], defaultProfileId: 'zsh' }
  }

  /**
   * Spawn one human terminal session (recorded). The default echoes a fixed id.
   * @param workspaceId - Workspace whose root bounds the default cwd.
   * @param profileId - optional shell profile.
   * @param cwd - optional initial cwd.
   * @param signal - optional abort signal forwarded like production.
   */
  async terminalSpawn(
    workspaceId: WorkspaceId,
    profileId?: string,
    cwd?: string,
    signal?: AbortSignal,
  ): Promise<TerminalSpawnResult> {
    this.calls.push({ method: 'terminalSpawn', args: [workspaceId, profileId, cwd, signal] })
    const stub = this.stubs.get('terminalSpawn')
    if (stub !== undefined) return await (stub(workspaceId, profileId, cwd, signal) as Promise<TerminalSpawnResult>)
    return { sessionId: 'test-terminal-1' }
  }

  /**
   * Write stdin to one human terminal session (recorded).
   * @param workspaceId - Workspace that owns the session pool.
   * @param sessionId - live session id.
   * @param text - UTF-8 stdin payload.
   * @param signal - optional abort signal forwarded like production.
   */
  async terminalWrite(
    workspaceId: WorkspaceId,
    sessionId: string,
    text: string,
    signal?: AbortSignal,
  ): Promise<{ written: true }> {
    this.calls.push({ method: 'terminalWrite', args: [workspaceId, sessionId, text, signal] })
    const stub = this.stubs.get('terminalWrite')
    if (stub !== undefined) return await (stub(workspaceId, sessionId, text, signal) as Promise<{ written: true }>)
    return { written: true }
  }

  /**
   * Resize one human terminal session (recorded).
   * @param workspaceId - Workspace that owns the session pool.
   * @param sessionId - live session id.
   * @param cols - terminal column count.
   * @param rows - terminal row count.
   * @param signal - optional abort signal forwarded like production.
   */
  async terminalResize(
    workspaceId: WorkspaceId,
    sessionId: string,
    cols: number,
    rows: number,
    signal?: AbortSignal,
  ): Promise<{ resized: true }> {
    this.calls.push({ method: 'terminalResize', args: [workspaceId, sessionId, cols, rows, signal] })
    const stub = this.stubs.get('terminalResize')
    if (stub !== undefined) {
      return await (stub(workspaceId, sessionId, cols, rows, signal) as Promise<{ resized: true }>)
    }
    return { resized: true }
  }

  /**
   * Kill one human terminal session (recorded).
   * @param workspaceId - Workspace that owns the session pool.
   * @param sessionId - live session id.
   * @param signal - optional abort signal forwarded like production.
   */
  async terminalKill(
    workspaceId: WorkspaceId,
    sessionId: string,
    signal?: AbortSignal,
  ): Promise<{ killed: true }> {
    this.calls.push({ method: 'terminalKill', args: [workspaceId, sessionId, signal] })
    const stub = this.stubs.get('terminalKill')
    if (stub !== undefined) return await (stub(workspaceId, sessionId, signal) as Promise<{ killed: true }>)
    return { killed: true }
  }

  /**
   * List live human terminal sessions (recorded). The default is empty.
   * @param workspaceId - Workspace whose session pool is queried.
   * @param signal - optional abort signal forwarded like production.
   */
  async terminalList(workspaceId: WorkspaceId, signal?: AbortSignal): Promise<TerminalListResult> {
    this.calls.push({ method: 'terminalList', args: [workspaceId, signal] })
    const stub = this.stubs.get('terminalList')
    if (stub !== undefined) return await (stub(workspaceId, signal) as Promise<TerminalListResult>)
    return { sessions: [] }
  }

  /**
   * Subscribe to one human terminal SSE stream (recorded). The default is a no-op.
   * @param workspaceId - Workspace that owns the session pool.
   * @param sessionId - live session id.
   * @param onFrame - frame callback.
   * @param signal - optional abort signal forwarded like production.
   * @param onOpen - optional stream-open callback.
   * @param onError - optional stream failure callback.
   */
  terminalStream(
    workspaceId: WorkspaceId,
    sessionId: string,
    onFrame: (frame: TerminalStreamFrame) => void,
    signal?: AbortSignal,
    onOpen?: () => void,
    onError?: (message: string) => void,
  ): void {
    this.calls.push({ method: 'terminalStream', args: [workspaceId, sessionId, onFrame, signal, onOpen, onError] })
    const stub = this.stubs.get('terminalStream')
    if (stub !== undefined) stub(workspaceId, sessionId, onFrame, signal, onOpen, onError)
    else onOpen?.()
  }

  async browserList(workspaceId: WorkspaceId, signal?: AbortSignal): Promise<BrowserListResult> {
    this.calls.push({ method: 'browserList', args: [workspaceId, signal] })
    const stub = this.stubs.get('browserList')
    if (stub !== undefined) return await (stub(workspaceId, signal) as Promise<BrowserListResult>)
    return { tabs: [] }
  }

  async browserCreateTab(workspaceId: WorkspaceId, url?: string, signal?: AbortSignal): Promise<BrowserCreateTabResult> {
    this.calls.push({ method: 'browserCreateTab', args: [workspaceId, url, signal] })
    const stub = this.stubs.get('browserCreateTab')
    if (stub !== undefined) return await (stub(workspaceId, url, signal) as Promise<BrowserCreateTabResult>)
    return { tabId: 'test-browser-1' }
  }

  async browserCloseTab(workspaceId: WorkspaceId, tabId: string, signal?: AbortSignal): Promise<{ closed: true }> {
    this.calls.push({ method: 'browserCloseTab', args: [workspaceId, tabId, signal] })
    const stub = this.stubs.get('browserCloseTab')
    if (stub !== undefined) return await (stub(workspaceId, tabId, signal) as Promise<{ closed: true }>)
    return { closed: true }
  }

  async browserSelectTab(workspaceId: WorkspaceId, tabId: string, signal?: AbortSignal): Promise<{ selected: true }> {
    this.calls.push({ method: 'browserSelectTab', args: [workspaceId, tabId, signal] })
    const stub = this.stubs.get('browserSelectTab')
    if (stub !== undefined) return await (stub(workspaceId, tabId, signal) as Promise<{ selected: true }>)
    return { selected: true }
  }

  async browserNavigate(
    workspaceId: WorkspaceId,
    tabId: string,
    url: string,
    signal?: AbortSignal,
  ): Promise<BrowserPageMetadata> {
    this.calls.push({ method: 'browserNavigate', args: [workspaceId, tabId, url, signal] })
    const stub = this.stubs.get('browserNavigate')
    if (stub !== undefined) return await (stub(workspaceId, tabId, url, signal) as Promise<BrowserPageMetadata>)
    return { url, title: '', canGoBack: false, canGoForward: false }
  }

  async browserGoBack(workspaceId: WorkspaceId, tabId: string, signal?: AbortSignal): Promise<BrowserPageMetadata> {
    this.calls.push({ method: 'browserGoBack', args: [workspaceId, tabId, signal] })
    const stub = this.stubs.get('browserGoBack')
    if (stub !== undefined) return await (stub(workspaceId, tabId, signal) as Promise<BrowserPageMetadata>)
    return { url: 'about:blank', title: '', canGoBack: false, canGoForward: false }
  }

  async browserGoForward(workspaceId: WorkspaceId, tabId: string, signal?: AbortSignal): Promise<BrowserPageMetadata> {
    this.calls.push({ method: 'browserGoForward', args: [workspaceId, tabId, signal] })
    const stub = this.stubs.get('browserGoForward')
    if (stub !== undefined) return await (stub(workspaceId, tabId, signal) as Promise<BrowserPageMetadata>)
    return { url: 'about:blank', title: '', canGoBack: false, canGoForward: false }
  }

  async browserReload(
    workspaceId: WorkspaceId,
    tabId: string,
    hard?: boolean,
    signal?: AbortSignal,
  ): Promise<BrowserPageMetadata> {
    this.calls.push({ method: 'browserReload', args: [workspaceId, tabId, hard, signal] })
    const stub = this.stubs.get('browserReload')
    if (stub !== undefined) return await (stub(workspaceId, tabId, hard, signal) as Promise<BrowserPageMetadata>)
    return { url: 'about:blank', title: '', canGoBack: false, canGoForward: false }
  }

  async browserSnapshot(workspaceId: WorkspaceId, tabId: string, signal?: AbortSignal): Promise<BrowserSnapshotResult> {
    this.calls.push({ method: 'browserSnapshot', args: [workspaceId, tabId, signal] })
    const stub = this.stubs.get('browserSnapshot')
    if (stub !== undefined) return await (stub(workspaceId, tabId, signal) as Promise<BrowserSnapshotResult>)
    return { tree: '' }
  }

  async browserClick(
    workspaceId: WorkspaceId,
    tabId: string,
    x: number,
    y: number,
    signal?: AbortSignal,
  ): Promise<{ clicked: true }> {
    this.calls.push({ method: 'browserClick', args: [workspaceId, tabId, x, y, signal] })
    const stub = this.stubs.get('browserClick')
    if (stub !== undefined) return await (stub(workspaceId, tabId, x, y, signal) as Promise<{ clicked: true }>)
    return { clicked: true }
  }

  async browserType(workspaceId: WorkspaceId, tabId: string, text: string, signal?: AbortSignal): Promise<{ typed: true }> {
    this.calls.push({ method: 'browserType', args: [workspaceId, tabId, text, signal] })
    const stub = this.stubs.get('browserType')
    if (stub !== undefined) return await (stub(workspaceId, tabId, text, signal) as Promise<{ typed: true }>)
    return { typed: true }
  }

  async browserScroll(
    workspaceId: WorkspaceId,
    tabId: string,
    deltaX: number,
    deltaY: number,
    signal?: AbortSignal,
  ): Promise<{ scrolled: true }> {
    this.calls.push({ method: 'browserScroll', args: [workspaceId, tabId, deltaX, deltaY, signal] })
    const stub = this.stubs.get('browserScroll')
    if (stub !== undefined) {
      return await (stub(workspaceId, tabId, deltaX, deltaY, signal) as Promise<{ scrolled: true }>)
    }
    return { scrolled: true }
  }

  async browserSelectOption(
    workspaceId: WorkspaceId,
    tabId: string,
    selector: string,
    values: string[],
    signal?: AbortSignal,
  ): Promise<{ selected: true }> {
    this.calls.push({ method: 'browserSelectOption', args: [workspaceId, tabId, selector, values, signal] })
    const stub = this.stubs.get('browserSelectOption')
    if (stub !== undefined) {
      return await (stub(workspaceId, tabId, selector, values, signal) as Promise<{ selected: true }>)
    }
    return { selected: true }
  }

  async browserResizeViewport(
    workspaceId: WorkspaceId,
    tabId: string,
    width: number,
    height: number,
    signal?: AbortSignal,
  ): Promise<{ resized: true }> {
    this.calls.push({ method: 'browserResizeViewport', args: [workspaceId, tabId, width, height, signal] })
    const stub = this.stubs.get('browserResizeViewport')
    if (stub !== undefined) {
      return await (stub(workspaceId, tabId, width, height, signal) as Promise<{ resized: true }>)
    }
    return { resized: true }
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
  ): Promise<{ sent: true }> {
    this.calls.push({ method: 'browserSendPointer', args: [workspaceId, tabId, event, signal] })
    const stub = this.stubs.get('browserSendPointer')
    if (stub !== undefined) return await (stub(workspaceId, tabId, event, signal) as Promise<{ sent: true }>)
    return { sent: true }
  }

  async browserSendKeyboard(
    workspaceId: WorkspaceId,
    tabId: string,
    event: { type: 'keyDown' | 'keyUp' | 'char'; key?: string; text?: string },
    signal?: AbortSignal,
  ): Promise<{ sent: true }> {
    this.calls.push({ method: 'browserSendKeyboard', args: [workspaceId, tabId, event, signal] })
    const stub = this.stubs.get('browserSendKeyboard')
    if (stub !== undefined) return await (stub(workspaceId, tabId, event, signal) as Promise<{ sent: true }>)
    return { sent: true }
  }

  browserWatchScreencast(
    workspaceId: WorkspaceId,
    tabId: string,
    onFrame: (frame: BrowserScreencastFrame) => void,
    signal?: AbortSignal,
    onOpen?: () => void,
    onError?: (message: string) => void,
  ): void {
    this.calls.push({ method: 'browserWatchScreencast', args: [workspaceId, tabId, onFrame, signal, onOpen, onError] })
    const stub = this.stubs.get('browserWatchScreencast')
    if (stub !== undefined) stub(workspaceId, tabId, onFrame, signal, onOpen, onError)
    else onOpen?.()
  }

  /**
   * Browse child creation (recorded). The default joins parent and name.
   * @param path - absolute existing parent directory.
   * @param name - single path segment.
   * @returns the created directory's absolute path.
   */
  async createDirectory(path: string, name: string): Promise<string> {
    this.calls.push({ method: 'createDirectory', args: [path, name] })
    const stub = this.stubs.get('createDirectory')
    if (stub !== undefined) return await (stub(path, name) as Promise<string>)
    return `${path}/${name}`
  }

  /**
   * Rename a Workspace (recorded). The default echoes a minimal view.
   * @param workspaceId - target workspace.
   * @param title - new title.
   * @returns the updated view.
   */
  async rename(workspaceId: WorkspaceId, title: string): Promise<WorkspaceView> {
    this.calls.push({ method: 'rename', args: [workspaceId, title] })
    const stub = this.stubs.get('rename')
    if (stub !== undefined) return await (stub(workspaceId, title) as Promise<WorkspaceView>)
    return { workspaceId, title, path: `/${title}`, sessionIds: [] } as unknown as WorkspaceView
  }

  /**
   * Delete a Workspace (recorded; default no-op).
   * @param workspaceId - target workspace.
   */
  async delete(workspaceId: WorkspaceId): Promise<void> {
    this.calls.push({ method: 'delete', args: [workspaceId] })
    await (this.stubs.get('delete')?.(workspaceId) as Promise<void> | undefined)
  }

  /**
   * Move a Workspace in display order (recorded; default no-op).
   * @param workspaceId - Workspace to move.
   * @param beforeWorkspaceId - Anchor; omitted appends.
   */
  async insertBefore(workspaceId: WorkspaceId, beforeWorkspaceId?: WorkspaceId): Promise<void> {
    this.calls.push({ method: 'insertBefore', args: [workspaceId, beforeWorkspaceId] })
    await (this.stubs.get('insertBefore')?.(workspaceId, beforeWorkspaceId) as Promise<void> | undefined)
  }

  /**
   * Move an accounted session (recorded). The default echoes a minimal view.
   * @param workspaceId - target workspace.
   * @param sessionId - session to move.
   * @param beforeSessionId - anchor; omitted appends.
   * @returns the updated view.
   */
  async insertSessionBefore(workspaceId: WorkspaceId, sessionId: SessionId, beforeSessionId?: SessionId): Promise<WorkspaceView> {
    this.calls.push({ method: 'insertSessionBefore', args: [workspaceId, sessionId, beforeSessionId] })
    const stub = this.stubs.get('insertSessionBefore')
    if (stub !== undefined) return await (stub(workspaceId, sessionId, beforeSessionId) as Promise<WorkspaceView>)
    return { workspaceId, title: '', path: '', sessionIds: [sessionId] } as unknown as WorkspaceView
  }

  /**
   * Archive a session (recorded). The default mirrors the production face's
   * observable effect: the id joins the list state's archive set.
   * @param sessionId - session to archive.
   */
  async archiveSession(sessionId: SessionId): Promise<void> {
    this.calls.push({ method: 'archiveSession', args: [sessionId] })
    const stub = this.stubs.get('archiveSession')
    if (stub !== undefined) {
      await (stub(sessionId) as Promise<void>)
      return
    }
    await this.update((draft) => {
      draft.archivedSessionIds = [...draft.archivedSessionIds, sessionId]
    })
  }
}
