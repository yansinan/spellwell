# 出题逻辑审查

> 基于当前 P9 调度器，用真实内容 + MemoryAdapter 构造不同学习状态，检查题型分布。
> 审查时间：2026-11-12。

## 1. 审查场景

| 场景 | 队列结果 |
|---|---|
| 全新词 | T-SEQUENCE 20/20 |
| 6 个已学，interval=0 | T-FILL 6 + 新词 T-SEQUENCE 14 |
| 6 个已学，interval=2 | T-TYPE 6 + 新词 T-SEQUENCE 14 |
| 6 个已学且答错 | T-EDIT 6 + 新词 T-SEQUENCE 14 |
| probe 且有句子 | T-CLOZE 1 |
| probe 且无句子 | T-JUDGE-FIX 1 |

在真实练习里，题量由所选 unit 的词数限制，不会一定凑满 20。

## 2. 结论

### 2.1 不是“判断题偏多”

T-JUDGE-FIX 只在 probe 状态、该词没有句子、且该词有历史错误时出现；否则用 T-TYPE。
普通新词/复习/错词修复分别进入：

```text
T-SEQUENCE / T-FILL / T-TYPE / T-EDIT
```

所以正常队列里 T-JUDGE-FIX 不会占多数。

### 2.2 判断题之前确实“太简单”

审查发现调度器把：

```js
claim: String(word.text)
```

固定传给 T-JUDGE-FIX，因此 claim 永远是正确词，
孩子只要点 Correct 就能过。

已修复为只在该词有历史错误时生成，claim 回放该词自己的错误：

```text
bird 曾经 ir → er
→ b _ _ d 的判断题 claim = berd
```

### 2.3 为什么不改成“两个完整单词二选一”

- 当前 T-JUDGE-FIX 已经是 Correct / Wrong 二选一；
- 选错后还必须输入正确拼写，保留“判断 + 改错”的诊断价值；
- 如果改成两个完整单词二选一，会变成纯识别，和 T-FILL/T-MATCH 重叠，
  也违背以拼写输出为主的设计。

因此本轮保留判断题结构，只修 claim 的真实性。

## 3. 仍可观察的问题

- probe 词如果很多，T-CLOZE/T-JUDGE-FIX 会集中出现；
- 新词队列可能连续大量 T-SEQUENCE，属于设计预期，但体验上可增加阶段标签；
- 后续可用真实首答正确率决定是否降低/提高 T-JUDGE-FIX 比例。
