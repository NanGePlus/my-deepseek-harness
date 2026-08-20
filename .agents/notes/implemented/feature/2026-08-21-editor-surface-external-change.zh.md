# Agent Note：editor-surface 外部变更对话框

Status: implemented

[English](2026-08-21-editor-surface-external-change.md) | 中文

## 问题

US-25 要求：已打开的可编辑文件在磁盘上被改写时，Web 编辑器须提示用户重新加载或保留本地缓冲。[Host `watchPath`](2026-08-21-host-watch-path.md) 已按路径推送 `host/path-changed` 帧；Client 须为每个打开的可编辑文本 Tab 订阅、对比磁盘文本与编辑缓冲，并在关 Tab 时释放 watch。

## 决策

`EditorSurface` 通过 `ctx.workspaces.watchPath` 注入的闭包，为每个打开的**文本** Tab 注册一条 `watchPath` 订阅（转发 SSE，在每条 `host/path-changed` 帧上调用回调）。回调时重新 `readFile`；当磁盘文本与 Tab 缓冲不一致时，弹出 `bg-layer-3` 对话框（**文件已在磁盘上更改**，主按钮 **重新加载**，次按钮 **保留本地编辑**）。**重新加载** 再次 `readFile` 并调用 `reloadTextTab`（同时更新 `buffer` 与 `saved`）。**保留本地编辑** 关闭对话框且不改动缓冲。关闭 Tab 会 abort 该 Tab 的 `AbortController`，从而结束 Host watch。只读预览与不可打开 Tab 不订阅——它们没有可对账的编辑缓冲。

## 曾考虑的替代方案

**递归 watch Workspace 根目录。** PRD 与 [host watchPath](2026-08-21-host-watch-path.md) 已拒绝：仅对已打开路径各启一个 `fs.watch`。

**每次 watch 事件自动重载、不询问。** US-25 已拒绝：须由用户选择重载或保留本地。

**把待处理的外部变更状态放进 Tab store。** 已拒绝：对话框是瞬时 UI；仅 `reloadTextTab` 变更持久 Tab 状态。

## 后果

- Session 切换与 dirty Tab 关闭守卫（US-26 / US-27）仍为独立 issue。
- 本地显式保存若触发 `fs.watch`，重读后与缓冲一致则不再弹窗。
- `WorkspaceRuntime.watchPath` 在 abort 后吞掉流传输错误；编辑界面在外部变更检查时的读失败会被忽略。

## 测试

`packages/client/ui-file-editor/tests/editor-surface.client.spec.tsx` 覆盖 Issue #23 States 矩阵：Fake watch → 对话框文案、重新加载丢弃缓冲、保留本地保留缓冲与 dirty、关 Tab 停止投递且不对 Workspace 根 watch。

`packages/client/ui-file-editor/tests/stores.client.spec.ts` 覆盖 `reloadTextTab`。

`packages/client/ui-file-editor/tests/apply.client.spec.ts` 验证 `watchPath` 经 `ctx.workspaces` 转发。
