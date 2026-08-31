# 桌面壳内嵌浏览器：Electron BrowserView 与 Playwright connectOverCDP

**浏览器交付**下，人类操作面为 ADR-0007 的 Playwright **有头 OS 窗口**（`host.browserShowWindow` / `page.bringToFront`）。**桌面壳**下，领域层要求 **面板内 WebView**（`CONTEXT.md`），不再弹出独立 Chromium 窗口。我们决定 **Electron 主导**：真实浏览载体为 Main 进程 **`BrowserView`**，Renderer 经 IPC 同步工具箱 **浏览器** 段 occupant（`#browser-occupant`）的屏幕 bounds，Main 调用 `setBounds` / 段切换时 `removeBrowserView`；Host `BrowserRegistry` 在桌面交付下用 **`chromium.connectOverCDP(electronDebugUrl)`** 附着 Electron webContents，Agent `browser_*` 与人类视图 **同一 webContents**。`host.browser.*` RPC 契约与 Tab 元数据语义不变（ADR-0007、ADR-0008）；变的是**人类操作面载体**与 Registry 内 Playwright 附着方式。桌面安装包经 electron-builder **`extraResources` 捆绑 Playwright Chromium 运行时**；桌面用户 **不要求** `npx playwright install chromium`。**浏览器交付** 仍按 ADR-0007 要求用户显式 install。

**Considered Options**

- **Playwright 主导 + BrowserView CDP 镜像显示**：Playwright 仍 `launchPersistentContext` 并有头窗，BrowserView 仅镜像；双 Chromium，profile / Cookie / 窗口生命周期 fragile，且仍可能弹出 OS 窗口。
- **桌面壳仍用 Playwright 有头 OS 窗口**：与 **面板内 WebView** 领域决策冲突，桌面壳相对 `dsh web` 几乎无浏览器侧收益。
- **Renderer `<webview>` 标签嵌入**：布局简单，但 Electron 长期标记为 legacy；guest webContents 的 debug 附着、段切换焦点与 Playwright target 选择在多 webContents 环境下更脆；安全须额外收紧 `webpreferences`。
- **首启后台下载 Chromium**：安装包小，但 dev 预览与离线环境首屏体验差，不符合桌面「开箱即用」。
- **桌面也不捆绑 Chromium，与浏览器交付相同**：用户须 CLI install；桌面 **浏览器不可用** 成为常态，与 V5 落地目标不符。

**Consequences**

- `BrowserRegistry`（或等价 seam）须识别 **交付形态**：**web** → 现有 `launchPersistentContext` + 有头窗 + `bringToFront`；**desktop** → Electron `BrowserView` 生命周期 + `connectOverCDP`，**不**调用 `browserShowWindow` 唤起 OS 窗口。
- `@deepseek-ai/dsh-client-ui-browser` 在桌面路径：occupant 改为 bounds 上报通道，**移除**「显示窗口」卡片与 `browserShowWindow` 主路径；Tab 栏、导航顶栏、溢出菜单与 workspace store **不变**。
- Main 须处理窗口 resize、工具箱 drag、**浏览器** 段 hide/show 时的 BrowserView attach/detach 与 bounds 更新。
- 安装包体积显著增加（约 +150–300MB 量级，平台分包）；PRD 须写清 macOS / Windows 分包与体积预期。
- ADR-0007「不在 `pnpm install` 捆绑 Chromium」**仅约束浏览器交付**；桌面交付例外见本 ADR。
- 集成测试：desktop 路径须可 mock CDP 或在 CI 无 display 时 self-skip；**不得**在 CI 弹出 BrowserView。
- `tool-browser` 与 `host.browser.*` schema **不**因载体分叉；Agent 与人类仍共用 Tab / Cookie / 存储，并发无全局锁（ADR-0007 不变）。
