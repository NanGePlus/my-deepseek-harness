---
name: tdd
description: 使用红-绿-重构（red-green-refactor）循环进行测试驱动开发。当用户希望使用 TDD 构建功能或修复 bug、提到“红-绿-重构”、TDD、希望编写集成测试，或要求测试优先开发时使用。
---

# 测试驱动开发（TDD）

## 核心理念

**核心原则**：测试应通过公共接口验证行为，而非验证实现细节。代码可以完全改变；但测试不应该因此而失败。

**好的测试**是集成风格的：它们通过公共 API 来执行真实的代码路径。它们描述系统**做什么**，而不是**如何做**。一个好的测试读起来就像一份规范 — “用户可以使用有效购物车结账”准确地告诉你存在什么能力。这类测试在重构后依然有效，因为它们不关心内部结构。

**不好的测试**与实现耦合。它们模拟内部协作对象、测试私有方法，或通过外部手段进行验证（例如直接查询数据库而不是使用接口）。警告信号是：当你重构时测试失败，但行为并没有改变。如果你重命名一个内部函数导致测试失败，这些测试就是在测试实现，而不是行为。

参见 [tests.md](tests.md) 获取示例，参见 [mocking.md](mocking.md) 获取模拟指南。

## 反模式：水平切片

**不要先编写所有测试，再编写所有实现。**这就是“水平切片” —— 把 RED 阶段当作“编写所有测试”，把 GREEN 阶段当作“编写所有代码”。

这会产生**糟糕的测试**：

- 批量编写的测试，测试的是**想象中**的行为，而不是**实际**的行为
- 你最终测试的是事物的**形态**（数据结构、函数签名），而不是面向用户的行为
- 测试对真实变化变得不敏感 —— 当行为被破坏时它们可能通过，当行为正常时它们可能失败
- 你的进度超出了你的“能见度”：在理解实现之前就锁死了测试结构

**正确的做法**：通过 tracer-bullet 实现垂直切片。一个测试 → 一个实现 → 重复循环。每个测试都基于你从上一个循环中学到的东西进行调整。因为你刚刚才写完代码，所以你确切地知道哪些行为是重要的，以及如何验证它们。

```
错误（水平切片）：
  RED:   test1, test2, test3, test4, test5
  GREEN: impl1, impl2, impl3, impl4, impl5

正确（垂直切片）：
  RED→GREEN: test1→impl1
  RED→GREEN: test2→impl2
  RED→GREEN: test3→impl3
  ...
```

## 工作流

### 1. 规划

在探索代码库时，使用项目的领域术语表，以便测试名称和接口词汇与项目的语言保持一致，并尊重你所涉及领域内的 ADR。

**先判定 Issue 类型**（再进入对应预检）：

| Issue 类型 | 识别 | 预检文档 |
|------------|------|----------|
| **UI 实现** | 含 `PRD 绑定` + `States 矩阵`（`headless` 除外） | [ui-issues.md](ui-issues.md) |
| **功能 / API / headless** | 含 `PRD 绑定` 且**无** `States 矩阵`，或 UI 模式 `headless` | [functional-issues.md](functional-issues.md) |

**共有门禁**：issue 非 `ready-for-agent` → **停止**，不要 `/tdd`。**依赖** 章节所列 Issue 未合并且未注明「已在主干合并」→ **停止**（详见各预检文档 § 依赖未完成时停止）。

**打开 PRD 必读（编码前强制 — 两类 issue 共有）**：

1. **取清单**：优先读 Issue 跟踪器上 **Agent 简报** 的「实现前必读」（`/triage` 从 issue 正文原样复制）；无简报时用 issue「PRD 绑定 › **PRD 必读**」编号清单。
2. **取 PRD 正文**：从 issue「PRD 绑定 › **父 PRD Issue**」拉取该 Issue **完整正文**（Issue 跟踪器 API / CLI / Web — 按项目 setup）。**禁止**只读 issue 摘要或 PRD 绑定字段代替打开 PRD。
3. **逐项定位**：按编号在 PRD / design 文件中打开对应段落 — UI 7 项见 [ui-issues.md](ui-issues.md) § 打开 PRD 必读；功能 3 项见 [functional-issues.md](functional-issues.md) § 打开 PRD 必读。
4. **预检通过条件**：勾选预检前，须能对每项 PRD 必读写出**一行摘要**（证明已打开而非扫过 issue 模板）。

