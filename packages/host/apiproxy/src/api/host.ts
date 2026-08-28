/**
 * host domain contract. No protocol version: client and host ship
 * together; introduce protocolVersion only when an independently released client appears.
 */

import type { RpcRequest, RpcResponse, RpcError } from './rpc.ts'
import type { WorkspaceId } from './workspace.ts'

/** One directory row of a listing: a child entry or a breadcrumb ancestor. */
export interface DirectoryEntry {
  /** Base name shown in a browser row (a root crumb carries its full path). */
  name: string
  /** Absolute host path — the client never joins path segments itself. */
  path: string
  /** Hidden by the host platform's convention (dot-prefixed on POSIX); the client owns whether to show it. */
  hidden: boolean
}

/** One row of host.listWorkspaceEntries: a direct child file or folder. */
export interface WorkspaceEntry {
  /** Base name within the listed directory. */
  name: string
  /** Absolute host path — the client never joins path segments itself. */
  path: string
  /** True for directories and for symlinks whose target is a directory. */
  isDirectory: boolean
  /** Hidden by the host platform's convention (dot-prefixed on POSIX). */
  hidden: boolean
}

/** host.listWorkspaceEntries response value: one directory level inside a Workspace. */
export interface WorkspaceEntriesListing {
  /** Absolute path of the listed directory. */
  path: string
  /** Direct child entries, name-sorted; files and folders both included. */
  entries: WorkspaceEntry[]
  /** True when the backend cut `entries` at its complete-result bound. */
  truncated: boolean
}

/** One Git badge row for host.gitStatus. */
export interface GitStatusEntry {
  /** Absolute host path — the client never joins path segments itself. */
  path: string
  /** Client badge letter (M modified, U untracked, D deleted, etc.). */
  letter: string
}

/** host.gitStatus response value: working-tree badges for a Workspace root. */
export interface GitStatusListing {
  /** Badge rows, path-sorted; empty when Git is absent or the root is not a repository. */
  entries: GitStatusEntry[]
}

/**
 * Nature of one working-tree change row. Untracked is a new path (`??` or
 * index `A`); deleted is a tracked deletion (`D`); everything else is modified.
 */
export type GitWorkingTreeChangeKind = 'modified' | 'untracked' | 'deleted'

/** One working-tree change row of host.gitWorkingTree. */
export interface GitWorkingTreeChange {
  /** Path relative to the Git repository root (POSIX separators). */
  path: string
  /** Absolute host path. May lie outside the bound Workspace when the repo root is an ancestor. */
  absolutePath: string
  /** Untracked, tracked deletion, or other tracked change — drives discard-confirm copy. */
  kind: GitWorkingTreeChangeKind
}

/**
 * host.gitWorkingTree success value. Git unavailable and not-a-repository are
 * product states, not RPC errors, so the Git panel can render the matching empty state.
 */
export type GitWorkingTreeResult =
  | { availability: 'git-unavailable' }
  | { availability: 'not-a-repository' }
  | {
    availability: 'repository'
    /** Absolute Git repository root discovered upward from the bound Workspace. */
    repoRoot: string
    /**
     * Current branch name, or Git's description of a detached HEAD
     * (for example `HEAD detached at abc1234`).
     */
    branch: string
    /** Unstaged working-tree changes, including untracked paths; ignored paths omitted. */
    unstaged: GitWorkingTreeChange[]
    /** Staged working-tree changes; ignored paths omitted. */
    staged: GitWorkingTreeChange[]
    /**
     * True when {@link HostApi.gitPush} can publish local commits on the current
     * branch (ahead of upstream, or a named branch that has a commit and no
     * upstream). False on an unborn branch even when `origin` exists.
     */
    pushAvailable: boolean
    /**
     * True when `git remote` lists at least one name. Host always sets this on
     * repository results; omitted only in older fixtures.
     */
    hasRemote?: boolean
    /**
     * URL of remote `origin` from `git remote get-url origin`. Omitted when
     * `origin` is missing, including when other remotes exist.
     */
    originUrl?: string
    /** Commits on HEAD not on @{upstream}; omitted when upstream is unset. */
    ahead?: number
  }

