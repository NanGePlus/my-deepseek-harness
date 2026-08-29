# Agent Note: Git panel V2 consumes the file-editor DESIGN.md

Status: implemented

[English](2026-08-25-git-panel-design-system.md) | 中文

## Problem

Git 面板 V2 是 spec-driven：页面布局与业务文案在 PRD，但 UI 实现者仍须有可引用的品牌板。若不验收关闭，后续 UI PR 会另造一套色板、把差异块做成 §5 原语、把破坏性确认或禁用图标按钮当成缺失的具名变体，或在交付 `git-panel` 时改 `DESIGN.md`。

## Decision

[`docs/design/DESIGN.md`](../../../../docs/design/DESIGN.md) 同时是 Git 面板、人类终端与文件编辑器的品牌板。[文件编辑器设计系统 Agent Note](2026-08-20-file-editor-design-system.md) 仍拥有叠色 Token 名、light 模式下 `--dsw-alias-brand-primary`，以及 UI 实现 PR 不得改全局 Token 的规则。

§5 已提供列表行、多行输入、按钮、图标按钮、空状态、Loading（行内 / 内容区居中 / 列表顶条）、状态徽章、卡片容器与 details 分段 Tab。行级差异用 `semantic-success` / `semantic-error` 配 `--ds-font-family-code` 的 13px/20px，不是新原语。破坏性对话框确认使用主按钮几何，hover 用 `editor-danger-hover-tint`，说明文案用 `semantic-error`。禁用图标按钮用 `label-caption` 与 cursor not-allowed。叠色列表列用 `--dsw-alias-bg-overlay`；代码/预览区用 `--dsw-alias-markdown-code-block`。

Git 面板 PRD「待扩展 DESIGN §5」保持为空。页面布局、空状态文案与 Git 操作标签留在 PRD。

## Alternatives considered

- **为 Git 面板另写一份 DESIGN.md 或另造色板。** 否决：面板在同一工具箱栏内，跟随同一套 Harness light/dark Token，且 V2 PRD 禁止重写品牌板。
- **为差异块头、新增/删除行或第六种危险按钮命名 §5 原语。** 否决：PRD 已组合现有语义色、代码字体、主按钮几何与 `editor-danger-hover-tint`；新增原语会迫使「待扩展 DESIGN §5」非空。
- **不写危险按钮与禁用图标按钮，并把 Issue #52 标为阻塞。** 否决：二者都是 §5 已有 Token 的组合；写入品牌板即可保持 PRD Token 表为空，且不是换肤。
- **允许 git-panel UI PR 在预览类型需要新叠色时改 DESIGN.md。** 否决：这正是文件编辑器验收关闭已经禁止的品牌板泄漏。

## Consequences

app-shell、git-panel 与 human-terminal 的 UI 实现者引用 `DESIGN.md` §5/§6 与 PRD 页面清单。不得把 HEX 拷进功能 CSS，不得新增差异行原语，也不得为了落地某一页去改品牌板。若要新增 PRD 尚未复用的通用原语，应走 Design Issue 并写入 PRD「待扩展 DESIGN §5」。
