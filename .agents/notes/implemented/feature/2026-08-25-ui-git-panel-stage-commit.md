# Agent Note: ui-git whole-file stage, discard, and commit

Status: implemented

English | [中文](2026-08-25-ui-git-panel-stage-commit.zh.md)

## Problem

The Git-panel occupant from [bind, list, and initialize](2026-08-25-ui-git-panel-bind-list.md) listed disk changes but could not stage, unstage, discard, or commit. Web developers still had to leave dsh Web to make a commit, and a commit-message draft had nowhere to live across Tab and Session switches.

## Decision

`ui-git` calls the Host write RPCs in [Host Git working-tree write RPCs](2026-08-25-host-git-write.md) through injected `ctx.workspaces` closures: whole-file `gitStage` / `gitUnstage` / `gitDiscard` / `gitCommit`. Write responses replace the panel lists; the occupant does not issue a follow-up `gitWorkingTree`. Hunk headers are omitted. The Git action guard is not in this occupant.

Unstaged rows expose **暂存** and **丢弃**; staged rows expose only **取消暂存**. Section heads expose **全部暂存** / **全部取消暂存**. Discard opens a panel-local `bg-layer-3` dialog (not a full-viewport mask): tracked modification uses 「丢弃更改」 / restore-to-index-or-HEAD; untracked uses 「丢弃未跟踪文件」 / delete-from-disk; tracked deletion uses 「丢弃更改」 / restore-the-file-to-disk. Host `GitWorkingTreeChange.kind` (`modified` / `untracked` / `deleted`) selects that copy.

Commit requires a non-empty trim of the message and a non-empty staged list. A whitespace-only message with staged files shows 「请填写提交说明」 and an error border. Success creates one new HEAD commit (Host does not amend or push) and clears that Session's draft. Failure shows Git's text plus **重试** and keeps the draft; the panel never collects `user.name` / `user.email`.

Commit-message drafts live in the slot store from `createGitPanelStore`, keyed by Session id. They are not session-log events. Hiding the Git tab or switching Session leaves every draft in place.

File-tree Git badges re-read disk when the Explorer tab becomes visible after being hidden. `ui-conversation` passes owner `visible` to `conversation.details.editor` the same way it does for Git; `ui-git` still does not import `ui-file-editor` internals.

## Alternatives considered

**Infer discard-dialog copy from `gitDiffPreview`.** Rejected: that couples this slice to the preview RPC and costs an extra round-trip for a fact porcelain already has. `kind` on the inspect row is the Host contract.

**A shared disk-generation counter that `ui-git` bumps after every write.** Rejected for this slice: the file tree is hidden while Git is selected, and US-37 is observable after switching back to Explorer. Passing `visible` into the Explorer occupant reuses the Git tab's visibility-gated read.

**Keep the commit draft in React state on the occupant.** Rejected: drafts must survive remounts and are per-Session human UI state, which is the slot-store seat.

**Unstage-and-discard from the staged list.** Rejected by US-17: staged rows only cancel staging.

## Consequences

- [Bind/list/init](2026-08-25-ui-git-panel-bind-list.md) still owns discovery, empty states, and visibility-gated inspect reads; this note owns whole-file writes, drafts, and Explorer badge refresh.
- Hunk operations and the Git action guard remain later git-panel slices.
- The `ui-git` and `ui-conversation` / `ui-file-editor` client bundles must rebuild before `pnpm dsh web` shows write actions and Explorer `visible`.

## Testing

`packages/client/ui-git/tests/git-panel.client.spec.tsx` drives Fake Host write callbacks and asserts row actions, section-wide stage/unstage, discard-confirm copy, commit enablement, in-flight spinners, commit failure plus retry, per-Session drafts, and Tab-hide persistence.

`packages/host/apiproxy/tests/parse-working-tree-porcelain.spec.ts` pins `kind` on unstaged, staged, and split-side rows.

`packages/client/ui-conversation/tests/details-panel-tabs.client.spec.tsx` and `packages/client/ui-file-editor/tests/editor-surface.client.spec.tsx` cover Explorer `visible` and a gitStatus re-read when Explorer returns.
