# ADR-0031：元音组合拆字母练习

- **状态**：Accepted
- **日期**：2026-11-12
- **影响条款**：DESIGN §3.4
- **相关**：`Capture`、`QuestionSpecBuilder`、`TFill`、`PracticeScreen`

## 背景

词库把 `ai/ea/ee/oo/ou/...` 作为一个 grapheme unit。
T-FILL 只会空一个 unit，孩子一直练整块组合，缺少“把组合拆开逐字母”的准确度练习。

## 决定

### D1：T-FILL 可选 vowelSplit

对 `word.units` 中纯元音组合（`/^[aeiou]{2,4}$/`）：
约 1/3 的 T-FILL spec 使用：

```json
{
  "vowelSplit": {
    "unitIndex": 1,
    "letters": ["a", "i"]
  }
}
```

例：

```text
rain = r / ai / n
→ r _ _ n
```

孩子分别选 `a`、`i`。

### D2：渲染

- 排除原组合块 `ai`；
- 增加两个单字母 tile；
- 两个空位分别选择；
- 两个都填满才自动提交；
- 保留原来的多空 T-FILL 机制。

### D3：判定

- 两个字母都正确 → wordCorrect；
- 错误位置映射回原 unit index；
- 不修改词库 units，不破坏连续拼接契约。

### D4：概率

- 只在 T-FILL；
- 只对纯元音组合；
- 约 1/3，由 `word.id + seed` 稳定决定；
- 不是每道题都拆，仍保留整块组合练习。

## 后果

- 正面：既练组合整体，也练逐字母准确度；
- 正面：无需改内容 units；
- 负面：两个空位比单空难，仍属于 T-FILL 内部难度变化。
