---
name: to-issues
description: 采用 tracer-bullet 垂直切片的方式，将一个计划、规范或 PRD 分解为项目 Issue 跟踪器中可独立领取的 issue。当用户希望将计划转化为 issue、创建实现工单或把工作拆解成多个 issue 时使用。
---

# 拆分为 Issue

使用垂直切片（tracer-bullet）将一个计划分解为可独立领取的 issue。

Issue 跟踪器和 triage 标签词汇表已经提供给你了 — 如果没有，请先运行 `/setup-skills`。

## 设计输入

`docs/design/` 最多三类（按条件启用）：

| 条件 | 文件 | 职责 |
|------|------|------|
| 有 UI（非 headless） | `DESIGN.md` | 品牌视觉：Token、气质、§5 通用 UI 原语、§6 宜忌 |
| mockup-driven | `references/{platform-id}-{page-id}.png` | 功能页面默认态设计稿 |
| 多端 | `platforms.md` | `platform-id` 平台清单 + 各端组件库映射 |

页面布局与状态策略 → **PRD**；交互验收 → **Issue 验收标准**（功能 / UI 行为 / 设计 QA）。

## 流程

### 1. 收集上下文

基于对话上下文中已有的信息开展工作。如果用户传递了一个 issue 引用（编号、URL 或文件路径）作为参数，请从 Issue 跟踪器中获取该 issue，并阅读其完整正文和评论。

**解析 PRD 章节**：

- **UI 模式**（三选一）：优先读 PRD 末尾摘要「本计划 UI 模式」→ 其次 `docs/design/DESIGN.md` 文首 `> UI 模式：…`
- **是否多端**：PRD 页面清单 / 映射表是否涉及多个端或运行环境
- **实现决策 / 测试决策**：提取测试 seams — 垂直切片应沿 seams 切，而非重新发明
- **非 headless 时**必读 PRD 的：
  - `用户故事 ↔ 页面映射` 表
  - `页面清单`（每页主任务、覆盖故事 `US-n`、DESIGN 复用、模式专属规格/PNG）
  - `状态策略` 与 PRD 末尾 spec/mockup 统计

**文档路由**：

- `CONTEXT.md` — 领域词汇表
- `docs/adr/` — 架构与技术栈决策
- `docs/design/DESIGN.md` — 非 headless 时读 §5/§6

当 **PRD UI 模式为 `spec-driven` 或 `mockup-driven`** 时，阅读 [DESIGN-ISSUES.md](./DESIGN-ISSUES.md)，并将 Design Issues 与功能切片一并拆分。

**PRD 缺口检查**（非 headless，读完 PRD 全文后立刻执行）：

核对父 PRD 是否含 **`### 状态策略`**（见 [prd-template.md](../to-prd/prd-template.md) § 状态策略 — `/to-prd` 非 headless 时**必填**）：

| 情况 | 处理 |
|------|------|
| **有** `### 状态策略` | UI issue「PRD 必读」第 2 项写标准项：`父 PRD Issue — PRD「状态策略」章节`（与 [tdd/ui-issues.md](../tdd/ui-issues.md) § 预检 PRD 必读项 一致） |
| **无** `### 状态策略` | 在拆解方案中列为 **PRD 缺口**；**建议**先补 PRD（`/to-prd` 或向父 PRD Issue 追加该章节）再继续 |
| 缺口未补且须继续起草 | UI issue **不得**标 `ready-for-agent`（标 `ready-for-human`）；**不要**擅自改写 PRD 必读第 2 项为「替代路由」— 该写法与 `/tdd` 打开规则（`PRD 正文 ### 状态策略`）不一致，会导致 Agent 预检失败 |

缺口未补时，States 矩阵中 loading / 全局态行的 **PRD 来源** 仍须写可定位字符串（如 `PRD 页面清单 §{page-id} 变体段「…」`、`DESIGN.md §5 …`），但**不能**代替缺失的 `### 状态策略` 章节。

### 2. 探索代码库

如果你尚未探索代码库，请现在进行，以了解代码的当前状态。Issue 标题和描述应使用 `CONTEXT.md` 词汇，并尊重 ADR。

