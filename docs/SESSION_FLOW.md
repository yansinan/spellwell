# 练习流程与出题顺序

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

## 5. 结束页

先正确率（first-try），再鼓励语，再错词列表。
