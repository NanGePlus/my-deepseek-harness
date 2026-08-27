# Issue 跟踪器：本地 Markdown

本仓库的 issue 与 PRD 以 `.scratch/` 下 markdown 文件形式存在。

## 约定

- 每功能一目录：`.scratch/<feature-id>/`
- PRD 为 `.scratch/<feature-id>/PRD.md`
- 实现 issue 为 `.scratch/<feature-id>/issues/<NN>-<短标识>.md`，从 `01` 编号
- 分拣状态记录为每 issue 文件顶部附近的 `Status:` 行（角色字符串见 `triage-labels.md`）
- 评论与对话历史追加到文件底部 `## Comments` 标题下

## 当 skill 说「发布到 issue 跟踪器」

在 `.scratch/<feature-id>/` 下创建新文件（必要时创建目录）。

## 当 skill 说「获取相关工单」

读引用路径的文件。用户通常直接传路径或 issue 编号。