### 3. 起草垂直切片

将计划拆解为 **tracer-bullet** 式的 issue。每个 issue 都是一个细粒度的垂直切片，端到端地贯穿所有集成层，而不是单一层级的水平切片。

切片可以是「HITL」或「AFK」类型。HITL 切片需要人工交互，例如架构决策或设计评审。AFK 切片可以在无需人工交互的情况下实现并合并。在可能的情况下，优先选择 AFK 而非 HITL。

#### headless 分支

```
UI 模式 == headless ?
├─ 是 → 跳过 Design Issues 与 UI 输入模板；仅按用户故事 + 实现/测试决策拆 API / schema / CLI 垂直切片
└─ 否 → 进入 spec-driven / mockup-driven 流程
```

**headless** 切片展示字段：**PRD 绑定**（Seam、实现/测试决策子项、覆盖 `US-n`）、依赖 — **不含** page-id、States 矩阵、设计依赖。

**功能 / headless 切片**（API / schema / CLI / 领域 seam）同样须写 **PRD 绑定** 与 **PRD 必读**（3 项，见下方模板），路由至 PRD「实现决策」「测试决策」本子项，**不**抄契约全文。

#### spec-driven / mockup-driven：以 PRD 页面清单为 SSOT

**不再重新拆解 UI 页** — 以 PRD 映射表 + 页面清单为权威来源，to-issues 只做命名映射与切片编排。

**命名映射**：

| PRD 字段 | Issue 字段 | 规则 |
|----------|-----------|------|
| 端 / 运行环境 | `platform-id` | **多端时**须在 `platforms.md` 清单中；单端可省略 platform-id 或写 `default` |
| `page-id` | `page-id` | kebab-case，与 PRD 页面清单、`references/{platform-id}-{page-id}.png` 一致 |
| DESIGN 复用 | DESIGN §5 原语 | 「待扩展 DESIGN §5」须标注为 `#D-global` 或 HITL 阻塞项 |

**Design Issues 推导**（详见 [DESIGN-ISSUES.md](./DESIGN-ISSUES.md)）：

| Design Issue | 触发条件 | 产出 |
|--------------|----------|------|
| `#D-global` | 非 headless | 验收/建立 `DESIGN.md`；**多端时**含 `platforms.md` |
| `#D-xxx` | **仅 mockup-driven** | PRD 页面清单该页默认态 PNG；**一页一 `#D-xxx`** |

- `#D-global`：**验收关闭** grill 已建的 `docs/design/`（补缺口、核对清单）— **非重写**；grill 未建时才从零充实
- API / 后端切片可与 `#D-global` 并行
- `#D-global` → 初始 `ready-for-agent`
- **mockup-driven** 任一页缺 `references/{platform-id}-*` → UI issue `ready-for-human`；设计输入齐 → `ready-for-agent`

**状态范围**（对齐 PRD「状态策略」）：

| 模式 | UI issue 逻辑态范围 | mockup PNG 范围 |
|------|---------------------|-----------------|
| spec-driven | PRD 页面清单该页「各状态行为」或「复用 DESIGN §5 ___」 | 不要求 PNG |
| mockup-driven | 仍须实现全部逻辑态（Loading / Empty / Error…） | **仅** PRD 列出的默认态 + 「须单独出稿的其他态」 |

- 正文须写 **page-id**、**PRD 绑定**（含 **PRD 必读** 7 项编号清单，定位 Agent 必读 PRD / design 段落，**不**抄 UI 设计描述全文）与 **States 矩阵**（每态一行；**PRD 来源**列须为可定位字符串）
- 一个 UI issue = 一个 `page-id`（× `platform-id` 若多端）的完整逻辑态；不要只交付 happy path
- 仅当用户明确批准拆分时，才将 states 分到多个连续 issue；须在拆解方案中标注

**app-shell 依赖**（功能页 UI 切片）：

