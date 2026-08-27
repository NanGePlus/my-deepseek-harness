# Agent Note: Git porcelain lists files inside untracked directories

Status: implemented

English | [中文](2026-08-26-git-untracked-directory-files.zh.md)

## Problem

Creating a new folder and a file inside it produced two Git-UI failures that looked like separate Client bugs.

The Explorer row for the folder showed `U`, but the nested file showed no badge. The Git panel listed the folder (`tests/hahah`) instead of the file, and clicking that row failed with `git path not found` because `gitDiffPreview` reads a file.

Default `git status --porcelain` reports an untracked directory as one row (`?? tests/` or `?? tests/hahah/`) and does not name the files inside. `host.gitStatus` and `host.gitWorkingTree` both consumed that default, so the Host never returned the nested file path.

## Decision

Every Host porcelain read uses `git status --porcelain --untracked-files=all` (`GIT_PORCELAIN_UNTRACKED_FILES` in `git-status.ts`). Git then emits `?? tests/hahah/test.md`, which is the path Explorer badges and the Git panel can preview, stage, and discard.

Explorer still needs a folder `U` after that change, because porcelain no longer names the directory. `rollupGitBadges` copies descendant letters onto ancestor folders (`M` beats `D` beats `U`) and stops at the Workspace root.

Porcelain paths drop a trailing slash so a directory-shaped row, if Git still emits one, matches the Host-absolute directory path.

## Alternatives considered

**Walk untracked directories in Host after default porcelain.** Rejected: Git already has `-uall`; a second walk would duplicate ignore rules and miss `info/exclude`.

**Leave Git-panel rows as directories and preview by listing children.** Rejected: stage, discard, and diff preview are file operations; a directory row is what produced `git path not found`.

**Show badges only on files, not ancestor folders.** Rejected: the Explorer already showed `U` on the new folder, and that collapsed-tree signal is useful.

## Consequences

- Large untracked trees (for example a whole `node_modules` that is not ignored) can inflate porcelain output. Ignored paths still stay out of default porcelain.
- Explorer folder letters are derived Client-side; Git-panel lists remain Host rows only.

## Testing

`packages/host/apiproxy/tests/api-proxy-git-status.spec.ts` and `api-proxy-git-working-tree.spec.ts` create `tests/hahah/test.md` in a real repo and require the file path in `gitStatus` / `gitWorkingTree` plus an untracked-text preview.

`packages/client/ui-file-editor/tests/git-badge-rollup.client.spec.ts` covers ancestor rollup and M-over-U.

`packages/client/ui-file-editor/tests/editor-surface.client.spec.tsx` expands a nested folder whose Host listing names only the file and asserts `U` on both rows.
