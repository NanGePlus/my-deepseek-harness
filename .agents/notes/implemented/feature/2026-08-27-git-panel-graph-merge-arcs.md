# Agent Note: Git panel graph merge arcs

Status: implemented

English | [中文](2026-08-27-git-panel-graph-merge-arcs.zh.md)

## Problem

The Graph section drew one vertical bar per lane and a circle on the commit row. Merge history looked like a stack of dots. Users expecting a GitLens-style graph could not see a first-parent trunk or a feature branch leaving that trunk and curving back.

## Decision

`layoutGitGraph` keeps the first parent on the current lane (the trunk). Extra parents occupy new lanes. A later commit whose first parent already sits on another lane curves back. Edges run from commit node to parent node across the whole list. `GitGraphSection` draws those edges in one overlay SVG: a vertical `L` on the trunk, a cubic `C` whose control points sit on the outer lane so the side-branch node stays on the arc. Each commit row's text gutter uses the rightmost node or stroke on that row, so a trunk-only tip does not reserve space for a later merge's side lane. A freed side lane reused by a later merge gets a new color. Commits with more than one parent use a hollow node and a center dot on the trunk. Remote refs keep the `origin/` prefix and render as an orange pill. `host.gitLog` lists commits with `--topo-order`. Parent-hash matching depends on stripping the newline Git appends after each `--format` record ([git log record newlines](../bug-fix/2026-08-27-git-log-record-newlines.md)).

## Alternatives considered

**Parse `git log --graph` ASCII.** Rejected: the drawing characters are not a stable layout API, and the panel would still have to map them onto pixels.

**Keep CSS vertical bars only.** Rejected: that presentation cannot show a branch leaving and rejoining the trunk.

**Draw one cubic per commit row.** Rejected: a 12px half-row curve looks like a kink; GitLens parentheses run from node center to parent node center.

**One text gutter sized to the page-wide max lane.** Rejected: trunk-only rows then sit far from their node whenever a later merge opens a side lane.

## Consequences

Graph still does not load a commit diff on click. Concurrent lanes stop at six; further parents reuse the last lane.

## Testing

`packages/client/ui-git/tests/git-graph-layout.client.spec.ts` asserts a diamond merge occupies lanes 0 then 1, sequential pull-request merges keep the trunk blue with rotating side colors, a two-commit side branch stays on one lane, cubics put control points on the outer lane, lane count caps at six, and a trunk tip above a merge uses a one-lane gutter.

`packages/client/ui-git/tests/git-panel.client.spec.tsx` mounts a merge `gitLog` result and asserts Graph contains a merge node and an SVG path with `C`; a tip-above-merge fixture asserts per-row gutter widths.
