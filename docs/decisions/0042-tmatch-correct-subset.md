# ADR-0042：T-MATCH 接受任意正确子集

- **状态**：Accepted
- **日期**：2026-11-18
- **影响条款**：DESIGN §3.4
- **相关**：`src/questionTypes/TMatch.js`

## 背景

T-MATCH 显示一个 focus 组合和多个包含该组合的词。旧判定要求选中全部正确词：

```text
correct = {rainy, rain, paint}
selected = {rainy}
→ wrong
```

孩子看到 `rainy` 是正确的词，只选它却判错，产生明显误判。

## 决定

选中集合只要满足：

```text
selected.size > 0
且 selected 中每个词都属于正确集合
```

即判定正确。

选择错误词仍判错；空选择仍判错。

## 后果

- 正面：选中任意一个明确正确的词即可完成；
- 正面：不再要求穷举所有含 focus 的词；
- 正面：仍然保留多选与错误词排除；
- 负面：不再强制孩子找出所有匹配词。

## 约束

- 不改变 T-MATCH 的 UI 结构；
- 不改变选项生成；
- 不写学习状态（仍由 Scheduler 负责）。
