# ADR-0006：难度梯度与选题计算

- **状态**：Accepted（方向确定，权重在 P3 校准）
- **日期**：2026-11-11
- **决策者**：P1 交互修订
- **影响条款**：DESIGN §3.5
- **相关**：`docs/DESIGN.md §3.5`、`docs/decisions/0004-unit-granularity.md`、未来的 `Scheduler` / `DifficultyPolicy`

## 背景

P1 的 T-SEQUENCE 同时支持 grapheme 块和未来可能的 letter/mixed 粒度。
如果只按“题型 ID”或“词长”选难度，会把下面两组错误地当成同一难度：

- `fish` → `f` / `i` / `sh`（较易，组合块）
- `fish` → `f` / `i` / `s` / `h`（较难，逐字母）

同样，`T-FILL`（只填一个空位）、`T-SEQUENCE`（排全部单位）、`T-TYPE`（无候选块整词输入）
也不是三个可以互换的“题型标签”，它们提供不同强度的脚手架。

## 决定

### D1：grapheme 块选难度低于字母级拼写

在**同一词、同一脚手架、同一候选池**下，固定偏序：

```text
grapheme < mixed < letter
```

理由：字母级要求维持组合内部字母顺序，拆掉了“组合是一个整体”的线索，工作记忆负荷更高。
这条规则写入 DESIGN §3.5，是所有后续难度计算的硬约束。

### D2：难度是向量，不是单一题型 ID

`QuestionSpec.params.difficulty` 至少记录：

```js
{
  scaffold: 'fill' | 'sequence' | 'type',
  granularity: 'grapheme' | 'mixed' | 'letter',
  slotCount,
  letterCount,
  graphemeTierMax: 1 | 2 | 3 | 4,
  distractorCount,
  confusableCount,
  inputMode: 'tap' | 'drag' | 'keyboard'
}
```

- 题型 ID 只表示脚手架，不表示难度；
- 同一题型可以出现在不同难度；
- 不能用一个固定总分覆盖所有维度，除非 P3 用真实数据校准权重。

### D3：P3 才计算 scalar，当前不写死权重

P3 的 `DifficultyPolicy`：

1. 先满足到期、错词修复、组合强化等约束；
2. 在可行集合里选择接近目标难度的题；
3. 新词从较易的 grapheme/fill 开始，随连续正确逐步升到 mixed/letter/type；
4. 错误修复可以临时提高难度（如边界错 → 拆字母），但必须记录本次难度向量；
5. 假掌握抽查使用更高粒度/更少脚手架，不能只用 grapheme 连续正确判定 `mastered`。

P1 不实现权重、不做难度排序、不改变当前固定 9 题队列。

### D4：难度与错误画像分开存储

难度向量是“这道题有多难”，错误画像是“这次错在哪”。两者都可以进入 attempt/状态，
但不能用难度参数推断错误类型，也不能用错误类型反推难度。

## 后果

- 正面：后续选题不会把组合块和字母级混为一谈；难度可解释、可校准；家长端能解释“为什么这次更难”。
- 负面：P3 需要更多字段与数据校准；同一词不同粒度会产生不同 spec，需要去重/统计策略。
- 当前：P1 只实现 grapheme；letter/mixed 在 P3/P4 实现（ADR-0004）。

## 被否决的方案

| 方案 | 否决原因 |
|---|---|
| 用题型 ID 直接当难度值 | 同题型不同粒度/脚手架差异很大 |
| 用词长作为唯一难度 | 忽略组合层级、干扰项、输入方式 |
| P1 立即写死一个总分 | 没有数据，容易把教学判断固化成错误权重 |
| 把难度和错误类型混在一个字段 | 报表与调度都会失去解释性 |
