# 设计系统文档：DeepSeek Harness 文件编辑器

[English](DESIGN.md) | 中文

> UI 模式：`spec-driven`（规范驱动 UI）
>
> 全局 Token、色板与字号仅由 Design Issue 变更；UI 实现 PR 不得修改。页面布局与业务文案以 PRD 为准。运行时 `--dsw-*` 值由 [`ui-theme`](../../packages/client/ui-theme/README.md) 样式表拥有；本文件是品牌板映射。见 [web-styling.md](../web-styling.md) 与 [文件编辑器设计系统 Agent Note](../../.agents/notes/implemented/process/2026-08-20-file-editor-design-system.md)。

## 1. 概览与创意北极星

### 创意北极星：「并排工坊」

文件编辑器不是独立产品，而是 DeepSeek Harness Web 内嵌于 details 栏的可收起编码面板：对话为主、编辑为辅。视觉 100% 继承 `ui-theme` 的 `--dsw-alias-*` token，Monaco 主题由同一 token 派生，随 light/dark 与对话区同步切换。

打破模板感的方式：用表面色阶与 ghost 交互态建立层次，而非卡片阴影或粗边框；文件树紧凑如 IDE、编辑区与对话代码块同 surface，使用户感到「编辑的就是会话里看到的那种代码」。双层 Tab（details 分段 + 文件 Tab）在窄栏内用底边强调与 warn 圆点传递状态，避免额外装饰。

---

## 2. 色彩与表面架构

文件编辑器不定义独立色板，四组角色映射至 dsh 静态色阶：主色为 DeepSeek 蓝（品牌与强调），辅色为通用蓝（链接与信息），第三色为绿（成功反馈），中性色为 bluish 灰阶（表面与文案）。明暗基调跟随 Harness 全局主题。

### 色板（品牌板须可视化）

| 角色 | 主色 HEX | 色阶（浅→深，附 HEX） |
|------|---------|----------------------|
| 主色（DeepSeek） | `#4176E6` | `#EDF3FE` · `#E4EDFD` · `#D3E2FF` · `#B7C8FE` · `#679EFE` · `#5686FE` · `#4176E6` · `#4868B2` · `#2F4C8F` · `#283142` |
| 辅色（Blue） | `#3B82F6` | `#EFF6FF` · `#E5F0FF` · `#DBEAFE` · `#93C5FD` · `#60A5FA` · `#4D93F8` · `#3B82F6` · `#2563EB` · `#1E40AF` · `#0E3074` |
| 第三色（Green） | `#22C55E` | `#E6FAED` · `#4ED17E` · `#22C55E` · `#233C2C` |
| 中性色（Bluish） | `#0F1115` | `#FFFFFF` · `#F9FAFB` · `#F5F6F7` · `#F1F3F5` · `#EBEEF2` · `#E1E5EE` · `#CFD3D6` · `#ADB2B8` · `#979DA6` · `#61666B` · `#151517` · `#0F1115` |

第三色仅继承 `ui-theme` 已发布的 `--dsw-static-green-*` 四阶（100 / 400 / 500 / 900）。本文档不补造色阶以达到 8–10 阶。

### 语义色（品牌板须可视化）

语义色复用 dsh alias，light 模式 HEX 如下；dark 模式由 `body[data-ds-dark-theme]` 同名 alias 覆盖。

| 角色 | Token | HEX | 来源 |
|------|-------|-----|------|
| 错误 | `semantic-error` → `--dsw-alias-state-error-primary` | `#EC1313` | 独立红系 |
| 成功 | `semantic-success` → `--dsw-alias-state-success-primary` | `#22C55E` | 独立绿系 |
| 警告 | `semantic-warning` → `--dsw-alias-state-warn-primary` | `#F59E0B` | 独立琥珀系 |
| 信息 | `semantic-info` → `--dsw-alias-state-business-primary` | `#4176E6` | 主色 DeepSeek 衍生 |

### 无描边分区规则

**明确指令：** 文件树与 Monaco 编辑区之间、列表行之间禁止 1px 实线作为主分隔；改用 `--dsw-alias-bg-overlay` 与 `--dsw-alias-markdown-code-block` 的 surface 对比，或 `--dsw-alias-border-l2` 仅用于输入框默认态与树/编辑区之间的单条竖向 ghost 线（≤1px 等价透明度）。Tab 选中允许底边 2px `--dsw-alias-brand-primary` 强调。

light 模式下 `--dsw-alias-brand-primary` 为 `--dsw-static-neutral-bluish-1000`（`#0F1115`），不是 DeepSeek 蓝。Tab 底边强调跟随该 alias。DeepSeek 蓝仍是品牌板主色 HEX，以及 `--dsw-alias-brand-primary-new-colorprimary-new-color`。

### 表面层级与嵌套

