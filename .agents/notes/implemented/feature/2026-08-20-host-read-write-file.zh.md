# Agent Note：文件编辑器的 Host readFile / writeFile

Status: implemented

[English](2026-08-20-host-read-write-file.md) | 中文

## 问题

Web 文件编辑器需要在 Session 绑定 Workspace 内经 Host 读取可编辑文本与图片预览字节，并支持显式保存。浏览器不得直接访问磁盘（[ADR-0001](../../../../docs/adr/0001-file-editor-host-rpc.md)）。

## 决策

`packages/host/apiproxy` 在现有 Host RPC seam 上新增 `host.readFile` 与 `host.writeFile`。二者均携带 `{ workspaceId, path }` 及各自载荷字段；路径为 Host 绝对路径，须通过 `list-workspace-entries.ts` 的 `pathWithinWorkspace` 落在已注册 Workspace 根内。越界路径以 `workspace-path-out-of-bounds` 失败，不静默截断。

`readFile` 携带 `kind: 'text' | 'bytes'`。文本读返回 UTF-8；字节读返回规范 base64 及由扩展名推导的图片 media type（`.png`、`.jpg`/`.jpeg`、`.gif`、`.webp`、`.svg`）。仅普通文件可读；目录与缺失路径分别映射为 `file-not-regular` 与 `file-not-found`；其他读失败使用 `file-unreadable`。

`writeFile` 接受 UTF-8 文本，目标不存在时创建文件，并返回写入后的绝对路径。写失败使用 `file-write-failed`。

实现位于 `read-write-file.ts`；wire 类型与 zod schema 按 `gitStatus`、`listWorkspaceEntries` 同一模式扩展 `HostApi`。

## 曾考虑的方案

**只传字节、由 Client 解码文本。** 否决：可编辑文本与预览字节需要不同响应字段；请求 `kind` 在单一 RPC 下保持契约明确。

**文件 I/O 错误复用 `directory-unreadable`。** 否决：目录列表与文件读写的失败语义不同；独立 file 错误码便于 Client 展示重试文案。

**Client 拼接相对路径。** 被 ADR-0001 否决：Host 端到端拥有绝对路径。

## 后果

- `ui-file-editor` 的打开／保存经 `WorkspaceRuntime` 调用这些 RPC（[打开／Tab／保存](2026-08-20-editor-surface-open-tabs-save.md)）。
- 删除、重命名与 Workspace 内建目录见 [Host 路径变更](2026-08-21-host-delete-rename-path.zh.md)。
- 外部变更检测见 [host watchPath](2026-08-21-host-watch-path.md)。
- V1 不设文件大小上限；超大读跟随 Node 内存行为。

## 测试

`packages/host/apiproxy/tests/api-proxy-read-write-file.spec.ts` 经 `createApiProxy` 覆盖文本读、PNG 字节读、写入落盘与越界读/写拒绝。

`packages/client/runtime/tests/workspaces-service.client.spec.ts` 覆盖 Client 对 `readFile`／`writeFile` 的转发与 `DirectoryBrowseError`。
