---
name: triage
description: 通过由 triage 角色驱动的状态机对 issue 进行分拣。当用户希望创建 issue、分拣 issue、审查传入的 bug 或功能请求、为无人值守（AFK）Agent 准备 issue，或管理工作流时使用。
---


# 分拣（Triage）

通过一个由 triage 角色组成的小型状态机，在项目的 issue 跟踪器中移动 issue。

在分拣期间，发布到 issue 跟踪器的每条评论或 issue **必须**以以下免责声明开头：

```
> 此内容由 AI 在分拣期间生成。
```

## 参考文档

- [AGENT-BRIEF.md](AGENT-BRIEF.md) —— 如何编写持久的 Agent 简报
- [OUT-OF-SCOPE.md](OUT-OF-SCOPE.md) —— `.out-of-scope/` 知识库的工作方式
- [DESIGN-ISSUES.md](../to-issues/DESIGN-ISSUES.md) —— UI / Design issue 模板与门禁（`spec-driven` 或 `mockup-driven` 时；`headless` 不适用）

## 角色

两个**类别**角色（`spec-driven` 或 `mockup-driven` 时含第三个）：

- `bug` —— 有东西坏了
- `enhancement` —— 新功能或改进
- `design-input` —— Design issue；仅产出 `docs/design/`（当 `spec-driven` 或 `mockup-driven` 时）

五个**状态**角色：

- `needs-triage` —— 维护者需要评估
- `needs-info` —— 等待报告人提供更多信息
- `ready-for-agent` —— 规范完整，可供无人值守（AFK）Agent 接手
- `ready-for-human` —— 需要人工实现
- `wontfix` —— 不予处理

每个经过分拣的 issue 应恰好拥有一个类别角色和一个状态角色。Design issue 使用 `design-input` 作为类别角色。如果状态角色冲突，请标记出来，并在做任何其他操作之前询问维护者。

这些是规范的角色名称 —— issue 跟踪器中实际使用的标签字符串可能有所不同。映射关系应该已经提供给你 —— 如果没有，请运行 `/setup-skills`。

**`headless`** PRD / issue：**跳过**本节 UI 门禁与 `design-input` 类别。

若 issue 含 UI，先读 UI 模式：issue 正文「UI 模式」→ PRD 摘要 → `docs/design/DESIGN.md` 文首，再应用下面的 UI 门禁。

设计输入仅三类：`DESIGN.md`（有 UI）、`references/`（mockup-driven）、`platforms.md`（多端）。页面规格 SSOT 在 **PRD**；issue 用 **PRD 绑定** 路由 Agent。

### UI 实现 issues

适用范围：Issue 含 **PRD 绑定** 或 **UI 输入** 章节。在移至 `ready-for-agent` 前，核对 [DESIGN-ISSUES.md](../to-issues/DESIGN-ISSUES.md) **UI 实现 Issue** 模板：

**共有（spec-driven 与 mockup-driven）：**

- [ ] Issue 正文含 **PRD 绑定**（父 PRD Issue、page-id、**PRD 必读 7 项**、壳层关系、覆盖的用户故事 `US-n`）
- [ ] Issue 正文含 **States 矩阵**（每态一行：**PRD 来源**为可定位字符串 + 可观察预期）
- [ ] `DESIGN.md` 存在且已就绪
- [ ] Issue 正文 **验收标准** 分三类且非空：**功能**（可测试）、**UI 行为**（可测试）、**设计 QA**（mockup 须含默认态对齐项）

**spec-driven 追加：**

- [ ] PRD 绑定含 **布局 SSOT** 指向 PRD 页面清单该条「UI 设计描述」（Issue 内不重复全文）

**功能页追加（`page-id` ≠ `app-shell`）：**

- [ ] **依赖** 含同端 app-shell issue，或注明「app-shell 已在主干合并」+ PR 链接

**多端追加：**

- [ ] **`platform-id`** 在 `platforms.md` 平台清单中

**mockup-driven 追加：**

- [ ] PRD 绑定含稿面 / 变体 SSOT 与默认态 PNG 路径
- [ ] `references/{platform-id}-*`（或单端 `{page-id}.png`）默认态存在；PRD 标注的额外态 PNG 已提供（若有）

**spec-driven**：不检查 `references/`。**mockup-driven** 或设计输入 / PRD 绑定 / States 矩阵缺项 → `ready-for-human`；其余项齐 → `ready-for-agent`。

### 功能 / headless issues

适用范围：Issue 含 **PRD 绑定** 且**无** `States 矩阵`（或 UI 模式为 `headless`）。在移至 `ready-for-agent` 前核对：

- [ ] Issue 正文含 **PRD 绑定**（Seam、**PRD 必读 3 项**、覆盖的用户故事 `US-n`、接口 / 行为 SSOT）
- [ ] Issue 正文 **验收标准** 非空，且每条为可观察行为
- [ ] **依赖** 已满足或阻塞项写「无 — 可立即开始」