| 层级 | Token | Light HEX | 用途 |
|------|-------|-----------|------|
| 底层 | `--dsw-alias-bg-base` | `#FFFFFF` | details 栏背景 |
| 文件树区 | `--dsw-alias-bg-overlay` | `#E9ECF2` | 文件树列 surface |
| 编辑区 | `--dsw-alias-markdown-code-block` | `#F9FAFB` | Monaco 容器 surface |
| 提示/空状态卡片 | `--dsw-alias-bg-overlay` | `#E9ECF2` | 分组容器，圆角 8px |
| 对话框/确认 | `--dsw-alias-bg-layer-3` | `#FFFFFF` | 复用 Harness 浮层（若有） |

Dark 模式：`bg-base` `#151517`，`bg-overlay` `#61666B`，`markdown-code-block` `#1B1B1C`。

### 玻璃与渐变规则

不适用，跳过。文件编辑器不使用毛玻璃或签名渐变；深度由 surface 色阶与 ghost 交互态建立。

---

## 3. 字体：Harness 继承版式

UI 文案使用 `--dsw-font-family`（含 PingFang SC 等系统栈）；Monaco 代码区使用 `--ds-font-family-code`（SF Mono / JetBrains Mono 栈）。配对理由：与对话区代码块一致，编辑器是「同一套代码字体在可编辑 surface 上的延伸」。

### 字号阶梯（品牌板须可视化）

| 角色 | 字体族 | 用途 | 样例层级 |
|------|--------|------|---------|
| 标题 | `--dsw-font-family` | details 分段 Tab 标签、对话框标题 | 14px/20px semibold |
| 正文 | `--dsw-font-family` | 文件树文件名、空状态说明 | 13px/18px regular |
| 标签 | `--dsw-font-family` | 微徽章、搜索框 placeholder、caption | 10–12px/12–16px regular |
| 代码 | `--ds-font-family-code` | Monaco 编辑区 | 13px/20px regular |

### 信息层级

标题（Tab、对话框）用 `label-primary`；树节点与 Tab 标题用 13px `label-primary`；辅助说明与徽章用 `label-secondary` / `label-caption`。Monaco 行高 20px 保持紧凑 IDE 密度；文件树行高 22px，与 13px 正文形成 tight 对比而非拉大字号。

### 字体实现约束（受限运行时须填写）

不适用，跳过。纯 Web 嵌入 Harness；Monaco 通过 `fontFamily: var(--ds-font-family-code)` 注入，无自定义字体加载或稿面/实现分离。

| 触点 | 稿面字体 | 实现字体 / fallback 栈 | 加载策略 |
|------|---------|----------------------|---------|
| Web 文件编辑器 | 同实现 | `--ds-font-family-code` / `--dsw-font-family` | 系统栈，无额外加载 |

---

## 4. 层级与深度

层级通过色调叠层而非线框或阴影建立；details 窄栏内避免浮动阴影卡片。

* **叠层原则：** 文件树（overlay）浅于 Monaco 容器（code-block）；选中/ hover 在行内用交互 tint 抬升，不用 z-index 阴影。
* **环境阴影：** 文件编辑器 V1 不使用 box-shadow；浮起感仅由 surface 对比与 Tab 底边强调提供。
* **幽灵描边兜底：** 输入框默认 `--dsw-alias-border-l2`（light `rgba(0,0,0,0.1)`）；聚焦改 `--dsw-alias-brand-primary`；树/编辑区分界可用 `border-l2` 单竖线。

### 叠色对照表（品牌板须可视化）

| Token | 基准色 | 不透明度 | 预计算 HEX（light） | 用途 |
|-------|--------|---------|-------------------|------|
| `editor-hover-tint` | `rgb(38, 49, 72)` | 6% | `#F2F3F4` | 文件树行 hover |
| `editor-selected-tint` | `--dsw-static-neutral-bluish-75` | 100% | `#F1F3F5` | 文件树行 selected |
| `editor-danger-hover-tint` | `--dsw-static-red-600` | 5% | `#FEF5F5` | 危险操作 hover（删除按钮） |
| `editor-tab-active-line` | `--dsw-alias-brand-primary` | 100% | `#0F1115` | Tab 底边 2px 强调（light） |
| `editor-dirty-dot` | `--dsw-alias-state-warn-primary` | 100% | `#F59E0B` | 未保存 Tab 圆点 |

Dark 模式下 `editor-hover-tint` 为 `rgba(255,255,255,0.08)` 叠于 `#151517` ≈ `#2A2A2C`；`editor-selected-tint` 为 `#353638`。

---

## 5. 组件

各组件均为通用 UI 原语，供文件编辑器 UI 消费；颜色引用 alias token，复用叠色引用 §4 Token 名。

### 按钮与交互（品牌板须可视化）

