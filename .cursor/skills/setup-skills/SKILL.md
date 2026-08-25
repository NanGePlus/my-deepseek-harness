---
name: setup-skills
description: 在 AGENTS.md/CLAUDE.md 与 docs/agents/ 中设置「## Agent skills」块，使工程 skills 知晓本仓库的 issue 跟踪器（GitHub 或本地 markdown）、triage 标签词汇、领域文档布局与 Repo Wiki 布局说明。在首次使用 grill-with-docs、to-prd、to-issues、tdd、improve-codebase-architecture、triage、diagnose、zoom-out 或 repo-wiki 前运行——或当这些 skills 似乎缺少 issue 跟踪器、triage 标签或领域文档上下文时。
---

# 设置 Skills

搭建工程 skills 假定的仓库配置：

- **Issue 跟踪器** — issue 所在处（默认 GitHub；开箱也支持本地 markdown）
- **Triage 标签** — 规范 triage 角色用的字符串
- **领域文档** — `CONTEXT.md`、`docs/adr/` 位置及读取规则
- **Repo Wiki** — `docs/repo-wiki/` 架构导读布局（供人阅读；workflow skills 不读）

这是 prompt 驱动的 skill，非确定性脚本。探索、呈现发现、与用户确认、然后写入。

## 流程

### 1. 探索

查看当前仓库以了解其初始状态。读取所有已存在的文件，不要做假设：

- `git remote -v` 和 `.git/config` — 这是一个 GitHub 仓库吗？是哪一个？
- 仓库根目录下的 `AGENTS.md` 和 `CLAUDE.md` — 这两个文件是否存在？若存在其内容是否已经有 `## Agent skills` 章节？
- 仓库根目录下的 `CONTEXT.md` — 该文件是否存在？
- `docs/adr/` 目录是否存在？
- `docs/agents/` 目录是否存在？
- `docs/repo-wiki/` — 是否已有 Repo Wiki？
- `docs/agents/wiki.md` — 是否已有 Wiki 布局与维护说明？
- `.scratch/` — 若存在，则表明已在使用本地 Markdown Issue 跟踪规范

### 2. 呈现发现并询问

总结当前存在的内容以及缺失的内容。然后逐一引导用户完成各项决策 — 呈现一个部分，获取用户的答案，然后继续下一部分。不要一次性抛出所有部分。

假设用户不知道这些术语的含义。每个部分以一个简短的解释性说明开头（解释这是什么、为什么这些 skills 需要它、以及不同选择会带来什么变化）。然后展示选项和默认值。

**A — Issue 跟踪器**

> 说明：「issue 跟踪器」是本仓库 issue 所在处。`to-prd`、`triage`、`to-issues`等 skills 从中读写—须知调用 `gh issue create` 或写 `.scratch/` 下的 Markdown 文件，也可以是遵循你描述的其他方式。选你实际跟踪本仓库工作的地方。

默认姿态：这些 skills 为 GitHub 设计。若 `git remote` 指向 GitHub，提议 GitHub。若指向 GitLab（`gitlab.com` 或自托管），提议 GitLab。否则（或用户偏好）提供：

- **GitHub** — issue 在仓库 GitHub Issues（用 `gh` CLI）
- **GitLab** — issue 在仓库 GitLab Issues（用 `[glab](https://gitlab.com/gitlab-org/cli)` CLI）
- **Local markdown** — issue 为本仓库 `.scratch/<feature>/` 下文件（适合无 remote 仓库）
- **Other**（如 Jira、Linear 等）— 请用户简要描述实际的 issue 跟踪工作流，skill 将按原文记录为一段说明

**B — Triage 分拣标签**

> 说明：当 `triage` skill 处理新提交的 issue 时将其移经一个状态机—待评估、等待报告人反馈、可由AFK Agent 接手、待人工处理、或不予处理。为此，它需要应用与你**实际已配置**的字符串相匹配的标签（或 Issue 跟踪器中对应的等效标签）。若仓库已用不同标签名（如 `bug:triage` 而非 `needs-triage`），在此映射以便 skill 应用正确标签而非创建重复。

五个**状态**角色标签：

- `needs-triage` — 待评估
- `needs-info` — 待报告人反馈
- `ready-for-agent` — 完全指派给 Agent，无需人工参与
- `ready-for-human` — 待人工处理
- `wontfix` — 不处理

