# Agent Note: Git panel add-remote entry

Status: implemented

English | [中文](2026-08-27-git-add-remote.zh.md)

## Problem

A newly initialized workspace has no remotes. **Commit & push** and **Push** fail with 「No remote repository is configured」, and the panel had no way to add a URL. The missing-remote copy change recorded that gap in [Git missing-remote push copy](../bug-fix/2026-08-27-git-missing-remote-push.md).

## Decision

`GitWorkingTreeResult` includes `hasRemote` from `git remote` (Host always sets it on repository results). When it is false, the line under the branch shows the missing-remote copy and **Add remote URL** instead of **Push**. Submitting runs `host.gitAddRemote({ workspaceId, url })`, which is `git remote add -- origin <url>` and returns the refreshed tree. The same **Add remote URL** control sits beside a missing-remote commit or push error so a failed push can open the editor even when the last tree read still reported a remote.

An empty trimmed URL fails with `git-failed` `empty remote url` before Git runs. A URL that still contains a NUL or CR/LF after trim uses the same token. When `origin` already exists, Git's own text rides `git-failed`. The RPC does not fetch, push, or rename remotes.

## Alternatives considered

**Prompt for a remote name.** Rejected: first-time publish in this panel already falls back to `origin` (`git push -u origin HEAD`). A name field would not match that fallback.

**`git remote set-url` when origin exists.** Rejected: changing an existing remote is a different product step; this entry is only for an empty `git remote` list.

**Disable Commit & push until a remote exists.** Already rejected in the missing-remote copy note; standalone **Commit** stays available.

## Consequences

Repositories that already have a remote other than `origin` do not show this entry. Push still uses `origin` when upstream is unset. The panel does not list or rename remotes. Removing `origin` is [Git panel remove-remote](2026-08-27-git-remove-remote.md).

## Testing

`packages/host/apiproxy/tests/api-proxy-git-write.spec.ts` adds origin, refuses empty/control URLs, refuses a second origin, reports `hasRemote` on inspect, and reports `pushAvailable` false when HEAD has no commits.

`packages/client/runtime/tests/workspaces-service.client.spec.ts` forwards `url` on the wire.

`packages/client/ui-git/tests/git-panel.client.spec.tsx` shows the entry when `hasRemote` is false, submits a URL, blocks a blank field, opens the editor from a push error, and maps Host failures onto the form.
