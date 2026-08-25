# 何时使用 Mock

仅在**系统边界**处使用 Mock：

- 外部 API（支付、邮件等）
- 数据库（有时 — 优先使用测试数据库）
- 时间 / 随机数
- 文件系统（有时）

不要 Mock：

- 你自己的类/模块
- 内部协作对象
- 任何你能控制的东西

## 为可 Mock 性设计

在系统边界处，设计易于 Mock 的接口：

**1. 使用依赖注入**

将外部依赖通过参数传入，而不是在内部创建它们：

```typescript
// 易于 Mock
function processPayment(order, paymentClient) {
  return paymentClient.charge(order.total);
}

// 难以 Mock
function processPayment(order) {
  const client = new StripeClient(process.env.STRIPE_KEY);
  return client.charge(order.total);
}
```

**2. 优先使用 SDK 风格的接口，而不是通用的fetcher**

为每个外部操作创建具体的函数，而不是使用一个包含条件逻辑的通用函数：

```typescript
// 好的设计：每个函数都可以独立进行 Mock
const api = {
  getUser: (id) => fetch(`/users/${id}`),
  getOrders: (userId) => fetch(`/users/${userId}/orders`),
  createOrder: (data) => fetch('/orders', { method: 'POST', body: data }),
};

// 不好的设计：Mock 需要在 Mock 内部编写条件逻辑
const api = {
  fetch: (endpoint, options) => fetch(endpoint, options),
};
```

SDK 风格的方法意味着：

- 每个 Mock 返回一种特定的数据结构
- 测试设置中没有条件逻辑
- 更容易看出一个测试调用了哪些端点
- 每个端点都有类型安全
