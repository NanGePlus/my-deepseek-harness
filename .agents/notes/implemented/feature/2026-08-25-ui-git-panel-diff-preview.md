# Agent Note: ui-git diff preview and hunk operations

Status: implemented

English | [中文](2026-08-25-ui-git-panel-diff-preview.zh.md)

## Problem

The Git-panel occupant from [whole-file stage, discard, and commit](2026-08-25-ui-git-panel-stage-commit.md) listed disk changes and could stage or commit whole files, but clicking a row did not show a diff. Tracked-text hunks could not be staged, unstaged, or discarded, so a path with only some hunks staged had no way to continue per-hunk work in the panel.

## Decision

Clicking a change row selects `{ side, row }` and loads `gitDiffPreview` into the right pane. The click does not open or replace an editor tab, and the preview never offers 「在编辑器中打开」 — including for a path inside the repository root but outside the bound Workspace. Selection is occupant React state; hiding the Git tab keeps it.

The preview toolbar repeats the whole-file actions of the selected side. Host `GitDiffPreview.kind` chooses the body:

- `text`: line-level hunks in `--ds-font-family-code` 13px/20px; add lines use `semantic-success`, delete lines use `semantic-error`. Unstaged hunks expose **暂存块** and **丢弃块**; staged hunks expose only **取消暂存块**. Hunk writes pass that hunk's unified-diff header into `gitStage` / `gitUnstage` / `gitDiscard`.
- `untracked-text`: the whole file as additions; whole-file actions only.
- `binary` / `deleted-binary`: a centered card 「二进制文件有差异」; whole-file actions only.
- `deleted-text`: the old text as deletions; whole-file actions only.

A merge-conflict file is a working-tree change with the same preview kinds; the pane has no Accept Current, abort, or continue controls. Hunk discard reuses the whole-file discard dialog and the row's `kind` copy. Write responses replace the lists and re-fetch the preview when the selected path remains on that side.

`apply` forwards `gitDiffPreview` and optional hunk headers through `ctx.workspaces`. The Git action guard is not in this occupant.

## Alternatives considered

**Reuse `DiffBlock` from `ui-primitives`.** Rejected: that card is a tool-mutation old/new pair with a copy control, path header, and 16-line cap. Git-panel hunks need context lines, per-hunk actions, and no collapse chrome.

**Add a DESIGN §5 hunk-row primitive.** Rejected by the [Git panel design-system close-out](../process/2026-08-25-git-panel-design-system.md): line-level diffs compose `semantic-success` / `semantic-error` with the code face.

**Open an editor tab for in-bound paths from the preview.** Rejected by US-22 / US-27: diff preview is not an editor tab, and bound-Workspace-outside paths must not open in the file editor.

**Store the selected row in the slot store.** Rejected: selection does not need to survive remounts or partition by Session; the occupant stays mounted when the Git tab is hidden.

## Consequences

- [Whole-file stage, discard, and commit](2026-08-25-ui-git-panel-stage-commit.md) still owns list-row whole-file writes, drafts, and Explorer badge refresh; this note owns preview, hunk headers, and the Host preview kinds.
- The Git action guard remains a later git-panel slice.
- The `ui-git` client bundle must rebuild before `pnpm dsh web` shows the preview pane.

## Testing

`packages/client/ui-git/tests/git-panel.client.spec.tsx` drives Fake Host `gitDiffPreview` / hunk writes and asserts panel-only preview, both sides of a split path, tracked-text hunk actions, untracked / binary / deletion bodies, outside-bound-Workspace preview, merge-conflict absence of merge controls, hunk discard confirm, and superseded-preview abort.

`packages/client/ui-git/tests/apply.client.spec.ts` forwards `gitDiffPreview` and hunk headers through the inject face.
