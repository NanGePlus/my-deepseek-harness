# Agent Note: Git porcelain 列出未跟踪目录内的文件

Status: implemented

[English](2026-08-26-git-untracked-directory-files.md) | 中文

## Problem

在资源管理器里新建文件夹再在其中新建文件，会出现两处看起来像 Client 的 Git UI 失败。

文件夹行有 `U`，里面的文件没有徽章。Git 面板列出的是文件夹（`tests/hahah`）而不是文件，点这一行会以 `git path not found` 失败，因为 `gitDiffPreview` 读的是文件。

默认 `git status --porcelain` 把未跟踪目录收成一行（`?? tests/` 或 `?? tests/hahah/`），不点名其中的文件。`host.gitStatus` 与 `host.gitWorkingTree` 都吃这个默认输出，所以 Host 从未返回嵌套文件路径。

## Decision

Host 每一次 porcelain 读取都使用 `git status --porcelain --untracked-files=all`（`git-status.ts` 里的 `GIT_PORCELAIN_UNTRACKED_FILES`）。Git 于是发出 `?? tests/hahah/test.md`，这才是资源管理器徽章和 Git 面板可以预览、暂存、丢弃的路径。

这一改之后 porcelain 不再点名目录，资源管理器仍需要文件夹上的 `U`。`rollupGitBadges` 把后代字母抄到祖先文件夹（`M` 强于 `D` 强于 `U`），并在 Workspace 根停下。

porcelain 路径去掉末尾斜杠，这样 Git 若仍发出目录形态的行，也能对上 Host 绝对目录路径。

## Alternatives considered

**在默认 porcelain 之后由 Host 再走一遍未跟踪目录。** 否决：Git 已有 `-uall`；二次遍历会重复 ignore 规则，还会漏掉 `info/exclude`。

**Git 面板继续以目录为行，预览时再列出子文件。** 否决：暂存、丢弃和差异预览都是文件操作；目录行正是 `git path not found` 的来源。

**只在文件上显示徽章，祖先文件夹不显示。** 否决：资源管理器本来就在新建文件夹上显示 `U`，折叠树时这条信号有用。

## Consequences

- 未被忽略的大型未跟踪树（例如整棵 `node_modules`）会撑大 porcelain 输出。被忽略路径仍不会出现在默认 porcelain 里。
- 资源管理器文件夹字母在 Client 侧派生；Git 面板列表仍只渲染 Host 行。

## Testing

`packages/host/apiproxy/tests/api-proxy-git-status.spec.ts` 与 `api-proxy-git-working-tree.spec.ts` 在真实仓库中创建 `tests/hahah/test.md`，要求 `gitStatus` / `gitWorkingTree` 给出文件路径，并给出 untracked-text 预览。

`packages/client/ui-file-editor/tests/git-badge-rollup.client.spec.ts` 覆盖祖先上卷以及 M 优先于 U。

`packages/client/ui-file-editor/tests/editor-surface.client.spec.tsx` 展开一个 Host 只点名文件的嵌套文件夹，并断言两行都有 `U`。
