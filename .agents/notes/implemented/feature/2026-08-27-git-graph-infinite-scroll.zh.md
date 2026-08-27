# Agent Note: Git Graph 无限滚动

Status: implemented

[English](2026-08-27-git-graph-infinite-scroll.md) | 中文

## Problem

`host.gitLog` 一次最多返回 50 条（schema 上限 200）。Graph 段只调用一次、不再要更早的历史，所以有几百个提交的仓库看起来像被截断。

## Decision

每次 `host.gitLog` 只返回一页。Host 跑 `git log --max-count=limit+1`（有偏移时加 `--skip`），用探测行设置 `hasMore`。Graph 段观察自己列表底部的哨兵（Graph 与 Changes 分开滚）；哨兵进入视口后，面板用已展示条数作为 `skip` 请求下一页，并按 hash 追加。Workspace、可见性或 reload epoch 变化时回到第一页。单次 `limit` 仍上限 200；面板页大小为 50。

## Alternatives considered

**提高单次上限、一次拉完全部。** 否决：大历史会拖住 Host，并在首次绘制 overlay SVG 时卡住布局。

**用提交 hash 当游标（`git log hash..`）。** 否决：按 skip 的 `--topo-order` 分页与 `git log` 自身一致，不需要跨 rewrite 的稳定游标。

**在列表顶部下拉刷新。** 否决：更早的提交在最新 tip 下面；加载触发点应在底部。

## Consequences

分页边界可能把 merge 和它的父提交拆开，直到下一页到达，所以未完成图底部的泳道在 `hasMore` 为 false 之前可能不完整。重叠页里的重复 hash 会被丢掉；一页若没有新增 hash 会清掉 `hasMore`，避免哨兵死循环。

## Testing

`packages/host/apiproxy/tests/parse-git-log.spec.ts` 断言分页 argv 与 `sliceGitLogPage` 的 `hasMore`。

`packages/client/runtime/tests/workspaces-service.client.spec.ts` 断言线上转发 `limit` 与 `skip`。

`packages/client/ui-git/tests/git-panel.client.spec.tsx` 挂载两页 `gitLog` stub，触发 IntersectionObserver，断言第二页追加且「加载更多」消失。
