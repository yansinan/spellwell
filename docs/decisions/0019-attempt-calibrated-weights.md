# ADR-0019：用真实 attempts 校准选词权重

- **状态**：Accepted
- **日期**：2026-11-11
- **决策者**：P9 权重校准
- **影响条款**：DESIGN §3.5
- **相关**：`SelectionWeights.js`、`Scheduler.js`

## 背景

P9 第一版选词只有“错词/到期/新词/填充”的硬优先级，没有使用历史答题数据。
用户要求做真实权重校准。

## 决定

### D1：按词、按题型统计真实错误率

从 `attempts` 读取最近记录：

- `byWord[wordId] = {wrong, correct, errorRate}`；
- `byType[typeId] = {wrong, correct, errorRate}`；
- `sampleSize / globalErrorRate`。

### D2：小样本平滑

避免 1 次答错就把词权重推到极端：

```text
errorRate = (wrong + 0.35 * 2) / (total + 2)
```

无历史记录使用先验 `0.35`，不使用全局错误率（全局可能是 1.0，会误伤新词）。

### D3：权重进入排序与计划

`scoreWord` 组合：

- 无状态的新词基础分；
- 错误画像/到期/probe 约束；
- 实际词错误率；
- 错误次数；
- Review/Effort 的 interval 偏好。

同层候选按 score 降序，tie 用 wordId 稳定排序。
spec 记录：

```js
params.plan.score
params.plan.calibration = { sampleSize, globalErrorRate, wordErrorRate }
```

### D4：约束优先

- 错词/错误画像/到期仍由硬优先级保证；
- 权重只影响同层排序；
- 不因为权重破坏“答错次日必现”。

### D5：不做实时改题

P9 不根据本次 attempt 立即替换当前队列；`PlanPolicy.revise()` 仍为预留。
下一次计划会重新读取 attempts 并校准。

## 后果

- 正面：有错误历史的词在同等条件下更早出现；
- 正面：权重可解释、可测试；
- 负面：当前样本量小，初期接近先验；
- 负面：权重是线性规则，不是机器学习模型；
- 负面：每次 buildDailyQueue 读取最近 1000 条 attempts，数据量大后需聚合表。