- 同端功能页 UI issue **必须依赖** 该端 `app-shell` UI issue（或依赖项注明「app-shell 已在主干合并」并链到合并 PR）
- `app-shell` UI issue 仅依赖 `#D-global`（及 mockup 下对应 `#D-{platform-id}-app-shell`）；不依赖功能页
- 发布顺序：`app-shell` issue 排在同端功能页之前，以便在「依赖」字段引用真实 issue 标识符

**PRD 绑定（非全文复制）**：UI 切片用 **PRD 绑定**（含 **PRD 必读** 7 项）把 Agent 路由到父 PRD 的正确段落；功能切片用 **PRD 绑定**（含 **PRD 必读** 3 项）路由至实现/测试决策子项。Issue **不**重复 PRD 全文；验收标准须从 PRD 反向生成（见下方「验收标准」）。`DESIGN.md` 就绪 + PRD 绑定 / PRD 必读完整 + States 矩阵非空（UI）+ 验收标准含可测试项后，issue 可 `ready-for-agent`。

**States 矩阵「PRD 来源」列格式**（须为可定位字符串，`/tdd` 按列直接打开 PRD 对应段落）：

| 场景 | 格式示例 |
|------|----------|
| 默认态 | `PRD 页面清单 §{page-id}「UI 设计描述」` |
| 变体态 | `PRD 页面清单 §{page-id} 变体段「{变体名}」`（如「空状态变体」「错误变体」） |
| 复用 DESIGN | `DESIGN.md §5 {原语名}`（须与页面清单「DESIGN 复用」列一致） |
| 全局状态策略 | `PRD「状态策略」+ PRD 页面清单 §{page-id}` |

**拆分前自检**（对照 PRD 映射表规则）：

- [ ] 无孤立故事（有 UI 的用户故事未映射到任何页）
- [ ] 无孤立页面（页面没有任何用户故事支撑）
- [ ] **spec-driven**：每页 PRD 绑定含 **PRD 必读** 7 项 + 布局 SSOT 指向 PRD 页面清单；全文无 PNG / 设计稿要求
- [ ] **UI issue**：「PRD 必读」7 项完整（对照 [tdd/ui-issues.md](../tdd/ui-issues.md) § 预检 PRD 必读项）；`page-id` = `app-shell` 时第 4 项写 `N/A`
- [ ] **UI issue**：States 矩阵「PRD 来源」列均为可定位字符串（含 `§{page-id}` 或 `DESIGN.md §5`）
- [ ] **非 headless**：父 PRD 含 **`### 状态策略`**；若无 → UI issue 不得 `ready-for-agent`，须在拆解方案标注 PRD 缺口
- [ ] **功能 / headless issue**：「PRD 绑定」含 Seam、实现决策子项、测试决策子项、覆盖 `US-n`
- [ ] **功能 issue**：「PRD 必读」3 项完整（对照 [tdd/functional-issues.md](../tdd/functional-issues.md) § 预检 PRD 必读项）
- [ ] **功能 issue**：每条验收标准含 **PRD 依据**（`PRD 实现决策 › {定位词}` / `PRD 测试决策 › {定位词}` / `用户故事 US-n`；对照 [tdd/functional-issues.md](../tdd/functional-issues.md) § 验收标准 → PRD 依据）
- [ ] 功能页 issue 已标注 app-shell 依赖（或主干已合并说明）
- [ ] 每页 UI issue 含 States 矩阵（每态一行可观察预期）
- [ ] **mockup-driven**：每页默认态 PNG 有路径或「待 #D-xxx」；无 PRD 替代稿面的布局描述

<vertical-slice-rules>
- 每个切片都交付一条狭窄但完整的路径，贯穿每一个层级（schema、API、UI、测试）
- 一个完成的切片本身是可演示或可验证的
- 优先采用多个薄切片，而不是少数厚切片
- 不要拆分为「先设计所有页面，再实现所有页面」
</vertical-slice-rules>

### 4. 向用户提问

将提议的拆解方案以编号列表的形式呈现。对于每个切片，展示：

