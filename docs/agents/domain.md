# 领域文档

工程 skills 探索代码库时应如何消费本仓库领域文档。

## 探索前先读这些

- 仓库根目录的 **`CONTEXT.md`**
- `docs/adr/**` — 读领域相关的 ADR

UI 模式三选一：`headless` | `spec-driven` | `mockup-driven`。判定顺序：PRD 末尾摘要「本计划 UI 模式」→ `docs/design/DESIGN.md` 文首 `> UI 模式：…`（与 `/to-prd`、`/to-issues`、`/triage` 一致）。

- **headless**：无可视化 UI — **跳过** `docs/design/` 门禁；不适用 Design Issue / UI issue 模板
- **spec-driven / mockup-driven**：若仓库包含 `docs/design/`，设计输入仅三类：
  - **DESIGN.md** — 有 UI 时必读
  - **references/** — mockup-driven 时必读默认态 PNG
  - **platforms.md** — 多端时必读
  - 页面规格 SSOT 在 **PRD**；issue 用 **PRD 绑定** + **States 矩阵** 路由 Agent
  - **spec-driven**：`DESIGN.md` + 父 PRD 页面清单该条 + issue PRD 绑定 → 可 `ready-for-agent`；**不检查** `references/`
  - **mockup-driven**：上列 + 默认态 references 就绪 → 可 `ready-for-agent`

如果这些文件中的任何一个不存在，**静默继续**。不要指出它们缺失，也不要建议提前创建它们。生产者 skill（`/grill-with-docs`）会在术语或决策实际确定时，再按需创建它们。

## 文件结构

```
/
├── CONTEXT.md
├── docs/
│   ├── adr/
│   │   ├── 0001-event-sourced-orders.md
│   │   └── 0002-postgres-for-write-model.md
│   └── design/                    ← 若启用设计治理（精简）
│       ├── DESIGN.md              ← 有 UI 时
│       ├── platforms.md           ← 多端时
│       └── references/            ← mockup-driven 时
└── src/
```

## 使用词汇表词汇

当你的输出中提及某个领域概念时（无论是在 issue 标题、重构提案、假设还是测试名称中），请使用 `CONTEXT.md` 中定义的术语。不要偏离到术语表中明确避免使用的同义词上。

如果你需要的概念尚未出现在术语表中，这本身就是一个信号 —— 要么你正在创造项目不使用的语言（请重新考虑），要么确实存在一个缺口（请记录下来，供 `/grill-with-docs` 使用）。

## 标记 ADR 冲突

如果你的输出与现有 ADR 存在冲突，请明确指出来，而不是静默地覆盖：

> *与 ADR-0007（event-sourced orders）矛盾——但值得重开因为…*
