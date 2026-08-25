---
name: to-prd
description: 将当前对话上下文转为 PRD 并发布到项目 Issue 跟踪器。当用户想从当前上下文创建 PRD 时使用。
---

本 skill 将当前会话上下文和代码库理解转化为 PRD。综合 `/grill-with-docs` 已对齐的决策与会话结论；除下列需确认项外，不要重复拷问：

- **测试接缝（seams）** — 始终确认
- **UI 页面清单与映射表** — **spec-driven** 与 **mockup-driven** 均须向用户确认后再写 PRD；两种模式均须确认各页 **UI 设计描述** 是否足够详细（mockup-driven 额外确认是否可据此绘制默认态设计稿）
- **各端整体框架页** — 每个 `platform-id` 须**先**定整体框架页（App Shell），**再**写该端功能页 UI 设计描述；向用户确认时框架页须排在最前
- **状态策略** — 非 headless PRD **须**含独立 `### 状态策略` 章节（见 [prd-template.md](./prd-template.md)）；向用户确认加载 / 空 / 错误等全局态处理方式后再写入 PRD

Issue 跟踪器与 triage 标签词汇已经提供给你了 — 如果没有，请先运行 `/setup-skills`。

## 流程

1. **读取已有文档**（与 [grill-with-docs/SKILL.md](../grill-with-docs/SKILL.md) 文档路由一致）：
   - `CONTEXT.md` — 领域词汇表
   - `docs/adr/` — 架构与技术栈决策
   - `docs/design/DESIGN.md` — 若存在，**通读全文**（headless 可跳过）。写 UI 设计描述 / 默认态设计稿计划时须已掌握：
     - 文首 **UI 模式**（`headless` / `spec-driven` / `mockup-driven`）与创意北极星（§1）
     - 色彩、表面、语义色与无描边规则（§2）
     - 字体阶梯与受限运行时字体约束（§3）
     - 阴影、叠色与层级 Token（§4）
     - 通用 UI 原语（§5）
     - 宜忌（§6）
     - **只读不全写**：PRD 中引用 Token / 组件名，**禁止**把色板 HEX、字号表等规格全文抄进 PRD
   - 若尚未探索代码库，现在探索，了解当前实现状态

   在整个 PRD 中使用 `CONTEXT.md` 词汇，尊重 ADR。**DESIGN.md 须通读以支撑 UI 设计描述**，但**不要**把品牌视觉规格全文重复写进 PRD 正文（引用 Token / 组件名即可）。

2. **勾画测试接缝（seams）**。优先使用现有接缝；尽可能使用最高层级接缝。如需新建，在你能达到的最高点提出。向用户确认。

3. **拆解 UI 页面**（计划含可视化页面时执行；**headless 跳过**）：
   - 先判定 **UI 模式**（见 [prd-template.md](./prd-template.md)）；**headless 不得**要求设计稿或写页面布局规格
   - 从用户故事推导 UI 页面清单（规则见 [prd-template.md](./prd-template.md) § UI 页面拆解）
   - **先定各端整体框架页**（见 [prd-template.md](./prd-template.md) § 整体框架页）：按 `platform-id` 分组，**每个端的第一条页面清单项必须是该端的 `app-shell`（整体框架页）**；写清顶栏 / 底栏 / 侧栏 / 内容区等壳层，再写功能页
   - **按模式校验页面边界**（两种模式共用流程，**唯一差异**见下）：
     - **共用** — 每页 **UI 设计描述** 须足够详细，使 AI 可直接实现（spec-driven）或据此绘制默认态设计稿（mockup-driven）；**禁止**描述留空或仅一句
     - **spec-driven** — **UI 设计描述即编码的唯一权威来源（SSOT）**；**禁止**规划设计稿
     - **mockup-driven** — **默认态设计稿为稿面对齐的唯一权威来源（SSOT）**；在 UI 设计描述之外，每页还须 1 张默认态设计稿（无变体稿）；**禁止**用设计稿替代描述
   - **UI 设计描述撰写顺序**：① 各端 `app-shell` → ② 该端功能页（功能页描述中引用壳层，只写内容区差异）
   - 为每页起草 **UI 设计描述**（见 [prd-template.md](./prd-template.md) § 页面清单）；向用户展示时需完整呈现 UI 设计描述原文，要足够详细、明确，所见即所得，最终全文写入 PRD
   - 产出**用户故事 ↔ 页面映射表**草稿（`app-shell` 可映射为「全端导航 / 布局」支撑故事，或标 `—` 并注明壳层）
   - 起草 **`### 状态策略`**（见 [prd-template.md](./prd-template.md) § 状态策略）：全局约定加载 / 空 / 错误 / 禁用 / 上传等态的处理方式；与各页 UI 设计描述中的**变体段**一致，不与之矛盾
   - 向用户展示页面清单（**框架页置顶**）、映射表、**状态策略**摘要、各页 UI 设计描述摘要与模式说明，**确认后再写 PRD**

4. **编写 PRD**：先**通读** [prd-template.md](./prd-template.md)，按其中结构与规则输出；**优先写入 `docs/prd` 目录，提示用户可以先行确认和调整**。用户故事序号引用须用 `US-n` 格式（**禁止** `#n`，避免 GitHub Issue autolink）。每页须写清 **`page-id`**（kebab-case）与 **页面标题**（人类可读），勿混为「页面名」。**非 headless** PRD 须含 **`### 状态策略`**（位于 `### 页面清单` 之前，见模板）— 缺此章节会导致下游 `/to-issues` UI issue「PRD 必读」第 2 项与 `/tdd` 预检无法对齐。用户确认无误后，最终将 PRD 发布到 Issue 跟踪器，并应用 `ready-for-agent` triage 标签 — 无需额外 triage。