/** host.gitInit response value: the newly created repository root. */
export interface GitInitResult {
  /** Absolute bound Workspace path where `git init` ran. */
  repoRoot: string
}

/** One commit row of host.gitLog. */
export interface GitLogEntry {
  /** Full commit hash. */
  hash: string
  /** Abbreviated commit hash. */
  shortHash: string
  /** Parent commit hashes in Git order (empty for root commits). */
  parents: string[]
  /** First line of the commit message. */
  subject: string
  /** Author display name from Git metadata. */
  authorName: string
  /** Author timestamp as ISO-8601 from `%aI`. */
  authorDate: string
  /** Commit message body after the subject (`%b`); empty when absent. */
  body: string
  /** Branch and tag labels attached to this commit (HEAD resolved). */
  refs: string[]
}

/**
 * host.gitLog success value. Git unavailable and not-a-repository are product
 * states, not RPC errors, so the Git panel can hide the graph section.
 */
export type GitLogResult =
  | { availability: 'git-unavailable' }
  | { availability: 'not-a-repository' }
  | {
    availability: 'repository'
    /** Absolute Git repository root discovered upward from the bound Workspace. */
    repoRoot: string
    /** One page of commits in reverse chronological order (newest first). */
    commits: GitLogEntry[]
    /** True when a further `skip` page exists beyond this result. */
    hasMore: boolean
  }

/** Nature of one file changed in a commit relative to its first parent (or empty tree for a root). */
export type GitCommitDiffFileStatus = 'added' | 'modified' | 'deleted' | 'renamed'

/** One file of host.gitCommitDiff. */
export interface GitCommitDiffFile {
  /** Path relative to the Git repository root (POSIX separators); the new path after a rename. */
  path: string
  /** First-parent name-status letter mapped onto the panel badge. */
  status: GitCommitDiffFileStatus
  /** Same preview kinds as {@link GitDiffPreview}; added text uses `untracked-text`. */
  preview: GitDiffPreview
}

/**
 * host.gitCommitDiff success value. Git unavailable and not-a-repository are product
 * states, not RPC errors. An unknown hash fails with `git-failed`.
 */
export type GitCommitDiffResult =
  | { availability: 'git-unavailable' }
  | { availability: 'not-a-repository' }
  | {
    availability: 'repository'
    /** Full commit hash after `rev-parse`. */
    hash: string
    /** Changed files versus the first parent; Host caps the list at 80 files. */
    files: GitCommitDiffFile[]
    /** True when more files existed than the cap. */
    truncated: boolean
  }

/** Which change list a gitDiffPreview request reads. */
export type GitDiffSide = 'unstaged' | 'staged'

/** One unified-diff line in a text hunk. */
export interface GitDiffLine {
  origin: 'context' | 'add' | 'del'
  /** Line text without the origin prefix. */
  text: string
}

/** One contiguous hunk of a tracked-text diff preview. */
export interface GitDiffHunk {
  /** Unified-diff hunk header (the `@@ … @@` line). */
  header: string
  lines: GitDiffLine[]
}

/**
 * host.gitDiffPreview success value. Tracked text is line-level hunks plus the
 * post-change file body used to fill unchanged regions between hunks;
 * untracked text is the whole file; binary only declares that a diff exists;
 * deletions include old text when the blob is text.
 */
export type GitDiffPreview =
  | { kind: 'text'; hunks: GitDiffHunk[]; fileText: string }
  | { kind: 'untracked-text'; text: string }
  | { kind: 'binary' }
  | { kind: 'deleted-text'; text: string }
  | { kind: 'deleted-binary' }

/** host.readFile request discriminator: text for editable sources, bytes for image preview. */
export type FileReadKind = 'text' | 'bytes'

/** host.readFile response when `kind` is `text`. */
export interface FileTextRead {
  kind: 'text'
  /** Absolute host path of the read file. */
  path: string
  /** UTF-8 text content. */
  text: string
}

