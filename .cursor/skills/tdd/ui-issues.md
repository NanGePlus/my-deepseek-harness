# TDD 中的 UI Issue

当当前 issue 实现 UI 时，在标准 TDD 规划步骤**之前**完成本门禁。

**先读模式**：issue 正文「UI 模式」→ PRD 摘要 → `docs/design/DESIGN.md` 文首。

**`headless` issue**：跳过本章 — 无 UI 实现。

## 设计输入（仅此三类）

| 条件 | 文件 |
|------|------|
| 有 UI | `DESIGN.md` |
| mockup-driven | `references/{platform-id}-{page-id}.png` |
| 多端 | `platforms.md` |

页面布局 SSOT 在 **PRD**；issue 用 **PRD 绑定** 与 **States 矩阵** 路由 Agent。**PRD 必读** 编号清单由 `/to-issues` 写入 issue 正文，为本章预检的权威来源。

## 预检 PRD 必读项（UI issue — 对照 issue 正文核对）

Issue「PRD 绑定 › PRD 必读」须覆盖下列 **7 项**（`/to-issues` 写入；缺项 → 停止 `/tdd`）：

1. 父 PRD Issue — PRD「页面清单」中 `{page-id}` 条目**全文**
2. 父 PRD Issue — PRD「状态策略」章节
3. 父 PRD Issue — 用户故事 `US-___`（本 issue 覆盖的编号）
4. （`page-id` ≠ `app-shell`）同端 PRD「页面清单」中 `app-shell` 条目 + 壳层变体规则（`app-shell` 页写 `N/A`）
5. `docs/design/DESIGN.md` — 页面清单该页「DESIGN 复用」列引用的 §5 原语 + §6 宜忌
6. （**多端**）`docs/design/platforms.md` — `{platform-id}` 段落（单端 `N/A`）
7. （**mockup-driven**）`docs/design/references/{platform-id}-{page-id}.png` 默认态（spec-driven `N/A`）

## 打开 PRD 必读（编码前强制）

**清单来源**：`ready-for-agent` 且存在 Agent 简报 → 以简报「实现前必读」为准（与 issue 正文 PRD 必读 须一致）；否则用 issue「PRD 绑定 › PRD 必读」。

**打开步骤**（逐项执行，不可跳过）：

1. 从 issue「PRD 绑定 › **父 PRD Issue**」拉取 PRD Issue **完整正文**。
2. 按编号定位并阅读：

| 项 | 打开位置 |
|----|----------|
| 1 | PRD 正文 `### 页面清单` 下 **`{page-id}`** 小节（常为 `#### \`{page-id}\`` 或 `#### \`{page-id}\`（页面标题）`）— 读该条**全文**（含 UI 设计描述与变体段） |
| 2 | PRD 正文 `### 状态策略` |
| 3 | PRD 正文 `## 用户故事` 中 issue 覆盖的 `US-n` |
| 4 | 同端 `app-shell` 页面清单条目 + 其「壳层变体」段（`page-id` = `app-shell` 时跳过，issue 应写 `N/A`） |
| 5 | 仓库 `docs/design/DESIGN.md` — issue / 页面清单「DESIGN 复用」列引用的 §5 原语 + §6 宜忌 |
| 6 | 仓库 `docs/design/platforms.md` — `{platform-id}` 段落（单端跳过） |
| 7 | 仓库 `docs/design/references/{platform-id}-{page-id}.png`（spec-driven 跳过） |

3. **预检通过**：每项能写出一行摘要（例：「第 1 项 — booking-store 继承 app-shell 隐藏 Tab，空态文案为…」）。做不到 → **停止 `/tdd`**，回到 `/triage` 或维护者补全 PRD 绑定。

## PRD 必读与 States 矩阵的分工

| 阶段 | 读什么 | 目的 |
|------|--------|------|
| **编码前预检** | PRD 必读 7 项 | 建立本页 + 壳层 + 设计输入的全局上下文 |
| **每个 RED 循环** | States 矩阵该行 **PRD 来源** | 精读该 state 的可观察预期；**不**重复通读整页条目 |

预检已读第 1 项（页面清单全文）后，循环时按 **PRD 来源** 列只打开变体段、状态策略补充或 DESIGN §5 — 例如 `PRD 页面清单 §booking-store 变体段「空状态变体」`，而非重读 default 段全文。

