# Agent Note：文件编辑器的 Host watchPath

Status: implemented

[English](2026-08-21-host-watch-path.md) | 中文

## 问题

Web 文件编辑器须感知已打开文件在磁盘上的外部变更（Agent 工具或其他进程），以便 UI 提示重新加载或保留本地缓冲（[ADR-0001](../../../../docs/adr/0001-file-editor-host-rpc.md)、US-25）。浏览器无法直接监视文件系统。

## 决策

`packages/host/apiproxy` 在现有 Host RPC seam 上新增 `host.watchPath`。客户端以 SSE 打开 `GET /api/host.watchPath?workspaceId=…&path=…`；每次外部变更投递一条带绝对路径的 `host/path-changed` 帧。中止流即关闭该路径的 Host `fs.watch` 句柄——不对 Workspace 根递归 watch，也不轮询 mtime（[PRD watchPath 切片](../../../../docs/prd/file-editor-v1.md)）。

路径须通过 `pathWithinWorkspace` 落在已注册 Workspace 根内；未知 Workspace 与越界路径以 `stream/error` 帧应答。实现位于 `watch-path.ts`；线型类型与文件编辑器其他 RPC 一样扩展 `HostApi`。

## 曾考虑的方案

**在全局 `events.host` 流上推送 path-changed。** 否决：与 session/workspace 生命周期流量混杂，重连基线复杂。

**一元 long-poll 或 mtime 轮询。** PRD 否决：V1 仅跟随 Host `fs.watch` 信号。

**浏览器端 fs.watch。** 不可行；磁盘访问归 Host。

## 后果

- 下游 `ui-file-editor` 外部变更对话框经 Client 载体的 `host.watchPath` 订阅；每个打开 Tab 一条订阅，关 Tab 即释放。
- 网络文件系统可能漏事件；V1 接受 `fs.watch` 覆盖范围，不做内容哈希对账。
- `watchPath` 与其他 `/api` 路由共用浏览器载体信任栅栏。

## 测试

`packages/host/apiproxy/tests/watch-path.spec.ts` 覆盖注入式 `fs.watch` 投递与 abort 清理。

`packages/host/apiproxy/tests/api-proxy-watch-path.spec.ts` 经 `createApiProxy` 覆盖外部改写与 abort 后静默。
