# Agent Note: Git panel path writes do not disable Commit

Status: implemented

English | [中文](2026-08-27-git-panel-path-write-commit-flash.zh.md)

## Problem

Clicking **选入提交**, **移出提交**, or **撤销更改** made the **提交** (and **推送**) control flash. Those row writes set `pathWriting`, and `commitDisabled` / `pushDisabled` treated that as a reason to `disabled` the primary buttons. Disabled styling drops opacity to 0.4, so a fast Host round-trip looks like a blink.

## Decision

`commitDisabled` is `stagedEmpty || commitPending !== false || stagedDirty`. `pushDisabled` is `!pushAvailable || pushPending || commitPending !== false`. Path writes still set `busyPath` so the row shows a spinner and other row actions stay inactive. They do not disable Commit or Push.

## Alternatives considered

**Keep Commit disabled during path writes to avoid overlapping Host git RPCs.** Rejected for this surface: the flash is the user-visible cost of a lock that lasts tens of milliseconds, and commit-in-progress already allows staging.

**Disable without opacity change.** Rejected: a click that does nothing with no visual reason is worse than a concurrent RPC the Host can serialize or fail.

## Consequences

A click on Commit during an in-flight stage/unstage/discard can overlap that write. Row actions remain mutually exclusive via `pathWriting`.

## Testing

`packages/client/ui-git/tests/git-panel.client.spec.tsx` holds **提交** enabled while a delayed stage, unstage, or discard is in flight.