## 依赖未完成时停止

在预检清单**之前**核对 issue **依赖** 章节：

- [ ] 所列依赖 Issue 已关闭且 PR 已合并，或正文注明「已在主干合并」+ PR / commit 链接
- [ ] mockup-driven：对应 `#D-xxx` 已评审通过且 references 已入库（若 UI Issue 依赖 `#D-xxx`）
- [ ] 功能页：同端 **app-shell** Issue 已合并，或已注明 shell 在主干可对照

任一未满足 → **停止 `/tdd`**，不要 stub 壳层、不要猜 API 契约。见 [functional-issues.md](functional-issues.md) § 依赖未完成时停止。

## 预检清单（共有：spec-driven 与 mockup-driven）

- [ ] Issue 正文含 **PRD 绑定**（父 PRD Issue、page-id、**PRD 必读** 7 项、壳层关系、覆盖的用户故事 `US-n`）
- [ ] Issue 正文含 **States 矩阵**（每态：**PRD 来源**为可定位字符串 + 可观察预期）
- [ ] **已按 issue「PRD 绑定 › PRD 必读」编号清单逐项打开并阅读**（对照上文 § 预检 PRD 必读项；不只读 Issue 绑定摘要）
- [ ] issue 状态为 `ready-for-agent`
- [ ] 禁止硬编码颜色/间距；使用 `DESIGN.md` 中的 Token 语义

## mockup-driven 追加

- [ ] PRD 必读第 7 项 references 默认态已阅读
- [ ] States 矩阵中含变体态的行，其 **PRD 来源** 已按列打开（如 `PRD 页面清单 §{page-id} 变体段「空状态变体」`）
- [ ] 偏离 references 须在 PR 说明中注明，并经维护者批准

## 对齐标准

- **spec-driven**：DESIGN.md 气质 + Token；**PRD 页面清单该条 UI 设计描述**（经 PRD 绑定路由）；States 矩阵各态；不要求 PNG
- **mockup-driven**：上列 + 对齐 references **设计稿默认态**；变体态按 States 矩阵 + PRD 变体段 + DESIGN §5

## 需要实现的状态

以 **States 矩阵** 为准（见 `/to-issues`），覆盖 PRD 页面清单该页定义的全部逻辑态。**mockup-driven** 的 references PNG 范围以 PRD 为准（默认态 + 须单独出稿的其他态），非每态一张 PNG。

## 测试策略（TDD 测什么）

**测** — 用户可观察行为，通过公共接口（E2E 或等价的高层集成，按项目既有测试栈）：

- 主路径：加载成功后的关键内容与操作（对照 States 矩阵 `default` 行）
- States 矩阵各 **state**：空列表文案与引导、错误提示与重试、loading/disabled、上传各阶段等
- issue 验收标准 **功能** / **UI 行为** 类条目（Toast、二次确认、提交防重复等）

**不测** — 留给 PR 人工审查（issue 验收标准 **设计 QA** 类）：

- 像素级布局、间距、颜色是否与 references PNG 一致
- 组件内部结构、CSS class、快照与稿面逐像素对比
- DESIGN.md 气质与 Token 语义是否「看起来对」（由代码审查验证）
- spec-driven：PRD UI 设计描述的整体视觉是否符合（PR 设计 QA）

**mockup-driven**：自动化测试验证功能与 states；references 默认态对齐由 PR 设计 QA 人工过。

**循环顺序**：同一 issue 内 tracer-bullet — 先 `default` 行 RED→GREEN，再按 States 矩阵**其余行**逐行 RED→GREEN。不要一次性写完所有 UI 测试再一次性实现。

## States 矩阵 → 测试映射

**一行矩阵 ≈ 一个 RED→GREEN 循环**（或一条独立 `it` / E2E scenario）。测试名应包含 state 与可观察预期关键词。**每个 RED 前**：按该行 **PRD 来源** 列打开 PRD / DESIGN 对应段落（见 § PRD 必读与 States 矩阵的分工），确认「可观察预期」与规格一致后再写测试。