- **标题**：简短的描述性名称
- **类型**：HITL / AFK（Design Issues 使用 `design-input`）
- **依赖**：必须优先完成的其他切片（如有）
- **覆盖的用户故事**：此切片解决了哪些用户故事
- **设计依赖**（UI 切片）：`DESIGN.md` / `platforms.md`（若多端）/ `#D-xxx`（若 mockup）
- **PRD 绑定**（UI 切片）：PRD 必读 7 项 + 壳层关系（不抄全文）
- **PRD 绑定**（功能 / headless 切片）：Seam + PRD 必读 3 项（实现/测试决策子项）
- **States 矩阵**（UI 切片）：每态一行；PRD 来源为可定位字符串
- **验收标准预览**：UI 切片 — 功能 / UI 行为 / 设计 QA 三类；功能 / headless 切片 — 每条含 **PRD 依据**

向用户提问：

- 粒度是否合适？（太粗 / 太细）
- 依赖关系是否正确？
- 是否有任何切片需要合并或进一步拆分？
- HITL 和 AFK 的标记是否正确？
- PRD 页面清单 → issue 切片映射是否正确？（`page-id` / `platform-id` / 故事 `US-n`）
- **headless** 时：确认无 UI 切片遗漏
- **状态范围**：是否与 PRD 状态策略一致（尤其 mockup 下哪些态需额外 PNG）
- 「待扩展 DESIGN §5」项是否已安排 `#D-global` 或 HITL
- Design Issues 和 UI 依赖是否正确？
- **app-shell 依赖**：同端功能页是否均依赖 app-shell issue（或注明已合并）？
- **PRD 必读**：Agent 能否仅凭 issue 内编号清单（UI 7 项 / 功能 3 项）找到 PRD 中全部相关规格（无需 Issue 内重复全文）？
- **States 矩阵与验收**：每态是否有可观察预期？验收标准是否覆盖 PRD 用户故事与 states？
- **功能 issue PRD 依据**：每条验收标准是否含可唯一定位的 PRD 依据？定位词是否与 PRD「实现决策」「测试决策」子项一致？

持续迭代，直到用户批准该拆解方案。

#### 验收标准生成（功能 / headless 切片）

从 PRD 反向提炼，写入 issue **验收标准** — **不**把 PRD 契约全文抄进 Issue。每条须为可观察行为，并带 **PRD 依据**（供 `/tdd` 每个 RED 循环打开 PRD 段落；与 UI issue 的 States 矩阵 **PRD 来源** 列对称）：

| PRD 依据 | 含义 | 何时引用 |
|----------|------|----------|
| `PRD 实现决策 › {定位词}` | 接口 / schema / 领域契约 | 断言请求 / 响应形状、领域不变量 |
| `PRD 测试决策 › {定位词}` | 可观测外部行为 | 断言状态码、错误码、CLI 输出等 |
| `用户故事 US-n` | 用户可见行为 | 主路径或故事级验收 |

**定位词**须与 issue「PRD 必读」第 1–2 项及 PRD 正文子项**完全一致**；PRD 中找不到唯一条目 → 回到 `/to-prd` 补子标题或修正定位词，不要猜。

**示例**（格式见 [tdd/functional-issues.md](../tdd/functional-issues.md) § 验收标准 → PRD 依据）：

```markdown
## 验收标准

- [ ] 有效 payload 创建预约并返回 201 + booking id（PRD 依据：`PRD 实现决策 › POST /bookings`；`PRD 测试决策 › HTTP 集成 seam / 201 响应形状`；`用户故事 US-1`）
- [ ] 重复提交同一时段返回 409（PRD 依据：`PRD 测试决策 › 冲突与 409`；`用户故事 US-2`）
```

#### 验收标准生成（UI 切片）

从 PRD 反向提炼，写入 issue **验收标准**，分三类 — **不**把 PRD UI 设计描述抄进 Issue：

| 类别 | 来源 | 谁验证 |
|------|------|--------|
| **功能** | 覆盖的用户故事 `US-n` + PRD 主路径 | CI / TDD |
| **UI 行为** | States 矩阵各态「可观察预期」 | CI / TDD |
| **设计 QA** | spec：PRD 描述 + DESIGN 气质；mockup：references 默认态对齐 | PR 人工 |

每条验收标准应可独立验证，并能在 PR 中对照 PRD 段落说明依据。

