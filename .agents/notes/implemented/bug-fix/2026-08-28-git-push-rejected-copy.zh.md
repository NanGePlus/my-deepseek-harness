# Agent Note: Git 推送被拒绝的文案

Status: implemented

[English](2026-08-28-git-push-rejected-copy.md) | 中文

## Problem

第一次 **推送** 到已经有提交的 GitHub 远程（例如创建时带了 README）会因无法快进而失败。Git 的 stderr 以 `To https://…` 开头。推送行错误用 CSS 省略，面板只显示 `To https://github.com/NanG…`，把 `[rejected]` / `fetch first` 藏掉了。

## Decision

Host `gitFailureMessage` 去掉 `To <url>` 目标行，让 RPC 文案从拒绝原因开始。面板把 `[rejected]`、`non-fast-forward` 和 `(fetch first)` 映射为「远程已有提交，无法快进推送」/「The remote has commits that would not fast-forward」。省略后的错误 span 仍带显示文本的 `title`。这与 [Git 无远程时的推送文案](2026-08-27-git-missing-remote-push.md) 同一套产品文案做法。

## Alternatives considered

**用 tooltip 展示完整 Git stderr，行内仍留 `To <url>`。** 否决：用户先读到的是行内标签；目标行不是失败原因。

**给面板加拉取，让被拒绝的推送能合入远程提交。** 本轮否决：需求是第一次推送失败时能读懂的文案。面板仍然没有拉取。

**未发布分支一律 `git push --force`。** 否决：会覆盖用户刚在 GitHub 上创建的远程历史。

## Consequences

带 README 创建的 GitHub 仓库仍然无法从无关的本地根提交快进。面板把这件事说清楚。权限拒绝和其它推送失败在去掉 `To <url>` 行之后仍显示 Git 原文。

## Testing

`packages/host/apiproxy/tests/api-proxy-git-write.spec.ts` 向已有不同根提交的远程推送，断言 `git-failed` 且 message 不以 `To ` 开头。

`packages/client/ui-git/tests/git-error-copy.client.spec.ts` 匹配拒绝短语，不匹配 `[remote rejected]`。

`packages/client/ui-git/tests/git-panel.client.spec.tsx` 在独立 **推送** 上把该 stderr 映射为产品文案。
