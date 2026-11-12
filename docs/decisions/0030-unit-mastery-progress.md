# ADR-0030：单元掌握总进度

- **状态**：Accepted
- **日期**：2026-11-12
- **影响条款**：DESIGN §2.1
- **相关**：`masteryProgress.js`、`PracticeSetupScreen.js`

## 背景

只显示 Done/Next 不能反映单元掌握程度；用户要求按记忆曲线 + 错题修正计算总进度，
用整行背景条和百分比显示。

## 决定

### D1：单词进度（真实数据校准）

```text
model = memory × 0.55 + streak × 0.45 - errorPenalty - wrongPenalty
observed = correct + wrong
empirical = (correct + globalAccuracy × 4) / (observed + 4)
confidence = min(1, observed / 8)
progress = model × (1 - 0.45 × confidence)
         + empirical × (0.45 × confidence)
```

- `memory = intervalIndex / MAX_INTERVAL_INDEX`；
- `streak = min(consecutiveCorrect, 3) / 3`；
- `errorPenalty` 按 errorProfile 有界惩罚；
- `empirical` 来自真实 attempts，`globalAccuracy` 作为小样本先验；
- 样本越多，真实答题准确率权重越高；
- `status=mastered` 且 `errorProfile=[]` → 100%；
- 未练词 → 0%。

### D2：单元进度

```text
unit.progress = 所有词 progress 的平均值
unit.percent = round(progress × 100)
```

未练词计 0，所以“只练了一个词”的单元不会显示 100%。

### D3：展示

练习设计页每个 unit：

```text
[背景进度条 62%]
一年级上 · 第1单元       62% · 5/8
```

- 整行背景从左到右填充；
- 文字和复选框在上层；
- 0% 仍显示，便于识别未开始；
- `mastered` 100% 的单元仍可手动复习，但默认不自动选。

## 后果

- 正面：进度同时反映记忆曲线和错题；
- 正面：单元之间可横向比较；
- 正面：默认选择与视觉进度一致；
- 负面：公式现在由真实 attempts 校准；仍是可解释的统计模型，不是黑箱。
