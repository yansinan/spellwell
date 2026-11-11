# ADR-0009：每日队列、错词优先级与状态写入

- **状态**：Accepted
- **日期**：2026-11-11
- **决策者**：P3 实现
- **影响条款**：DESIGN §1.3、§2.1、§3.3
- **相关**：`src/scheduler/Scheduler.js`、`QuestionSpecBuilder.js`、`src/ui/bootstrap.js`

## 背景

P3 需要把 P2 的内容持久化接到“每日 5—8 个词、错词次日必现、按错误类型选题型”。
DESIGN 只定义了目标和间隔阶梯，没有规定队列排序、满额截断、状态迁移细节。

## 决定

### D1：队列 5—8 个唯一词，默认 6

- `size` 允许 5..8，非法值直接报错，不静默截断；
- 优先顺序：
  1. 到期且 `lastResult === 'wrong'` 或 `errorProfile.length > 0` 的词；
  2. 其他到期复习词；
  3. 无状态的新词；
  4. 未掌握但未到期的填充词（保证 5 个下限）。
- 同一词只出现一次；超过上限时优先保留错词。

### D2：答错排到次日，答对升档

- 复用 `IntervalPolicy.applyWordReview`：
  - 答错：`intervalIndex = max(0, index - 2)`；同一词连续错则归零；
  - 答对：升一档，封顶 30 天；
- 答错后 `dueDate = 明天`，次日队列优先拉回；
- 答对后清空 `errorProfile`，因为本轮错误已修复；错误类型仍保留在 `attempts` 历史里。

### D3：错误画像驱动题型

- 取 `wordState.errorProfile` 最后一条错误类型；
- `selectType({ errorType, seed, available: P1_AVAILABLE_TYPES })`；
- P3 只有 P1 三题型，映射到 P4 的偏好会被 `available` 过滤，再回退 `UNKNOWN`；
- 新词按 `T-SEQUENCE → T-FILL → T-TYPE` 轮转；
- 题型选择由 seed 决定，不读 `Math.random`。

### D4：每个 spec 记录 P3 难度向量

`QuestionSpecBuilder` 写入：

```js
params.difficulty = {
  scaffold, granularity: 'grapheme', slotCount, letterCount,
  graphemeTierMax, distractorCount: 0|1,
  confusableCount: 0, inputMode: 'tap'|'keyboard'
}
```

P3 只实现 grapheme；letter/mixed 仍按 ADR-0004 留给 P3/P4 后续校准。

### D5：UI 只负责提交结果，状态由 Scheduler 写

- `PracticeScreen` 接受 `onResult` 回调，在 judge 后 `await scheduler.recordAttempt(result)`；
- `PracticeSession` 允许注入 Scheduler 产出的 specs；
- 队列大小直接显示为 `1 / 6`，不新增积分/连胜；
- 不做家长端完整报表（P3 可选，未做）。

## 后果

- 正面：答错次日必现；队列 5—8；状态与 attempts 落 IndexedDB；刷新不丢。
- 负面：同一天再次打开会重新组队，可能和刚完成的队列顺序不同；P3 不缓存“今日队列快照”。
- 负面：`mastered` 与 60 天抽查仍留 P6；P3 最高状态为 `reviewing`。
- 约束：P3 不实现 P4 题型，因此顺序/边界错误只能降级到 P1 题型。

## 被否决的方案

| 方案 | 否决原因 |
|---|---|
| 固定 9 题 × 3 词 | 不是每日队列，无法次日调度 |
| 只在内存更新状态 | 刷新丢失，P2 已具备持久化 |
| 答错清零 | 违背 DESIGN“降 2 档、再错才归零” |
| 用 `Math.random` 选题 | 不可复现，违反铁律 |
| 今天队列写入内容库 | 队列是调度状态，不属于内容 |
