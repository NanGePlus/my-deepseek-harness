# Agent Note: File-editor DESIGN.md is the brand-board SSOT

Status: implemented

[English](2026-08-20-file-editor-design-system.md) | 中文

## Problem

文件编辑器 V1 UI 是 spec-driven：页面布局与业务文案在 PRD，但品牌板仍须给 UI 实现者可引用的 Token、通用原语与宜忌，且不得重写 `ui-theme` 或另造一套色板。grill 已写入 `docs/design/DESIGN.md`。若不验收关闭，后续 UI PR 会把 HEX 写进组件、在交付页面时改品牌板，或把缺失的按下/描边细节当成要去改写 PRD Token 表的理由。

## Decision

[`docs/design/DESIGN.md`](../../../../docs/design/DESIGN.md) 是文件编辑器品牌板。它把 Harness `--dsw-alias-*` / `--ds-font-family-*` 映射到通用原语（含 details 分段 Tab 与文件 Tab 栏），并在 §4 命名编辑器叠色 Token（`editor-hover-tint`、`editor-selected-tint`、`editor-danger-hover-tint`、`editor-tab-active-line`、`editor-dirty-dot`）。运行时 HEX 与 alias 解析仍在 [`ui-theme`](../../../../packages/client/ui-theme/README.md) 样式表；现行编码规则仍在 [web-styling.md](../../../../docs/web-styling.md) 与 [样式系统 Agent Note](2026-07-19-web-styling-system.md)。Git 面板、人类终端与内嵌浏览器消费同一品牌板，不另造色板或 §5 原语；见 [Git 面板设计系统 Agent Note](2026-08-25-git-panel-design-system.md)、[人类终端设计系统 Agent Note](2026-08-29-human-terminal-design-system.md) 与 [内嵌浏览器设计系统 Agent Note](2026-08-30-embedded-browser-design-system.md)。

`DESIGN.md` 中的全局 Token、色板与字号只通过 Design Issue 变更。UI 实现 PR 消费这些名字（alias 或局部自定义属性），不得改品牌板。第三色绿阶保持 `ui-theme` 已发布的四阶 `--dsw-static-green-*`。light 模式下 `--dsw-alias-brand-primary` 为近黑（`#0F1115`）；Tab 底边强调跟随该 alias，而不是 DeepSeek 蓝的品牌 HEX。

页面布局、空状态文案与 Git 字母映射留在 PRD。`DESIGN.md` §5 只保留通用原语；父 PRD「待扩展 DESIGN §5」保持为空。

## Alternatives considered

- **重写 grill 品牌板（新色板、8–10 阶绿、DeepSeek 蓝 Tab 底边）。** 否决：Issue #13 是验收关闭而非换肤，且 `ui-theme` 只发布四阶 green static。light 下 `--dsw-alias-brand-primary` 是 bluish-1000，把 Tab 底边画成 DeepSeek 蓝会与 Web 其余部分已消费的 alias 矛盾。
- **允许 UI PR 在页面需要新叠色时直接改 `DESIGN.md`。** 否决：这会把产品布局工作与品牌板所有权混在一起，正是 Design Issue / UI Issue 拆分要阻止的泄漏。
- **在本次关闭中把叠色 Token 提升进 `ui-theme`。** 否决：尚无文件编辑器 CSS 消费者；在有消费者之前写入全局表会在没有证据的情况下扩大 `ui-theme`。UI PR 可引入与 §4 同名的局部自定义属性；待复用被证明后，再由后续 Design Issue 加 alias。
- **让 `DESIGN.md` 继续以无后缀路径只放中文。** 否决：`docs/**` 属于翻译配对语料，未配对文件在 `doc-sync` 下不可引用。

## Consequences

UI 实现者引用 `DESIGN.md` §5/§6 与 PRD 页面清单；不得把 HEX 拷进功能 CSS，也不得为了落地某一页去改品牌板。§4 叠色 Token 是第一个 UI PR 必须兑现的名字，不是第二套主题。若要新增 PRD 尚未复用的通用原语，应走 Design Issue 并写入 PRD「待扩展 DESIGN §5」，而不是静默追加 `DESIGN.md`。
