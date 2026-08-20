# Agent Note: Push and pull_request do not start GitHub Actions CI

Status: implemented

[English](2026-08-20-disable-push-pr-ci.md) | 中文

## Problem

本仓库是工作用 fork。每个分支 push 和 pull request 上的自动 CI 会排队上游 harness 矩阵（托管与自托管 runner、覆盖率、快照、打包、原生构建），这里没有这些检查的消费者，却会在每次提交上消耗 Actions 分钟数。

## Decision

`.github/workflows/` 下没有任何 workflow 由 `push` 或 `pull_request` 启动（含 `pull_request_review` 以及带 label 的 PR dry-run）。CI、e2e、sandbox、landlock-run、release pack、docs-pages、expected-filenames、issue-policy，以及 issue-lifecycle 的 PR 一半，改为手动 `workflow_dispatch`（以及已有 release workflow 调用处的 `workflow_call`）。issue-lifecycle 仍响应 `issues` 事件。真实 API 的 e2e workflow 仍保留夜间 `schedule`。

## Alternatives considered

- **在 GitHub 仓库设置里关闭 Actions。** 否决：该设置不在仓库树里，克隆或重置设置后会按 workflow 文件恢复自动 CI。
- **保留 `push`/`pull_request`，用 `if: false` 或仓库名守卫跳过 job。** 否决：GitHub 仍会为每个事件创建一次 workflow run；去掉触发器才能阻止 run。
- **让 issue-policy 和带 label 的 PR release dry-run 继续走 pull_request。** 否决：它们仍是 PR 活动上的 Actions run，与本决策排除范围冲突。

## Consequences

分支 push 和 pull request 不再产生 status check。若分支保护仍要求 `all checks passed` 或其他 workflow 名，须先去掉该规则才能合并。夜间 e2e 会继续跑，直到去掉 schedule，或因仓库不活跃被 GitHub 停掉。要重新打开自动 CI，把 `push` / `pull_request` 触发器加回对应 workflow 文件即可。
