# Agent Note: Push and pull_request do not start GitHub Actions CI

Status: implemented

English | [中文](2026-08-20-disable-push-pr-ci.zh.md)

## Problem

This repository is a working fork. Automatic CI on every branch push and pull request queues the upstream harness matrix (hosted and self-hosted runners, coverage, snapshots, pack, native builds) with no consumers for those checks here, and it spends Actions minutes on every commit.

## Decision

No workflow under `.github/workflows/` starts on `push` or `pull_request` (including `pull_request_review` and labeled-PR dry runs). CI, e2e, sandbox, landlock-run, release pack, docs-pages, expected-filenames, issue-policy, and the PR half of issue-lifecycle are manual `workflow_dispatch` (and `workflow_call` where a release workflow already called them). Issue-lifecycle still runs on `issues` events. The real-API e2e workflow still has its nightly `schedule`.

## Alternatives considered

- **Disable Actions in GitHub repository settings.** Rejected: that setting is not in the tree, so a clone or a settings reset would restore automatic CI from the workflow files.
- **Keep `push`/`pull_request` and skip jobs with `if: false` or a repository-name guard.** Rejected: GitHub still creates a workflow run for every event; removing the triggers is what prevents the run.
- **Leave issue-policy and labeled-PR release dry runs on pull_request.** Rejected: those are still Actions runs on PR activity, which this decision excludes.

## Consequences

Branch pushes and pull requests do not produce status checks. If a branch-protection rule still requires `all checks passed` or another workflow name, the PR cannot merge until that rule is removed. Nightly e2e still runs until the schedule is dropped or GitHub disables it after inactivity. Re-enabling automatic CI is adding the `push` / `pull_request` triggers back to the owning workflow files.
