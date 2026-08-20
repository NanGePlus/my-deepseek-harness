/**
 * host domain contract. No protocol version: client and host ship
 * together; introduce protocolVersion only when an independently released client appears.
 */

import type { RpcRequest, RpcResponse } from './rpc.ts'
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
   * `git status --porcelain` at its root. Non-repositories and hosts without
   * `git` return an empty entry list without error.
   */
  gitStatus(
    request: RpcRequest<{ workspaceId: WorkspaceId }>,
    signal: AbortSignal,
  ): Promise<RpcResponse<GitStatusListing>>

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
}
