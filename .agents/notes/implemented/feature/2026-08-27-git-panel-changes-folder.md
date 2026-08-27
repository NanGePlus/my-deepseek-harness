# Agent Note: Git panel Changes folder

Status: implemented

English | [中文](2026-08-27-git-panel-changes-folder.zh.md)

## Problem

The Git ops column mixed working-tree chrome (branch, commit, unstaged/staged lists) with the commit Graph as one undifferentiated stack. Users could collapse the inner file lists or Graph, but could not hide the whole working-tree block the way a folder hides its children.

## Decision

The lists column has two sibling collapsible groups. **CHANGES** wraps the branch line, unpushed/push row, commit field, commit toolbar, write-error line, and the existing unstaged/staged sections without changing their handlers. The CHANGES title shows `unstaged.length + staged.length` on the right (including 0), using the same count chrome as GRAPH's loaded-commit count; a path in both lists counts twice, matching the inner section totals. **GRAPH** stays a sibling pinned at the bottom of the ops column: while Changes is open, Graph cannot scroll away and is capped at 48% height; collapsing Changes lets Graph take the remaining space. Both default expanded. Nested unstaged/staged headers still collapse their own rows. The whole Changes body (branch, commit chrome, and both file lists) and the Graph list (nodes, arcs, and commit rows) indent 14px under the folder titles. Folder titles are 13px, bold, uppercase; inner section titles stay 12px regular case.

## Alternatives considered

**Keep commit chrome pinned above the scroll column.** Rejected: the request wraps the whole working-tree block, including branch and commit, as one folder.

**One accordion that keeps only Changes or Graph open.** Rejected: both groups stay independently expandable.

**One shared scroll for Changes and Graph.** Rejected: a long unstaged list would push Graph off-screen; Graph stays pinned at the bottom while Changes is open.

## Consequences

When Changes is expanded, its body scrolls; Graph stays pinned at the bottom of the ops column and is not scrolled away. Inner unstaged/staged expand state resets if Changes unmounts its body.

## Testing

`packages/client/ui-git/tests/git-panel.client.spec.tsx` asserts Changes and Graph headers, collapses Changes (keyboard and click) while Graph remains, and checks uppercase folder titles, 14px Changes-body and Graph-list indent, Graph `max-height` while Changes is open, the CHANGES title count as unstaged plus staged (still visible when collapsed), and `0` on a clean tree.
