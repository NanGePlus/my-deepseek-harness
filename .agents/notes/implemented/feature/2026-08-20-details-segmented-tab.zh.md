# Agent Note：文件编辑器 details 分段 Tab 壳层

Status: implemented

[English](2026-08-20-details-segmented-tab.md) | 中文

## 问题

文件编辑器 V1 将编辑界面放入现有 Web details 栏，与 Tool 详情切换（[ADR-0002](../../../../docs/adr/0002-file-editor-details-tab.md)）。该栏此前只渲染 Tool 输出，没有 Tab 壳层，也没有编辑器 surface 的 occupant 槽位，文件编辑器 PRD 的 US-1~US-3 缺少集成点。

## 决策

`ui-conversation` 拥有 details **壳层**：在 `DetailsPanel` 中增加 segmented Tab（`资源管理器` | `Git` | `工具详情`），Tool 正文抽到 `ToolDetailsBody`，Tab 选择写入共享 per-session chat store（`detailsTab: 'tool' | 'editor' | 'git'`）。选中 **资源管理器** 或 **Git** 时调用 `layout.openDetails()`，在栏已收起时也能展开，且不新增第四栏或 overlay。Git occupant 槽位见 [Toolbox three-tab Git slot](2026-08-25-details-three-tab-git.md)。

`ui-file-editor` 向新子槽 `conversation.details.editor` 注入 `EditorSurface`。[文件树 issue](2026-08-20-editor-surface-file-tree.md) 拥有 Workspace 绑定、列表、过滤、图标与 Git 徽章；[打开三档、Tab 与保存](2026-08-20-editor-surface-open-tabs-save.md) 拥有缓冲与 Monaco。

`ui-layout` 在有非 blank Session 占用 details 时（`detailsSession` 已定义）始终挂载 details 拖动手柄，即使渲染宽度为 0，以便用户在自动收起后拖开右栏。

## 备选方案

**由 `ui-file-editor` 替换整个 `details` occupant。** 否决：Tool 详情注册与共享 chat store 在 `ui-conversation`；ADR-0002 要求 Tab 壳层归 conversation、编辑器内容可 inject。

**Overlay 抽屉或第四栏。** ADR-0002 与 PRD app-shell 规格已否决。

## 后果

- Tab 选择保存在 chat store 中，跨 remount 保留，直至后续 issue 的 Session 守卫重置。
- 浏览器 e2e 通过 `aria-label="Toolbox"` 定位 details tablist，避免误捕对话视图 Tab。
- web e2e 前须重建 `ui-conversation`、`ui-layout`、`ui-file-editor` 的 client bundle。

## 测试

`packages/client/ui-conversation/tests/details-panel-tabs.client.spec.tsx` 覆盖默认文案、选中编辑器 Tab（展开 details + 渲染 editor 席位）、切回 Tool 详情。Git Tab 壳层由 [Toolbox three-tab Git slot](2026-08-25-details-three-tab-git.md) 拥有。

`packages/client/ui-file-editor/tests/*` 覆盖槽位注入、[文件树笔记](2026-08-20-editor-surface-file-tree.md) 拥有的文件树各态，以及[打开／Tab／保存笔记](2026-08-20-editor-surface-open-tabs-save.md) 拥有的打开／保存各态。

`apps/web/tests/details-segmented-tab.e2e.ts` 回放 segmented Tab 的 aria 与编辑界面快照（文件树 + 未打开文件空态）。
