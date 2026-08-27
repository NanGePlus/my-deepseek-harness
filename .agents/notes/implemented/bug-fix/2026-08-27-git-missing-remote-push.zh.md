# Agent Note: Git 无远程时的推送文案

Status: implemented

[English](2026-08-27-git-missing-remote-push.md) | 中文

## Problem

刚初始化的工作区没有 remote。**提交并推送** 和 **推送** 仍会调用 `git push`，Git 返回 `fatal: No configured push destination.` Git 面板把这段英文 stderr 显示在 **提交** 旁边，CSS 省略成 `fatal: No config...`。提交并推送还会先执行 `git commit`，推送失败时可能已经产生新的 HEAD，而 RPC 仍失败。

## Decision

Host 在任何 push 前用 `git remote` 列出远程。空输出以 `git-failed` `no remote configured` 失败。**提交并推送** 在 `git commit` 之前做这次检查，因此没有 remote 时不会创建 commit。面板把该 token 以及 Git 的 `No configured push destination` / `No such remote` 映射为「没有配置远程仓库地址」/「No remote repository is configured」。

## Alternatives considered

**用 tooltip 展示完整 Git stderr。** 否决：需求是点明缺少远程地址的产品文案，不是更长的 fatal 原文。

**在有 remote 之前禁用提交并推送。** 本轮否决：先给出明确错误。单独 **提交** 仍可用。从面板添加 remote 见 [Git 面板添加远程地址](../feature/2026-08-27-git-add-remote.md)。

## Consequences

用户在 `hasRemote` 为 false 时从面板添加 `origin`；见 [Git 面板添加远程地址](../feature/2026-08-27-git-add-remote.md)。其它推送失败仍显示 Git 原文。

## Testing

`packages/host/apiproxy/tests/api-proxy-git-write.spec.ts` 断言 `gitPush` 与 `gitCommit({push:true})` 以 `no remote configured` 拒绝，且 HEAD 与暂存区不变。

`packages/client/ui-git/tests/git-error-copy.client.spec.ts` 匹配 Host 与 Git 短语。

`packages/client/ui-git/tests/git-panel.client.spec.tsx` 断言提交并推送与独立推送显示产品文案。
