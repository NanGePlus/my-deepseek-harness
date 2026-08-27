# Agent Note: Git log format records include a trailing newline

Status: implemented

[English](2026-08-27-git-log-record-newlines.md) | 中文

## Problem

Git 面板 Graph 几乎给每条提交都新开一条彩色竖线，线性历史也一样。merge 空心点和跨泳道弧线从不出现。用户反馈 Graph 看起来仍像最初那叠圆点。

`git log --format=…` 会在每条记录后追加换行。只按记录分隔符切开时，从第二条起 hash 前面多了 `\n`。这些 hash 永远不等于 `%P` 写下的父提交指针，布局就给每条提交分配新泳道。

## Decision

`parseGitLogOutput` 在切字段前 trim 每条记录（并跳过空记录）。父提交 hash 才能对上下一条的 `hash`，线性历史留在一条主干上。

## Alternatives considered

**改 git format 字符串来去掉默认换行。** 否决：Git 仍会结束每一行 `--format` 输出；解析器接受 git 实际发出的字节，契约更小。

**用缩写 `%h` / `%p` 匹配父提交。** 否决：仓库稍大时，50 条窗口内缩写也不唯一；Host 类型已经承诺完整 hash。

## Consequences

只有第一父提交的仓库画一条主干。彩色弧线和空心 merge 点只在列表里出现多于一个父提交的 commit 时出现。

## Testing

`packages/host/apiproxy/tests/parse-git-log.spec.ts` 用 `\x1e\n` 拼接记录并带尾部分隔符，要求父提交 hash 等于下一条的 `hash`。
