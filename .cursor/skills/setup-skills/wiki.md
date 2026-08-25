# Repo Wiki 代码导读

本仓库架构导读的布局、维护与阅读说明。**供人查阅**；workflow skills（`to-prd`、`tdd`、`grill-with-docs`、`triage` 等）**不读取** Wiki，除非用户在本轮对话中显式 `@` 了 Wiki 文件。

## 定位

`docs/repo-wiki/` 是**代码库架构导读**——帮助人理解项目做什么、主流程如何运行、模块如何衔接。它是**人类 onboarding 文档**，不是 Agent 工作流的一部分，也不是规范 SSOT。

| 文档 | 读者 | 回答什么 |
|------|------|----------|
| `CONTEXT.md` | 人 + Agent | 领域术语与业务含义（规范） |
| `docs/adr/` | 人 + Agent | 架构决策与理由（规范） |
| `docs/design/` | 人 + Agent | 品牌视觉设计系统（规范） |
| `docs/prd/` + PRD Issue | 人 + Agent | 功能规格与执行契约（规范） |
| **`docs/repo-wiki/`** | **人** | **代码现在长什么样（架构地图）** |

Agent 工作流读序仍为：Issue 简报 + PRD 绑定 → CONTEXT / ADR / DESIGN → 探索 `src/`。Wiki 不参与该读序。

## 人类阅读建议

接手陌生项目或代码大变更后：

1. 从 `docs/repo-wiki/README.md` 开始
2. 读 `01-execution-flow.md` 了解主链路
3. 按需深入 `02-core-modules/` 等主题页
4. 对照页内 `path:startLine-endLine` 源码锚点，在 IDE 中打开对应位置验证

`_meta.yaml` 中的 `commit` 与当前主分支不一致时，意识到 Wiki 可能过时，以源码为准。

## 生成与刷新

- **生成 / 刷新 / 删除**：运行 `/repo-wiki`
- **首次生成**：建议在 `/setup-skills`（D — Repo Wiki）完成后进行
- **代码变更后**：人工运行「刷新 Wiki」；`_meta.yaml` 会更新 commit 与时间戳

## 文件结构

布局固定，禁止自定义路径或命名约定：

```
docs/repo-wiki/
├── _meta.yaml                 # 分支、commit、语言、生成时间、页数
├── README.md                  # 项目身份 + 如何使用本 Wiki
├── 01-execution-flow.md       # 主执行链路
├── 02-core-modules/
│   ├── index.md               # 模块总览
│   └── {module-name}.md       # 各核心模块
├── 03-cross-boundaries.md     # 跨端 / 跨服务边界
├── 04-data-state-flow.md      # 数据与状态流
├── 05-config-boundaries.md    # 配置边界
├── 06-extension-points.md     # 扩展点与接缝
├── 07-risk-points.md          # 风险点与技术债
└── diagrams/                  # 可选：Mermaid 图源文件
```

**同一仓库只保留一种语言版本**（zh-CN 或 en）。换语言重新生成会覆盖原有 Wiki。

## 与规范文档的关系

- Wiki 生成时可参考 `CONTEXT.md` 统一模块命名，但**不在 Wiki 中重新定义术语**
- Wiki 可标注代码现状与 ADR 是否一致；冲突时以 ADR 为准
- Wiki **不复制** PRD 全文或功能规格

## Workflow skills 边界

以下 skills **默认不读** `docs/repo-wiki/`：

- `to-prd`、`to-issues`、`tdd`、`grill-with-docs`、`grill-me`、`triage`、`diagnose`、`improve-codebase-architecture`

Agent 临时需要模块关系图时，使用 `/zoom-out`（对话内临时地图），而非 Wiki。
