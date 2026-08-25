# @deepseek-ai/dsh-client-ui-git

English | [中文](README.zh.md)

Git panel surface for the Web toolbox **Git** tab: the occupant injected into `conversation.details.git`. The panel follows the Workspace whose `sessionIds` include the current Session, discovers the Git repository root upward from that bound directory, and lists disk-only unstaged and staged working-tree changes. It does not import `ui-file-editor` internals.

The left column shows the current branch (or Git's detached-HEAD description), a commit-message field with **提交**, and the **更改** / **暂存的更改** lists. Unstaged rows expose whole-file stage and discard (discard confirms first); staged rows expose only unstage. Commit requires a non-empty message and a non-empty staged list. Drafts are stored per Session in the slot store and survive hiding the Git tab or switching Session; a successful commit clears that Session's draft. The right column shows 「选择一个文件以查看差异」 until a later slice fills the diff preview. Hunk operations and the Git action guard are out of this occupant.

`apply` injects `gitWorkingTree`, `gitInit`, `gitStage`, `gitUnstage`, `gitDiscard`, and `gitCommit` closures from `ctx.workspaces`. Product states `git-unavailable` and `not-a-repository` ride the success discriminant and render mutually exclusive overlays; only `not-a-repository` offers **初始化仓库**. A clean repository keeps the commit field and shows 「没有要提交的更改」. The occupant stays mounted when the Git tab is hidden; it re-reads disk when the tab becomes visible, when the bound Workspace changes, and after a successful init. Write RPCs return the refreshed lists. It does not poll while the tab stays selected. Ignored paths never appear because Host omits them.

## Model Experience

None, as the Git panel is browser chrome; working-tree lists, branch names, and commit drafts never enter the session log.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

- **No hunk operations** — whole-file stage, unstage, and discard only; `gitDiffPreview` and per-hunk actions land in a later git-panel slice.
- **No Git action guard** — dirty editor tabs do not yet block stage, discard, or commit.
- **No diff preview** — selecting a row does not yet load `gitDiffPreview`; the right column stays on the unselected empty copy.
