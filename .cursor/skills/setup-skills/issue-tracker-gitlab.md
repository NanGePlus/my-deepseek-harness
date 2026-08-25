# Issue 跟踪器：GitLab

本仓库的 issue 与 PRD 以 GitLab issue 形式存在。所有操作用 [`glab`](https://gitlab.com/gitlab-org/cli) CLI。

## 约定

- **创建 issue**：`glab issue create --title "..." --description "..."`。多行描述用 heredoc。传 `--description -` 打开编辑器。
- **读 issue**：`glab issue view <number> --comments`。机器可读输出用 `-F json`。
- **列出 issue**：`glab issue list -F json`，加适当 `--label` 过滤。
- **评论 issue**：`glab issue note <number> --message "..."`。GitLab 称评论为「notes」。
- **应用/移除标签**：`glab issue update <number> --label "..."` / `--unlabel "..."`。多标签可逗号分隔或重复标志。
- **关闭**：`glab issue close <number>`。`glab issue close` 不接受关闭评论，先用 `glab issue note <number> --message "..."` 发说明再关闭。
- **Merge requests**：GitLab 称 PR 为「merge requests」。用 `glab mr create`、`glab mr view`、`glab mr note` 等——与 `gh pr ...` 同形，用 `mr` 替 `pr`，`note`/`--message` 替 `comment`/`--body`。

从 `git remote -v` 推断仓库——在 clone 内运行 `glab` 会自动推断。

## 当 skill 说「发布到 issue 跟踪器」

创建 GitLab issue。

## 当 skill 说「获取相关工单」

运行 `glab issue view <number> --comments`。