### 5. 将 issue 发布到 Issue 跟踪器

对于每个已批准的切片，向 Issue 跟踪器发布一个新 issue。

- **功能 / headless 切片**：使用下方 **功能 / headless 切片** 模板发布。
- **UI 切片**：使用下方 **UI 切片** 模板发布。
- **Design Issues**：使用 [DESIGN-ISSUES.md](./DESIGN-ISSUES.md) 中的模板发布。应用类别标签 `design-input`。

如果 AFK 就绪，则标记 `ready-for-agent`；否则标记正确的状态标签。

按依赖顺序发布 issue（被依赖的在前），这样你就可以在「依赖」字段中引用真实的 issue 标识符。

<functional-issue-template>

## 父 Issue

对 Issue 跟踪器中父 issue 的引用（如果源材料是一个已有 issue，则包含此章节；否则省略）。

## 构建内容

对此垂直切片的简洁描述。描述端到端的行为，而不是逐层的实现细节。

避免使用具体的文件路径或代码片段 — 它们很快就会过时。

## UI 模式

`headless`（纯 API / CLI / schema 切片亦写 `headless` 或省略 UI 章节）

## PRD 绑定（功能 / headless 切片必填）

Issue 不重复 PRD 决策全文 — 本节把 Agent **路由**到父 PRD 的正确段落。

- **父 PRD Issue：** #___
- **Seam：** ___（如 `POST /bookings` HTTP API、CLI `booking create`、schema 迁移 `bookings` 表）
- **覆盖的用户故事：** ___（`US-n` 格式，如 `US-1~US-3`）
- **PRD 必读：**（编码前强制完成；`/triage` 与 `/tdd` 按此清单逐项打开，**不**在简报内重复）
  1. 父 PRD Issue — PRD「实现决策」：**___**（本子项定位词，如「API 预约契约 / POST /bookings」）
  2. 父 PRD Issue — PRD「测试决策」：**___**（本子项定位词，如「HTTP 集成测试 seam / 状态码与响应形状」）
  3. 父 PRD Issue — 用户故事 `US-___`（本 issue 覆盖的编号）
- **接口 SSOT：** PRD「实现决策」上述子项 + `docs/adr/`（不在 Issue 内重复契约全文）
- **行为 SSOT：** issue 验收标准 + PRD「测试决策」上述子项

## 验收标准

每条为可观察行为，须含 **PRD 依据**（括号内；`/tdd` 每个 RED 循环按依据打开 PRD 段落）。定位词与上方「PRD 必读」第 1–2 项及 PRD 正文子项一致。

- [ ] ___（PRD 依据：`PRD 实现决策 › ___`；`PRD 测试决策 › ___`；`用户故事 US-___` — 每条至少一个 RED→GREEN 循环）
- [ ] ___（PRD 依据：`PRD 测试决策 › ___`；`用户故事 US-___`）

**示例**：

- [ ] 有效 payload 创建预约并返回 201 + booking id（PRD 依据：`PRD 实现决策 › POST /bookings`；`PRD 测试决策 › HTTP 集成 seam / 201 响应形状`；`用户故事 US-1`）
- [ ] 重复提交同一时段返回 409（PRD 依据：`PRD 测试决策 › 冲突与 409`；`用户故事 US-2`）

## 依赖

- ___

## 阻塞项

- 对阻塞项的引用（如有）

如果没有阻塞项，则写「无 — 可立即开始」。

</functional-issue-template>

<ui-issue-template>

## 父 Issue

对 Issue 跟踪器中父 issue 的引用（如果源材料是一个已有 issue，则包含此章节；否则省略）。

## 构建内容

对此垂直切片的简洁描述。描述端到端的行为，而不是逐层的实现细节。

避免使用具体的文件路径或代码片段 — 它们很快就会过时。

## UI 模式

`spec-driven` | `mockup-driven`（从 PRD 摘要读取）

## PRD 绑定（UI 切片必填）

Issue 不重复 PRD UI 章节全文 — 本节把 Agent **路由**到父 PRD 的正确段落。

