# 内嵌浏览器经 Host Playwright 提供 Workspace 级浏览器实例

V4 内嵌浏览器需要在 Web 工具箱内展示可交互 Web 页面，且 Agent 浏览器工具与人类 UI **共用同一浏览器实例**（共享 Tab、Cookie、DOM）。`pnpm dsh web` 是纯 Web SPA，Client 侧 iframe 无法可靠嵌入任意 `http://` / `https://` 页（`X-Frame-Options` / CSP），也无法与 Agent 自动化共用存储。我们决定在 `packages/host/apiproxy` 扩展一组**有类型的** `host.browser.*` RPC：Host 以 **Playwright（Chromium）** 维护按 **workspaceId** 索引的 `BrowserRegistry`；每个 Workspace 以 `launchPersistentContext` 映射到本地 profile 目录（如 `.sessions/browser-profiles/<workspaceId>/`），多 Tab 对应多 `Page`。**画面**经 SSE screencast 推送给 Client（对齐 `host.terminalStream` 先例）；**人类指针/键盘**与 **Agent 操作**经 RPC 写入同一 Playwright `Page`。切走浏览器段或硬刷新 dsh Web **不**销毁 Context；Client 重载后 `list` 并重连 screencast。Chromium 通过 `npx playwright install chromium` 显式安装；缺失时返回 **`browser-unavailable`**，映射领域层 **浏览器不可用**。

**Considered Options**

- Client iframe 承载人类视图、Host Playwright 仅服务 Agent：两套 Cookie/DOM，违反「共用同一实例」。
- WebSocket 全双工传 screencast：引入第二传输栈；Host 已有 SSE 先例（终端输出、`watchPath`）。
- `pnpm install` 捆绑 Chromium：install 体积与 CI 不可控；Playwright 官方推荐显式 `install chromium`。
- 纯内存 Context、无 profile 目录：Host 重启丢登录态，dev 预览体验差。

**Consequences**

- 浏览器契约随 `apiproxy` RPC 与 connection schema 演进；`ui-browser` 与 `tool-browser` 不直接 import Playwright。
- Host 须维护 Tab 元数据（tabId、url、title）、viewport 尺寸与 screencast 帧序；隐藏 Tab 可暂停推帧以省 CPU。
- Playwright 为 Host **dependency**；文档与 CI 须说明 `playwright install chromium`；缺 Chromium 的 e2e 可 self-skip。
- **浏览器不可用**（无 Chromium、Context 启动失败）与 **未绑定 Workspace**（Client 不发起 RPC）须可区分。
- Agent 与人类并发操作同一 Tab 时不加全局锁；Playwright 与浏览器事件顺序为准。
- Host 重启后从 profile 目录恢复 Context；Tab URL 列表由 Client store 或 Host 元数据重载。