移至 `ready-for-agent` 时，Agent 简报须从 issue 正文 **PRD 必读** **原样复制**实现前必读（见 [AGENT-BRIEF.md](AGENT-BRIEF.md)），并含 PRD 绑定摘要。

### UI 实现 issues — Agent 简报

移至 `ready-for-agent` 时，Agent 简报须从 issue 正文 **PRD 必读** **原样复制**实现前必读，并含 [AGENT-BRIEF.md](AGENT-BRIEF.md) 中的 **PRD 绑定** 与 **设计参考** 章节 — **不要**在简报中补全或改写 PRD 必读项。

### Design Issues（`design-input`）

分层见 [DESIGN-ISSUES.md](../to-issues/DESIGN-ISSUES.md)：`#D-global`；**mockup-driven** 下追加**全部 UI 页**的 `#D-xxx`（依赖 `#D-global`）。

验收：`#D-global` 闭合 `DESIGN.md`（**多端时**含 `platforms.md`）；**mockup-driven** `#D-xxx` 含默认态 references 与人工评审。

状态转换：一个未标记的 issue 通常首先进入 `needs-triage`；从那里它可以移动到 `needs-info`、`ready-for-agent`、`ready-for-human` 或 `wontfix`。一旦报告人回复，`needs-info` 会返回到 `needs-triage`。维护者可以随时覆盖这些转换 —— 如果转换看起来不正常，请标记出来并在继续之前询问。

## 调用方式

维护者调用 `/triage` 并用自然语言描述他们想要做什么。解释该请求并采取行动。例如：

- “显示所有需要我关注的内容”
- “我们来看看 #42”
- “将 #42 移至 ready-for-agent”
- “有哪些是 Agent 可以接手的？”

## 显示需要关注的内容

查询 issue 跟踪器，分三个桶呈现，旧的在前：

1. **未标记** —— 从未分拣过。
2. **`needs-triage`** —— 评估进行中。
3. **自上次分拣备注后有报告人新活动的 `needs-info`** —— 需要重新评估。

显示每个 issue 的数量和一行摘要。让维护者选择。

## 对特定 issue 进行分拣

1. **收集上下文。** 阅读完整的 issue（正文、评论、标签、报告人、日期）。解析任何先前的分拣备注，以免重复询问已经解决的问题。使用项目的领域术语表探索代码库，尊重所涉及领域内的 ADR。阅读 `.out-of-scope/*.md`，并提出任何与当前 issue 相似的、先前被拒绝的情况。

2. **提出建议。** 向维护者告知你的类别角色和状态角色建议及理由，并附上与 issue 相关的简短代码库摘要。等待指示。

3. **复现（仅限 bug）。** 在任何深入追问之前，尝试复现：阅读报告人的复现步骤，跟踪相关代码，运行测试或命令。报告发生了什么 —— 成功复现并指出代码路径、复现失败，或细节不足（这是一个强烈的 `needs-info` 信号）。一个已确认的复现步骤会大大增强 Agent 简报的说服力。

4. **追问（如果需要）。** 如果 issue 需要充实细节，运行一次 `/grill-with-docs` 会话。

5. **应用结果：**
   - `ready-for-agent` —— 发布一条 Agent 简报评论（[AGENT-BRIEF.md](AGENT-BRIEF.md)）。
   - `ready-for-human` —— 结构与 Agent 简报相同，但需注明为什么不能委托给 Agent（需要判断、外部访问权限、设计决策、手动测试）。
   - `needs-info` —— 发布分拣备注（模板如下）。
   - `wontfix`（bug）—— 礼貌解释，然后关闭。
   - `wontfix`（enhancement）—— 写入 `.out-of-scope/`，在评论中链接到它，然后关闭（[OUT-OF-SCOPE.md](OUT-OF-SCOPE.md)）。
   - `needs-triage` —— 应用该角色。如有部分进展，可选择性添加评论。

## 快速状态覆盖

如果维护者说“将 #42 移至 ready-for-agent”，则相信他们并直接应用该角色。确认你将要执行的操作（角色变更、评论、关闭），然后执行。跳过追问环节。如果在没有进行追问会话的情况下移至 `ready-for-agent`，询问他们是否要编写 Agent 简报。

## Needs-info 模板

```markdown
## 分拣笔记

**到目前为止，我们已经确定：**

- 要点 1
- 要点 2

**我们仍然需要你（@报告人）提供：**

- 问题 1
- 问题 2
```

将在追问过程中解决的所有内容记录在“已确定”部分下，以免工作成果丢失。问题必须具体且可操作，而不是“请提供更多信息”。

## 恢复之前的会话

如果 issue 上存在先前的分拣备注，请阅读它们，检查报告人是否已回答任何未决问题，并在继续之前呈现更新后的情况。不要重复询问已经解决的问题。