| 矩阵 state | 触发方式（示例） | 断言什么 |
|------------|------------------|----------|
| `default` | 正常 fixture / API 返回有数据 | 矩阵「可观察预期」中的文案、按钮态、主操作可用 |
| `loading` | 延迟 API、或 `aria-busy` 路由 | 骨架 / spinner 可见；或提交中按钮 disabled |
| `empty` | API 返回空列表 fixture | 矩阵中的空态文案与引导操作 |
| `error` | API 5xx fixture 或 seam 注入失败 | 错误提示 + 重试（若矩阵有写） |
| `disabled` | 未选必填项即渲染 | 主 CTA 不可点或矩阵描述的行为 |

优先用 **test seam**（fixture、MSW、项目既有 API stub 层）触发变体态，避免测 CSS 类名或组件内部 state。

## app-shell Issue（`page-id` = `app-shell`）

壳层 Issue **仍走本章**；无业务 API 时 tracer-bullet 测 **导航 chrome 行为**，不测业务字段。

**States 矩阵建议行**（与 PRD app-shell 壳层变体对齐；**PRD 来源**列须可定位）：

| state | PRD 来源 | 可观察预期（示例） |
|-------|---------|-------------------|
| `default` | PRD 页面清单 §app-shell「UI 设计描述」 | 顶栏 / 底栏 Tab 按 PRD 顺序渲染；当前无业务页时内容区占位正确 |
| `tab-selected` | PRD 页面清单 §app-shell「UI 设计描述」 | 点击 Tab 后选中态变化（文案 / aria / 路由 — 按项目栈） |
| `chrome-reduced` | PRD 页面清单 §app-shell 壳层变体 / PRD「状态策略」 | 进入壳层变体列出的某页路由后，底栏隐藏或顶栏显示返回 |

功能页 Issue 依赖本 Issue 合并后，在功能页 TDD 中 **不再重复测 shell 全规格**，只测相对壳层的增减（见 PRD 壳层关系）。

## AFK 规划

issue 为 `ready-for-agent` 时：**States 矩阵 + issue 验收标准（功能 / UI 行为类）** 即 RED→GREEN 清单，无需再向用户确认。见 [functional-issues.md](functional-issues.md) § AFK 规划。

## 验收标准

| 项 | 谁负责 | 说明 |
| --- | --- | --- |
| 功能 + UI 行为 | CI / Agent / TDD | issue 验收标准中 **功能** / **UI 行为** 类 |
| 布局 / 气质 / mockup references | PR 评审者 | issue **设计 QA** 类 — **不由 TDD 测试替代** |
| 人工审查 | PR 评审者 | 设计 QA + 行为是否符合 PRD / issue |

## GREEN 阶段之后

- 新禁止模式：追加到 `DESIGN.md` §6 宜忌（Design Issue），勿直接改全局 Token
- 不要修改 `DESIGN.md` — 用 Design Issue

## PR 中的 UI 验收标准章节

```markdown
## UI 模式
spec-driven 或 mockup-driven

## PRD 绑定
- 父 PRD Issue: #___
- page-id / 覆盖的用户故事: ___ / ___（`US-n` 格式）
- 壳层关系: ___
- spec-driven — 布局 SSOT: PRD 页面清单该条 UI 设计描述
- mockup-driven — 稿面 SSOT: references/___
- States 矩阵: （见 issue 正文）

## 平台
- platform-id: ___（多端时必填）
- page-id: ___

## UI 输入（ready-for-agent 前已满足）
- [ ] 已按 issue「PRD 绑定 › PRD 必读」完成阅读（见 issue 正文 7 项清单）
- [ ] DESIGN.md 已就绪
- [ ] （多端）platforms.md 中该 platform-id 已就绪
- [ ] （mockup-driven）references/{platform-id}-___
- [ ] 已读父 PRD 页面清单 {page-id} 条目全文

## UI 验收标准
### 功能（CI）
- [ ] ___
### UI 行为（CI）
- [ ] ___
### 设计 QA（PR 人工）
- [ ] 匹配 DESIGN.md 气质与 Token
- [ ] spec-driven：符合 PRD UI 设计描述；mockup-driven：默认态对齐 references
- [ ] States 矩阵各态已覆盖
- [ ] 代码检查通过

## 设计参考
- 视觉身份：docs/design/DESIGN.md
- 平台：（多端）docs/design/platforms.md
- 视觉稿：（mockup-driven）docs/design/references/___
```
