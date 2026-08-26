# Agent Note: watchPath 占满 HTTP/1.1 槽导致资源管理器 listing 卡住

Status: implemented

[English](2026-08-26-explorer-listing-http-starvation.md) | 中文

## Problem

在文件树里连续展开多个文件夹时，行尾 spinner 会转几十秒，随后每个已展开文件夹变成红色 `!`。同类故障曾经发生在 `events.mux` 与 `events.host` 上，当时把这两条下行从 HTTP SSE 迁走后已修好。

## Decision

浏览器载体上的 `host.watchPath` 改为 `/api/host.watchPath` 的只下行 WebSocket，物理规则与 mux/host 相同（[WebSocket 下行载体](../architecture/2026-08-04-websocket-downlink-carrier.md)）。每个已打开文本 Tab 与 Workspace 根仍各有一条 socket；这些 socket 不再占用 HTTP/1.1 的六条连接，因此 `listWorkspaceEntries` 的 unary POST 不会排在长寿命 SSE 后面。

命中客户端 30 s 超时的 listing 记为文件夹失败（`!`），而不是当成被取代的 abort 从而让 spinner 永远转。被取代的在途 fetch（折叠、同一路径的更新 fetch）仍直接退出，不画 `!`。

## Alternatives considered

**用 Workspace 根上的一条递归 `fs.watch` 代替按路径的 socket。** 此处否决：还要为 `.git` / `.dsh` 写入风暴加忽略规则，并且会改 Host watch 语义，超出连接槽 bug 的范围。

**保留 SSE，把并发 watch 上限钉在五条。** 否决：第六个 Tab、Workspace 根 watch 以及 HMR 仍会饿死 listing；配额是载体事实，不是产品上限。

## Consequences

- 网络 GET `/api/host.watchPath` 返回 426；进程内测试仍经 `toFetchHandler` 走 SSE。
- 关闭文件 Tab 只中止该 watch socket；mux/host generation 不变。

## Testing

`packages/client/connection/tests/client-apply.client.spec.ts` 要求 `host.watchPath` 打开 `ws:` 且不调用 `fetch`。

`packages/client/connection/tests/node-half.host.spec.ts` 注册 upgrade 路径，并对 GET 断言 426。

`packages/client/connection/tests/websocket-downlink.host.spec.ts` 投递 `host/path-changed` 帧，并对缺 query 的 upgrade 拒绝 HTTP 400。

`packages/client/ui-file-editor/tests/editor-surface.client.spec.tsx` 推进 listing 定时器，要求出现 `!` 且没有 spinner。
