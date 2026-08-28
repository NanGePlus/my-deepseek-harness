# Agent Note: Git 面板添加远程地址

Status: implemented

[English](2026-08-27-git-add-remote.md) | 中文

## Problem

刚初始化的工作区没有 remote。**提交并推送** 和 **推送** 会失败并显示「没有配置远程仓库地址」，面板没有入口去填写 URL。无远程推送文案那次改动把这个缺口记在 [Git 无远程时的推送文案](../bug-fix/2026-08-27-git-missing-remote-push.md)。

## Decision

`GitWorkingTreeResult` 增加 `hasRemote`，来自 `git remote`（Host 在 repository 结果上总会带上）。为 false 时，分支名下一行显示缺远程文案和 **添加远程地址**，不再显示 **推送**。提交后调用 `host.gitAddRemote({ workspaceId, url })`，即 `git remote add -- origin <url>`，并返回刷新后的工作树。缺远程的提交/推送错误旁也有同一 **添加远程地址**，这样即便上次读到的工作树仍显示已有 remote，失败后仍能打开输入框。

trim 后为空的 URL 在调用 Git 之前以 `git-failed` `empty remote url` 失败。trim 后仍含 NUL 或 CR/LF 的 URL 用同一 token。`origin` 已存在时，Git 原文走 `git-failed`。该 RPC 不 fetch、不 push、不改名。

## Alternatives considered

**让用户填写远程名。** 否决：本面板首次推送已经回落到 `origin`（`git push -u origin HEAD`）。再要一个名字对不上这条回落。

**`origin` 已存在时改走 `git remote set-url`。** 否决：改已有远程是另一步产品操作；本入口只服务 `git remote` 为空。

**在有 remote 之前禁用提交并推送。** 无远程推送文案那次已经否决；单独 **提交** 仍可用。

## Consequences

已经有名为其它名字的 remote 时，面板不显示这个入口。无 upstream 时推送仍用 `origin`。面板不列出或重命名 remote。删除 `origin` 见 [Git 面板删除远程地址](2026-08-27-git-remove-remote.md)。

## Testing

`packages/host/apiproxy/tests/api-proxy-git-write.spec.ts` 添加 origin、拒绝空/控制字符 URL、拒绝第二个 origin，并在 inspect 上报告 `hasRemote`；HEAD 尚无 commit 时 `pushAvailable` 为 false。

`packages/client/runtime/tests/workspaces-service.client.spec.ts` 在线上转发 `url`。

`packages/client/ui-git/tests/git-panel.client.spec.tsx` 在 `hasRemote` 为 false 时显示入口、提交 URL、空字段不发 Host、从推送错误打开编辑器，并把 Host 失败映射到表单。
