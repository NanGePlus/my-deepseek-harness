/**
 * The outward workspaces-service face — what `ctx.workspaces` exposes to
 * feature packages and the renderer host, and therefore exactly what the
 * test runtime's workspaces double must implement. Wire-pump entry points
 * (handleHostEnvelope/handleConnected/refresh/startInitialSelection) stay on
 * the concrete class. Widening this interface is the explicit act of
 * widening what features may do to the workspaces domain.
 */
import type {
  DirectoryListing, GitStatusListing, SessionId, WorkspaceEntriesListing, WorkspaceId, WorkspaceView,
  FileReadKind, FileReadResult, FileWriteResult, PathMutationResult,
  GitWorkingTreeResult, GitInitResult, GitLogResult, GitCommitDiffResult, GitDiffSide, GitDiffPreview,
  LspSyncDocumentResult, LspCloseDocumentResult, LspHoverDocumentResult,
  TerminalProfilesResult, TerminalSpawnResult, TerminalListResult, TerminalStreamFrame,
  BrowserListResult, BrowserCreateTabResult, BrowserPageMetadata, BrowserSnapshotResult, BrowserScreencastFrame,
} from '@deepseek-ai/dsh-api-remotes/client'
import type { WorkspaceListState } from '../workspaces/service.ts'
import type { ObservableSnapshot } from './store.ts'

