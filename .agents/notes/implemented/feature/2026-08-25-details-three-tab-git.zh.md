# Agent Note: Toolbox three-tab Git slot

Status: implemented

[English](2026-08-25-details-three-tab-git.md) | 中文

## 问题

Git 面板 V2 需要在资源管理器与工具详情旁增加第三段工具箱 Tab（[ADR-0004](../../../../docs/adr/0004-git-panel-client-plugin.md)，US-1~US-4）。[文件编辑器 details 分段 Tab](2026-08-20-details-segmented-tab.md) 的两段壳层没有 Git occupant，也无法在不卸载的前提下隐藏 Git 视图。

## 决策

`ui-conversation` 拥有工具箱 Tab 壳层：`DetailsPanel` 渲染 **资源管理器 | Git | 工具详情**，per-session chat store 的 `detailsTab` 为 `'editor' | 'git' | 'tool'`。同时只选中一段。选中 **资源管理器** 或 **Git** 时调用 `layout.openDetails()`，栏已收起也能展开；壳层不新增第四栏或 overlay。

Git occupant 是子槽 `conversation.details.git`（`kind: 'single'`，`scope: 'root'`，owner `{ visible }`）。`ui-git` 注入此处。三个 tabpanel 保持挂载；未选中的面板为 `display: none`（`aria-hidden`）。仅在选中 Git 时 `visible` 为 true，occupant 才能在用户切回来时按磁盘重读。切走 Git 不取消暂存、不清空提交说明草稿——那属于 Git occupant，隐藏面板才能保留它们。

`ui-git` 把 occupant 注册进此席位。右栏拖宽与 concession 仍在 `ui-layout`。

## 曾考虑的方案

**把 Git 面板做进 `ui-file-editor`。** 被 ADR-0004 否决：文件编辑与 Git 工作流分属不同包；壳层只声明槽位。

**未选中 Git Tab 时卸载面板。** 被 US-3 否决：卸载会丢掉 occupant 状态，包括按 Session 保存的提交说明草稿。

**等到 `ui-git` 注入后再显示 Git Tab。** 否决：本切片拥有壳层与槽位；后续 issue 拥有面板正文。

**为 Git 新开第四栏或 overlay。** 被 ADR-0002 与 Git 面板 PRD 的 app-shell 规格否决。

## 后果

- `ui-git` 必须注入 `conversation.details.git`，且不得 import `ui-file-editor` 的内部符号。
- 切换 Tab 从不发出 Git 写 RPC；取消暂存不是壳层行为。
- 浏览器 e2e `details-segmented-tab` 包含 Git Tab 文案。Git 面板正文覆盖见 [`ui-git` 绑定/列表](2026-08-25-ui-git-panel-bind-list.md)。
- web e2e 或 `pnpm dsh web` 要看到第三段 Tab，须先重建 `ui-conversation` 的 client bundle。

## 测试

`packages/client/ui-conversation/tests/details-panel-tabs.client.spec.tsx` 覆盖默认顺序、同时只选中一段、选中 Git 展开工具箱、以及切走 Git 后 occupant 与草稿仍挂载。

`packages/client/ui-conversation/tests/chat-apply.client.spec.tsx` 覆盖 `conversation.details.git` 的声明及其随 fiber dispose 折叠。

`apps/web/tests/details-segmented-tab.e2e.ts` 回放三段 Tab 的 aria 快照，并断言选中 Git 后右栏仍打开。editor-empty 黄金记录组装后的资源管理器壳层（隐藏文件树、刷新、拖宽）。
