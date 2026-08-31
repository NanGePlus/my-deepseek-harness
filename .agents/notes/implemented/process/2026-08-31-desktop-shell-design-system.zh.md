# Agent Note: 桌面壳 V5 SPA 内容消费文件编辑器 DESIGN.md

Status: implemented

[English](2026-08-31-desktop-shell-design-system.md) | 中文

## Problem

桌面壳 V5 是 spec-driven：页面布局与业务文案在 PRD，但 UI 实现者仍须为 SPA 内容引用可 cite 的品牌板。若不验收关闭，后续 UI PR 会把原生菜单或窗口 chrome 做成 §5 原语、用全屏原生遮罩做退出守卫、把 BrowserView occupant 当成缺失的具名原语，或在交付桌面壳时改 `DESIGN.md`。

## Decision

[`docs/design/DESIGN.md`](../../../../docs/design/DESIGN.md) 是桌面壳内 SPA 内容的品牌板——与浏览器交付同一套。原生桌面 chrome（应用菜单、标题栏、交通灯、窗口边框）遵循各平台 HIG / Fluent，**不在** `DESIGN.md` 内。[文件编辑器设计系统 Agent Note](2026-08-20-file-editor-design-system.md) 仍拥有叠色 Token 名、light 模式下 `--dsw-alias-brand-primary`，以及 UI 实现 PR 不得改全局 Token 的规则。

**app-shell** SPA 内容复用 Web 三栏布局与 §5 details 分段 Tab。Host boot loader、connection connecting 态与 loud boot 错误留在 SPA 视口内——不用全屏原生遮罩（§6）。

**退出守卫** 复用与 Session 切换守卫相同的逐文件保存 / 丢弃 / 取消对话框（`--dsw-alias-bg-layer-3` 对话框 / 确认表面、`editor-dirty-dot` 标记 Tab）。原生 Quit / 关窗触发该链；不另加全屏原生遮罩。

**embedded-browser** 桌面 occupant 继承 [内嵌浏览器设计系统 Agent Note](2026-08-30-embedded-browser-design-system.md)：Tab 栏、导航、地址栏、溢出、空状态与 Loading 不变；移除「显示窗口」卡片。**面板内 WebView** occupant 组合 `--dsw-alias-markdown-code-block` 作为预览区表面（与 screencast 画布相同）；BrowserView bounds 贴满 occupant 矩形，不是新原语。错误与空态叠层按 PRD 状态策略画在 BrowserView 之上或之后，仍在工具箱栏内。

桌面 V5 PRD「待扩展 DESIGN §5」保持为空。页面布局、原生菜单文案与桌面专属 copy 留在 PRD。

## Alternatives considered

- **把原生菜单、标题栏或交通灯做成 DESIGN §5 原语。** 否决：PRD 把壳层 chrome 交给平台原生规范；新增原语会迫使「待扩展 DESIGN §5」非空。
- **退出守卫或 Host 启动失败用全屏原生遮罩。** 否决：与 §6（不全屏遮罩整个 dsh Web）冲突；PRD 要求 SPA boot 错误与 dirty 编辑器对话框形态。
- **为桌面交付另写 DESIGN.md 或另造色板。** 否决：桌面 SPA 加载同一 `apps/web` bundle 且功能对等；第二套品牌板会破坏对等。
- **为 BrowserView occupant 命名 §5 原语。** 否决：PRD 已组合现有预览区表面；内嵌浏览器验收关闭已约束 Tab / 导航 / 空态 / Loading。
- **允许桌面 UI PR 为原生 chrome 叠色改 DESIGN.md。** 否决：这正是先前各段验收关闭已禁止的品牌板泄漏。

## Consequences

桌面 `app-shell` 与 `embedded-browser` 的 UI 实现者引用 `DESIGN.md` §5/§6、PRD 页面清单，原生 chrome 引用平台 HIG / Fluent。不得把 HEX 拷进功能 CSS，不得新增壳层 chrome 或 BrowserView 原语，也不得为了落地某一页去改品牌板。若要新增 PRD 尚未复用的通用原语，应走 Design Issue 并写入 PRD「待扩展 DESIGN §5」。
