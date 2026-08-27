# Design Issues

当 **PRD UI 模式为 `spec-driven` 或 `mockup-driven`** 时，将 **Design Issues** 与功能垂直切片一并拆分。

> **`headless` 模式**：**不开任何 Design Issue**；UI 实现 Issue 模板不适用。

## 设计输入（仅此三类）

| 条件 | 文件 | 职责 |
|------|------|------|
| 有 UI | `DESIGN.md` | 品牌视觉 SSOT：Token、气质、§5 通用 UI 原语、§6 宜忌 |
| mockup-driven | `references/{platform-id}-{page-id}.png` | 功能页面默认态设计稿 |
| 多端 | `platforms.md` | `platform-id` 平台清单 + 各端组件库映射 |

页面布局、状态策略、交互细节 → **PRD**；验收 → **Issue 验收标准**（功能 / UI 行为 / 设计 QA）。

**先读 UI 模式**：PRD 末尾摘要 → `docs/design/DESIGN.md` 文首 `> UI 模式：…`

## PRD 与 Design Issue 的分工

[to-prd](../to-prd/SKILL.md) 产出 **页面清单、用户故事 ↔ 页面映射表、状态策略** — UI Issue 以此为输入 SSOT。

| PRD 章节 | 消费方式 |
|----------|----------|
| 用户故事 ↔ 页面映射 | UI issue 覆盖故事 `US-n`；mockup 下 `#D-xxx` 页面范围 |
| 页面清单 | spec-driven → issue「PRD 绑定」路由至该条 UI 设计描述；mockup → `#D-xxx` 默认态 PNG |
| 状态策略 | issue「States 矩阵」 |
| PRD 末尾 DESIGN 就绪情况 | `#D-global` 验收关闭 vs 从零建立 |

## grill 与 Design Issue 的分工

`/grill-with-docs` UI 段可将品牌视觉**直接写入** `DESIGN.md`（及多端时的 `platforms.md`）。

**`#D-global` 不是把 design 再写一遍**，而是 Issue 跟踪器上的**验收关闭工单**：

- grill **已写入** → Agent 在原文上补缺口、核对清单 → PR 合并 → 关闭 Issue
- grill **未建** `docs/design/` → 该 Issue 承担从零充实：按 [DESIGN-TEMPLATE.md](../grill-with-docs/DESIGN-TEMPLATE.md) 建立 `docs/design/DESIGN.md`（及多端时的 `platforms.md`）；UI 模式与品牌视觉未定则先补跑 `/grill-with-docs` UI 段

Issue 正文须注明：**「验收关闭」** 或 **「从零建立」**。

## 分层

| Issue | 产出物 | 依赖 | 默认状态 |
|-------|--------|------|----------|
| `#D-global` | **验收关闭**：`DESIGN.md`（**非重写**）；**多端时**含 `platforms.md` | 无 | `ready-for-agent` |
| `#D-xxx` | mockup-driven 每页：**默认态** `references/{platform-id}-{page-id}.png`；PRD 标注的额外态 PNG（若有） | `#D-global` | `ready-for-human` |

**spec-driven**：**不开** `#D-xxx`。功能页面规格在 PRD 文字 + issue 正文中。

## 页面标识

- **`page-id`**：PRD 页面清单中的 kebab-case 机器标识；与 `references/{platform-id}-{page-id}.png`、Issue PRD 绑定一致
- **页面标题**：PRD 内人类可读短名，**不**写入 Issue 绑定；Issue 标题可引用页面标题，但绑定字段只用 `page-id`
- **`platform-id`**：**多端时**必填，须在 `platforms.md` 清单中；单端可省略

### spec-driven

| 条件 | UI Issue 初始状态 |
|------|------------------|
| `DESIGN.md` 已就绪 + issue 含完整 PRD 绑定（含 **PRD 必读** 7 项）+ States 矩阵（PRD 来源可定位）+ 可测试验收标准 | `ready-for-agent` |
| 缺 `DESIGN.md`、PRD 绑定 / PRD 必读不完整或 States 矩阵为空 / PRD 来源不可定位 | `ready-for-human` |

