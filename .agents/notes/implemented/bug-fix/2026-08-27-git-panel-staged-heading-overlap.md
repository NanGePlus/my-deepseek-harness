# Agent Note: Git panel staged heading follows unstaged content height

Status: implemented

English | [中文](2026-08-27-git-panel-staged-heading-overlap.zh.md)

## Problem

A long **Changed, not staged for commit** list painted over the **Ready to commit** heading. The staged file count still showed, so the heading looked stuck in the middle of unstaged rows.

## Decision

`.section` is `flex: none` and must not set `min-height: 0`. `.lists` stays the only scroller (`overflow: auto`). Unstaged rows keep their content height and the staged heading follows them.

## Alternatives considered

**Give each section `flex: 1; overflow: auto` so both headings stay on screen.** Rejected here: the product request is to push **Ready to commit** down. Independent panes would also need a sash; `min-height: 0` without overflow was what caused the overlap.

**`position: sticky` on the staged heading.** Rejected: that keeps the heading in the viewport while unstaged rows scroll under it, which is the reported overlap.

## Consequences

A long unstaged list can push the staged heading below the fold; the user scrolls `.lists` to reach it.

## Testing

`packages/client/ui-git/tests/git-panel-icon-sizing.client.spec.ts` requires `.section { flex: none }` and forbids `min-height` on that rule.
