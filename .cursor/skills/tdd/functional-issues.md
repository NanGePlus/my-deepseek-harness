# TDD 中的功能 Issue（API / schema / 领域 / headless）

当当前 issue **不含 UI 章节**（headless，或 spec/mockup 下的 API / schema / 领域 seam 切片）时，在标准 TDD 规划步骤**之前**完成本门禁。

**UI 实现 issue**（含 `PRD 绑定` + `States 矩阵`）→ 改用 [ui-issues.md](ui-issues.md)，不要与本章混用。

## 识别

下列任一即为功能 Issue（走本章）：

- issue 正文 **UI 模式** 为 `headless`
- issue 含 **PRD 绑定** 但**无** `States 矩阵` / UI 章节（API / schema / 领域 seam 切片）
- `/to-issues` 拆出的共享后端切片（如「API 预约」），被多个 UI Issue 依赖

## 预检 PRD 必读项（功能 issue — 对照 issue 正文核对）

Issue「PRD 绑定 › PRD 必读」须覆盖下列 **3 项**（`/to-issues` 写入；缺项 → 停止 `/tdd`）：

1. 父 PRD Issue — PRD「实现决策」：**{本子项定位词}**
2. 父 PRD Issue — PRD「测试决策」：**{本子项定位词}**
3. 父 PRD Issue — 用户故事 `US-___`（本 issue 覆盖的编号）



## 打开 PRD 必读（编码前强制）

**清单来源**：`ready-for-agent` 且存在 Agent 简报 → 以简报「实现前必读」为准；否则用 issue「PRD 绑定 › PRD 必读」。

**打开步骤**：

1. 从 issue「PRD 绑定 › **父 PRD Issue**」拉取 PRD Issue **完整正文**。
2. 按编号定位并阅读：


| 项   | 打开位置                                                                          |
| --- | ----------------------------------------------------------------------------- |
| 1   | PRD 正文 `## 实现决策` 中含 issue 第 1 项**定位词**的那一条（定位词须与 `/to-issues` 写入 issue 的正文一致） |
| 2   | PRD 正文 `## 测试决策` 中含 issue 第 2 项**定位词**的那一条                                    |
| 3   | PRD 正文 `## 用户故事` 中 issue 覆盖的 `US-n`                                           |


1. **预检通过**：每项能写出一行摘要（例：「第 1 项 — POST /bookings 返回 201 + booking id」）。定位词在 PRD 中找不到唯一条目 → **停止** `/tdd`，请维护者补 PRD 子标题或修正 issue 定位词。



## 验收标准 → PRD 依据

功能 issue **无 States 矩阵**；每条 **验收标准** 应带 **PRD 依据**（由 `/to-issues` 写入），供每个 RED 循环打开 PRD 段落 — 与 UI issue 的 States 矩阵 **PRD 来源** 列对称。

**推荐格式**（写在验收标准括号内或表格「PRD 依据」列）：


| PRD 依据             | 含义                 | RED 前打开           |
| ------------------ | ------------------ | ----------------- |
| `PRD 实现决策 › {定位词}` | 接口 / schema / 领域契约 | PRD「实现决策」含该定位词的条目 |
| `PRD 测试决策 › {定位词}` | 可观测外部行为            | PRD「测试决策」含该定位词的条目 |
| `用户故事 US-n`        | 用户可见行为             | PRD「用户故事」第 n 条    |


**示例**：

```markdown
## 验收标准

- [ ] 有效 payload 创建预约并返回 201 + booking id（PRD 依据：`PRD 实现决策 › POST /bookings`；`PRD 测试决策 › HTTP 集成 seam / 201 响应形状`）
- [ ] 重复提交同一时段返回 409（PRD 依据：`PRD 测试决策 › 冲突与 409`；`用户故事 US-2`）
```

**缺 PRD 依据时**：仍按 **PRD 必读** 第 1–2 项定位词 + 该条验收标准涉及的 `US-n` 打开 PRD；若无法唯一对应 → 停止并澄清，不要猜契约。

**每个 RED 前**：打开该条验收标准的全部 **PRD 依据** 所指段落，确认可观察行为后再写测试。

## 预检清单

