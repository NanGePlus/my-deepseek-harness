# Agent Note: 人类终端 V3 消费文件编辑器 DESIGN.md

Status: implemented

[English](2026-08-29-human-terminal-design-system.md) | 中文

## Problem

人类终端 V3 是 spec-driven：页面布局与业务文案在 PRD，但 UI 实现者仍须有可引用的品牌板。若不验收关闭，后续 UI PR 会另造一套色板、把 xterm 或 Shell 下拉做成 §5 原语、把行内错误条或禁用 `+` 当成缺失的具名变体，或在交付 `human-terminal` 时改 `DESIGN.md`。

## Decision

[`docs/design/DESIGN.md`](../../../../docs/design/DESIGN.md) 同时是人类终端、Git 面板与文件编辑器的品牌板。[文件编辑器设计系统 Agent Note](2026-08-20-file-editor-design-system.md) 仍拥有叠色 Token 名、light 模式下 `--dsw-alias-brand-primary`，以及 UI 实现 PR 不得改全局 Token 的规则。

§5 已提供 details 分段 Tab、文件 Tab 栏（高 32px、2px `editor-tab-active-line`、28×28 ghost 关闭）、图标按钮（24×24 工具栏、28×28 关闭）、空状态、Loading（内容区居中 24px spinner + 12px `label-secondary`）、主按钮（重试 CTA）与卡片容器。终端 Tab 栏复用文件 Tab 栏；Kill 用 28×28 ghost 图标按钮；`+` 用 24×24 ghost 图标按钮。xterm 画布组合 `--dsw-alias-markdown-code-block` 与 `--ds-font-family-code` 的 13px/20px，不是新原语。xterm light/dark 与 Monaco 一样跟随 Harness 主题。spawn/write/重连行内错误组合 12px `semantic-error` 文案与可选主按钮重试，不是新原语。Shell profile 下拉项复用既有菜单形态；V3 不新增 §5 下拉原语。

人类终端 PRD「待扩展 DESIGN §5」保持为空。页面布局、空状态文案与终端标签留在 PRD。

## Alternatives considered

- **为人类终端另写一份 DESIGN.md 或另造色板。** 否决：终端在同一工具箱栏内，跟随同一套 Harness light/dark Token，且 V3 PRD 禁止重写品牌板。
- **为 xterm 区、Shell 下拉或终端错误条命名 §5 原语。** 否决：PRD 已组合现有表面、代码字体、图标按钮、空状态、Loading 与 `semantic-error`；新增原语会迫使「待扩展 DESIGN §5」非空。
- **不写 xterm 字体规则并把 Issue #74 标为阻塞。** 否决：§3 与 §6 已约束 Monaco 与行级差异的代码字体；把同一规则延伸到 xterm 即可闭合，且不是换肤。
- **允许 ui-terminal UI PR 在 xterm 需要新叠色时改 DESIGN.md。** 否决：这正是文件编辑器与 Git 面板验收关闭已经禁止的品牌板泄漏。

## Consequences

app-shell、human-terminal 与 embedded-browser 的 UI 实现者引用 `DESIGN.md` §5/§6 与 PRD 页面清单。不得把 HEX 拷进功能 CSS，不得新增 xterm 区原语，也不得为了落地某一页去改品牌板。若要新增 PRD 尚未复用的通用原语，应走 Design Issue 并写入 PRD「待扩展 DESIGN §5」。
