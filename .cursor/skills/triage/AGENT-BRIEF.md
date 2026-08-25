# 编写 Agent 简报

当 issue 移至 `ready-for-agent` 时，会在 GitHub issue 上发布一条结构化的评论。这是无人值守（AFK）Agent 将依据的权威规范。原始 issue 正文和讨论是上下文 —— Agent 简报才是契约。

## 原则

### 持久性优于精确性

 issue 可能会在 `ready-for-agent` 状态中停留数天或数周。在此期间代码库会发生变化。编写简报时应使其即使在文件被重命名、移动或重构后依然有用。

- **要** 描述接口、类型和行为契约
- **要** 指定 Agent 应寻找或修改的具体类型、函数签名或配置结构
- **不要** 引用文件路径 —— 它们会过时
- **不要** 引用行号
- **不要** 假设当前的实现结构会保持不变

### 行为导向，而非程序步骤导向

描述系统**做什么**，而不是**如何**实现它。Agent 将从头开始探索代码库并自行做出实现决策。

- **好的：** “`SkillConfig` 类型应接受一个可选的 `schedule` 字段，类型为 `CronExpression`”
- **不好的：** “打开 src/types/skill.ts 并在第 42 行添加一个 schedule 字段”
- **好的：** “当用户不带参数运行 `/triage` 时，他们应该看到一个需要关注的 issue 摘要”
- **不好的：** “在主处理函数中添加一个 switch 语句”

### 完整的验收标准

Agent 需要知道什么时候才算完成。每个 Agent 简报必须有具体的、可测试的验收标准。每个标准都应该是可独立验证的。

- **好的：** “运行 `gh issue list --label needs-triage` 返回已经过初步分类的 issue ”
- **不好的：** “分拣功能应该正确工作”

### 明确的范围边界

说明哪些不在范围内。这可以防止 Agent 过度打磨或对相邻功能做出假设。

### UI issue 例外：稳定设计路径与 PRD 绑定

非 UI issue 遵循「不写文件路径」。**UI 实现类 issue** 的 Agent 简报须额外包含：

- **实现前必读** — 从 issue 正文「PRD 绑定 › **PRD 必读**」**原样复制**编号清单；**不要**补全、改写或省略项（清单由 `/to-issues` 写入，须含 7 项，见 [to-issues/SKILL.md](../to-issues/SKILL.md) UI 切片模板）
- **PRD 绑定** — 与 issue 正文一致的 page-id、壳层关系、States 矩阵摘要
- **设计参考** — `docs/design/` 下路径（DESIGN.md、platforms.md、references/）在此视为稳定契约，允许写出

**功能 / headless issue** 的 Agent 简报须额外包含：

- **实现前必读** — 从 issue 正文「PRD 绑定 › **PRD 必读**」**原样复制**编号清单（3 项，见 [to-issues/SKILL.md](../to-issues/SKILL.md) 功能切片模板）
- **PRD 绑定** — 与 issue 正文一致的 Seam、覆盖的用户故事 `US-n`、接口 / 行为 SSOT 摘要

## 模板

```markdown
## Agent 简报

**类别：** bug / enhancement
**摘要：** 一行描述需要完成什么

**当前行为：**
描述当前发生的情况。对于 bug，这是有问题的行为。
Enhancement，这是该功能所基于的现状。

**期望行为：**
描述 Agent 的工作完成后应该发生什么。
具体说明边界情况和错误条件。

**关键接口：**
- `TypeName` —— 需要什么改变以及为什么
- `functionName()` 返回类型 —— 当前返回什么 vs 应该返回什么
- 配置结构 —— 任何需要的新配置选项

**验收标准：**
- [ ] 具体的、可测试的标准 1
- [ ] 具体的、可测试的标准 2
- [ ] 具体的、可测试的标准 3

**范围外：**
- 在此 issue 中不应更改或解决的事项
- 可能看起来相关但实际上是独立的相邻功能

**实现前必读（UI 实现类 issue — 从 issue 正文原样复制；`headless` 省略）：**

（从 issue「PRD 绑定 › PRD 必读」**原样复制**下方编号清单 — **不要**补全或改写）

1. …
2. …
…

**实现前必读（功能 / headless issue — 从 issue 正文原样复制）：**

（从 issue「PRD 绑定 › PRD 必读」**原样复制**下方编号清单 — **不要**补全或改写）

1. …
2. …
3. …

**PRD 绑定（UI 实现类 issue — 与 issue 正文一致；`headless` 省略）：**
- **UI 模式：** ___
- **父 PRD Issue：** #___
- **page-id / 覆盖的用户故事：** ___ / ___（`US-n` 格式）
- **壳层关系：** ___
- **spec-driven — 布局 SSOT：** PRD 页面清单该条 UI 设计描述（简报不重复全文）
- **mockup-driven — 稿面 / 变体 SSOT：** references/___ + PRD 变体段 + DESIGN §5
- **States 矩阵（摘要）：** default → ___；___ → ___（完整矩阵见 issue 正文；PRD 来源须可定位）
- **platform-id：** `___`（**多端时**必填；单端可省略）
- [ ] DESIGN.md 已就绪
- [ ] （**多端**）platforms.md 中该 platform-id 段落已就绪
- [ ] （**mockup-driven**）references/{platform-id}-___

**PRD 绑定（功能 / headless issue — 与 issue 正文一致）：**
- **Seam：** ___
- **父 PRD Issue：** #___
- **覆盖的用户故事：** ___（`US-n` 格式）
- **接口 SSOT / 行为 SSOT：** （见 issue 正文，简报不重复契约全文）

**验收标准（须与 issue 正文三类对齐）：**
- [ ] **功能**（可测试）：___
- [ ] **UI 行为**（可测试）：___
- [ ] **设计 QA**（PR 人工）：___

**设计参考（UI issue）：**
- 视觉身份：docs/design/DESIGN.md
- 平台：（**多端时**）docs/design/platforms.md
- 视觉稿：（**mockup-driven**）docs/design/references/___

按场景的最小引用见 [DESIGN-ISSUES.md](../to-issues/DESIGN-ISSUES.md)。
```

