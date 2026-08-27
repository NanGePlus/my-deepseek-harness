# Agent Note: Git Graph 收窄引用胶囊

Status: implemented

[English](2026-08-27-git-graph-compact-ref-pills.md) | 中文

## Problem

Graph 引用胶囊把 `text-overflow: ellipsis` 打在 `inline-flex` 容器上，长分支名不会省略。内边距和 18px 行高让每颗胶囊占满 24px 行。悬停胶囊无法读完整引用或提交说明。

## Decision

胶囊高 14px，宽上限 80px（带远程云图标为 88px）。内部 label 负责 `min-width: 0` 和省略号。有引用时胶囊放在说明下一行 16px、靠右，避免挡住作者；无引用的行仍是 24px。带引用的行用 `flex: none`，避免 Graph 列表把它们压回 24px。图上的圆点仍对准说明行中心，SVG 的 Y 按累计行高计算。悬停胶囊用 `position:fixed` 打开 GitLens 风格详情卡（不用行内弹出层，因为 `.graphRow` 是 `overflow: hidden`），展示完整引用、作者、相对/绝对时间、说明、正文和短 hash。`host.gitLog` 增加 `%aI` 与 `%b`，卡片不必再打一次 RPC。指针移到卡片上时保持打开（隐藏延迟 120ms）；收起 Graph 时关闭。

## Alternatives considered

**原生 `title` tooltip。** 否决：无法展示作者、时间或提交正文。

**复用 ui-primitives 的 `Tooltip`。** 否决：那个气泡是字符串、且 `pointer-events: none`；详情卡必须是指针可以进入的富文本。

**Portal 到 `document.body`。** 否决：现有 tooltip 已经用 `position:fixed` 逃出祖先 overflow，不必让 ui-git 依赖 `react-dom`。

**胶囊留在说明同一行。** 否决：操作列 260px 时会挡住作者名。

## Consequences

悬停卡不提供「在 GitHub 上打开」；`host.gitLog` 仍不解析远程 HTML URL。每页 50 条提交现在会在线上带上作者时间与正文。

## Testing

`packages/host/apiproxy/tests/parse-git-log.spec.ts` 断言 `%aI` / `%b` 字段以及正文里的换行。

`packages/client/ui-git/tests/git-graph-card.client.spec.ts` 断言相对时间分桶与视口定位。

`packages/client/ui-git/tests/git-panel.client.spec.tsx` 悬停长 `origin/` 胶囊并断言卡片，再覆盖隐藏延迟、移入卡片、收起 Graph、本地引用上的空正文/空日期，以及胶囊在作者之后的第二行。

`packages/client/ui-git/tests/git-graph-layout.client.spec.ts` 断言后面的行因胶囊变高时，圆点 Y 仍落在说明行中心。
