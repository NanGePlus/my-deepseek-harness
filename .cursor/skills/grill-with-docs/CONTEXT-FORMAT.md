# CONTEXT.md 格式

## 结构

```md
# {上下文名称}

{一两句话描述此上下文是什么以及为何存在。}

## 领域语言

**服务 (Service)**：
门店提供的可预约项目；含名称、占用时长与展示价（参考价，非成交价）。v1 不涉及在线付款。店长可启用或停用；停用后不可新约，已有预约不受影响。
_避免使用_: 商品 (Product), 项目 (Item)

**预约 (Booking)**：
顾客选定一项服务并占用某个时段的记录；含唯一 **预约码 (Booking Code)**，供店员核销时检索。
_避免使用_: 订单 (Order), 挂号 (Registration)

### 角色

**店员 (Staff)**：
管理端一线操作者；可查看预约、核销、代客取消。
_避免使用_: 员工 (Employee), 客服 (Agent)

**店长 (Manager)**：
管理端配置者；拥有店员全部权限，并可管理服务目录、营业时间、时段容量与店员账号。
_避免使用_: 管理员 (Admin), 老板 (Owner)
```

## 规则

- **要有主见。** 当同一个概念有多个词时，选出最好的一个，把其他的列在 `_避免使用_` 下。
- **定义要精炼。** 最多一两句话。定义它**是什么**，而不是它做什么。
- **仅包含本项目上下文特有的术语。** 通用的编程概念（超时、错误类型、工具模式）即使项目大量使用，也不属于这里。在添加术语之前，先问：这是本上下文独有的概念，还是通用的编程概念？只有前者才属于这里。
- **自然聚类时用子标题分组。** 如果所有术语都属于一个内聚的领域，使用扁平列表也可以。

## 单上下文 vs 多上下文仓库

**单上下文（大多数仓库）：** 仓库根目录一个 `CONTEXT.md`。

**多上下文：** 根目录 `CONTEXT-MAP.md` 列出上下文、位置及相互关系：

```md
# 上下文地图

## 上下文

- [Ordering](./src/ordering/CONTEXT.md) — 接收并跟踪客户订单
- [Billing](./src/billing/CONTEXT.md) — 生成发票并处理付款
- [Fulfillment](./src/fulfillment/CONTEXT.md) — 管理仓库拣货与发货

## 关系

- **Ordering → Fulfillment**：Ordering 发出 `OrderPlaced` 事件；Fulfillment 消费以开始拣货
- **Fulfillment → Billing**：Fulfillment 发出 `ShipmentDispatched` 事件；Billing 消费以生成发票
- **Ordering ↔ Billing**：共享 `CustomerId` 与 `Money` 类型
```

skill 推断适用哪种结构：

- 若存在 `CONTEXT-MAP.md`，读取以定位上下文
- 若仅有根目录 `CONTEXT.md`，则为单上下文
- 若两者皆无，在首个术语确定时惰性创建根目录 `CONTEXT.md`

多上下文时，推断当前主题属于哪个。若不明确，询问。
