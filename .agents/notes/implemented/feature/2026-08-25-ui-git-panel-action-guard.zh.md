# Agent Note: ui-git Git action guard

Status: implemented

[English](2026-08-25-ui-git-panel-action-guard.md) | 中文

## 问题

Dirty 编辑器标签页与磁盘工作区变更行可以指向同一路径。从 Git 面板对该路径暂存、丢弃或提交，会在未保存的编辑缓冲仍占用该路径时改写磁盘，或让 HEAD 提交的暂存区内容与开发者正在编辑的内容不一致。

## 决策

`ui-conversation` 在 `DetailsPanel` 的 React state 里持有 Host 绝对路径的 dirty 列表。Explorer occupant 经 owner `setDirtyPaths` 发布；Git occupant 读取 `dirtyPaths`。该列表不是 runtime 对象层事实，也不按 Session 分区：它是当前绑定 Workspace 的 dirty 文本 Tab，`ui-file-editor` 在这些 Tab 或 Workspace 变化时重新发布。

列表中的路径不可丢弃、不可暂存（整文件、按块或 **全部暂存**），也不可包含在一次提交里。取消暂存（整文件、按块与 **全部取消暂存**）不受限。面板从不自动保存。

守卫对话框复用丢弃确认的 overlay（`bg-layer-3`，不是全视口遮罩）：标题「文件有未保存的编辑」、Host 绝对路径、提示先显式保存、丢弃该编辑缓冲或关闭该标签页的正文，以及唯一的 **取消**。没有 **保存** 按钮。

任一已暂存行 dirty 时，提交保持原生 `disabled`。行与差异块的暂存/丢弃控件使用 `aria-disabled`，颜色 `label-caption`，`cursor: not-allowed`；点击仍打开对话框。提交说明草稿在切换 Session 时不会打开此守卫。

## 曾考虑的方案

**把 dirty 集合放进 runtime 对象层。** 被 [ADR-0004](../../../../docs/adr/0004-git-panel-client-plugin.md) 否决：这是人类 UI 状态，不是模型可见数据。

**先自动保存，再执行 Git 写入。** 被 US-30 否决：守卫不得保存。

**复用文件编辑器 Session/Tab dirty 对话框（保存 / 丢弃 / 取消）。** 否决：那个对话框会改写编辑缓冲；Git 守卫只拦截，且不得 import `ui-file-editor` 内部符号。

**按 Session id 分区该列表。** 否决：dirty Tab 已在编辑器 store 里按 Workspace 存放；切换 Session 时重新发布当前 Workspace 的路径即可，提交说明草稿已有自己的按 Session store。

**连取消暂存一并拦住。** 被 US-28 否决：取消暂存不改写磁盘。

## 后果

- [三段 Git 槽位](2026-08-25-details-three-tab-git.md) 拥有 owner 字段。[整文件暂存、丢弃与提交](2026-08-25-ui-git-panel-stage-commit.md) 与 [差异预览与按块操作](2026-08-25-ui-git-panel-diff-preview.md) 仍拥有被本守卫拦截的写入。
- `ui-git` 仍不 import `ui-file-editor` 内部符号。
- `pnpm dsh web` 要看到守卫，须重建 `ui-git`、`ui-conversation` 与 `ui-file-editor` 的 client bundle。

## 测试

`packages/client/ui-git/tests/git-panel.client.spec.tsx` 断言 dirty 暂存/丢弃的 `aria-disabled`、提交的原生 disabled、整文件 / 按块 / 全部暂存的守卫对话框、不受限的取消暂存，以及提交说明草稿在切换 Session 时不打开此守卫。

`packages/client/ui-conversation/tests/details-panel-tabs.client.spec.tsx` 断言 Explorer 的 `setDirtyPaths` 到达 Git 的 `dirtyPaths`。

`packages/client/ui-file-editor/tests/editor-surface.client.spec.tsx` 断言 occupant 发布 dirty Tab 路径，并在保存后清空。
