# Agent Note: 编辑界面打开三档、多 Tab 与显式保存

Status: implemented

[English](2026-08-20-editor-surface-open-tabs-save.md) | 中文

## 问题

[文件树切片](2026-08-20-editor-surface-file-tree.md) 已列出 Workspace 路径，但尚未打开文件。US-13~US-19 与 US-28~US-30 需要三种打开模式（可编辑文本、图片只读预览、不可打开提示）、多 Tab、dirty 文本的显式保存、编辑区内打开/保存加载与重试，以及 Monaco／UI 跟随 `body[data-ds-dark-theme]`，且不得把缓冲写入 session 日志。

## 决策

`ui-file-editor` 在任何 Host I/O 之前用 `openKindForPath` 判定单击：图片扩展名调用 `readFile(..., 'bytes')` 并预览；已知二进制扩展名（如 `.wasm`）打开提示 Tab 且不得读取；其余路径调用 `readFile(..., 'text')`，并按扩展名把语言 id 交给 Monaco。已打开路径只聚焦该 Tab。Tab、缓冲与 dirty（`buffer !== saved`）活在 Session 独占的 `defineStore` 中，不进入 session 日志。dirty 文本只经 **保存** 或 ⌘S / Ctrl+S 落盘；预览与不可打开 Tab 不能保存。打开/保存状态是组件本地状态，不进 store；失败留在编辑区并提供 **重试**。关闭 Tab 即丢弃该缓冲（dirty 关闭对话框由 US-27 拥有）。

`apply` 在既有列表动词之外，从 `ctx.workspaces` 注入 `readFile` / `writeFile` 闭包。[Host `readFile` / `writeFile`](2026-08-20-host-read-write-file.md) 已定义 RPC；`WorkspaceRuntime` 负责转发，并把业务失败包装为 `DirectoryBrowseError`。

Monaco 经 `loadMonacoEditor()`（`import('monaco-editor')`）加载。jsdom 通过 Vitest alias 指向 `tests/monaco-editor.stub.ts`，其 `create` 会抛错，因此控件保持等宽 textarea，可访问名称仍携带文件名、语言与主题。client bundle 把 monaco-editor 内联进单一的 `lib/client.js` 工厂（`outputOptions.codeSplitting: false`）；CSS Modules 插件同时把 monaco 的普通 `.css` 内联为 `<style>` 标签，避免 tsdown 的 css-guard 去要求 `@tsdown/css`。

## 备选方案

**把缓冲写入 session 日志。** 否决：这是人类 UI 状态，不是模型可见输入；PRD 与[文件树笔记](2026-08-20-editor-surface-file-tree.md) 要求编辑器 store 只留在 Client。

**每次按键自动保存。** 被 US-16 否决：由用户决定何时落盘。

**在树里过滤掉非文本行。** 被 PRD 否决：树展示 Host 返回的全部行；打开模式在单击时判定。

**把 monaco-editor 留成额外的 `lib/*.cjs` chunk。** 否决：插件加载器只拉取 `lib/client.js`。

**为 monaco 样式安装 `@tsdown/css`。** 否决：现有虚拟模块 CSS 管线已经注入 `<style data-plugin>` 标签；扩展到普通 `.css` 即可，不必再引入第二套 CSS 工具链。

## 后果

- 关闭 dirty Tab 会丢弃缓冲，直到 US-27。
- `watchPath`／外部变更对话框仍属后续 issue。
- ui-file-editor 的 client 工厂包含 monaco-editor（数 MB）；PRD 接受这一体积。
- 本切片里 Monaco worker 是占位 `Worker`；分词仍来自内联的语言贡献。

## 测试

`packages/client/ui-file-editor/tests/editor-surface.client.spec.tsx` 覆盖 States 矩阵：可编辑文本、图片预览、不可打开且不调用 `readFile`、空编辑区、dirty／保存与 ⌘S、保存禁用、编辑区内加载／错误／重试、主题跟随、切换 Tab 不再次读取，以及卸载后中止。

`packages/client/ui-file-editor/tests/monaco-editor.client.spec.tsx` 用假的 `loadMonacoEditor` 走通 Monaco 成功路径。

`packages/client/runtime/tests/workspaces-service.client.spec.ts` 覆盖 `readFile`／`writeFile` 转发。

`scripts/client-bundle-css.spec.ts` 覆盖普通 `.css` 内联。

`apps/web/tests/details-segmented-tab.e2e.ts` 仍回放未打开文件空态；本切片不把 Monaco 像素写入该快照。
