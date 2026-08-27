# Agent Note: Git 面板路径写入不再禁用提交

Status: implemented

[English](2026-08-27-git-panel-path-write-commit-flash.md) | 中文

## 问题

点击 **选入提交**、**移出提交** 或 **撤销更改** 时，**提交**（以及 **推送**）会闪一下。这些行写入会置 `pathWriting`，而 `commitDisabled` / `pushDisabled` 把它当成按钮 `disabled` 的理由。disabled 样式把透明度降到 0.4，一次很快的 Host 往返看起来就是闪烁。

## 决策

`commitDisabled` 为 `stagedEmpty || commitPending !== false || stagedDirty`。`pushDisabled` 为 `!pushAvailable || pushPending || commitPending !== false`。路径写入仍设置 `busyPath`，行上显示 spinner，其它行操作仍 inactive。它们不再禁用提交或推送。

## 曾考虑的方案

**路径写入期间继续禁用提交，避免与 Host git RPC 重叠。** 本表面否决：闪一下是几十毫秒锁的用户可见代价，而且提交进行中已经允许继续选入。

**禁用但不改透明度。** 否决：点击没反应又没有可见原因，比 Host 可串行或失败的并发 RPC 更差。

## 后果

选入/移出/撤销进行中点击提交，可能与该次写入重叠。行操作仍由 `pathWriting` 互斥。

## 测试

`packages/client/ui-git/tests/git-panel.client.spec.tsx` 断言延迟的选入、移出、撤销进行中 **提交** 保持 enabled。