/** The workspaces-service face injected as `ctx.workspaces`. */
export interface IWorkspaces {
  /** The useWorkspaces standard feed (read face — writes stay inside the domain). */
  readonly list: ObservableSnapshot<WorkspaceListState>
  /**
   * Connect a Workspace to its reusable or freshly created blank session.
   * @param workspaceId - target workspace.
   * @returns the connected session id.
   */
  connectWorkspace(workspaceId: WorkspaceId): Promise<SessionId>
  /**
   * The New Session flow: connect the explicit, current-Session, or recent
   * Workspace and open the resulting session; failures surface on the session
   * list state.
   * @param workspaceId - explicit target; omitted inherits the current
   * Session's Workspace before falling back to the recency projection.
   */
  startSession(workspaceId?: WorkspaceId): void
  /**
   * Register an existing path as a Workspace.
   * @param input - the Host create payload.
   * @returns the created or idempotently resolved Workspace.
   */
  create(input: { path: string }): Promise<WorkspaceView>
  /**
   * Open the Host's native directory picker.
   * @returns the selected path, or null when the user cancelled.
   */
  pickDirectory(): Promise<string | null>
  /**
   * List one directory level through the Host's `browse` capability.
   * @param path - absolute directory to list; absent lists the Host home directory.
   * @param signal - aborts the wire request (and the Host's scan) when the caller supersedes it.
   * @returns the level's listing with breadcrumb ancestry.
   */
  listDirectory(path?: string, signal?: AbortSignal): Promise<DirectoryListing>
  /**
   * List one directory level of files and folders inside a registered Workspace.
   * @param workspaceId - Workspace whose root bounds the path.
   * @param path - absolute directory inside that Workspace.
   * @param signal - aborts the wire request (and the Host's scan) when the caller supersedes it.
   * @returns the level's listing; `truncated` means the client must not treat it as exhaustive.
   */
  listWorkspaceEntries(workspaceId: WorkspaceId, path: string, signal?: AbortSignal): Promise<WorkspaceEntriesListing>
  /**
   * Read Git working-tree badge letters for a registered Workspace.
   * @param workspaceId - Workspace whose root is the `git status` directory.
   * @param signal - aborts the wire request when the caller supersedes it.
   * @returns badge rows; empty when Git is absent or the root is not a repository.
   */
  gitStatus(workspaceId: WorkspaceId, signal?: AbortSignal): Promise<GitStatusListing>
  /**
   * Discover the Git repository and list unstaged and staged disk changes.
   * Distinguishes Git unavailable from not-a-repository. Does not throw for those
   * product states — they ride the success discriminant.
   * @param workspaceId - Workspace whose bound root is the discovery start.
   * @param signal - aborts the wire request when the caller supersedes it.
   * @returns Git unavailable, not-a-repository, or repository state with both change lists.
   */
  gitWorkingTree(workspaceId: WorkspaceId, signal?: AbortSignal): Promise<GitWorkingTreeResult>
  /**
   * Initialize a Git repository at the bound Workspace root.
   * @param workspaceId - Workspace whose root receives `git init`.
   * @param signal - aborts the wire request when the caller supersedes it.
   * @returns the bound Workspace path after a successful `git init`.
   */
  gitInit(workspaceId: WorkspaceId, signal?: AbortSignal): Promise<GitInitResult>
  /**
   * Read a disk-only diff preview for one working-tree change.
   * @param workspaceId - Workspace whose bound root is the discovery start.
   * @param path - Host-absolute path under the discovered repository root.
   * @param side - unstaged vs staged list.
   * @param signal - aborts the wire request when the caller supersedes it.
   * @returns hunks, whole-file text, a binary marker, or deleted content.
   */
  gitDiffPreview(
    workspaceId: WorkspaceId,
    path: string,
    side: GitDiffSide,
    signal?: AbortSignal,
  ): Promise<GitDiffPreview>
  /**
   * Stage one unstaged working-tree change. Omit `hunkHeader` to stage the whole
   * file; when present, only that tracked-text hunk is staged.
   * @param workspaceId - Workspace whose bound root is the discovery start.
   * @param path - Host-absolute path under the discovered repository root.
   * @param hunkHeader - optional unified-diff hunk header from gitDiffPreview.
   * @param signal - aborts the wire request when the caller supersedes it.
   * @returns the refreshed working tree.
   */
  gitStage(
    workspaceId: WorkspaceId,
    path: string,
    hunkHeader?: string,
    signal?: AbortSignal,
  ): Promise<GitWorkingTreeResult>
  /**
   * Unstage one staged working-tree change. Omit `hunkHeader` to unstage the
   * whole file; when present, only that tracked-text hunk is unstaged.
   * @param workspaceId - Workspace whose bound root is the discovery start.
   * @param path - Host-absolute path under the discovered repository root.
   * @param hunkHeader - optional unified-diff hunk header from gitDiffPreview.
   * @param signal - aborts the wire request when the caller supersedes it.
   * @returns the refreshed working tree.
   */
  gitUnstage(
    workspaceId: WorkspaceId,
    path: string,
    hunkHeader?: string,
    signal?: AbortSignal,
  ): Promise<GitWorkingTreeResult>
  /**
   * Discard one unstaged working-tree change. Omit `hunkHeader` to discard the
   * whole file; when present, only that unstaged tracked-text hunk is discarded.
   * @param workspaceId - Workspace whose bound root is the discovery start.
   * @param path - Host-absolute path under the discovered repository root.
   * @param hunkHeader - optional unified-diff hunk header from gitDiffPreview.
   * @param signal - aborts the wire request when the caller supersedes it.
   * @returns the refreshed working tree.
   */
  gitDiscard(
    workspaceId: WorkspaceId,
    path: string,
    hunkHeader?: string,
    signal?: AbortSignal,
  ): Promise<GitWorkingTreeResult>
  /**
   * Create one new commit from the current index. Author identity is taken only
   * from Git config. Does not amend. When `push` is true, pushes after commit.
   * @param workspaceId - Workspace whose bound root is the discovery start.
   * @param message - commit message; empty after trim is allowed.
   * @param push - when true, run `git push` after commit.
   * @param signal - aborts the wire request when the caller supersedes it.
   * @returns the refreshed working tree.
   */
  gitCommit(
    workspaceId: WorkspaceId,
    message: string,
    push?: boolean,
    signal?: AbortSignal,
  ): Promise<GitWorkingTreeResult>
  /**
   * Push the current branch without creating a new commit.
   * @param workspaceId - Workspace whose bound root is the discovery start.
   * @param signal - aborts the wire request when the caller supersedes it.
   * @returns the refreshed working tree.
   */
  gitPush(
    workspaceId: WorkspaceId,
    signal?: AbortSignal,
  ): Promise<GitWorkingTreeResult>
  /**
   * Add `origin` with the given URL. Does not fetch or push.
   * @param workspaceId - Workspace whose bound root is the discovery start.
   * @param url - remote URL passed to `git remote add origin`.
   * @param signal - aborts the wire request when the caller supersedes it.
   * @returns the refreshed working tree.
   */
  gitAddRemote(
    workspaceId: WorkspaceId,
    url: string,
    signal?: AbortSignal,
  ): Promise<GitWorkingTreeResult>
  /**
   * Remove remote `origin`. Does not fetch or push.
   * @param workspaceId - Workspace whose bound root is the discovery start.
   * @param signal - aborts the wire request when the caller supersedes it.
   * @returns the refreshed working tree.
   */
  gitRemoveRemote(
    workspaceId: WorkspaceId,
    signal?: AbortSignal,
  ): Promise<GitWorkingTreeResult>
  /**
   * Read one page of commit history for the Git repository discovered from a registered Workspace.
   * @param workspaceId - Workspace whose bound root is the discovery start.
   * @param query - optional page size and skip from the newest end of history.
   * @param signal - aborts the wire request when the caller supersedes it.
   * @returns commit rows or availability discriminants.
   */
  gitLog(
    workspaceId: WorkspaceId,
    query?: { limit?: number; skip?: number },
    signal?: AbortSignal,
  ): Promise<GitLogResult>
  /**
   * Read first-parent file diffs for one Graph commit.
   * @param workspaceId - Workspace whose bound root is the discovery start.
   * @param hash - abbreviated or full commit hash from gitLog.
   * @param signal - aborts the wire request when the caller supersedes it.
   * @returns changed files or availability discriminants.
   */
  gitCommitDiff(
    workspaceId: WorkspaceId,
    hash: string,
    signal?: AbortSignal,
  ): Promise<GitCommitDiffResult>
  /**
   * Read one file inside a registered Workspace.
   * @param workspaceId - Workspace whose root bounds the path.
   * @param path - absolute file path.
   * @param kind - `text` for editable sources; `bytes` for image preview.
   * @param signal - aborts the wire request when the caller supersedes it.
   * @returns the text or byte payload.
   */
  readFile(
    workspaceId: WorkspaceId,
    path: string,
    kind: FileReadKind,
    signal?: AbortSignal,
  ): Promise<FileReadResult>
  /**
   * Write UTF-8 text to one path inside a registered Workspace.
   * @param workspaceId - Workspace whose root bounds the path.
   * @param path - absolute file path.
   * @param text - UTF-8 body to write (creates the file when absent).
   * @param signal - aborts the wire request when the caller supersedes it.
   * @returns the written absolute path.
   */
  writeFile(
    workspaceId: WorkspaceId,
    path: string,
    text: string,
    signal?: AbortSignal,
  ): Promise<FileWriteResult>
  /**
   * Delete one file or directory tree inside a registered Workspace.
   * @param workspaceId - Workspace whose root bounds the path.
   * @param path - absolute file or directory path.
   * @param signal - aborts the wire request when the caller supersedes it.
   * @returns the deleted absolute path.
   */
  deletePath(
    workspaceId: WorkspaceId,
    path: string,
    signal?: AbortSignal,
  ): Promise<PathMutationResult>
  /**
   * Rename one file or directory within the same parent directory inside a registered Workspace.
   * @param workspaceId - Workspace whose root bounds the path.
   * @param path - absolute source path.
   * @param newName - single-segment new base name.
   * @param signal - aborts the wire request when the caller supersedes it.
   * @returns the renamed absolute path.
   */
  renamePath(
    workspaceId: WorkspaceId,
    path: string,
    newName: string,
    signal?: AbortSignal,
  ): Promise<PathMutationResult>
  /**
   * Move one file or directory to another existing directory inside a registered Workspace.
   * @param workspaceId - Workspace whose root bounds the path.
   * @param path - absolute source path.
   * @param destinationDirectory - absolute existing directory that will receive the source.
   * @param signal - aborts the wire request when the caller supersedes it.
   * @returns the destination absolute path.
   */
  movePath(
    workspaceId: WorkspaceId,
    path: string,
    destinationDirectory: string,
    signal?: AbortSignal,
  ): Promise<PathMutationResult>
  /**
   * Create one child directory under an existing parent inside a registered Workspace.
   * @param workspaceId - Workspace whose root bounds the path.
   * @param path - absolute existing parent directory.
   * @param name - single non-blank path segment.
   * @param signal - aborts the wire request when the caller supersedes it.
   * @returns the created directory's absolute path.
   */
  createWorkspaceDirectory(
    workspaceId: WorkspaceId,
    path: string,
    name: string,
    signal?: AbortSignal,
  ): Promise<PathMutationResult>
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
  ): void
  /**
   * Sync one editor buffer with the host language server and return diagnostics.
   * @param workspaceId - Workspace whose root bounds the path.
   * @param path - absolute file path.
   * @param text - current edit-buffer text.
   * @param version - monotonic document version (>= 1).
   * @param signal - aborts a superseded sync.
   */
  lspSyncDocument(
    workspaceId: WorkspaceId,
    path: string,
    text: string,
    version: number,
    signal?: AbortSignal,
  ): Promise<LspSyncDocumentResult>
  /**
   * Close one editor document in the host language server.
   * @param workspaceId - Workspace whose root bounds the path.
   * @param path - absolute file path.
   * @param signal - aborts a superseded close.
   */
  lspCloseDocument(
    workspaceId: WorkspaceId,
    path: string,
    signal?: AbortSignal,
  ): Promise<LspCloseDocumentResult>
  /**
   * Query hover for one open editor document at a cursor position.
   * @param workspaceId - Workspace whose root bounds the path.
   * @param path - absolute file path.
   * @param text - current edit-buffer text.
   * @param version - monotonic document version (>= 1).
   * @param line - zero-based UTF-16 line.
   * @param character - zero-based UTF-16 character.
   * @param signal - aborts a superseded hover request.
   */
  lspHoverDocument(
    workspaceId: WorkspaceId,
    path: string,
    text: string,
    version: number,
    line: number,
    character: number,
    signal?: AbortSignal,
  ): Promise<LspHoverDocumentResult>
  /**
   * List selectable interactive shell profiles for human terminals.
   * @param signal - aborts the wire request when the caller supersedes it.
   */
  terminalProfiles(signal?: AbortSignal): Promise<TerminalProfilesResult>
  /**
   * Spawn one interactive human terminal session in a registered Workspace.
   * @param workspaceId - Workspace whose root bounds the default cwd.
   * @param profileId - optional shell profile; omitted uses the Host login shell.
   * @param cwd - optional initial cwd; omitted uses the Workspace root.
   * @param signal - aborts the wire request when the caller supersedes it.
   */
  terminalSpawn(
    workspaceId: WorkspaceId,
    profileId?: string,
    cwd?: string,
    signal?: AbortSignal,
  ): Promise<TerminalSpawnResult>
  /**
   * Write stdin bytes to one live human terminal session.
   * @param workspaceId - Workspace that owns the session pool.
   * @param sessionId - live session id from spawn or list.
   * @param text - UTF-8 stdin payload.
   * @param signal - aborts the wire request when the caller supersedes it.
   */
  terminalWrite(
    workspaceId: WorkspaceId,
    sessionId: string,
    text: string,
    signal?: AbortSignal,
  ): Promise<{ written: true }>
  /**
   * Resize one live human terminal session.
   * @param workspaceId - Workspace that owns the session pool.
   * @param sessionId - live session id from spawn or list.
   * @param cols - terminal column count.
   * @param rows - terminal row count.
   * @param signal - aborts the wire request when the caller supersedes it.
   */
  terminalResize(
    workspaceId: WorkspaceId,
    sessionId: string,
    cols: number,
    rows: number,
    signal?: AbortSignal,
  ): Promise<{ resized: true }>
  /**
   * Kill one live human terminal session and release its PTY.
   * @param workspaceId - Workspace that owns the session pool.
   * @param sessionId - live session id from spawn or list.
   * @param signal - aborts the wire request when the caller supersedes it.
   */
  terminalKill(
    workspaceId: WorkspaceId,
    sessionId: string,
    signal?: AbortSignal,
  ): Promise<{ killed: true }>
  /**
   * List live human terminal sessions for one Workspace.
   * @param workspaceId - Workspace whose session pool is queried.
   * @param signal - aborts the wire request when the caller supersedes it.
   */
  terminalList(workspaceId: WorkspaceId, signal?: AbortSignal): Promise<TerminalListResult>
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
  ): void
  /** List live browser tabs for one Workspace. */
  browserList(workspaceId: WorkspaceId, signal?: AbortSignal): Promise<BrowserListResult>
  /** Open one browser tab in a registered Workspace. */
  browserCreateTab(workspaceId: WorkspaceId, url?: string, signal?: AbortSignal): Promise<BrowserCreateTabResult>
  browserCloseTab(workspaceId: WorkspaceId, tabId: string, signal?: AbortSignal): Promise<{ closed: true }>
  browserSelectTab(workspaceId: WorkspaceId, tabId: string, signal?: AbortSignal): Promise<{ selected: true }>
  /**
   * Raise the headed Chromium window for one tab so a human can operate it.
   * @param workspaceId - Workspace whose browser pool owns the tab.
   * @param tabId - live tab id.
   * @param signal - aborts a superseded raise.
   */
  browserShowWindow(workspaceId: WorkspaceId, tabId: string, signal?: AbortSignal): Promise<{ shown: true }>
  browserNavigate(workspaceId: WorkspaceId, tabId: string, url: string, signal?: AbortSignal): Promise<BrowserPageMetadata>
  browserGoBack(workspaceId: WorkspaceId, tabId: string, signal?: AbortSignal): Promise<BrowserPageMetadata>
  browserGoForward(workspaceId: WorkspaceId, tabId: string, signal?: AbortSignal): Promise<BrowserPageMetadata>
  browserReload(workspaceId: WorkspaceId, tabId: string, hard?: boolean, signal?: AbortSignal): Promise<BrowserPageMetadata>
  browserSnapshot(workspaceId: WorkspaceId, tabId: string, signal?: AbortSignal): Promise<BrowserSnapshotResult>
  browserClick(workspaceId: WorkspaceId, tabId: string, x: number, y: number, signal?: AbortSignal): Promise<{ clicked: true }>
  browserType(workspaceId: WorkspaceId, tabId: string, text: string, signal?: AbortSignal): Promise<{ typed: true }>
  browserScroll(
    workspaceId: WorkspaceId,
    tabId: string,
    deltaX: number,
    deltaY: number,
    x?: number,
    y?: number,
    signal?: AbortSignal,
  ): Promise<{ scrolled: true }>
  browserSelectOption(
    workspaceId: WorkspaceId,
    tabId: string,
    selector: string,
    values: string[],
    signal?: AbortSignal,
  ): Promise<{ selected: true }>
  browserResizeViewport(
    workspaceId: WorkspaceId,
    tabId: string,
    width: number,
    height: number,
    devicePixelRatio: number,
    signal?: AbortSignal,
  ): Promise<{ resized: true }>
  browserSendPointer(
    workspaceId: WorkspaceId,
    tabId: string,
    event: {
      type: 'mousePressed' | 'mouseReleased' | 'mouseMoved'
      x: number
      y: number
      button?: 'left' | 'right' | 'middle'
    },
    signal?: AbortSignal,
  ): Promise<{ sent: true; cursor?: string }>
  browserSendKeyboard(
    workspaceId: WorkspaceId,
    tabId: string,
    event: { type: 'keyDown' | 'keyUp' | 'char'; key?: string; text?: string },
    signal?: AbortSignal,
  ): Promise<{ sent: true }>
  browserWatchScreencast(
    workspaceId: WorkspaceId,
    tabId: string,
    onFrame: (frame: BrowserScreencastFrame) => void,
    signal?: AbortSignal,
    onOpen?: () => void,
    onError?: (message: string) => void,
  ): void
  /**
   * Create one child directory through the Host's `browse` capability.
   * @param path - absolute existing parent directory.
   * @param name - single non-blank path segment.
   * @returns the created directory's absolute path.
   */
  createDirectory(path: string, name: string): Promise<string>
  /**
   * Open a filesystem path with the Host operating system's default application.
   * @param path - absolute or host-resolvable path.
   */
  openPath(path: string): Promise<void>
  /**
   * Rename a Workspace.
   * @param workspaceId - target workspace.
   * @param title - the new display title.
   * @returns the updated Workspace view.
   */
  rename(workspaceId: WorkspaceId, title: string): Promise<WorkspaceView>
  /**
   * Delete a Workspace (its sessions fall back to the unaccounted group).
   * @param workspaceId - target workspace.
   */
  delete(workspaceId: WorkspaceId): Promise<void>
  /**
   * Move a Workspace within the registry display order.
   * @param workspaceId - Workspace to move.
   * @param beforeWorkspaceId - Anchor workspace; omitted appends.
   */
  insertBefore(workspaceId: WorkspaceId, beforeWorkspaceId?: WorkspaceId): Promise<void>
  /**
   * Move an accounted session within/into a Workspace's ordered list.
   * @param workspaceId - target workspace.
   * @param sessionId - accounted session to move.
   * @param beforeSessionId - accounted anchor to insert before; omitted appends.
   * @returns the updated Workspace view.
   */
  insertSessionBefore(workspaceId: WorkspaceId, sessionId: SessionId, beforeSessionId?: SessionId): Promise<WorkspaceView>
  /**
   * Archive a session into the registry-global set (hidden from grouping
   * surfaces; session log and accounting slot remain). Archiving the current
   * session clears the selection into the New Session view state.
   * @param sessionId - session to archive.
   */
  archiveSession(sessionId: SessionId): Promise<void>
}
