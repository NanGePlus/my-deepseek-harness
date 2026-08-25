# Agent Note: ui-git panel binds, lists, and initializes

Status: implemented

English | [中文](2026-08-25-ui-git-panel-bind-list.zh.md)

## Problem

The toolbox Git tab declared in [the three-tab Git slot](2026-08-25-details-three-tab-git.md) had an empty occupant. Web developers could switch to Git but could not see the bound Workspace's repository, working-tree lists, or empty states, and could not initialize a repository when Git was available and no ancestor repo existed.

## Decision

`@deepseek-ai/dsh-client-ui-git` is the Git-panel occupant of `conversation.details.git`. It follows the Workspace whose `sessionIds` include the current Session, calls `gitWorkingTree` / `gitInit` through injected `ctx.workspaces` closures, and does not import `ui-file-editor` internals.

The shell passes owner `visible: true` only while the Git segment is selected. The occupant stays mounted when hidden. It reads disk when `visible` becomes true, when the bound Workspace changes, and after a successful init. It does not poll while the tab stays selected, so Agent or terminal writes are not live-followed. Lists render Host rows only (ignored paths never appear; unsaved edit buffers never appear). `git-unavailable` and `not-a-repository` are mutually exclusive overlays; only the latter offers **初始化仓库**. A clean repository shows 「没有要提交的更改」 and keeps the commit-message field. Whole-file stage, discard, commit, and per-Session drafts are owned by [whole-file stage, discard, and commit](2026-08-25-ui-git-panel-stage-commit.md). Diff preview and hunk operations are owned by [diff preview and hunk operations](2026-08-25-ui-git-panel-diff-preview.md).

First load uses a centered spinner. A later re-read of an already-shown repository uses the 2px list-top indeterminate bar and does not mask the lists.

## Alternatives considered

**Fold the panel into `ui-file-editor`.** Rejected by [ADR-0004](../../../../docs/adr/0004-git-panel-client-plugin.md): file editing and the Git workflow stay separate packages.

**Fetch on mount even while the Git tab is hidden.** Rejected: the occupant is always mounted, so a visibility-gated read is what implements "refresh when switching to Git" without polling (US-35 / US-36).

**A shared disk-generation counter written by the file editor on explicit save.** Deferred at bind/list time: switching back to Git already re-reads disk. Explorer badge refresh after Git-panel writes is owned by [whole-file stage, discard, and commit](2026-08-25-ui-git-panel-stage-commit.md), which re-reads `gitStatus` when Explorer becomes visible.

**Wire stage, discard, commit, and diff preview in the same occupant change.** Rejected: Issue #56 is slice 1/4; write actions now live in [whole-file stage, discard, and commit](2026-08-25-ui-git-panel-stage-commit.md).

## Consequences

- `packages/bundle/web-app` registers `ui-git`. An empty Git seat is no longer the assembled web default.
- Whole-file stage/discard/commit are owned by [whole-file stage, discard, and commit](2026-08-25-ui-git-panel-stage-commit.md). Hunk operations are owned by [diff preview and hunk operations](2026-08-25-ui-git-panel-diff-preview.md). The Git action guard remains a later slice.
- The `ui-git` client bundle must rebuild before web e2e or `pnpm dsh web` shows the panel body.

## Testing

`packages/client/ui-git/tests/git-panel.client.spec.tsx` drives Fake Host callbacks and asserts the four empty states, both change lists, visibility-gated refresh, Session switch, init success/failure, and loading variants.

`packages/client/ui-git/tests/apply.client.spec.ts` covers slot injection, Host callback forwarding, and fiber dispose.

`apps/web/tests/details-segmented-tab.e2e.ts` snapshots the selected-Git not-a-repository empty state of the non-Git workspace fixture.
