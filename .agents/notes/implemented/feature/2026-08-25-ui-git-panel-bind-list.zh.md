# Agent Note: ui-git panel binds, lists, and initializes

Status: implemented

[English](2026-08-25-ui-git-panel-bind-list.md) | 中文

## 问题

[三段 Git 槽位](2026-08-25-details-three-tab-git.md) 声明了工具箱 Git Tab，但 occupant 为空。Web 开发者可以切到 Git，却看不到绑定 Workspace 的仓库、工作区变更列表或空态，也无法在 Git 可用且无祖先仓库时初始化。

## 决策

`@deepseek-ai/dsh-client-ui-git` 是 `conversation.details.git` 的 Git 面板 occupant。它跟随 `sessionIds` 包含当前 Session 的 Workspace，经注入的 `ctx.workspaces` 闭包调用 `gitWorkingTree` / `gitInit`，且不 import `ui-file-editor` 的内部符号。

壳层仅在选中 Git 段时传入 owner `visible: true`。隐藏时 occupant 保持挂载。在 `visible` 变为 true、绑定 Workspace 变化、以及初始化成功后按磁盘读取。停在 Git Tab 期间不轮询，因此不实时跟随 Agent 或终端改写。列表只渲染 Host 行（被忽略路径与未保存编辑缓冲都不会出现）。`git-unavailable` 与 `not-a-repository` 是互斥 overlay；仅后者提供 **初始化仓库**。干净仓库显示「没有要提交的更改」并保留提交说明输入。整文件暂存、丢弃、提交与按 Session 草稿由 [整文件暂存、丢弃与提交](2026-08-25-ui-git-panel-stage-commit.md) 拥有。

首次加载使用居中 spinner。对已展示仓库的再次读取使用列表顶 2px indeterminate 条，不遮罩列表。

## 曾考虑的方案

**把面板做进 `ui-file-editor`。** 被 [ADR-0004](../../../../docs/adr/0004-git-panel-client-plugin.md) 否决：文件编辑与 Git 工作流分属不同包。

**即使 Git Tab 隐藏也在挂载时拉取。** 否决：occupant 始终挂载，按可见性读取才能实现「切到 Git 时刷新」且不轮询（US-35 / US-36）。

**由文件编辑器在显式保存时写入共享磁盘代数。** 绑定/列表时暂缓：切回 Git 已经按磁盘重读。Git 面板写入后的 Explorer 徽章刷新由 [整文件暂存、丢弃与提交](2026-08-25-ui-git-panel-stage-commit.md) 拥有：资源管理器重新可见时重读 `gitStatus`。

**在同一次 occupant 变更里接上暂存、丢弃、提交与差异预览。** 否决：Issue #56 是 1/4 切片；写操作现由 [整文件暂存、丢弃与提交](2026-08-25-ui-git-panel-stage-commit.md) 落地。

## 后果

- `packages/bundle/web-app` 注册 `ui-git`。空的 Git 席位不再是组装后的 Web 默认态。
- 整文件暂存/丢弃/提交由 [整文件暂存、丢弃与提交](2026-08-25-ui-git-panel-stage-commit.md) 拥有。按块操作与 Git 操作守卫仍属后续切片。
- web e2e 或 `pnpm dsh web` 要看到面板正文，须先重建 `ui-git` 的 client bundle。

## 测试

`packages/client/ui-git/tests/git-panel.client.spec.tsx` 用 Fake Host 回调驱动，断言四种空态、两段列表、可见性门控刷新、Session 切换、初始化成败与加载变体。

`packages/client/ui-git/tests/apply.client.spec.ts` 覆盖槽位注入、Host 回调转发与 fiber dispose。

`apps/web/tests/details-segmented-tab.e2e.ts` 快照非 Git 仓库夹具在选中 Git 后的「不是 Git 仓库」空态。
