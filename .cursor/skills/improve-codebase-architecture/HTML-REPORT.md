# HTML 报告格式

架构评审报告以单个自包含的 HTML 文件形式呈现，存放在操作系统临时目录中。Tailwind 和 Mermaid 均通过 CDN 引入。Mermaid 能够可靠地处理图形化图表；手写的 div 和内联 SVG 则用来处理更具说明性的视觉元素（块状图、剖面图）。将两者结合使用 —— 不要事事依赖 Mermaid，否则报告会显得千篇一律。

## 脚手架

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <title>架构评审 — {{repo name}}</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script type="module">
      import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs";
      mermaid.initialize({ startOnLoad: true, theme: "neutral", securityLevel: "loose" });
    </script>
    <style>
      /* small custom layer for things Tailwind doesn't cover cleanly:
         dashed seam lines, hand-drawn-feeling arrow heads, etc. */
      .seam { stroke-dasharray: 4 4; }
      .leak { stroke: #dc2626; }
      .deep { background: linear-gradient(135deg, #0f172a, #1e293b); }
    </style>
  </head>
  <body class="bg-stone-50 text-slate-900 font-sans">
    <main class="max-w-5xl mx-auto px-6 py-12 space-y-12">
      <header>...</header>
      <section id="candidates" class="space-y-10">...</section>
      <section id="top-recommendation">...</section>
    </main>
  </body>
</html>
```

## 页眉

包含仓库名称、日期以及一个紧凑的图例：实线框 = 模块，虚线 = 接缝，红色箭头 = 泄漏，深色粗线框 = 深层模块。没有介绍段落 —— 直接进入候选建议部分。

## 候选建议卡片

图表承担主要表达任务。文字说明简洁、平实，并使用术语表中的词汇，不加修饰。（[LANGUAGE.md](LANGUAGE.md)）。

每个候选建议为一个 `<article>` 元素：

- **标题** —— 简短，命名该深化操作（例如“折叠订单接收管道”）。
- **徽章行** —— 推荐强度（`Strong` = 翠绿色，`Worth exploring` = 琥珀色，`Speculative` = 石板灰色），外加一个依赖类别标签（`in-process`、`local-substitutable`、`ports & adapters`、`mock`）。
- **涉及文件** —— 等宽字体列表，`font-mono text-sm`。
- **前后对比图** —— 核心部分。两列并排展示。参见下方的模式。
- **问题** —— 一句话。哪里造成了困扰。
- **解决方案** —— 一句话。将会发生什么变化。
- **收益** —— 项目符号，每条不超过 6 个字。例如“测试只打一个接口”、“定价逻辑不再泄漏”、“删除 4 个浅层包装器”。
- **ADR 标注**（如果适用）—— 琥珀色框内的一行文字。

不要使用大段的解释性段落。如果图表需要配文字才能让人理解，那就重新绘制图表。

## 图表模式

选择适合该候选建议的模式。混合使用它们。不要让每个图表看起来都一模一样 —— 多样性本身就是目的的一部分。

### Mermaid 图（用于依赖/调用流的常规手段）

当要点是“X 调用 Y，Y 调用 Z，看看这团乱麻”时，使用 Mermaid 的 `flowchart` 或 `graph`。将其包裹在一个 Tailwind 样式的卡片中，这样就不会显得突兀。使用 `classDef` 将泄漏边着色为红色，将深层模块着色为深色。序列图非常适合表达“之前：6 次往返；之后：1 次”。

```html
<div class="rounded-lg border border-slate-200 bg-white p-4">
  <pre class="mermaid">
    flowchart LR
      A[OrderHandler] --> B[OrderValidator]
      B --> C[OrderRepo]
      C -.leak.-> D[PricingClient]
      classDef leak stroke:#dc2626,stroke-width:2px;
      class C,D leak
  </pre>
</div>
```

### 手绘框图和箭头（当 Mermaid 的布局与你作对时）

模块用带边框和标签的 `<div>` 表示。箭头使用内联 SVG 的 `<line>` 或 `<path>` 元素，在相对定位的容器中通过绝对定位来放置。当你想让“之后”的图表呈现为一个带有灰色内部细节的粗边框深层模块时，可以使用这种方式 —— Mermaid 无法渲染出那种合适的视觉重量。

### 剖面图（适用于表达层层浅层叠加的情况）

堆叠水平条带（`h-12 border-l-4`）来展示一次调用所经过的层级。之前：6 个薄层，每层几乎什么都没做。之后：1 个厚条带，标注了整合后的职责。

### 块状图（适用于表达“接口与实现一样宽”的情况）

每个模块有两个矩形 —— 一个代表接口表面积，一个代表实现。之前：接口矩形的高度几乎与实现矩形一样高（浅层）。之后：接口矩形很矮，实现矩形很高（深层）。

### 调用图折叠

之前：一组嵌套的方框渲染出一个函数调用树。之后：同一棵树被折叠成一个方框，原本内部的调用现在在其内部以淡化方式显示。

## 样式指南

- 偏向编辑风格，而非企业仪表板风格。留白充足。标题可选衬线字体（`font-serif` 配 stone/slate）。
- 颜色要克制：一种强调色（翠绿色或靛蓝色），加上用于泄漏的红色和用于警告的琥珀色。
- 保持图表高度约 320px，这样前后对比可以舒适地并排放置，无需滚动。
- 图表内的模块标签使用 `text-xs uppercase tracking-wider` —— 它们应该看起来像示意图，而不是 UI。
- 唯一的脚本是 Tailwind CDN 和 Mermaid ESM 导入。除此之外，报告应该是静态的 —— 没有应用代码，除了 Mermaid 自身的渲染外没有其他交互。

## 首选推荐章节

一个稍大的卡片。包含候选建议名称、一句话说明推荐理由，以及指向其卡片的锚点链接。仅此而已。

## 语气

使用平实、简洁的中文 —— 但架构方面的名词和动词直接来自 [LANGUAGE.md](LANGUAGE.md)。简洁不是偏离术语的借口。

**必须精确使用：** 模块（Module）、接口（Interface）、实现（Implementation）、深度（Depth）、深层的（deep）、浅层的（shallow）、接缝（Seam）、适配器（Adapter）、杠杆（Leverage）、局部性（Locality）。

**禁止替换为：** component、service、unit（指代 module 时）· API、signature（指代 interface 时）· boundary（指代 seam 时）· layer、wrapper（指代 module，且你本意是 module 时）。

**符合该风格的措辞示例：**

- “订单接收模块是浅层的 —— 接口几乎与实现相匹配。”
- “定价逻辑跨越接缝发生泄漏。”
- “深化：一个接口，一个测试点。”
- “两个适配器证明了该接缝的价值：生产环境用 HTTP，测试环境用内存实现。”

**收益项目符号**使用术语表中的术语来命名收益：*“局部性：bug 集中在一个模块”*、*“杠杆效应：一个接口，N 个调用点”*、*“接口缩小；实现吸收了那些包装器”*。不要写 *“更易于维护”* 或 *“代码更整洁”* —— 这些词不在术语表中，也没有资格占据这个位置。

不要含糊其辞，不要铺垫，不要写“值得注意的是……”。如果一个句子可以写成项目符号，那就把它写成项目符号。如果一个项目符号可以删掉，那就删掉它。如果一个术语不在 [LANGUAGE.md](LANGUAGE.md) 中，在发明新术语之前，先尝试使用已有的术语。
