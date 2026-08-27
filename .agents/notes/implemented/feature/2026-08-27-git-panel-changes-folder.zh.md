# Agent Note: Git 面板 Changes 目录

Status: implemented

[English](2026-08-27-git-panel-changes-folder.md) | 中文

## Problem

Git 操作列把工作区 chrome（分支、提交、未暂存/已暂存列表）和 Graph 混成一叠。用户可以收起内侧文件列表或 Graph，但不能像收起文件夹那样把整块工作区藏起来。

## Decision

列表列有两个同级可折叠组。**CHANGES** 包住分支行、未推送/推送行、提交说明、提交工具栏、写错误行，以及原有未暂存/已暂存段，不改它们的 handler。CHANGES 标题右侧显示 `unstaged.length + staged.length`（干净仓库为 0），与 GRAPH 已加载提交数同一套计数样式；同一路径同时出现在两段时计两次，与内侧两段数字之和一致。**GRAPH** 仍是兄弟，钉在操作列底部：Changes 打开时 Graph 不会被滚走，高度上限 48%；收起 Changes 后 Graph 占满剩余空间。两者默认展开。内侧未暂存/已暂存段头仍只收起各自的行。Changes 的 body（分支、提交区与两段文件列表）和 Graph 列表（节点、弧线与提交行）相对文件夹标题缩进 14px。文件夹标题 13px、加粗、全大写；内侧段标题仍是 12px、大小写不变。

## Alternatives considered

**把提交区钉在滚动列上方。** 否决：需求是把整块工作区（含分支和提交）收成一个文件夹。

**手风琴，同时只开 Changes 或 Graph。** 否决：两组仍可独立展开。

**Changes 与 Graph 共用一列滚动。** 否决：未暂存一长 Graph 会被顶出视口；Changes 打开时 Graph 钉在底部。

## Consequences

Changes 展开时只滚它自己的 body；Graph 钉在操作列底部，不会被滚走。若 Changes 卸掉 body，内侧未暂存/已暂存的展开状态会重置。

## Testing

`packages/client/ui-git/tests/git-panel.client.spec.tsx` 断言 Changes 与 Graph 段头，再用键盘和点击收起 Changes（Graph 仍在），并检查文件夹标题全大写、Changes body 与 Graph 列表缩进 14px、Changes 打开时 Graph 的 `max-height`、CHANGES 标题数量为未暂存加待提交（收起后仍可见），以及干净仓库显示 `0`。
