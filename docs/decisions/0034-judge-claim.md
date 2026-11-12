# ADR-0034：T-JUDGE-FIX 的可信错误 claim

- **状态**：Accepted
- **日期**：2026-11-12
- **影响条款**：DESIGN §3.4
- **相关**：`QuestionSpecBuilder`、`Scheduler`

## 背景

审查队列时发现 T-JUDGE-FIX 的 `claim` 被调度器固定传成 `word.text`，
因此它总是显示正确拼写，孩子只要点 Correct 就能通过，判断环节没有难度。

## 决定

### D1：约一半正确、一半可信错误

`buildWordSpec` 在 T-JUDGE-FIX 未显式传入 claim 时，用 `word.id + seed` 决定：

- 50%：claim = 正确词；
- 50%：从历史 actual 或人工相似组替换一个 unit，生成可信错词。

例：

```text
bird → berd / burd
bread → bred / brad
```

### D2：优先历史错误

错词 claim 的替换候选顺序：

1. 同词历史 actual；
2. 同 expected 跨词历史 actual；
3. 人工相似组。

### D3：不改判定契约

仍然是：

```text
Correct / Wrong
Wrong → 输入正确拼写
```

不改成“两个完整单词二选一”，保留判断 + 改错的诊断价值。

## 后果

- 正面：不会再出现 100% claim 正确的判断题；
- 正面：错词 claim 与真实错误/相似组相关；
- 负面：判断题仍有 50% 的二元猜测空间，但 Wrong 分支要求改对。
