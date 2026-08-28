# Agent Note: Host Git working-tree write RPCs

Status: implemented

English | [中文](2026-08-25-host-git-write.zh.md)

## Problem

The Git panel must stage, unstage, discard, and commit through Host-owned operations. The browser must not assemble git argv or apply patches ([ADR-0003](../../../../docs/adr/0003-git-panel-host-rpc.md)). Inspect RPCs in [Host Git working-tree inspect RPCs](2026-08-25-host-git-working-tree.md) list disk state; they do not mutate the index or working tree.

## Decision

`packages/host/apiproxy` adds four typed Host RPCs on the existing Host API seam. Client feature packages consume them only through `WorkspaceRuntime` (and the matching `IWorkspaces` / `TestWorkspaces` face). There is no arbitrary-argv git channel. Each write returns the refreshed `GitWorkingTreeResult` from the inspect path.

`host.gitStage({ workspaceId, path, hunkHeader? })` stages one unstaged change. Omitting `hunkHeader` runs `git add` for the whole file, including untracked paths. When `hunkHeader` is set, it must match a hunk from the unstaged `gitDiffPreview` of a tracked text file; the Host extracts that hunk from `git diff` and applies it with `git apply --cached`. Untracked paths reject hunk staging with `git-path-not-found`.

`host.gitUnstage({ workspaceId, path, hunkHeader? })` unstages one staged change without rewriting disk. Whole-file uses `git restore --staged` when HEAD exists. On an unborn branch it uses `git rm --cached -f` so added paths leave the index without resolving HEAD. A hunk uses the staged `git diff --cached` plus `git apply --cached --reverse`.

`host.gitDiscard({ workspaceId, path, hunkHeader? })` discards only unstaged changes. Whole-file: untracked paths are deleted from disk; tracked modifications and deletions restore the worktree from the index. A hunk applies `git apply --reverse` to the unstaged diff. Staged-only paths fail with `git-path-not-found` so discard never mutates the index.

`host.gitCommit({ workspaceId, message })` creates one new HEAD commit. The message is rejected after trim if empty (`git-failed`, Git’s empty-message wording). An empty staged list is rejected with `git-failed` (`nothing to commit`) without invoking `git commit`. Author identity is taken only from Git config; the Host never passes `--author`, never amends, and never pushes. Git’s own author-identity failure text is returned as `git-failed`.

`hunkHeader` is the `@@ … @@` line from `gitDiffPreview`. `runNativeCommand` has no stdin, so hunk patches are written to a temp file and passed as `git apply -- <file>`.

Write failures reuse existing codes: `git-unavailable`, `git-path-not-found`, `git-failed`, `cancelled`, `workspace-not-found`. A bound Workspace that is not a repository fails writes with `git-path-not-found` (inspect still returns success `availability: 'not-a-repository'`). Missing unstaged/staged rows, hunks that are not in the current diff, and paths outside the discovered repository root are `git-path-not-found`.

Implementation lives in `git-working-tree.ts`; wire types and zod schemas extend `HostApi` like the inspect RPCs.

## Alternatives considered

**Expose a generic `gitRun` with argv.** Rejected by the PRD and ADR-0003: the Host owns a closed set of typed operations; arbitrary argv is a shell, not a panel API.

**Let the Client assemble and send a patch.** Rejected: hunk selection is a UI concern, but patch assembly and `git apply` flags stay on the Host so the browser never handles git patch syntax or argv.

**Discard staged changes, or unstage-and-discard in one RPC.** Rejected: US-17 keeps discard off the index; unstaging is a separate typed operation.

**Supply author identity from the Session user.** Rejected: US-8 / US-21 require Git config only; a Host-invented `--author` would hide Git’s own identity failure.

**Pass a whitespace-only message through to `git commit -m`.** Rejected: Git may accept that message; the product requires a non-empty explanation after trim.

## Consequences

- `ui-git` (Issues #55–#59) calls these RPCs through `WorkspaceRuntime`, not `ui-file-editor` internals.
- Inspect RPCs are unchanged: git missing and not-a-repository remain success `availability` values on `gitWorkingTree`.
- Hunk headers from a preview can become stale after another hunk is applied; the Client must re-preview before a subsequent hunk write.
- Unborn-branch whole-file unstage is [Git unstage on an unborn branch](../bug-fix/2026-08-28-git-unborn-unstage.md).

## Testing

`packages/host/apiproxy/tests/api-proxy-git-write.spec.ts` covers whole-file and hunk stage/unstage/discard, unborn-branch unstage, commit constraints, author-identity failure text, typed error codes, and the absence of an argv channel through `createApiProxy`.

`packages/client/runtime/tests/workspaces-service.client.spec.ts` covers Client forwarding and `DirectoryBrowseError`.
