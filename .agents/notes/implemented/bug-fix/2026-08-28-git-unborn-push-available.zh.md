# Agent Note: Git 未提交时不提供首次推送

Status: implemented

[English](2026-08-28-git-unborn-push-available.md) | 中文

## Problem

在从未提交过的仓库上添加 `origin` 后，面板立刻显示「尚未推送到远程」/ `Not pushed to remote yet` 和 **推送**。CHANGES 计数可以因未暂存文件非零；那不是未推送的 commit。

## Decision

`readPublishState` 只在 `git rev-parse --verify HEAD` 成功后，才把缺少 `@{upstream}` 当成首次推送。未出生分支上报 `pushAvailable` false。已有 commit、尚无 upstream 的命名分支仍上报 `pushAvailable` true，因此 [Git 面板未推送文案与推送行](../feature/2026-08-27-git-panel-unpushed-push-row.md) 的尚未推送行仍是首次发布控件。

## Alternatives considered

**刚添加 `origin` 就隐藏尚未推送行。** 否决：本地已有 commit、等待第一次 `git push -u` 时仍需要该行。

**保持 `pushAvailable` 为 true，只改面板文案。** 否决：没有可推送的对象；Host 不得宣称可以 `gitPush`。

## Consequences

添加远程 URL 本身不是未推送状态。**提交并推送** 仍会先创建 HEAD，再发布。

## Testing

`packages/host/apiproxy/tests/api-proxy-git-working-tree.spec.ts` inspect 未出生分支。

`packages/host/apiproxy/tests/api-proxy-git-write.spec.ts` 在无 commit 时添加 `origin` 并断言 `pushAvailable` false；本地已有 commit 后再添加 `origin` 仍为 `pushAvailable` true。

`packages/client/ui-git/tests/git-panel.client.spec.tsx` 在 `pushAvailable` 为 false 时保留 origin URL 与删除，不出现尚未推送文案或 **推送**。