默认：每角色字符串等于其名。问用户是否覆盖任何。若跟踪器无现有标签，默认即可。

**C — Domain 领域语言**

> 说明：部分 skills（`to-prd`、`diagnose`、`tdd`、`improve-codebase-architecture`）读 `CONTEXT.md` 学项目领域语言，`docs/adr/` 学过往架构决策。布局固定为根目录下一个 `CONTEXT.md` + `docs/adr/`。禁止自定义不同的路径或命名约定。

**D — Repo Wiki 代码导读**

> 说明：`docs/repo-wiki/` 是代码库架构导读 — 帮助**人**快速理解主链路与模块关系（带可点击的源码锚点）。Wiki **仅供人阅读**；workflow skills（`to-prd`、`tdd` 等）不读取 Wiki。布局固定为 `docs/repo-wiki/`，路径不可自定义。Wiki 内容由 `/repo-wiki` skill 生成；setup 只写入布局与维护说明。

问用户：

- **启用 Repo Wiki？** 默认：是
- 若启用：**默认语言**（`zh-CN` 或 `en`，默认 `zh-CN`）— 记录到 `docs/agents/wiki.md`，供后续 `/repo-wiki` 首次生成时使用

若用户选择不启用，仍写入 `docs/agents/wiki.md`，但在说明中注明 Wiki 未启用；不创建 `docs/repo-wiki/` 目录。

### 3. 确认并编辑

向用户展示草稿：

- 将加到正在编辑的 `CLAUDE.md` / `AGENTS.md` 的 `## Agent skills` 块（见步骤 4 选择规则）
- `docs/agents/issue-tracker.md`、`docs/agents/triage-labels.md`、`docs/agents/domain.md`、`docs/agents/wiki.md` 内容

让用户写入前编辑。

### 4. 写入

**选要编辑的文件：**

- 若存在 `CLAUDE.md`，编辑它。
- 否则若存在 `AGENTS.md`，编辑它。
- 若都不存在，问用户创建哪个——不要替他们选。

已有 `CLAUDE.md` 时不要创建 `AGENTS.md`（反之亦然）——始终编辑已有的。

若所选文件已有 `## Agent skills` 块，就地更新内容而非追加重复。不要覆盖用户对其他章节的编辑。

块：

```markdown
## Agent skills

### Issue 跟踪器

[issue 跟踪方式一行摘要]。见 `docs/agents/issue-tracker.md`。

### Triage 标签

[标签词汇一行摘要]。见 `docs/agents/triage-labels.md`。

### Domain 领域文档

根目录 `CONTEXT.md` + `docs/adr/`。见 `docs/agents/domain.md`。

### Repo Wiki（人类阅读）

`docs/repo-wiki/` 供人查阅；workflow skills 不读。见 `docs/agents/wiki.md`。
```

然后用本 skill 文件夹种子模板写 docs 文件：

- [issue-tracker-github.md](./issue-tracker-github.md) — GitHub issue 跟踪器
- [issue-tracker-gitlab.md](./issue-tracker-gitlab.md) — GitLab issue 跟踪器
- [issue-tracker-local.md](./issue-tracker-local.md) — 本地 markdown issue 跟踪器
- [triage-labels.md](./triage-labels.md) — 标签映射
- [domain.md](./domain.md) — 领域文档消费规则 + 布局
- [wiki.md](./wiki.md) — Repo Wiki 布局与维护说明（人类阅读）

「其他」跟踪器，根据用户描述从零写 `docs/agents/issue-tracker.md`。

写入 `docs/agents/wiki.md` 时，若用户在 D 项选择了默认语言，在文件末尾追加：

```markdown
## 本仓库配置

- Wiki 启用：是 | 否
- 默认语言：zh-CN | en
```

### 5. 完成

告诉用户设置完成，哪些工程 skills 现在将从 `docs/agents/*.md` 读取。说明可稍后直接编辑 `docs/agents/*.md` — 仅当要换 Issue 跟踪器或从头重来时才需重跑本 skill。

若用户在 D 项启用了 Repo Wiki 且 `docs/repo-wiki/` 尚不存在，建议下一步运行 `/repo-wiki` 生成首次架构导读。
