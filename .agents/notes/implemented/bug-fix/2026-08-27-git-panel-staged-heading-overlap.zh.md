# Agent Note: Git 面板「待提交」跟在未暂存内容高度之后

Status: implemented

[English](2026-08-27-git-panel-staged-heading-overlap.md) | 中文

## 问题

**已更改，暂未选入提交** 行数多时，行会画到 **待提交** 标题上。待提交计数仍在，标题看起来卡在未暂存列表中间。

## 决策

`.section` 使用 `flex: none`，且不得设 `min-height: 0`。`.lists` 仍是唯一滚动容器（`overflow: auto`）。未暂存行保持内容高度，「待提交」跟在它们后面。

## 考虑过的替代方案

**每段 `flex: 1; overflow: auto`，让两个标题都留在视口内。** 此处否决：产品要求把「待提交」往后排。独立分栏还需要拖动手柄；只有 `min-height: 0`、没有 overflow 正是叠层原因。

**给「待提交」标题 `position: sticky`。** 否决：标题会钉在视口里，未暂存行从它下面穿过，正是这次报告的叠层。

## 后果

未暂存很长时，「待提交」可能被顶出视口；用户滚动 `.lists` 才能看到。

## 测试

`packages/client/ui-git/tests/git-panel-icon-sizing.client.spec.ts` 要求 `.section { flex: none }`，并禁止该规则出现 `min-height`。