* **主按钮：** 背景 `--dsw-alias-button-primary-fill`，文字 `--dsw-alias-label-primary-foreground`（light 上为 `#FFFFFF` on dark fill）；圆角 6px；hover `--dsw-alias-button-primary-hover`；按下 `--dsw-alias-interactive-bg-active`。
* **次按钮：** 背景 `--dsw-alias-button-elevated-fill`；文字 `--dsw-alias-label-primary`；圆角 6px；hover `--dsw-alias-button-floating-hover`；按下 `--dsw-alias-interactive-bg-active`。
* **描边按钮：** 背景 transparent；边框 `--dsw-alias-border-l2`；文字 `--dsw-alias-label-primary`；圆角 6px；hover 背景 `--dsw-alias-button-ghost-active-fill`；按下 `--dsw-alias-interactive-bg-active`。
* **文字按钮：** 无背景；文字 `--dsw-alias-label-secondary`；圆角 6px；hover 文字 `--dsw-alias-label-primary`；按下背景 `--dsw-alias-interactive-bg-active`。
* **反色按钮：** 背景 `--dsw-alias-button-contrast-fill`（`#61666B` light）；文字 `--dsw-alias-label-primary-foreground`；圆角 6px；hover 略浅 `--dsw-alias-button-primary-hover`；按下 `--dsw-alias-interactive-bg-active`；用于深色编辑区上的浅色 CTA（少用）。

### 输入与表单

* **默认态：** 背景 `--dsw-alias-bg-base`；边框 `--dsw-alias-border-l2`；文字 `--dsw-alias-label-primary`；圆角 6px；高 28px（默认单行）。
* **聚焦态：** 边框 `--dsw-alias-brand-primary`；无外发光或 1px 等价 ghost。
* **错误态：** 边框 `semantic-error`（`#EC1313`）；说明文案 `semantic-error`；用于重名冲突等校验失败。

### 卡片容器

* 圆角 8px；内边距 12px；背景 `--dsw-alias-bg-overlay`；无阴影；无业务内容排列规格。

### 列表行

* 行高 22px；行间距 0；无行间分隔线；缩进每级 12px。
* **hover：** 背景 `editor-hover-tint`。
* **selected：** 背景 `editor-selected-tint`。
* 图标 16px 位于行首；微徽章靠行尾。

### 导航

* **details 分段 Tab：** 水平 segmented；选中背景 `editor-selected-tint` + 底边 2px `editor-tab-active-line`；未选中文字 `label-secondary`。
* **文件 Tab 栏：** 水平滚动；Tab 高 32px；选中底边 2px `editor-tab-active-line`；未保存指示为标题前 6px 圆点 `editor-dirty-dot`；关闭为 28×28 ghost 图标按钮。

### 搜索框

* 贴列表顶；高 28px；左 16px 搜索图标 `label-caption`；背景 `bg-base`；边框 `border-l2`；圆角 6px；聚焦 `brand-primary` 描边；有内容时右侧清除图标按钮（24×24 ghost）。placeholder 色为 `label-caption`；本文档不写业务占位文案。
* 无下拉结果 pattern（无全局搜索，跳过）。

### 状态徽章

* padding 0 4px；圆角 3px；字号 10px/12px 行高；letter-spacing 0.02em。
* **通用样例：** 文字 `semantic-error`（`#EC1313`），无填充或背景 `editor-danger-hover-tint`；不写业务状态名映射。

### 图标按钮

* 描边粗细 0px（ghost，无描边）。工具栏尺寸 24×24；关闭 / 折叠尺寸 28×28。
* 默认图标 `label-secondary`；hover 背景 `editor-hover-tint`；active 背景 `editor-selected-tint`、图标 `label-primary`。
* **选中态：** 与 active 相同，用于 Toggle 按下（如文件夹展开）。

### 空状态

* 图标 48px outline，`label-caption`；标题 14px `label-primary`；说明 12px `label-secondary`；可选 CTA 用主按钮；整体置于卡片容器内，垂直居中。

### Loading

* **行内：** 16px spinner，颜色 `label-caption`，位于该行右侧。
* **内容区居中：** 24px spinner + 12px `label-secondary` 文案。
* **列表顶条：** 2px 高 indeterminate 条 `semantic-info`，不遮罩整列表。

---

## 6. 宜忌

### 应当：

* **应当** 所有颜色与字体通过 `--dsw-alias-*` / `--ds-font-family-*` 消费，不在组件里写 literal HEX。
* **应当** Monaco 主题从 dsw token 派生，随 light/dark 与对话区同步切换。
* **应当** 文件树用 ghost hover/selected 与紧凑 22px 行，字母徽章靠右。
* **应当** 未保存 Tab 用 `editor-dirty-dot`，保存前禁止静默丢编辑缓冲。
* **应当** 异步操作用分层 Loading，避免全屏 mask。

### 禁止：

* **禁止** 在文件编辑器内引入第二套主题色或 Tailwind/组件库。
* **禁止** 用 1px 实线边框做主要分区（除输入框聚焦与 Tab 底边强调外）。
* **禁止** 全屏遮罩 blocking 整个 dsh Web（保存/加载仅编辑区内反馈）。
* **禁止** Monaco 区使用 UI sans-serif 字体。
* **禁止** 在本设计系统文档中写 Session、Workspace、Agent 等领域术语作视觉标签。
