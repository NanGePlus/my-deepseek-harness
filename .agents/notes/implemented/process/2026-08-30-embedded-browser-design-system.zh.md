# Agent Note: 内嵌浏览器 V4 消费文件编辑器 DESIGN.md

Status: implemented

[English](2026-08-30-embedded-browser-design-system.md) | 中文

## Problem

内嵌浏览器 V4 是 spec-driven：页面布局与业务文案在 PRD，但 UI 实现者仍须有可引用的品牌板。若不验收关闭，后续 UI PR 会另造一套色板、把 screencast 画布或溢出菜单做成 §5 原语、把 dim 加载遮罩或行内外部站点提示当成缺失的具名变体，或在交付 `embedded-browser` 时改 `DESIGN.md`。

## Decision

[`docs/design/DESIGN.md`](../../../../docs/design/DESIGN.md) 同时是内嵌浏览器、文件编辑器、Git 面板与人类终端的品牌板。[文件编辑器设计系统 Agent Note](2026-08-20-file-editor-design-system.md) 仍拥有叠色 Token 名、light 模式下 `--dsw-alias-brand-primary`，以及 UI 实现 PR 不得改全局 Token 的规则。

§5 已提供 details 分段 Tab、文件 Tab 栏（高 32px、2px `editor-tab-active-line`）、图标按钮（24×24 工具栏、28×28 关闭）、输入（地址栏）、空状态、Loading（内容区居中 24px spinner + 12px `label-secondary`）、主按钮（重试 CTA）与卡片容器。浏览器 Tab 栏复用文件 Tab 栏；导航控件（← → ↻）、外部打开与溢出触发器用 24×24 ghost 图标按钮；Tab `×` 在 Tab 栏内用 20×20 热区。screencast 画布组合 `--dsw-alias-markdown-code-block` 作为预览区表面；JPEG 帧贴满内容区，不是新原语。地址栏聚焦组合 §5 输入聚焦几何与 PRD 要求的 `semantic-info` 描边；该组合不是新原语。导航失败、外部站点提示与浏览器不可用文案组合 12px `semantic-error` 或 `semantic-info` 与可选主按钮重试；不是新原语。溢出菜单项（Hard Reload、Copy Current URL、Zoom）复用既有菜单形态；V4 不新增 §5 下拉原语。Loading dim 留在 screencast 内容区内，不全屏遮罩整个 dsh Web（§6）。

内嵌浏览器 PRD「待扩展 DESIGN §5」保持为空。页面布局、空状态文案与浏览器标签留在 PRD。

## Alternatives considered

- **为内嵌浏览器另写一份 DESIGN.md 或另造色板。** 否决：浏览器在同一工具箱栏内，跟随同一套 Harness light/dark Token，且 V4 PRD 禁止重写品牌板。
- **为 screencast 画布、溢出下拉或行内 info/error 条命名 §5 原语。** 否决：PRD 已组合现有表面、图标按钮、输入、空状态、Loading 与语义色；新增原语会迫使「待扩展 DESIGN §5」非空。
- **不写 screencast 表面或地址栏聚焦规则并把 Issue #93 标为阻塞。** 否决：§2 与 §5 已约束预览区表面与输入聚焦；记录 PRD 的 `semantic-info` 聚焦组合即可闭合，且不是换肤。
- **允许 ui-browser UI PR 在 screencast 需要新叠色时改 DESIGN.md。** 否决：这正是文件编辑器、Git 面板与人类终端验收关闭已经禁止的品牌板泄漏。

## Consequences

app-shell 与 embedded-browser 的 UI 实现者引用 `DESIGN.md` §5/§6 与 PRD 页面清单。不得把 HEX 拷进功能 CSS，不得新增 screencast 区原语，也不得为了落地某一页去改品牌板。若要新增 PRD 尚未复用的通用原语，应走 Design Issue 并写入 PRD「待扩展 DESIGN §5」。
