# Agent Note: 编辑界面文件树绑定 Session 的 Workspace

Status: implemented

[English](2026-08-20-editor-surface-file-tree.md) | 中文

## 问题

[分段 Tab 壳层](2026-08-20-details-segmented-tab.md) 的 details **文件编辑器** Tab 只显示未打开文件空态。US-4~US-12 需要左栏文件树，绑定当前 Session 的 Workspace：展示 Host 全量列表、懒加载展开、文件名过滤、类型图标与只读 Git 徽章。

## 决策

`ui-file-editor` 在 `EditorSurface` 内拥有文件树。绑定方式是 `useWorkspaces` 成员关系（`sessionIds.includes(sessionId)`）；缺少 Session id 时栏不绑定 Workspace。`apply` 从 `ctx.workspaces` 注入 `listWorkspaceEntries` 与 `gitStatus` 闭包，occupant 不接收整个 WorkspaceRuntime。`WorkspaceRuntime` 转发这两条 Host 一元 RPC，并把业务失败包装为 `DirectoryBrowseError`。

文件树在已加载层展示 Host 返回的全部行（含隐藏名、`.git`、`node_modules`）。仅展开文件夹时才拉取该层；缓存命中不再请求。文件名过滤对已加载名称做大小写不敏感包含匹配，并保留匹配项的祖先文件夹；不会因过滤而递归拉取。Git 字母按路径映射到行上；非仓库或 `gitStatus` 抛错时省略徽章且不弹出 alert。单击选中；双击展开文件夹；单击文件即在编辑区打开该路径（[打开／Tab／保存](2026-08-20-editor-surface-open-tabs-save.md)）。新建文件操作保持 disabled，留给文件操作 issue。

`DetailsPanel` 在编辑器 Tab 使用无页边距内容区，使过滤行贴顶，不再叠加 details 内边距。

## 备选方案

**像默认 IDE 资源管理器那样过滤隐藏项／`.git`／`node_modules`。** PRD 的全量可见规则否决；agent 与用户必须看到 Host 列出的同一棵树。

**预先递归列举，或过滤时再拉取。** 否决：大目录必须可滚动，且不能遍历整个 Workspace；过滤只收窄已经加载的节点。

**把 `ctx.workspaces` 传给 occupant。** 否决：slot inject 面只关闭该界面需要的动词；测试运行时可替换这两个回调。

**栏内列表错误／重试。** 本切片否决：列举被拒时保留上次缓存，与 PRD「无 Git 仍可用、非仓库不 alert」一致，不为第三种错误 chrome 发明新态。

**在 web 快照工作区放置空的 `.git`。** 否决：Host `git status` 会把它当成仓库，徽章 chrome 将不稳定。

## 后果

- 打开三档、Tab 与显式保存由[打开／Tab／保存笔记](2026-08-20-editor-surface-open-tabs-save.md) 拥有。
- Web e2e 在已连接工作区下放入 `README.md`、`.gitignore`、`src/` 与 `node_modules/`，且不得创建 `.git`。
- 该场景前须重建 `ui-file-editor` 与 `ui-conversation` 的 client bundle。

## 测试

`packages/client/ui-file-editor/tests/editor-surface.client.spec.tsx` 覆盖默认绑定与可见性、空工作区、文件名过滤、懒展开缓存、Git 加载与非仓库、大目录滚动、卸载后列表／Git 中止，以及选中。单击打开由[打开／Tab／保存笔记](2026-08-20-editor-surface-open-tabs-save.md) 断言。

`packages/client/runtime/tests/workspaces-service.client.spec.ts` 覆盖一元转发与 `DirectoryBrowseError`。

`apps/web/tests/details-segmented-tab.e2e.ts` 回放组装后的文件树与未打开文件空态。
