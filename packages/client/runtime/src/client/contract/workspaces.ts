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
  GitWorkingTreeResult, GitInitResult, GitDiffSide, GitDiffPreview,
  LspSyncDocumentResult, LspCloseDocumentResult, LspHoverDocumentResult,
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
