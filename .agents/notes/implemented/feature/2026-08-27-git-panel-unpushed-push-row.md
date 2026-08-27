# Agent Note: Git panel unpushed copy and push row

Status: implemented

English | [中文](2026-08-27-git-panel-unpushed-push-row.zh.md)

## Problem

The Git panel put Git jargon (`领先 N` / `N ahead`) on the same line as **Commit to branch**. Ordinary users did not know that meant local commits were not on the remote. The standalone **Push** button sat in the commit toolbar, so the count and the action were not one control.

## Decision

When `pushAvailable` is true, a second line under the branch label shows plain-language copy plus **Push** (`host.gitPush`). Ahead of upstream uses 「有 {count} 个提交尚未推送」 / `{count} commits not pushed yet`. A branch that has never been pushed uses 「尚未推送到远程」 / `Not pushed to remote yet`. When `pushAvailable` is false, that whole line is omitted, including the button.

Push success and failure hints stay beside **Push** on that line. After a successful push the unpushed copy and button hide, but the success hint remains on the second line until it times out. The commit toolbar keeps **Commit** and commit / commit-and-push feedback only. **Push** Tooltip wraps `.pushButtonShell` rather than sitting inside it: that shell uses `isolation: isolate` for the pending border, which would otherwise trap the bubble under the commit-message field.

## Alternatives considered

**Keep `领先 N` and explain it in a tooltip.** Rejected: the on-screen label is what users read first, and the jargon still sits next to the branch name.

**Leave Push in the commit toolbar and only move the copy.** Rejected: the request is one row for the unpushed fact and the push action.

**Hide the second line whenever `ahead` is missing, including first-time push.** Rejected: Host reports first-time push as `pushAvailable` with no `ahead`; hiding that case would remove the only standalone push control.

## Consequences

The commit toolbar no longer hosts a standalone **Push**. First-time push still uses the second line with unpublished copy.

## Testing

`packages/client/ui-git/tests/git-panel.client.spec.tsx` asserts the ahead copy and **Push** share `data-git-push-row` below the branch label, unpublished copy for a never-pushed branch, and a clean tree with no unpushed row.

`packages/client/ui-git/tests/git-panel-icon-sizing.client.spec.ts` requires `.branchRow` to stack as a column and `.pushRow` to be a horizontal flex row.

`packages/client/ui-git/tests/icon-button-hover.client.spec.ts` requires the push Tooltip to wrap `.pushButtonShell` so the bubble can paint over the commit field.