/** host.readFile response when `kind` is `bytes`. */
export interface FileBytesRead {
  kind: 'bytes'
  /** Absolute host path of the read file. */
  path: string
  /** Canonical base64 of the on-disk bytes. */
  data: string
  /** Image media type derived from the file extension. */
  mediaType: string
}

/** host.readFile response value. */
export type FileReadResult = FileTextRead | FileBytesRead

/** host.writeFile response value. */
export interface FileWriteResult {
  /** Absolute host path written. */
  path: string
}

/** host.deletePath / host.renamePath / host.createWorkspaceDirectory response value. */
export interface PathMutationResult {
  /** Absolute host path affected by the mutation. */
  path: string
}

/** host.watchPath stream frame: one external change on the watched path. */
export type WatchPathFrame =
  | { type: 'host/path-changed'; path: string }
  | { type: 'stream/error'; error: RpcError }

/** Zero-based UTF-16 position in an editor buffer. */
export interface HostLspPosition {
  line: number
  character: number
}

/** Zero-based UTF-16 range in an editor buffer. */
export interface HostLspRange {
  start: HostLspPosition
  end: HostLspPosition
}

/** One language-server diagnostic for Monaco markers. */
export interface HostLspDiagnostic {
  message: string
  severity: 'error' | 'warning' | 'info' | 'hint'
  range: HostLspRange
}

/** host.lspSyncDocument response value. */
export interface LspSyncDocumentResult {
  diagnostics: HostLspDiagnostic[]
}

/** host.lspCloseDocument response value. */
export interface LspCloseDocumentResult {
  closed: true
}

/** Normalized hover content for the editor surface. */
export interface HostLspHover {
  contents: string
  range?: HostLspRange
}

/** host.lspHoverDocument response value. */
export interface LspHoverDocumentResult {
  hover: HostLspHover | null
}

/** host.listDirectory response value: one directory level plus its ancestry. */
export interface DirectoryListing {
  /** Absolute path of the listed directory. */
  path: string
  /** The host account's home directory (breadcrumb "Home" rooting). */
  home: string
  /**
   * Ancestor chain from the filesystem root to the listed directory
   * inclusive; every crumb is a jump target (crumb `hidden` is always false).
   */
  crumbs: DirectoryEntry[]
  /** Direct child directories, name-sorted; symlinks to directories included. */
  entries: DirectoryEntry[]
  /** True when the backend cut `entries` at its complete-result bound (the name-sorted tail is absent). */
  truncated: boolean
}

/** Host-level unary methods. */
export interface HostApi {
  /**
   * One-shot host snapshot. Empty payload uses the literal `{}` (extend in place when fields arrive).
   * version = the host app's (apps/cli) package.json version; cwd = the host process working
   * directory (root for session persistence and tool execution); provider/model = the defaults
   * applied when a new agent doesn't specify them explicitly, absent when the host configures
   * no explicit default (the adapter falls back internally);
   * attachedSessions = count of currently attached sessions (those with a live agent);
   * canOpenPath = whether this deployment can hand a path to a user-visible native desktop.
   */
  describe(request: RpcRequest<{}>): Promise<RpcResponse<{
    version: string
    cwd: string
    provider?: string
    model?: string
    attachedSessions: number
    canOpenPath: boolean
  }>>

  /**
   * Open the operating system's single-directory picker; cancellation returns
   * null. Only served under the `native` capability.
   */
  pickDirectory(
    request: RpcRequest<{}>,
    signal: AbortSignal,
  ): Promise<RpcResponse<{ path: string | null }>>

  /**
   * List one directory level for the in-app browser; an absent path lists the
   * host account's home directory. Only served under the `browse` capability;
   * unreadable or missing targets fail with `directory-unreadable`. The
   * carrier's request signal follows the caller, stopping the backend's scan
   * on disconnect or timeout.
   */
  listDirectory(
    request: RpcRequest<{ path?: string }>,
    signal: AbortSignal,
  ): Promise<RpcResponse<DirectoryListing>>