## 示例

### 好的 Agent 简报（bug）

```markdown
## Agent 简报

**类别：** bug
**摘要：** 技能描述截断时在单词中间截断，产生不完整的输出

**当前行为：**
当技能描述超过 1024 个字符时，无论单词边界如何，都会在恰好 1024 个字符处截断。这会导致描述在单词中间结束（例如“当用户希望配置时——”）。

**期望行为：**
截断应在 1024 个字符之前的最后一个单词边界处断开，并附加“...”以表示截断。

**关键接口：**
- `SkillMetadata` 类型的 `description` 字段 —— 不需要改变类型，但填充它的验证/处理逻辑需要尊重单词边界
- 任何读取 SKILL.md frontmatter 并提取描述的函数

**验收标准：**
- [ ] 长度低于 1024 字符的描述保持不变
- [ ] 长度超过 1024 字符的描述在 1024 字符之前的最后一个单词边界处截断
- [ ] 截断后的描述以“...”结尾
- [ ] 包含“...”的总长度不超过 1024 字符

**范围外：**
- 更改 1024 字符限制本身
- 支持多行描述
```

### 好的 Agent 简报（enhancement）

```markdown
## Agent 简报

**类别：** enhancement
**摘要：** 添加 `.out-of-scope/` 目录支持，用于跟踪被拒绝的功能请求

**当前行为：**
当一个功能请求被拒绝时，该 issue 会被关闭并打上 `wontfix` 标签和一条评论。没有关于该决策或理由的持久化记录。未来类似的功能请求需要维护者回忆或搜索之前的讨论。

**期望行为：**
被拒绝的功能请求应记录在 `.out-of-scope/<概念>.md` 文件中，这些文件应包含决策、理由以及请求该功能的每个 issue 的链接。在对新 issue 进行分拣时，应检查这些文件以查找匹配项。

**关键接口：**
- `.out-of-scope/` 中的 Markdown 文件格式 —— 每个文件应有 `# 概念名称` 标题、一行 `**Decision：**`、一行 `**Reason：**`，以及一个包含 issue 链接的 `**Prior requests：**` 列表
- 分拣工作流应在早期读取所有 `.out-of-scope/*.md` 文件，并根据概念相似性将传入的 issue 与它们进行匹配

**验收标准：**
- [ ] 关闭一个功能请求为 wontfix 时，会在 `.out-of-scope/` 中创建/更新一个文件
- [ ] 该文件包含决策、理由以及指向已关闭 issue 的链接
- [ ] 如果已存在匹配的 `.out-of-scope/` 文件，新 issue 会被追加到其“Prior requests”列表中，而不是创建重复文件
- [ ] 在分拣期间，会检查现有的 `.out-of-scope/` 文件，并且当新 issue 与之前被拒绝的请求匹配时，会将其呈现出来

**范围外：**
- 自动匹配（由人工确认匹配）
- 重新打开之前被拒绝的功能
- Bug 报告（只有增强功能类的拒绝才会进入 `.out-of-scope/`）
```

### 不好的 Agent 简报

```markdown
## 不好的 Agent 简报（不要这样做）

**摘要：** 修复分拣 bug

**要做什么：**
分拣功能坏了。看看主文件并修复它。
第 150 行附近的函数有问题。

**要更改的文件：**
- src/triage/handler.ts（第 150 行）
- src/types.ts（第 42 行）
```

这之所以是不好的，是因为：
- 没有类别
- 描述模糊（“分拣功能坏了”）
- 引用了会过时的文件路径和行号
- 没有验收标准
- 没有范围边界
- 没有描述当前行为与期望行为
