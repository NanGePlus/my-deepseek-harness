# 好的测试与不好的测试

## 好的测试

**集成风格**：通过真实的接口进行测试，而不是通过内部模块的模拟。

```typescript
// 好的测试：测试可观察的行为
test("user can checkout with valid cart", async () => {
  const cart = createCart();
  cart.add(product);
  const result = await checkout(cart, paymentMethod);
  expect(result.status).toBe("confirmed");
});
```

特征：

- 测试用户/调用者关心的行为
- 仅使用公共 API
- 在内部重构后依然有效
- 描述**做什么**，而不是**怎么做**
- 每个测试包含一个逻辑断言

## 不好的测试

**实现细节测试**：与内部结构耦合。

```typescript
// 不好的测试：测试实现细节
test("checkout calls paymentService.process", async () => {
  const mockPayment = jest.mock(paymentService);
  await checkout(cart, payment);
  expect(mockPayment.process).toHaveBeenCalledWith(cart.total);
});
```

危险信号：

- 模拟内部协作对象
- 测试私有方法
- 断言调用次数/顺序
- 重构时测试失败，但行为未改变
- 测试名称描述**怎么做**而不是**做什么**
- 通过外部手段而非接口进行验证

```typescript
// 不好的测试：绕过接口进行验证
test("createUser saves to database", async () => {
  await createUser({ name: "Alice" });
  const row = await db.query("SELECT * FROM users WHERE name = ?", ["Alice"]);
  expect(row).toBeDefined();
});

// 好的测试：通过接口进行验证
test("createUser makes user retrievable", async () => {
  const user = await createUser({ name: "Alice" });
  const retrieved = await getUser(user.id);
  expect(retrieved.name).toBe("Alice");
});
```

## UI Issue：States 矩阵驱动（E2E / 集成 UI）

一行矩阵 = 一个测试场景；用 **test seam** 触发变体态，断言 **可观察预期**（文案、按钮 disabled、空态引导），不断言 CSS 类或像素。

```typescript
// 好的测试：对照 States 矩阵 default 行
test("booking store list shows stores and enables next when one selected", async () => {
  await page.goto("/booking/store");
  await expect(page.getByRole("button", { name: "下一步" })).toBeDisabled();
  await page.getByText("朝阳店").click();
  await expect(page.getByRole("button", { name: "下一步" })).toBeEnabled();
});

// 好的测试：对照 States 矩阵 empty 行（API fixture 返回空列表）
test("booking store empty state shows guidance copy", async () => {
  await stubStoresApi({ stores: [] });
  await page.goto("/booking/store");
  await expect(page.getByText("暂无门店可选")).toBeVisible();
});

// 不好的测试：测实现细节
test("StoreList renders empty-state class", async () => {
  await page.goto("/booking/store");
  expect(await page.locator(".empty-state")).toHaveCount(1);
});
```

参见 [ui-issues.md](ui-issues.md) § States 矩阵 → 测试映射。
