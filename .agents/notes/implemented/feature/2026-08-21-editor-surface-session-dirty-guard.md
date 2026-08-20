# editor-surface Session 切换与 dirty Tab 守卫

**Status:** implemented
**Area:** web file editor (`packages/client/ui-file-editor`)

## Decision

Dirty 文本 Tab 在切换 Session（US-26）或关闭 Tab（US-27）前经同一组逐文件对话框：**保存**、**丢弃**、**取消**。保存失败停留在守卫；切换成功后 `closeAllTabs` 并执行真实的 `sessions.open`；V1 不按 Session 持久化 Tab。

## Mechanism

- `dirty-guard.ts` 持有守卫队列与 `sessions.open` 拦截（apply 包装 `commitOpen`）。
- `EditorSurface` 向 guard 注册 per-session bridge（dirty 列表、`saveTab`、`closeTab`、`closeAllTabs`），并渲染 `bg-layer-3` 对话框。
- 组件 seam 测试覆盖 States 矩阵四态；设计 QA（Token / 布局）留 PR 人工。

## Verification

- `packages/client/ui-file-editor/tests/editor-surface.client.spec.tsx` — `EditorSurface dirty guard`
- `packages/client/ui-file-editor/tests/dirty-guard.client.spec.ts`
