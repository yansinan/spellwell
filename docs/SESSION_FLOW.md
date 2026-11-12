# 练习流程与出题顺序

## 0. 默认选择

- 自动选择所有 `practiced > 0 && !mastered` 的单元；
- 完全 mastered 默认不加入；
- 复习单元全部 completed 且题量有空间时，自动加一个下一个新单元；
- 设计页保留；自动结果作为默认勾选，孩子点 Start；练习页 `Units` 可回设计页手动选。

## 1. 会话顺序

每次练习固定四段，从稳定到新授再到巩固：

```text
1. Warm-up  修复到期错词
2. Review   到期复习
3. New      新词
4. Practice 巩固/填充
```

界面在题型上方显示当前阶段（`WARM-UP / REVIEW / NEW WORD / PRACTICE`）。
不会再把错词、到期词、新词随机混在一起。

## 2. 题型策略

| 阶段 | 题型 |
|---|---|
| 修复 | 按错误画像：TRANSPOSITION→T-REORDER，SUBSTITUTION→T-EDIT，OMISSION→T-FILL，BOUNDARY→T-SEGMENT |
| probe | 有句子→T-CLOZE，无句子→T-JUDGE-FIX |
| 新词 | Review 模式→T-SEQUENCE；Effort 模式→T-FILL |
| 到期复习 | interval < 2→T-FILL；interval ≥ 2→T-TYPE |
| 巩固 | Review→T-FILL；Effort→T-TYPE |

原则：

- 新词先“搭出来”，不是直接默写；
- 到期词逐步转向回忆（T-TYPE）；
- 错词永远优先修复，不被 mode 覆盖；
- T-MATCH 是组合强化旁路，最多 1 题。

## 3. 记忆曲线

- 错词次日必现；
- 到期词按 interval 进入 Review；
- 答对升级 interval，答错降档；
- probe 用于假掌握抽查；
- 练习结束的错词仍由 Scheduler 记录，下一次回来。

## 4. 错误重试

答错后：

- 显示正确答案；
- 不进入下一题；
- 允许重试到正确；
- 只把第一次作答写入学习状态；
- 因此错词仍按记忆曲线复习，不会被重试掩盖。

## 5. 输入体验

- T-TYPE 只用中文语义/音标提示，不显示目标单词；句子提示留给 T-CLOZE；
- T-TYPE/T-EDIT/T-CLOZE 自动聚焦输入框；
- 输入正确时自动提交，不需回车；
- 选择类题型在正确/齐备时自动提交；
- 中文输入法 composition 期间的 Enter 不会触发提交；
- Enter 可确认/重试，不替代正在自动推进的下一题。

## 6. 结束页

先正确率（first-try），再鼓励语，再错词列表。
