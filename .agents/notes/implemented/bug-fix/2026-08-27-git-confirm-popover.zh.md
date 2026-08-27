# Agent Note: Git 确认框贴在触发按钮上

Status: implemented

[English](2026-08-27-git-confirm-popover.md) | 中文

## 问题

**提交**、**提交并推送** 和 **推送** 会打开一张居中确认卡。`.dialogRoot` 在 `.split` 上是 `position:absolute; inset:0; place-items:center`，卡片落在白色差异预览上。`.dialogCard` 没有描边和阴影，白底看不出是弹框。

## 决策

提交类确认（`commit` / `commitPush` / `push`）改为 `position:fixed` 弹出层。`confirmPopoverPosition` 把卡片左上角放在触发按钮右下角再加 4px，测到尺寸后再收入视口。卡片使用 `--dsw-alias-border-l2` 和 `--dsw-shadow-lv3`。丢弃与守卫对话框仍在分栏里居中，并共用这套卡片描边阴影。

## 曾考虑的方案

**复用 `Menu` 的 portal 定位（`align: end`，在触发器下方）。** 否决：需求是按钮右下角，不是右对齐的下拉。

**全视口遮罩 `Modal`。** 否决：遮罩和「贴着按钮」的弹出层冲突，而且仍会把卡片居中。

**只靠 CSS 在 `.commitActions` 上写 `top:100%; left:100%`。** 否决：推送在另一行，操作列 overflow 还会裁掉流内绝对定位卡片。

## 后果

触发器贴着操作列右缘时，确认框可以盖住差异预览。触发器靠近窗口边缘时，视口钳位会把卡片拉回来。丢弃/守卫仍居中。

## 测试

`packages/client/ui-git/tests/git-confirm-popover.client.spec.ts` 检查原点计算、视口钳位和卡片描边阴影。

`packages/client/ui-git/tests/git-panel.client.spec.tsx` mock 提交和推送按钮的 `getBoundingClientRect`，断言对话框的 `left`/`top`。
