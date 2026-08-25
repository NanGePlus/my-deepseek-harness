# Agent Note: ui-git diff preview and hunk operations

Status: implemented

[English](2026-08-25-ui-git-panel-diff-preview.md) | 中文

## 问题

[整文件暂存、丢弃与提交](2026-08-25-ui-git-panel-stage-commit.md) 的 Git 面板 occupant 能列出磁盘变更并整文件暂存或提交，但单击行不展示差异。已跟踪文本的差异块无法暂存、取消暂存或丢弃，因此只有部分差异块已暂存的路径无法在面板内继续按块处理。

## 决策

单击一条变更行会选中 `{ side, row }`，并把 `gitDiffPreview` 加载到右栏。该单击不打开、不替换编辑器标签页，预览也不提供「在编辑器中打开」——即使路径在 Git 仓库根内、绑定 Workspace 之外。选中态是 occupant 的 React state；隐藏 Git Tab 后仍保留。

预览顶栏重复所选段的整文件操作。Host `GitDiffPreview.kind` 决定正文：

- `text`：`--ds-font-family-code` 13px/20px 行级差异；新增行用 `semantic-success`，删除行用 `semantic-error`。未暂存块提供 **暂存块** 与 **丢弃块**；已暂存块只提供 **取消暂存块**。按块写入把该块的 unified-diff header 传给 `gitStage` / `gitUnstage` / `gitDiscard`。
- `untracked-text`：整文件视为新增；仅整文件操作。
- `binary` / `deleted-binary`：居中卡片「二进制文件有差异」；仅整文件操作。
- `deleted-text`：旧内容按删除行展示；仅整文件操作。

合并冲突文件按工作区变更处理，预览种类相同；面板没有 Accept Current、abort 或 continue。按块丢弃复用整文件丢弃对话框和该行 `kind` 文案。写响应替换列表；若选中路径仍在该段，则重读预览。

`apply` 经 `ctx.workspaces` 转发 `gitDiffPreview` 与可选 hunk header。本 occupant 不含 Git 操作守卫。

## 曾考虑的方案

**复用 `ui-primitives` 的 `DiffBlock`。** 否决：那是工具变更的旧/新对照卡片，带复制控件、路径头和 16 行上限。Git 面板差异块需要上下文行、按块操作，且不要折叠铬件。

**新增 DESIGN §5 差异块行原语。** 被 [Git 面板设计系统验收关闭](../process/2026-08-25-git-panel-design-system.md) 否决：行级差异用 `semantic-success` / `semantic-error` 加代码字体组合。

**从预览为绑定范围内路径打开编辑器标签页。** 被 US-22 / US-27 否决：差异预览不是编辑器标签页；绑定 Workspace 之外的路径不得在文件编辑器打开。

**把选中行放进槽位 store。** 否决：选中态不必在重新挂载后还在，也不按 Session 分区；隐藏 Git Tab 时 occupant 保持挂载。

## 后果

- [整文件暂存、丢弃与提交](2026-08-25-ui-git-panel-stage-commit.md) 仍拥有列表行整文件写入、草稿与 Explorer 徽章刷新；本笔记拥有预览、hunk header 与 Host 预览种类。
- Git 操作守卫仍属后续 git-panel 切片。
- `pnpm dsh web` 要看到预览栏，须重建 `ui-git` 的 client bundle。

## 测试

`packages/client/ui-git/tests/git-panel.client.spec.tsx` 用 Fake Host 的 `gitDiffPreview` / 按块写入驱动，断言仅面板内预览、同一路径两侧、已跟踪文本按块操作、未跟踪 / 二进制 / 删除正文、绑定范围外预览、合并冲突无合并控件、按块丢弃确认，以及被取代预览的中止。

`packages/client/ui-git/tests/apply.client.spec.ts` 经 inject face 转发 `gitDiffPreview` 与 hunk header。
