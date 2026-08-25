# Agent Note: ui-git whole-file stage, discard, and commit

Status: implemented

[English](2026-08-25-ui-git-panel-stage-commit.md) | 中文

## 问题

[绑定、列表与初始化](2026-08-25-ui-git-panel-bind-list.md) 的 Git 面板 occupant 能列出磁盘变更，但不能暂存、取消暂存、丢弃或提交。Web 开发者仍须离开 dsh Web 才能完成一次提交，提交说明草稿也没有按 Session 保存、无法在切 Tab / 切 Session 后还在。

## 决策

`ui-git` 经注入的 `ctx.workspaces` 闭包调用 [Host Git 工作区写 RPC](2026-08-25-host-git-write.md)：整文件 `gitStage` / `gitUnstage` / `gitDiscard` / `gitCommit`。写响应直接替换面板列表，occupant 不再跟一次 `gitWorkingTree`。不传 hunk header。本 occupant 不含 Git 操作守卫。

未暂存行提供 **暂存** 与 **丢弃**；已暂存行只提供 **取消暂存**。段标题提供 **全部暂存** / **全部取消暂存**。丢弃打开面板内 `bg-layer-3` 对话框（不是全视口遮罩）：已跟踪修改用「丢弃更改」/ 恢复为暂存区或 HEAD；未跟踪用「丢弃未跟踪文件」/ 从磁盘删除；已跟踪删除用「丢弃更改」/ 把文件恢复到磁盘。Host `GitWorkingTreeChange.kind`（`modified` / `untracked` / `deleted`）选择文案。

提交要求说明 trim 非空且暂存列表非空。暂存非空而说明为空白时显示「请填写提交说明」和错误描边。成功则新建一次 HEAD 提交（Host 不 amend、不 push）并清空该 Session 草稿。失败展示 Git 原文加 **重试**，草稿保留；面板不收集 `user.name` / `user.email`。

提交说明草稿放在 `createGitPanelStore` 的槽位 store 里，按 Session id 分区，不写入 session 日志。隐藏 Git Tab 或切换 Session 都不清空任何草稿。

文件树 Git 状态标记在资源管理器 Tab 从隐藏回到可见时按磁盘重读。`ui-conversation` 给 `conversation.details.editor` 传入 owner `visible`，与 Git 槽相同；`ui-git` 仍不 import `ui-file-editor` 内部符号。

## 曾考虑的方案

**用 `gitDiffPreview` 推断丢弃确认文案。** 否决：这会把本切片绑到预览 RPC，并为 porcelain 已有的事实多打一轮。inspect 行上的 `kind` 才是 Host 契约。

**由 `ui-git` 在每次写入后递增共享磁盘代数。** 本切片否决：选中 Git 时文件树本就隐藏，US-37 在切回资源管理器后可观察。把 `visible` 传给 Explorer occupant，复用 Git Tab 的按可见性读取。

**把提交说明草稿放在 occupant 的 React state。** 否决：草稿必须能在重新挂载后还在，且按 Session 保存，这是槽位 store 的职责。

**在暂存的更改段做取消暂存并丢弃。** 被 US-17 否决：暂存行只取消暂存。

## 后果

- [绑定/列表/初始化](2026-08-25-ui-git-panel-bind-list.md) 仍拥有发现、空态与按可见性的 inspect 读取；本笔记拥有整文件写入、草稿与 Explorer 徽章刷新。
- 按块操作与 Git 操作守卫仍属后续 git-panel 切片。
- `pnpm dsh web` 要看到写操作和 Explorer `visible`，须重建 `ui-git` 以及 `ui-conversation` / `ui-file-editor` 的 client bundle。

## 测试

`packages/client/ui-git/tests/git-panel.client.spec.tsx` 用 Fake Host 写回调驱动，断言行操作、段级全部暂存/取消暂存、丢弃确认文案、提交启用条件、进行中 spinner、提交失败加重试、按 Session 草稿，以及切走 Tab 后草稿仍在。

`packages/host/apiproxy/tests/parse-working-tree-porcelain.spec.ts` 钉住未暂存、已暂存与两侧分行的 `kind`。

`packages/client/ui-conversation/tests/details-panel-tabs.client.spec.tsx` 与 `packages/client/ui-file-editor/tests/editor-surface.client.spec.tsx` 覆盖 Explorer `visible`，以及切回资源管理器时重读 gitStatus。
