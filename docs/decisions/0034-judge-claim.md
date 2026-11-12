# ADR-0034：T-JUDGE-FIX 的可信错误 claim

- **状态**：Accepted
- **日期**：2026-11-12
- **影响条款**：DESIGN §3.4
- **相关**：`QuestionSpecBuilder`、`Scheduler`

## 背景

审查队列时发现 T-JUDGE-FIX 的 `claim` 被调度器固定传成 `word.text`，
因此它总是显示正确拼写，孩子只要点 Correct 就能通过，判断环节没有难度。

## 决定

### D1：只在该词有历史错误时生成

T-JUDGE-FIX 不再对没有历史错误的词生成。
probe 无句子时：

- 有该词自己的历史错误 → T-JUDGE-FIX；
- 没有 → T-TYPE。

判断题 claim 只使用该词自己的历史 actual，并回放到对应 unit。

例：

```text
bird 曾把 ir 写成 er
→ claim = berd
```

### D2：回放自己的错误

错词 claim 只使用：

```text
同词历史 actual + expected/unitId
```

不跨词、不使用人工相似组代替。

### D3：不改判定契约

仍然是：

```text
Correct / Wrong
Wrong → 输入正确拼写
```

不改成“两个完整单词二选一”，保留判断 + 改错的诊断价值。

## 后果

- 正面：没有错题历史时不会出现无逻辑的判断题；
- 正面：有历史时回放孩子自己的错误；
- 负面：判断题数量会明显减少，集中在错题回顾。
