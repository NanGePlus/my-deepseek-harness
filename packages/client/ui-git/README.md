# @deepseek-ai/dsh-client-ui-git

English | [中文](README.zh.md)

Git panel surface for the Web toolbox **Git** tab: the occupant injected into `conversation.details.git`. The panel follows the Workspace whose `sessionIds` include the current Session, discovers the Git repository root upward from that bound directory, and lists disk-only unstaged and staged working-tree changes, including files inside untracked directories. It does not import `ui-file-editor` internals.

The left column shows the current branch (or Git's detached-HEAD description), a commit-message field with **Commit**, and the **Changed, not staged for commit** / **Ready to commit** lists. Unstaged rows expose whole-file stage and discard (discard confirms first); staged rows expose only unstage. Commit requires a non-empty message and a non-empty staged list; the chevron menu offers **Commit & push** (Host runs `git push` after commit, falling back to `-u origin HEAD` when upstream is unset). Drafts are stored per Session in the slot store and survive hiding the Git tab or switching Session; a successful commit clears that Session's draft and shows an inline success hint. Clicking a row loads a disk-only diff preview in the right column and does not open an editor tab. Tracked-text hunks can be staged, unstaged, or discarded (discard confirms); untracked text, binary, and deletion previews are whole-file only. A dirty editor tab blocks discard, stage (whole file, hunk, or **Select all**), and any commit that includes that path; unstage is unrestricted. The guard dialog asks the user to save, discard that edit buffer, or close that tab and does not auto-save.

`apply` injects `gitWorkingTree`, `gitInit`, `gitDiffPreview`, `gitStage`, `gitUnstage`, `gitDiscard`, and `gitCommit` closures from `ctx.workspaces`. Product states `git-unavailable` and `not-a-repository` ride the success discriminant and render mutually exclusive overlays; only `not-a-repository` offers **初始化仓库**. A clean repository keeps the commit field with empty change lists. The occupant stays mounted when the Git tab is hidden; it re-reads disk when the tab becomes visible, when the bound Workspace changes, and after a successful init. Write RPCs return the refreshed lists and re-fetch the selected preview when that path remains. It does not poll while the tab stays selected. Ignored paths never appear because Host omits them.

## Model Experience

None, as the Git panel is browser chrome; working-tree lists, branch names, and commit drafts never enter the session log.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

- **No standalone pull/fetch/branch controls** — the panel does not pull, fetch, amend, or switch branches; optional **Commit & push** pushes the current branch after commit.