  /**
   * Create one child directory under an existing parent (the browser's
   * "New folder"). Only served under the `browse` capability; an existing
   * child fails with `directory-exists`, every other filesystem failure with
   * `directory-create-failed`.
   */
  createDirectory(
    request: RpcRequest<{ path: string; name: string }>,
  ): Promise<RpcResponse<{ path: string }>>

  /**
   * List one directory level inside a registered Workspace; the path must
   * lie within that Workspace's root (out-of-bounds paths fail with
   * `workspace-path-out-of-bounds`). Returns files and folders with host-owned
   * `hidden` flags; `truncated` marks a cut level the client must not treat as
   * exhaustive. The carrier's request signal follows the caller, stopping the
   * backend's scan on disconnect or timeout.
   */
  listWorkspaceEntries(
    request: RpcRequest<{ workspaceId: WorkspaceId; path: string }>,
    signal: AbortSignal,
  ): Promise<RpcResponse<WorkspaceEntriesListing>>

  /**
   * Read Git working-tree badge letters for a registered Workspace by running
   * `git status --porcelain --untracked-files=all` at its root so files inside
   * untracked directories appear as their own rows. Non-repositories and hosts without
   * `git` return an empty entry list without error.
   */
  gitStatus(
    request: RpcRequest<{ workspaceId: WorkspaceId }>,
    signal: AbortSignal,
  ): Promise<RpcResponse<GitStatusListing>>

  /**
   * Discover the Git repository root and current branch for a registered
   * Workspace, and list unstaged and staged working-tree changes. Distinguishes
   * Git unavailable from not-a-repository. Does not expose an arbitrary git argv.
   */
  gitWorkingTree(
    request: RpcRequest<{ workspaceId: WorkspaceId }>,
    signal: AbortSignal,
  ): Promise<RpcResponse<GitWorkingTreeResult>>

  /**
   * Initialize a Git repository at the bound Workspace root. Fails with
   * `git-unavailable` when git is missing, `already-a-git-repository` when
   * any ancestor is already a repository, and `git-failed` when `git init`
   * itself fails. Does not publish a remote.
   */
  gitInit(
    request: RpcRequest<{ workspaceId: WorkspaceId }>,
    signal: AbortSignal,
  ): Promise<RpcResponse<GitInitResult>>

  /**
   * Read a disk-only diff preview for one working-tree change. The path is a
   * Host-absolute path under the discovered repository root (it may lie outside
   * the bound Workspace). `side` selects the unstaged or staged diff. Missing
   * change rows fail with `git-path-not-found`; a missing git binary with
   * `git-unavailable`; other git invocation failures with `git-failed`.
   */
  gitDiffPreview(
    request: RpcRequest<{ workspaceId: WorkspaceId; path: string; side: GitDiffSide }>,
    signal: AbortSignal,
  ): Promise<RpcResponse<GitDiffPreview>>

  /**
   * Stage one unstaged working-tree change. Omit `hunkHeader` to stage the
   * whole file; when present, only that tracked-text hunk is staged (patch
   * assembly stays on the Host). The path is a Host-absolute path under the
   * discovered repository root (it may lie outside the bound Workspace).
   * Returns the refreshed working tree. Missing unstaged rows or hunks fail with
   * `git-path-not-found`; a missing git binary with `git-unavailable`; other git
   * invocation failures with `git-failed`. Does not expose an arbitrary git argv.
   */
  gitStage(
    request: RpcRequest<{ workspaceId: WorkspaceId; path: string; hunkHeader?: string }>,
    signal: AbortSignal,
  ): Promise<RpcResponse<GitWorkingTreeResult>>

  /**
   * Unstage one staged working-tree change. Omit `hunkHeader` to unstage the
   * whole file; when present, only that tracked-text hunk is unstaged. Does not
   * rewrite the disk working tree. On an unborn branch, whole-file unstage uses
   * `git rm --cached -f` because `git restore --staged` cannot resolve HEAD.
   * Returns the refreshed working tree. Missing staged rows or hunks fail with
   * `git-path-not-found`; a missing git binary with `git-unavailable`; other git
   * invocation failures with `git-failed`.
   */
  gitUnstage(
    request: RpcRequest<{ workspaceId: WorkspaceId; path: string; hunkHeader?: string }>,
    signal: AbortSignal,
  ): Promise<RpcResponse<GitWorkingTreeResult>>

