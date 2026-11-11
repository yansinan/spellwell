# ADR-0014：前台学习分析与历史答题统计

- **状态**：Accepted
- **日期**：2026-11-11
- **决策者**：P8 新增阶段
- **影响条款**：DESIGN §2.1/§2.2、§5.2
- **相关**：`src/ui/analytics.js`、`PracticeScreen`

## 背景

P7 之前只有当前题目的即时反馈，没有“本次练习效果”和“历史答题情况”的前台视图。
家长需要看到具体卡点，孩子也需要知道本次练习完成得怎样，但产品仍不能变成积分/排行榜。

## 决定

### D1：新增 P8 学习分析阶段，输入适配顺延 P9

原 P8（Pointer/Keyboard）向后顺延为 P9；挑战/平移依次为 P10/P11。
新增 P8 只做统计与展示，不改判定、不改调度。

### D2：纯统计函数与 UI 分离

`src/ui/analytics.js` 提供：

- `summarizeSession(results)`：本次正确数/正确率/错误类型；
- `summarizeAttempts(attempts)`：历史汇总、按词、错误类型；
- `groupAttemptsByDay(attempts)`：按本地日历日聚合；
- `summarizeWordStates(states)`：learning/reviewing/probe/mastered 分布；
- `buildReport({attempts, wordStates, graphemeStates})`。

不读库、不渲染、不写状态。

### D3：前台两个入口

- 每题 Header 增加 `Stats`，随时查看历史报告；
- Done 页显示本次 `correct / total · accuracy`；
- 报告包含：本次练习、历史总览、最近 5 天、词状态、最近 10 次答题。

### D4：不做积分/排名

- 不显示积分、连胜、排行榜、“超过多少人”；
- 不用红色失败；仅用中性 ✓/• 与错误类型；
- 文案保持学习诊断，不是游戏奖励。

### D5：历史数据只读

- `loadReport` 从 AttemptRepository/StateRepository/adapter 读取；
- 报告页不提供修改状态入口；
- 不写 wordStates/graphemeStates/attempts。

## 后果

- 正面：家长能看到具体错误类型/日期；孩子能看到本次完成度；历史数据可追溯。
- 负面：报告是只读视图，不能删除单条 attempt；数据管理留后续。
- 负面：当前最近 10/5 天是固定窗口，暂不做筛选。
- 约束：统计结果不参与调度，不能反向影响 Scheduler。

## 被否决的方案

| 方案 | 否决原因 |
|---|---|
| 只显示正确率 | 无法看到具体卡点 |
| 做积分/排行榜 | 违反产品边界 |
| 报告页直接改状态 | 越权，且破坏调度一致性 |
| 在 analytics 里查库 | 破坏纯函数与可测试性 |