- **父 PRD Issue：** #___
- **page-id：** ___
- **覆盖的用户故事：** ___（`US-n` 格式，如 `US-1~US-3`）
- **PRD 必读：**（编码前强制完成；`/triage` 与 `/tdd` 按此清单逐项打开，**不**在简报内重复）
  1. 父 PRD Issue #___ — PRD「页面清单」中 `{page-id}` 条目**全文**
  2. 父 PRD Issue — PRD「状态策略」章节
  3. 父 PRD Issue — 用户故事 `US-___`（本 issue 覆盖的编号）
  4. （`page-id` ≠ `app-shell`）同端 PRD「页面清单」中 `{platform-id}` **`app-shell`** 条目 + 壳层变体规则（本页即 app-shell 写 `N/A`）
  5. `docs/design/DESIGN.md` — 页面清单该页「DESIGN 复用」列引用的 §5 原语 + §6 宜忌
  6. （**多端**）`docs/design/platforms.md` — `{platform-id}` 段落（单端写 `N/A`）
  7. （**mockup-driven**）`docs/design/references/{platform-id}-{page-id}.png` 默认态（spec-driven 写 `N/A`）
- **壳层关系：** ___（例：继承 `{platform-id}` app-shell，隐藏底栏 Tab；或「—（本页即 app-shell）」；或「脱离 app-shell，全屏独立页」）
- **spec-driven — 布局 SSOT：** PRD 页面清单该条「UI 设计描述」（不在 Issue 内重复）
- **mockup-driven — 稿面 SSOT：** `references/{platform-id}-{page-id}.png`（spec-driven 写 `N/A`）
- **mockup-driven — 变体 SSOT：** PRD 该条变体段 + DESIGN.md §5（spec-driven 写 `N/A`）
- **mockup-driven — 默认态 PNG：** ___（路径或「待 #D-xxx」；spec-driven 写 `N/A`）
- **mockup-driven — 须单独出稿的其他态：** ___（无则写「其余复用 DESIGN §5」；spec-driven 写 `N/A`）

## States 矩阵

从 PRD 页面清单 + 状态策略提炼；每态一行，供 TDD 与验收对照。**PRD 来源**列须为可定位字符串（见上文格式表）。

| state | PRD 来源 | 可观察预期 |
|-------|---------|-----------|
| default | PRD 页面清单 §{page-id}「UI 设计描述」 | ___ |
| empty | PRD 页面清单 §{page-id} 变体段「空状态变体」 | ___ |
| loading | PRD「状态策略」+ DESIGN.md §5 Loading / 骨架屏 | ___ |

## UI 输入（当切片包含 UI 时）

- **platform-id：** `___`（**多端时**必填，须在 `platforms.md` 清单中；单端可写 `default` 或省略）
- **page-id：** `___`
- [ ] docs/design/DESIGN.md 已就绪
- [ ] （**多端**）docs/design/platforms.md 中该 platform-id 段落已就绪
- [ ] （**mockup-driven**）docs/design/references/{platform-id}-___

## 参考资料（UI 切片）

- 视觉身份：docs/design/DESIGN.md
- 平台：（**多端时**）docs/design/platforms.md（platform-id: ___）
- 视觉稿：（**mockup-driven**）docs/design/references/___

按页面类型的最小引用见 [DESIGN-ISSUES.md](./DESIGN-ISSUES.md)。

## 验收标准

### 功能（可测试 — CI / TDD）

- [ ] ___（来自用户故事 `US-___`：可观察行为）

### UI 行为（可测试 — CI / TDD）

- [ ] ___（来自 States 矩阵 state「___」：可观察预期）

### 设计 QA（PR 人工 — mockup 须列默认态对齐项）

- [ ] ___（spec-driven：符合 PRD 页面清单 UI 设计描述 + DESIGN 气质；mockup-driven：默认态对齐 references PNG）

## 依赖

- ___（功能页须含同端 app-shell issue #___ 或「app-shell 已在主干合并」+ PR 链接）

## 阻塞项

- 对阻塞项的引用（如有）

如果没有阻塞项，则写「无 — 可立即开始」。

</ui-issue-template>

**不要**关闭或修改任何父 issue。
