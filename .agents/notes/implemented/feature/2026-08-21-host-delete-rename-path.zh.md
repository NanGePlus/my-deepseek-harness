# Agent Note：Host deletePath / renamePath / createWorkspaceDirectory

Status: implemented

[English](2026-08-21-host-delete-rename-path.md) | 中文

## 问题

Web 文件编辑器需要在 Session 绑定 Workspace 内经 Host 删除、同父级重命名与新建文件夹（[ADR-0001](../../../../docs/adr/0001-file-editor-host-rpc.md)）。浏览器不得直接碰磁盘，且 browse 的 `host.createDirectory` 必须留在目录选择器 seam 上。

## 决策

`packages/host/apiproxy` 在现有 Host RPC seam 上新增三个方法：

- `host.deletePath({ workspaceId, path })` — 递归删除一个文件或目录树；返回被删绝对路径。
- `host.renamePath({ workspaceId, path, newName })` — 在同一父目录下重命名；返回新绝对路径。
- `host.createWorkspaceDirectory({ workspaceId, path, name })` — 在 Workspace 内现有父目录下非递归创建子目录；返回新建绝对路径。

三者均复用 `list-workspace-entries.ts` 的 `pathWithinWorkspace`。越界路径以 `workspace-path-out-of-bounds` 失败，不静默截断。删除/重命名时源路径缺失以 `path-not-found` 失败。重命名或创建目标已存在以 `directory-exists` 失败（与 browse 创建语义对齐）。其他删除/重命名失败分别用 `path-delete-failed` / `path-rename-failed`；其他创建失败用 `directory-create-failed`。

实现位于 `workspace-path-mutations.ts`；wire 类型与 zod schema 按 `readFile` / `writeFile` 先例扩展 `HostApi`。`WorkspaceRuntime` 经 `DirectoryBrowseError` 转发这三个方法。

## 曾考虑的方案

**给 browse `host.createDirectory` 增加 `workspaceId`。** 否决：会把文件编辑器建目录与目录选择器 capability kind 耦合并可能破坏 Miller 浏览器契约。

**删除目录时复用 `file-not-found`。** 否决：删除/重命名也作用于目录；`path-not-found` 在这类变更上统一表示路径缺失。

## 后果

- 下游 `ui-file-editor` 文件操作工具栏可经 `WorkspaceRuntime` 调用这些 RPC。
- `watchPath` 仍为独立 Issue。
- 递归删除遵循 Node `fs.rm` 对目录树的语义。

## 测试

`packages/host/apiproxy/tests/api-proxy-delete-rename-path.spec.ts` 经 `createApiProxy` 覆盖删除（文件与目录树）、重命名成功、重命名目标冲突、Workspace 内建目录、`directory-exists` 与越界拒绝。

`packages/client/runtime/tests/workspaces-service.client.spec.ts` 覆盖 Client 转发与三个方法的错误映射。
