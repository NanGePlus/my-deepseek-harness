# Agent Note：桌面 Edit 菜单不得注册原生 Undo/Redo

Status: implemented

[English](2026-09-02-desktop-edit-menu-monaco-undo.md) | 中文

## 问题

桌面壳使用 Electron `{ role: 'editMenu' }`，会把 Cmd+Z 绑定到 `webContents.undo()`。Monaco 源码编辑器与 TipTap Markdown 预览各自维护文档 undo 栈。在 Monaco 面上执行原生 web undo 会错误地回退 IME 组合步骤（出现 `ni hao` 等罗马化拼音，而不是撤销已提交的中文）。预览模式正常，是因为 TipTap 在某些路径下先于原生加速键处理了 undo；Markdown 源码与其他 Monaco 标签页稳定复现。

## 决策

保留 `{ role: 'editMenu' }` 以维持平台 Edit 菜单位置，但将子菜单替换为仅含剪贴板与选择项（`cut`、`copy`、`paste`、`delete`、`selectAll`，macOS 另含 paste-and-match-style）。不注册 `undo` / `redo` 菜单角色。Renderer 在桌面交付下安装捕获阶段 Cmd+Z 处理：编辑器聚焦时调用 Monaco `trigger('undo'|'redo')` 与 TipTap `commands.undo/redo`。

## 已否决方案

**经 IPC 将 Edit ▸ Undo 路由到 `editor.trigger('undo')`。** 本变更否决：剪贴板仍依赖原生 `webContents.*`；undo IPC 需 preload 与聚焦编辑器追踪，在更简单的加速键修复未证明不足前过重。

**完全移除 Edit 菜单。** 否决：无 edit 菜单角色时复制/粘贴加速键会失效。

## 后果

菜单栏不再显示 Undo/Redo 项；编辑器内 undo/redo 仅能通过键盘。浏览器交付不变。

## 测试

`apps/desktop/tests/app-menu.spec.ts` 断言 edit 子菜单含 copy/paste、不含 undo/redo 角色。
