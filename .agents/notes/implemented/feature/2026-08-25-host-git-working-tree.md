# Agent Note: Host Git working-tree inspect RPCs

Status: implemented

English | [中文](2026-08-25-host-git-working-tree.zh.md)

## Problem

The Git panel needs Host-mediated repository discovery, unstaged/staged change lists, disk-only diff preview, and initialize-at-Workspace-root. The browser must not touch disk or run git ([ADR-0003](../../../../docs/adr/0003-git-panel-host-rpc.md)). V1 `host.gitStatus` collapses “git missing” and “not a repository” into an empty badge list, which cannot drive the panel’s distinct empty states.

## Decision

`packages/host/apiproxy` adds three typed Host RPCs on the existing Host API seam. Client feature packages consume them only through `WorkspaceRuntime` (and the matching `IWorkspaces` / `TestWorkspaces` face). There is no arbitrary-argv git channel.

`host.gitWorkingTree({ workspaceId })` walks upward from the bound Workspace with `git rev-parse --show-toplevel`, returns the current branch or Git’s detached-HEAD description, and lists unstaged and staged disk changes. Each row carries a POSIX path relative to the repository root plus a Host-absolute `absolutePath` that may lie outside the bound Workspace. Ignored paths are omitted (default porcelain). Git missing and not-a-repository are success `availability` values, not RPC errors, so the panel can render the matching empty state. Unexpected git failures remain `internal`.

`host.gitInit({ workspaceId })` runs `git init` only at the bound Workspace root when no ancestor is already a repository. Failures: `git-unavailable`, `already-a-git-repository` (details include `repoRoot`), `git-failed` (message is Git’s own text). It does not publish a remote.

`host.gitDiffPreview({ workspaceId, path, side })` reads a disk-only preview for one path in the unstaged or staged list. Success kinds are `text` (hunks), `untracked-text`, `binary`, `deleted-text`, and `deleted-binary`. A path with no matching change, or a path outside the discovered repository root, fails with `git-path-not-found`. Git missing fails with `git-unavailable`; other git invocation failures with `git-failed`.

V1 `host.gitStatus` is unchanged: non-repositories and hosts without git still return empty `entries`.

Implementation lives in `git-working-tree.ts`; wire types and zod schemas extend `HostApi` like `gitStatus`.

## Alternatives considered

**Reuse `host.gitStatus` and infer empty states from an empty badge list.** Rejected: US-32/US-33 require distinguishing git missing from not-a-repository, including when a `.git` directory is already on disk.

**Expose a generic `gitRun` with argv.** Rejected by the PRD and ADR-0003: the Host owns a closed set of typed operations; arbitrary argv is a shell, not a panel API.

**Bound change lists to the Workspace root.** Rejected: nested Workspaces must see the whole repository so the user can commit the repo they discovered, while the file editor still refuses paths outside the bound Workspace.

**Treat git missing and not-a-repository as RPC errors on `gitWorkingTree`.** Rejected: those are product empty states, not transport failures; the Client would have to special-case error codes that are success discriminants for the panel.

## Consequences

- Staging, unstaging, discard, and commit stay on Issue #54; this change is inspect-only plus initialize.
- `ui-git` (Issues #55–#59) calls these RPCs through `WorkspaceRuntime`, not `ui-file-editor` internals.
- Paths outside the bound Workspace may appear in lists and previews; opening them in the file editor remains out of scope for this RPC.

## Testing

`packages/host/apiproxy/tests/api-proxy-git-working-tree.spec.ts` covers discovery, branch/detached HEAD, both change lists, ignored and out-of-workspace paths, initialize, availability discriminants, and preview kinds plus typed failures through `createApiProxy`.

`packages/host/apiproxy/tests/api-proxy-git-status.spec.ts` keeps V1 empty-list behavior for non-repositories and missing git.

`packages/client/runtime/tests/workspaces-service.client.spec.ts` covers Client forwarding and `DirectoryBrowseError`.
