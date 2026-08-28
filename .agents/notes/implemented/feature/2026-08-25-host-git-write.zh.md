# Agent Note: Host Git working-tree write RPCs

Status: implemented

[English](2026-08-25-host-git-write.md) | 中文

## 问题

Git 面板必须经 Host 拥有的操作做暂存、取消暂存、丢弃与提交。浏览器不得拼装 git argv 或应用 patch（[ADR-0003](../../../../docs/adr/0003-git-panel-host-rpc.md)）。[Host Git working-tree inspect RPCs](2026-08-25-host-git-working-tree.md) 中的检查 RPC 只列出磁盘状态，不改 index 或工作树。

## 决策

`packages/host/apiproxy` 在现有 Host API seam 上新增四个有类型 Host RPC。Client 功能包只经 `WorkspaceRuntime`（以及对应的 `IWorkspaces`／`TestWorkspaces`）消费。没有任意 argv 的 git 通道。每次写操作返回检查路径刷新后的 `GitWorkingTreeResult`。

`host.gitStage({ workspaceId, path, hunkHeader? })` 暂存一条未暂存变更。省略 `hunkHeader` 时对整文件执行 `git add`（含未跟踪路径）。给出 `hunkHeader` 时，它必须匹配已跟踪文本文件未暂存 `gitDiffPreview` 中的一块；Host 从 `git diff` 抽出该块并以 `git apply --cached` 应用。未跟踪路径的按块暂存以 `git-path-not-found` 拒绝。

`host.gitUnstage({ workspaceId, path, hunkHeader? })` 取消暂存一条已暂存变更且不改写磁盘。有 HEAD 时整文件使用 `git restore --staged`。未出生分支使用 `git rm --cached -f`，把已添加路径移出 index 而不解析 HEAD。按块使用已暂存的 `git diff --cached` 加上 `git apply --cached --reverse`。

`host.gitDiscard({ workspaceId, path, hunkHeader? })` 只丢弃未暂存变更。整文件：未跟踪路径从磁盘删除；已跟踪的修改与删除从 index 还原工作树。按块对未暂存 diff 执行 `git apply --reverse`。仅已暂存的路径以 `git-path-not-found` 失败，因此丢弃从不改 index。

`host.gitCommit({ workspaceId, message })` 新建一条 HEAD 提交。说明 trim 后为空则以 `git-failed` 拒绝（Git 空说明原文）。暂存区为空则以 `git-failed`（`nothing to commit`）拒绝，不调用 `git commit`。作者身份只取 Git 配置；Host 从不传 `--author`、不 amend、不 push。Git 自己的作者身份失败原文作为 `git-failed` 返回。

`hunkHeader` 是 `gitDiffPreview` 返回的 `@@ … @@` 行。`runNativeCommand` 没有 stdin，因此按块 patch 写入临时文件再以 `git apply -- <file>` 传入。

写失败复用已有错误码：`git-unavailable`、`git-path-not-found`、`git-failed`、`cancelled`、`workspace-not-found`。绑定 Workspace 不是仓库时，写操作为 `git-path-not-found`（检查 RPC 仍返回成功的 `availability: 'not-a-repository'`）。缺失的未暂存／已暂存行、当前 diff 中不存在的块、以及已发现仓库根之外的路径均为 `git-path-not-found`。

实现位于 `git-working-tree.ts`；wire 类型与 zod schema 按检查 RPC 同一模式扩展 `HostApi`。

## 曾考虑的方案

**暴露带 argv 的通用 `gitRun`。** 被 PRD 与 ADR-0003 否决：Host 拥有封闭的有类型操作集；任意 argv 是 shell，不是面板 API。

**由 Client 拼装并发送 patch。** 否决：选块是 UI 职责，但 patch 拼装与 `git apply` 参数留在 Host，浏览器从不处理 git patch 语法或 argv。

**丢弃已暂存变更，或在一个 RPC 里取消暂存并丢弃。** 否决：US-17 要求丢弃不碰 index；取消暂存是单独的有类型操作。

**用 Session 用户填作者身份。** 否决：US-8／US-21 要求只取 Git 配置；Host 自造 `--author` 会掩盖 Git 自己的身份失败。

**把只含空白的说明传给 `git commit -m`。** 否决：Git 可能接受该说明；产品要求 trim 后非空。

## 后果

- `ui-git`（Issue #55–#59）经 `WorkspaceRuntime` 调用这些 RPC，不 import `ui-file-editor` 内部符号。
- 检查 RPC 不变：本机无 git 与不是仓库在 `gitWorkingTree` 上仍是成功的 `availability` 值。
- 另一块被应用后，预览里的 hunk header 可能失效；Client 必须在下一次按块写之前重新预览。
- 未出生分支上的整文件取消暂存见 [Git 未提交时移出提交](../bug-fix/2026-08-28-git-unborn-unstage.md)。

## 测试

`packages/host/apiproxy/tests/api-proxy-git-write.spec.ts` 经 `createApiProxy` 覆盖整文件与按块的暂存／取消暂存／丢弃、未出生分支取消暂存、提交约束、作者身份失败原文、有类型错误码，以及不存在 argv 通道。

`packages/client/runtime/tests/workspaces-service.client.spec.ts` 覆盖 Client 转发与 `DirectoryBrowseError`。
