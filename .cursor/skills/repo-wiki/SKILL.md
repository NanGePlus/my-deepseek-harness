---
name: repo-wiki
description: 扫描代码库并生成/刷新 docs/repo-wiki/ 架构导读（带源码锚点）。当用户接手陌生项目、需要代码库架构文档、说「生成 Wiki」「刷新 Repo Wiki」、setup 完成后首次建导读，或代码大变更后更新导读时使用。
---

# Repo Wiki — 代码库架构导读

生成并维护 `docs/repo-wiki/` —— 帮助**人**快速理解项目做什么、主流程如何运行、模块如何衔接（带可点击的源码锚点）。

**定位**：代码库架构导读，**仅供人阅读**。不是产品文档、不是需求规格、不是领域术语表；**不参与** workflow skills 的读序。布局与维护说明见 [setup-skills/wiki.md](../setup-skills/wiki.md)。

## 支持文件

- [TOC-TEMPLATE.md](./TOC-TEMPLATE.md) — 固定 8 类目录结构
- [PAGE-FORMAT.md](./PAGE-FORMAT.md) — 正文与源码锚点格式
- [SCAN-RULES.md](./SCAN-RULES.md) — 扫描与安全规则
- [META-FORMAT.yaml](./META-FORMAT.yaml) — `_meta.yaml` 字段说明

## 模式

根据用户意图选择：

| 模式 | 触发 | 行为 |
|------|------|------|
| **生成** | 首次、「生成 Wiki」 | 全量：分析 → 目录 → 逐页 → 保存 |
| **刷新** | 「刷新 Wiki」、代码变更后 | 对比 `_meta.yaml` commit，增量或整库重生 |
| **停止** | 生成过程中 | 保留已完成页，`_meta.yaml` status=stopped |
| **删除** | 「删除 Wiki」 | 删除 `docs/repo-wiki/` 全部内容，可随时重生 |

同一仓库同时只跑一个生成任务。

## 流程

### 0. 前置

- 若 `docs/agents/wiki.md` 不存在，建议用户先运行 `/setup-skills`（D — Repo Wiki）。若用户跳过，仍可按本 skill 默认布局生成。
- 读取 [SCAN-RULES.md](./SCAN-RULES.md)、[TOC-TEMPLATE.md](./TOC-TEMPLATE.md)、[PAGE-FORMAT.md](./PAGE-FORMAT.md)。

### 1. 配置（一次一问）

除非用户已在请求中明确，逐项询问：

**语言**

- 简体中文（`zh-CN`）或英文（`en`）
- 默认：简体中文
- **同一仓库只保留一种语言版本** — 换语言重新生成会覆盖原有 Wiki

**图表**

- 是否生成 Mermaid 架构 / 流程 / 时序 / 状态图？
- 默认：开启
- 只在图确实帮助理解且有源码依据时生成（见 PAGE-FORMAT）

**重试次数**

- 单个页面生成失败时自动重试几次？
- 默认：0（不重试）

### 2. 分析代码库

按 [SCAN-RULES.md](./SCAN-RULES.md) 扫描工作区：

- 识别入口文件、顶层 package / 目录结构
- 若存在，读取 `CONTEXT.md`（统一命名）和 `docs/adr/`（标注一致性）
- **不读取** `docs/prd/` 全文

向用户报告扫描摘要：项目类型、主要语言、识别到的核心模块数量。

### 3. 生成目录

按 [TOC-TEMPLATE.md](./TOC-TEMPLATE.md) 生成目录树草稿。

呈现目录给用户确认（若用户说「直接生成」可跳过确认）。一次只问一个确认问题。

### 4. 逐页生成

按目录顺序逐页生成，遵循 [PAGE-FORMAT.md](./PAGE-FORMAT.md)：

- 每条实质性结论带 `path:startLine-endLine` 源码锚点
- 模块命名优先使用 `CONTEXT.md` 词汇
- 与 ADR 矛盾处标注，不 silent 覆盖 ADR
- 术语在 CONTEXT 中不存在时，页内注明「待纳入 CONTEXT」

**进度报告**：定期告知进度（如「5/12 页」）。目录确定后，已完成的页立即可读。

**失败处理**：单页失败按配置重试；仍失败则记录到 `failed_pages`，继续下一页。

**用户停止**：保留已完成页，写入 `_meta.yaml` status=stopped。

### 5. 保存

写入 `docs/repo-wiki/`，并创建 `_meta.yaml`（格式见 [META-FORMAT.yaml](./META-FORMAT.yaml)）：

- `branch`、`commit`（当前 HEAD 完整 hash）
- `language`、`generated_at`、`page_count`
- `diagram_enabled`、`retry_count`、`status`、`failed_pages`

### 6. 生成后检查

- 术语与 `CONTEXT.md` 对齐抽查（若存在）
- 每页至少 1 个源码锚点
- 8 类主题均有覆盖（partial 时列出缺失项）
- 告知用户：Wiki 已保存；后续代码变更后可运行「刷新 Wiki」

## 刷新流程

1. 读取 `docs/repo-wiki/_meta.yaml`
2. 对比 `commit` 与当前 HEAD（见 SCAN-RULES）
3. 若无变更且用户未强制 → 告知已是最新，询问是否仍刷新
4. 若有变更 → 询问**增量**（仅更新受影响模块页）或**整库重生**
5. 更新 `_meta.yaml` 的 commit 与时间戳

**不支持**单页独立重新生成 — 增量更新相关页，或整库重生，或手动编辑单页。

## 删除

删除 `docs/repo-wiki/` 目录下全部内容。不删除 `docs/agents/wiki.md`（布局与维护说明保留）。

## 与 SSOT 的边界

| 写入 Wiki | 不写入 Wiki |
|-----------|-------------|
| 模块职责、调用关系、数据流 | 领域术语定义 → `CONTEXT.md` |
| 代码现状描述 | 架构决策理由 → `docs/adr/` |
| 配置项生效位置（不含密钥值） | 功能规格 → PRD |
| 风险点、与 ADR 不一致标注 | 品牌视觉 → `DESIGN.md` |
| 源码锚点 | 安装 / 部署 / CI/CD 教程 |

## 限制

- 同一仓库同时只跑一个生成任务
- 同一仓库只保留一种语言版本
- 不支持 Wiki 历史版本（Git 承担版本管理）
- **Workflow skills 不读取 Wiki** — 除非用户在本轮对话中显式 `@` 了 Wiki 文件；Agent 临时需要模块图时用 `/zoom-out`