  /**
   * Discard one unstaged working-tree change. Omit `hunkHeader` to discard the
   * whole file; when present, only that unstaged tracked-text hunk is discarded
   * on disk. Tracked modifications restore disk from the index (HEAD when nothing
   * is staged); untracked paths are deleted from disk; tracked deletions restore
   * the file. Staged-only paths are not discarded. Returns the refreshed working
   * tree. Missing unstaged rows or hunks fail with `git-path-not-found`; a missing
   * git binary with `git-unavailable`; other git invocation failures with `git-failed`.
   */
  gitDiscard(
    request: RpcRequest<{ workspaceId: WorkspaceId; path: string; hunkHeader?: string }>,
    signal: AbortSignal,
  ): Promise<RpcResponse<GitWorkingTreeResult>>

  /**
   * Create one new commit from the current index on HEAD. Requires a non-empty
   * commit message and a non-empty staged area. Author identity is taken only
   * from Git config. Does not amend. Returns the refreshed working tree.
   * An empty trimmed message is allowed via `--allow-empty-message`. When
   * `push` is true, runs `git push` after a successful commit. Empty staged
   * area fails with `git-failed`; a repository with no remotes fails with
   * `git-failed` `no remote configured` before creating the commit; missing git
   * with `git-unavailable`; other Git failures with `git-failed` carrying Git's
   * own text.
   */
  gitCommit(
    request: RpcRequest<{ workspaceId: WorkspaceId; message: string; push?: boolean }>,
    signal: AbortSignal,
  ): Promise<RpcResponse<GitWorkingTreeResult>>

  /**
   * Push the current branch without creating a new commit. Detached HEAD fails
   * with `git-failed`. A repository with no remotes fails with `git-failed`
   * `no remote configured`. When upstream is unset, runs `git push -u origin HEAD`.
   * Returns the refreshed working tree.
   */
  gitPush(
    request: RpcRequest<{ workspaceId: WorkspaceId }>,
    signal: AbortSignal,
  ): Promise<RpcResponse<GitWorkingTreeResult>>

  /**
   * Add `origin` with the given URL. Does not fetch, push, or rename an existing
   * remote. An empty trimmed URL fails with `git-failed` `empty remote url`.
   * When `origin` already exists, Git's own text rides `git-failed`. Returns the
   * refreshed working tree. Missing git fails with `git-unavailable`.
   */
  gitAddRemote(
    request: RpcRequest<{ workspaceId: WorkspaceId; url: string }>,
    signal: AbortSignal,
  ): Promise<RpcResponse<GitWorkingTreeResult>>

  /**
   * Remove remote `origin`. Does not fetch, push, or touch remotes with other
   * names. When `origin` is missing, Git's own text rides `git-failed`. Returns
   * the refreshed working tree. Missing git fails with `git-unavailable`.
   */
  gitRemoveRemote(
    request: RpcRequest<{ workspaceId: WorkspaceId }>,
    signal: AbortSignal,
  ): Promise<RpcResponse<GitWorkingTreeResult>>

  /**
   * Read one page of commit history for the Git repository discovered from a
   * registered Workspace. Distinguishes Git unavailable from not-a-repository.
   * Does not expose an arbitrary git argv.
   */
  gitLog(
    request: RpcRequest<{ workspaceId: WorkspaceId; limit?: number; skip?: number }>,
    signal: AbortSignal,
  ): Promise<RpcResponse<GitLogResult>>

  /**
   * Read the first-parent file diffs of one commit for the Git repository
   * discovered from a registered Workspace. Distinguishes Git unavailable from
   * not-a-repository. An unknown hash fails with `git-failed`. Does not expose
   * an arbitrary git argv.
   */
  gitCommitDiff(
    request: RpcRequest<{ workspaceId: WorkspaceId; hash: string }>,
    signal: AbortSignal,
  ): Promise<RpcResponse<GitCommitDiffResult>>

