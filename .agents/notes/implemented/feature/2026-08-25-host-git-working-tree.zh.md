# Agent Note: Host Git working-tree inspect RPCs

Status: implemented

[English](2026-08-25-host-git-working-tree.md) | 中文

## 问题

Git 面板需要经 Host 做仓库发现、未暂存／已暂存变更列表、只认磁盘的差异预览，以及在绑定 Workspace 根初始化仓库。浏览器不得直接碰磁盘或运行 git（[ADR-0003](../../../../docs/adr/0003-git-panel-host-rpc.md)）。V1 `host.gitStatus` 把「没有 git」和「不是仓库」都收成空徽章列表，无法驱动面板的两种空态。

## 决策

`packages/host/apiproxy` 在现有 Host API seam 上新增三个有类型 Host RPC。Client 功能包只经 `WorkspaceRuntime`（以及对应的 `IWorkspaces`／`TestWorkspaces`）消费。没有任意 argv 的 git 通道。

`host.gitWorkingTree({ workspaceId })` 从绑定 Workspace 用 `git rev-parse --show-toplevel` 向上发现仓库根，返回当前分支或 Git 对游离 HEAD 的说明，并列出未暂存与已暂存的磁盘变更。每行带相对仓库根的 POSIX `path` 以及 Host 绝对路径 `absolutePath`（可在绑定 Workspace 之外）。忽略路径不出现（默认 porcelain）。本机无 git 与不是仓库是成功响应里的 `availability` 值，不是 RPC 错误，以便面板渲染对应空态。其它 git 失败仍为 `internal`。

`host.gitInit({ workspaceId })` 仅当整条祖先链都没有仓库时，在绑定 Workspace 根执行 `git init`。失败码：`git-unavailable`、`already-a-git-repository`（details 含 `repoRoot`）、`git-failed`（message 为 Git 原文）。不发布远程。

`host.gitDiffPreview({ workspaceId, path, side })` 为未暂存或已暂存列表中的一条路径读取只认磁盘的预览。成功 kind 为 `text`（hunks）、`untracked-text`、`binary`、`deleted-text`、`deleted-binary`。没有对应变更的路径，或落在已发现仓库根之外的路径，以 `git-path-not-found` 失败。本机无 git 为 `git-unavailable`；其它 git 调用失败为 `git-failed`。

V1 `host.gitStatus` 不变：非仓库与本机无 git 仍返回空 `entries`。

实现位于 `git-working-tree.ts`；wire 类型与 zod schema 按 `gitStatus` 同一模式扩展 `HostApi`。

## 曾考虑的方案

**复用 `host.gitStatus`，从空徽章列表推断空态。** 否决：US-32／US-33 要求区分本机无 git 与不是仓库，包括磁盘上已有 `.git` 的情况。

**暴露带 argv 的通用 `gitRun`。** 被 PRD 与 ADR-0003 否决：Host 拥有封闭的有类型操作集；任意 argv 是 shell，不是面板 API。

**把变更列表限制在 Workspace 根内。** 否决：嵌套 Workspace 必须看见整个仓库才能提交所发现的仓；文件编辑器仍拒绝打开绑定范围外的路径。

**把 `gitWorkingTree` 上的无 git／不是仓库做成 RPC 错误。** 否决：那是产品空态，不是传输失败；Client 不必把面板成功判别值特判成错误码。

## 后果

- 暂存、取消暂存、丢弃与提交见 [Host Git working-tree write RPCs](2026-08-25-host-git-write.md)。
- `ui-git`（Issue #55–#59）经 `WorkspaceRuntime` 调用这些 RPC，不 import `ui-file-editor` 内部符号。
- 绑定 Workspace 之外的路径可以出现在列表和预览中；用文件编辑器打开它们仍不在本 RPC 范围内。

## 测试

`packages/host/apiproxy/tests/api-proxy-git-working-tree.spec.ts` 经 `createApiProxy` 覆盖发现、分支／游离 HEAD、两段列表、忽略与范围外路径、初始化、availability 判别以及预览 kind 与有类型失败。

`packages/host/apiproxy/tests/api-proxy-git-status.spec.ts` 保持 V1 在非仓库与本机无 git 时的空列表行为。

`packages/client/runtime/tests/workspaces-service.client.spec.ts` 覆盖 Client 转发与 `DirectoryBrowseError`。