**UI issue**（摘要）：完成 [ui-issues.md](ui-issues.md) 预检；缺 `DESIGN.md`、多端 `platforms.md`、mockup `references/` → 停止。**mockup-driven** 对齐 references 默认态 + States 矩阵；**spec-driven** 对齐父 PRD 页面清单 UI 设计描述（经 PRD 绑定）。预检读 PRD 必读 7 项；RED 循环按 States 矩阵 **PRD 来源** 精读（见 ui-issues § PRD 必读与 States 矩阵的分工）。

**功能 issue**（摘要）：完成 [functional-issues.md](functional-issues.md) 预检；按 issue **PRD 绑定 › PRD 必读** 打开 PRD 实现/测试决策子项；行为清单来自 issue **验收标准**；每条验收标准的 **PRD 依据**（若有）在 RED 前打开对应 PRD 段落。

**UI issue：测试 GREEN ≠ 设计验收通过。** 全部测试通过后，仍须按 [ui-issues.md](ui-issues.md) 填写 PR 的 UI 验收章节，并由 PR 评审者做设计 QA。

在编写任何代码之前：

- [ ] 完成上表对应预检清单
- [ ] **AFK（`ready-for-agent`）**：Issue **验收标准** 即计划批准 — 将每条映射为一个 RED→GREEN 循环，无需再向用户重复确认行为清单（仅当验收标准模糊或与 PRD 冲突时才暂停澄清）
- [ ] **交互式会话**：仍可与用户核对映射，但不得跳过 Issue 已写明的验收项
- [ ] 识别使用 [深模块](deep-modules.md) 机会（小接口、深实现）
- [ ] 为[可测试性](interface-design.md)设计接口
- [ ] 列出 RED→GREEN 顺序（UI：States 矩阵行序；功能：验收标准优先级 + 各条 **PRD 依据**）

**你无法测试所有东西。** AFK 下以 Issue 验收标准为上限；交互式下可与用户裁剪优先级，但须在 Issue 或 PR 中记录范围变更。

### 2. Tracer Bullet

编写一个测试，用于确认系统的**某一件事**：

```
RED: 为第一个行为编写测试 → 测试失败
GREEN: 编写最少的代码使其通过 → 测试通过
```

这就是你的 tracer-bullet —— 证明该路径端到端是可行的。

### 3. 增量循环

对于剩余的每个行为：

```
RED:   编写下一个测试 → 失败
GREEN: 编写最少的代码使其通过 → 通过
```

规则：

- 一次一个测试
- 只编写足够通过当前测试的代码
- 不要预判未来的测试
- 保持测试聚焦于可观察的行为
- **UI issue**：按 issue 正文 **States 矩阵** 逐 state 循环 RED→GREEN（先 `default`，再其余行）；测行为，不测像素（见 [ui-issues.md](ui-issues.md) § 测试策略）
- **功能 issue**：按 issue **验收标准** 逐条循环 RED→GREEN；每条 RED 前打开该条 **PRD 依据** 所指 PRD 段落（见 [functional-issues.md](functional-issues.md) § 验收标准 → PRD 依据）

### 4. 重构

在所有测试通过后，寻找[重构候选](refactoring.md)：

- [ ] 提取重复代码
- [ ] 深化模块（将复杂性隐藏在简单接口后面）
- [ ] 在自然的地方应用 SOLID 原则
- [ ] 思考新代码揭示了现有代码的什么问题
- [ ] 每个重构步骤后运行测试

对于 UI issue：注明 PR 的 UI 验收标准项（参见 [ui-issues.md](ui-issues.md)）；未经 Design Issue，不得修改 `DESIGN.md`。**重构完成后：测试全绿仍须过 PR 设计 QA，才算 UI issue 完成。**

**绝不在 RED 阶段重构。** 先让测试变 GREEN。

## 每个循环的检查清单

```
[ ] 测试描述的是行为，而非实现
[ ] 测试仅使用公共接口
[ ] 测试在内部重构后仍然有效
[ ] 代码对于此测试是最小化的
[ ] 没有添加推测性的功能
```
