# Agent Note: Git 面板 Graph 合入弧线

Status: implemented

[English](2026-08-27-git-panel-graph-merge-arcs.md) | 中文

## Problem

Graph 段原先每条泳道只画竖线和圆点。合并历史看起来像一叠圆点。期望 GitLens 风格的用户看不见第一父提交主干，也看不见功能分支从主干分出再弯回。

## Decision

`layoutGitGraph` 把第一父提交留在当前泳道（主干）。额外父提交占用新泳道。若后续提交的第一父提交已在另一泳道，则弯回主干。边从子提交节点连到父提交节点，跨越整列。`GitGraphSection` 用一张 overlay SVG 画这些边：主干为竖线 `L`，分叉或合入为三次曲线 `C`，控制点落在外侧泳道上，让侧支圆点落在弧上。每一行说明的 gutter 只按该行最右侧的点或线来留空，主干上的 tip 不会为后面 merge 的侧道预留空白。被释放的侧道被后续 merge 复用时换新颜色。多于一个父提交的 commit 在主干上用空心圆加点。远程引用保留 `origin/` 前缀，画成橙色胶囊。`host.gitLog` 用 `--topo-order` 列出提交。父提交 hash 能对上，依赖于去掉 Git 在每条 `--format` 记录后追加的换行（[git log 记录换行](../bug-fix/2026-08-27-git-log-record-newlines.md)）。

## Alternatives considered

**解析 `git log --graph` 的 ASCII。** 否决：绘图字符不是稳定的布局 API，面板仍要把它们映射到像素。

**继续只用 CSS 竖线。** 否决：那种画法无法表现分支离开主干再合回。

**按行各画一段三次曲线。** 否决：半行 12px 的弧看起来像折角；GitLens 括号弧从子节点中心连到父节点中心。

**整页按最宽泳道留一列 gutter。** 否决：后面一旦出现 merge 侧道，主干 tip 行的字会离圆点很远。

## Consequences

Graph 仍不会在点击提交后加载该 commit 的 diff。并发泳道上限为 6；更多父提交复用最后一条泳道。

## Testing

`packages/client/ui-git/tests/git-graph-layout.client.spec.ts` 断言菱形合并占用泳道 0 与 1、连续 PR 合并时主干保持蓝色且侧支换色、两提交侧支留在同一泳道、三次曲线控制点落在外侧泳道、泳道数上限为 6，以及 merge 上方的主干 tip 只用单泳道 gutter。

`packages/client/ui-git/tests/git-panel.client.spec.tsx` 挂载含 merge 的 `gitLog` 结果，断言 Graph 含 merge 节点以及带 `C` 的 SVG path；另用 tip-above-merge 夹具断言逐行 gutter 宽度。