- [ ] issue 状态为 `ready-for-agent`（否则停止 — 不要 `/tdd`）
- [ ] **依赖** 章节所列 Issue 已合并至主干，或阻塞项写「无 — 可立即开始」
- [ ] Issue 正文含 **PRD 绑定**（Seam、**PRD 必读** 3 项、覆盖的用户故事 `US-n`、接口 / 行为 SSOT）
- [ ] **已按 issue「PRD 绑定 › PRD 必读」编号清单逐项打开并阅读**（对照上文 § 预检 PRD 必读项）
- [ ] issue **验收标准** 非空，且每条为可观察行为（非实现步骤）；每条含 **PRD 依据**（缺则按 § 验收标准 → PRD 依据 回退规则处理并记录）
- [ ] 使用 `CONTEXT.md` 词汇；尊重 `docs/adr/`



## 依赖未完成时停止

Issue **依赖** 字段若引用其他 Issue（如前置 API、schema 迁移），须满足其一，否则 **停止** `/tdd` 并说明阻塞：

1. 依赖 Issue 已关闭且 PR 已合并至当前工作基线；或
2. 依赖项注明「已在主干合并」并给出可验证的 PR / commit 链接；或
3. 维护者明确批准在本 Issue 内临时 stub（须在 PR 说明中记录，且不得合并为最终方案）

**不要**在依赖未就绪时自行发明接口契约 — 回到 PRD / 依赖 Issue 或等待合并。

## AFK 规划：Issue 验收标准 = 计划批准

issue 为 `ready-for-agent` 时：

- **Issue 正文验收标准** 即 TDD 行为清单与优先级 — **无需**再向用户重复确认「测哪些行为」
- 规划步骤：将每条验收标准映射为 **一个 RED→GREEN 循环**（或一条参数化场景），按 tracer-bullet 顺序排列（主路径 / happy path 优先，再边界与错误）；规划表须列出每条对应的 **PRD 依据**
- 仅当验收标准模糊、互相冲突或与 PRD 矛盾时，才暂停并请求维护者澄清

交互式会话（非 AFK）时，仍可与用户核对映射，但不得以「未口头批准」为由跳过 Issue 已写明的验收项。

## 对齐标准

- **行为 SSOT**：issue **验收标准** + PRD「测试决策」（经 PRD 必读第 2 项路由）
- **接口 SSOT**：PRD「实现决策」（经 PRD 必读第 1 项路由）+ ADR；issue **构建内容** 描述端到端行为，非文件路径
- **seam**：issue **PRD 绑定 › Seam** 字段；在 PRD 选定的最高层 seam 上写集成测试（HTTP API、CLI、公开 SDK 等 — 按项目栈）



## 测试策略

**测** — 通过公共接口的可观察行为：

- issue 验收标准每条至少一个测试（或一组参数化场景）；RED 前打开该条 **PRD 依据**（见 § 验收标准 → PRD 依据）
- 与 PRD 测试决策一致的外部行为（状态码、响应形状、领域不变量、CLI 输出等）
- 错误 / 边界条件若写在验收标准或 PRD 测试决策中，各占一个 RED→GREEN 循环

**不测** — 实现细节（私有函数、内部 call 顺序、直接查库绕过公共接口 — 见 [tests.md](tests.md)）

**循环顺序**：与 UI Issue 相同 — **一次一个测试**，RED→GREEN 后再下一个；不要批量 RED 再批量 GREEN。

## 与 UI Issue 的衔接

本 Issue 产出的 **公共接口** 即下游 UI Issue 的集成依赖。合并前确认：

- [ ] 本 Issue 验收标准对应的测试在 CI 中通过
- [ ] 接口契约与 PRD 一致（UI Issue 的 TDD 应调用真实接口或项目认可的 test double，而非临时 mock）



## GREEN 阶段之后

- 在 PR 中逐条勾选 issue 验收标准，并注明对应测试名
- 不修改 `docs/design/`（功能 Issue 无设计输入轨）



## PR 验收章节（功能 Issue）

```markdown
## 父 PRD Issue
#___

## PRD 绑定
- Seam: ___
- PRD 必读: （见 issue 正文 3 项清单）

## 覆盖的用户故事
___（`US-n` 格式，如 `US-1~US-3`）

## Seams / 公共接口
- ___（如 `POST /bookings`、CLI `booking create`）

## 验收标准（CI）
- [ ] ___（PRD 依据：`PRD 测试决策 › `___；测试：`describe...` / `it...`）

## 依赖已满足
- [ ] #___ 已合并 / 无依赖
```