### mockup-driven

| 条件 | UI Issue 初始状态 |
|------|------------------|
| `DESIGN.md` 已就绪 + 默认态 references 就绪 + PRD 绑定（含 **PRD 必读** 7 项）+ States 矩阵（PRD 来源可定位）完整 | `ready-for-agent` |
| 缺 references、`#D-xxx` 评审待办，或 PRD 绑定 / PRD 必读 / States 矩阵不完整 | `ready-for-human` |

PRD 页面清单中的**全部 UI 页**均须 `#D-xxx` + 默认态 PNG。

## 依赖示例

### spec-driven（单端）

```
#D-global                              → 无（验收 DESIGN.md）
#5 API 预约                             → 可与 #D-global 并行
#7 app-shell                           → #D-global
#8 预约列表                              → #5、#7（app-shell）
#9 新建预约                              → #5、#7（app-shell）
```

### spec-driven（多端）

```
#D-global                              → 无（验收 DESIGN.md + platforms.md）
#5 API 预约                             → 可与 #D-global 并行
#7 [web-admin] app-shell               → #D-global
#8 [web-admin] 预约列表                  → #5、#7
#7b [wechat-mini] app-shell            → #D-global
#9 [wechat-mini] 预约列表                → #5、#7b
```

### mockup-driven

```
#D-global                              → 无
#5 API 预约                             → 可与 #D-global 并行
#D-web-admin-app-shell                 → #D-global（references/web-admin-app-shell.png）
#7 [web-admin] app-shell               → #D-web-admin-app-shell
#D-web-admin-booking-list              → #D-global（references/web-admin-booking-list.png）
#8 [web-admin] 预约列表                  → #D-web-admin-booking-list、#7
#D-web-admin-booking-create            → #D-global（references/web-admin-booking-create.png）
#9 [web-admin] 新建预约                  → #D-web-admin-booking-create、#7
```

## 规则

- **grill 已写 design → `#D-global` = 验收关闭**，不重写
- **仅垂直切片** — 不要「先设计所有页面再实现所有页面」
- `#D-global` → 初始 `ready-for-agent`
- **mockup-driven**：任一页缺 `references/` → UI issue `ready-for-human`
- **功能页 UI issue 须依赖同端 app-shell issue**（或注明 app-shell 已在主干合并）
- UI PR 不得改 `DESIGN.md` 全局 Token — 用 Design Issue

## Design Issue 正文模板

```markdown
## 类型
`design-input` — 仅产出 `docs/design/`，无业务页面代码

## 模式
- [ ] **验收关闭** — grill 已建；本 Issue 仅补缺口、核对清单
- [ ] **从零建立** — grill 未建；本 Issue 充实内容

## 层级
- [ ] `#D-global` / `#D-xxx`（删去不适用项；spec-driven 无 `#D-xxx`）

## PRD 输入
- **父 PRD Issue：** #___
- **覆盖的 PRD 页面：** ___（`page-id` 列表）
- **mockup-driven — 本 Issue PNG 范围：** 默认态 + 须单独出稿的其他态（若有）

## 产出物
- [ ] DESIGN.md
- [ ] （多端）platforms.md
- [ ] （#D-xxx）references/{platform-id}-{page-id}.png

## 验收标准
- [ ] （#D-global）DESIGN.md 合并；§5/§6 闭合；「待扩展 DESIGN §5」项已闭合或列出阻塞
- [ ] （#D-global，多端）platforms.md 平台清单与各 id 段落就绪
- [ ] （#D-xxx，mockup-driven）默认态 PNG 存在；PRD 标注的额外态 PNG 已提供（若有）；人工评审通过

## 阻塞于
- …