  /**
   * Read one regular file inside a registered Workspace; the path must lie
   * within that Workspace's root (`workspace-path-out-of-bounds` otherwise).
   * Text reads return UTF-8; byte reads return canonical base64 for image preview.
   */
  readFile(
    request: RpcRequest<{ workspaceId: WorkspaceId; path: string; kind: FileReadKind }>,
    signal: AbortSignal,
  ): Promise<RpcResponse<FileReadResult>>

  /**
   * Write editable UTF-8 text to one path inside a registered Workspace,
   * creating the file when absent; out-of-bounds paths fail with
   * `workspace-path-out-of-bounds`.
   */
  writeFile(
    request: RpcRequest<{ workspaceId: WorkspaceId; path: string; text: string }>,
    signal: AbortSignal,
  ): Promise<RpcResponse<FileWriteResult>>

  /**
   * Delete one file or directory tree inside a registered Workspace; the path
   * must lie within that Workspace's root (`workspace-path-out-of-bounds`
   * otherwise).
   */
  deletePath(
    request: RpcRequest<{ workspaceId: WorkspaceId; path: string }>,
    signal: AbortSignal,
  ): Promise<RpcResponse<PathMutationResult>>

  /**
   * Rename one file or directory within the same parent directory inside a
   * registered Workspace; an existing target fails with `directory-exists`.
   */
  renamePath(
    request: RpcRequest<{ workspaceId: WorkspaceId; path: string; newName: string }>,
    signal: AbortSignal,
  ): Promise<RpcResponse<PathMutationResult>>

  /**
   * Create one child directory under an existing parent inside a registered
   * Workspace; an existing child fails with `directory-exists` (same semantics
   * as the browse directory picker). Does not replace `host.createDirectory`.
   */
  createWorkspaceDirectory(
    request: RpcRequest<{ workspaceId: WorkspaceId; path: string; name: string }>,
    signal: AbortSignal,
  ): Promise<RpcResponse<PathMutationResult>>

  /**
   * Open a filesystem path with the operating system's default application
   * (Finder / Explorer / xdg-open hand-off). The browser carrier's
   * prefix-wide trust fence covers this privileged method like every other
   * `/api` request.
   */
  openPath(
    request: RpcRequest<{ path: string }>,
    signal: AbortSignal,
  ): Promise<RpcResponse<{ opened: true }>>

  /**
   * Push external disk changes for one opened path inside a registered
   * Workspace until the caller aborts the stream. Watches only the given
   * path via Host `fs.watch`; out-of-bounds paths fail before streaming.
   */
  watchPath(
    request: RpcRequest<{ workspaceId: WorkspaceId; path: string }>,
    signal: AbortSignal,
  ): AsyncIterable<RpcRequest<WatchPathFrame>>

  /**
   * Sync one editor buffer with the host language server and return diagnostics.
   * Fails with `lsp-unavailable` when the deployment mounts no editor LSP backend.
   */
  lspSyncDocument(
    request: RpcRequest<{ workspaceId: WorkspaceId; path: string; text: string; version: number }>,
    signal: AbortSignal,
  ): Promise<RpcResponse<LspSyncDocumentResult>>

  /**
   * Close one editor document in the host language server.
   * Fails with `lsp-unavailable` when the deployment mounts no editor LSP backend.
   */
  lspCloseDocument(
    request: RpcRequest<{ workspaceId: WorkspaceId; path: string }>,
    signal: AbortSignal,
  ): Promise<RpcResponse<LspCloseDocumentResult>>

  /**
   * Query hover for one open editor document at a cursor position.
   * Fails with `lsp-unavailable` when the deployment mounts no editor LSP backend.
   */
  lspHoverDocument(
    request: RpcRequest<{ workspaceId: WorkspaceId; path: string; text: string; version: number; line: number; character: number }>,
    signal: AbortSignal,
  ): Promise<RpcResponse<LspHoverDocumentResult>>
}
