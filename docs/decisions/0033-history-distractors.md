# ADR-0033：历史错误优先于人工相似组

- **状态**：Accepted
- **日期**：2026-11-12
- **影响条款**：DESIGN §3.4
- **相关**：`ErrorHistory.js`、`QuestionSpecBuilder`、`Scheduler`

## 背景

人工相似组（ir/er/ur）是次优先项。
如果孩子实际把 `bird` 写成 `berd`，下一次 T-FILL 应该优先出现 `er`，
而不是只按静态表随机选。

## 决定

### D1：历史来源

从所有 attempts 的 `firstError` 聚合：

```text
wordId + expected + actual + 次数 + 最近时间
```

即使后来答对、`wordState.errorProfile` 被清空，历史 attempts 仍保留。

### D2：优先级

T-FILL/T-SEQUENCE 干扰项：

```text
1. 同一词的历史 actual
2. 同一 expected 的跨词历史 actual
3. 人工相似组
4. 随机多字母组合
```

例如：

```text
bird 曾经 ir → er
下一次 b _ _ d 候选：er / ur / ir
```

### D3：T-MATCH

目标组合的历史 actual 对应的组合，优先选含该组合的干扰词。

### D4：边界

- 只读 attempts，不写状态；
- 历史 actual 必须在当前候选池中存在才使用；
- 最多取 2 个历史/相似干扰项；
- 没有历史时退回静态相似组，不阻塞出题。

## 后果

- 正面：干扰项跟孩子真实错误走；
- 正面：历史错误不会被“后来答对”覆盖；
- 正面：静态相似组仍有兜底；
- 负面：attempts 很多时需要一次全量聚合，后续可做缓存。