## 范围外
- 业务路由、API、数据库
```

## UI 实现 Issue

当切片包含 UI 时，增加以下字段。Issue **不**重复 PRD UI 章节全文 — 用 **PRD 绑定** 路由 Agent 至父 PRD。

```markdown
## UI 模式
spec-driven 或 mockup-driven（从 PRD 摘要读取）

## PRD 绑定
- **父 PRD Issue：** #___
- **page-id：** ___
- **覆盖的用户故事：** ___（`US-n` 格式）
- **PRD 必读：**（`/triage` 与 `/tdd` 按此清单逐项打开）
  1. 父 PRD Issue #___ — PRD「页面清单」中 `{page-id}` 条目**全文**
  2. 父 PRD Issue — PRD「状态策略」章节
  3. 父 PRD Issue — 用户故事 `US-___`（本 issue 覆盖的编号）
  4. （`page-id` ≠ `app-shell`）同端 PRD「页面清单」中 `{platform-id}` **`app-shell`** 条目 + 壳层变体规则（本页即 app-shell 写 `N/A`）
  5. `docs/design/DESIGN.md` — 页面清单该页「DESIGN 复用」列引用的 §5 原语 + §6 宜忌
  6. （**多端**）`docs/design/platforms.md` — `{platform-id}` 段落（单端写 `N/A`）
  7. （**mockup-driven**）`docs/design/references/{platform-id}-{page-id}.png` 默认态（spec-driven 写 `N/A`）
- **壳层关系：** ___（继承/脱离 app-shell，或「—（本页即 app-shell）」）
- **spec-driven — 布局 SSOT：** PRD 页面清单该条「UI 设计描述」
- **mockup-driven — 稿面 SSOT：** references/___（spec 写 N/A）
- **mockup-driven — 变体 SSOT：** PRD 变体段 + DESIGN §5（spec 写 N/A）
- **mockup-driven — 默认态 PNG：** ___（spec 写 N/A）
- **mockup-driven — 须单独出稿的其他态：** ___（无则「其余复用 DESIGN §5」；spec 写 N/A）

## States 矩阵

**PRD 来源**列须为可定位字符串（见 [SKILL.md](./SKILL.md) § States 矩阵「PRD 来源」列格式）。

| state | PRD 来源 | 可观察预期 |
|-------|---------|-----------|
| default | PRD 页面清单 §{page-id}「UI 设计描述」 | ___ |
| empty | PRD 页面清单 §{page-id} 变体段「空状态变体」 | ___ |

## 平台
- **platform-id：** `___`（多端时必填；单端可写 default 或省略）
- **page-id：** `___`

## UI 输入（ready-for-agent 前）
- [ ] docs/design/DESIGN.md 已就绪
- [ ] （多端）platforms.md 中该 platform-id 段落已就绪
- [ ] （mockup-driven）references/{platform-id}-___

## 参考资料
- 视觉身份：docs/design/DESIGN.md
- 平台：（多端）docs/design/platforms.md
- 视觉稿：（mockup-driven）docs/design/references/___

## 验收标准
### 功能（可测试）
- [ ] ___
### UI 行为（可测试）
- [ ] ___
### 设计 QA（PR 人工）
- [ ] ___

## 依赖
- ___（功能页须含同端 app-shell issue 或「app-shell 已在主干合并」）
```

### 按场景的最小引用

| 场景 | 必需 |
| -------- | -------- |
| spec-driven，单端 | `DESIGN.md` + issue **PRD 绑定** + 父 PRD 页面清单该条全文 |
| spec-driven，多端 | 上列 + `platforms.md`（该 platform-id）+ 同端 app-shell 已合并或 issue 依赖 |
| mockup-driven，单端 | `DESIGN.md` + `references/{page-id}.png`（或 `{platform-id}-{page-id}`）+ PRD 绑定 + States 矩阵 |
| mockup-driven，多端 | 上列 + `platforms.md` + 同端 app-shell 已合并或 issue 依赖 |
