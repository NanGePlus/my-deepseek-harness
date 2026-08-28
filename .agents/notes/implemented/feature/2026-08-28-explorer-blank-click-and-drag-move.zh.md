# Agent Note：资源管理器空白选根与拖拽移动

Status: implemented

[English](2026-08-28-explorer-blank-click-and-drag-move.md) | 中文

## 问题

Web 文件树只列出 Workspace 子项，没有根行。选中某个文件或文件夹后，无法把工具栏新建的父目录恢复为 Workspace 根。`host.renamePath` 只改同一父目录下的基名，选中路径不能移入其他目录。

## 决策

点击文件树中不是 `treeitem` 或 `button` 的空白处会清空 `selectedPath`。`parentDirectoryForCreate` 在未选中时已经使用 Workspace 根，因此工具栏 **新建文件** / **新建文件夹** 落在根目录。工具栏标题不作为根行高亮。

`host.movePath({ workspaceId, path, destinationDirectory })` 把路径移入同一 Workspace 内已存在的目录，并保留基名。实现位于 `moveWorkspacePath`，与删除/重命名并列。不能移动 Workspace 根。目标必须已是目录。不能把目录移入自身或子孙。源已在目标目录时返回原路径、不调用 `rename`。同类型目标已存在以 `directory-exists` 失败；其他失败用 `path-move-failed`。越界与缺失路径复用 `workspace-path-out-of-bounds` / `path-not-found`。

文件树使用 HTML5 拖放。拖到目录行即移入该目录。拖到树空白处即移到 Workspace 根。拖到文件行、自身、当前父级或被拖目录的子孙则忽略，不调用 Host。同一窗口拖拽把源记在 `dragSourceRef`，因为 jsdom 的 `DataTransfer` 不可靠。`dragEnd` 设置 `suppressClickAfterDragRef`，避免 drop 后的那次 click 改选中。已打开 Tab 经现有 `onPathRenamed` 重映射路径。

同父级重命名、删除、右键菜单、选中文件夹后新建，仍走原来的接缝。

## 曾考虑的方案

**给 `host.renamePath` 增加目标目录。** 否决：同父级重命名校验的是单个新名；跨目录移动校验的是已存在目录，并禁止把目录树移入自身。一个方法会混进两套检查。

**客户端先复制再删除。** 否决：两次 Host 往返，且可能只完成一半。Host `rename` 是一次文件系统操作。

**在树里画一行 Workspace 根。** 否决：会改选中样式和空态 snapshot。空白点击清空 `selectedPath` 即可恢复根上新建，不必加根行。

**只靠 `DataTransfer` 携带拖拽载荷。** 否决：jsdom 不能可靠往返自定义 MIME；`dragSourceRef` 是同一窗口的真源。

## 后果

- 空白点击是把新建父目录恢复为 Workspace 根的唯一方式。
- 根上的文件再拖到空白处是空操作，因为它已在根下。
- Host 拥有移动；Client 先检查同级同名再调用 `movePath`。
- 同父级重命名仍是 `host.renamePath`。跨目录移动仍是 `host.movePath`。与 [Host 删除/重命名/创建](2026-08-21-host-delete-rename-path.md) 的分工写在该笔记里。

## 测试

`packages/client/ui-file-editor/tests/file-tree-parent.client.spec.ts` 覆盖拖放目标解析，包括文件/自身/父级/子孙/Workspace 外的忽略。

`packages/client/ui-file-editor/tests/editor-surface.client.spec.tsx` 覆盖空白点击恢复根上新建、拖到文件夹、拖到空白、忽略文件/自身、客户端同名冲突，以及 Host `directory-exists` / 通用移动失败。

`packages/host/apiproxy/tests/workspace-path-mutations.spec.ts` 与 `packages/host/apiproxy/tests/api-proxy-delete-rename-path.spec.ts` 覆盖 Host 移动成功、冲突、移入自身、中止与越界。

`packages/client/runtime/tests/workspaces-service.client.spec.ts` 覆盖 Client 对 `movePath` 的转发与错误映射。
