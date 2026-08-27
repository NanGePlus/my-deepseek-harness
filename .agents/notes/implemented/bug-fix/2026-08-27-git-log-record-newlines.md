# Agent Note: Git log format records include a trailing newline

Status: implemented

English | [中文](2026-08-27-git-log-record-newlines.zh.md)

## Problem

The Git panel Graph drew a new colored vertical for almost every commit, even on linear history. Merge nodes and cross-lane arcs never appeared. Users reported the Graph looking unchanged from the first stacked-dot drawing.

`git log --format=…` appends a newline after each record. Splitting only on the record separator left a leading `\n` on every hash after the first. Those hashes never equalled the parent pointers stored from `%P`, so the layout allocated a fresh lane per commit.

## Decision

`parseGitLogOutput` trims each record (and skips empty ones) before splitting fields. Parent hashes then match later `hash` values, so linear history stays on one trunk.

## Alternatives considered

**Drop the default newline by changing the git format string.** Rejected: Git still terminates each `--format` line, and a parser that accepts the bytes git actually emits is the smaller contract.

**Match parents by abbreviated `%h` / `%p`.** Rejected: abbreviations are not unique in a 50-commit window once the repo is large enough, and the Host type already promises full hashes.

## Consequences

A repository with only first-parent history renders one trunk. Colored arcs and hollow merge nodes appear only when a listed commit has more than one parent.

## Testing

`packages/host/apiproxy/tests/parse-git-log.spec.ts` feeds records joined by `\x1e\n` plus a trailing record separator and requires parent hashes to equal the next commit's `hash`.
