# ADR-0012：判断纠错、语境抽查与 probe 迁移

- **状态**：Accepted
- **日期**：2026-11-11
- **决策者**：P6 实现
- **影响条款**：DESIGN §1.3、§2.1、§3.4
- **相关**：`TJudgeFix.js`、`TCloze.js`、`Scheduler.js`、`PracticeScreen.js`

## 背景

P6 要用 T-JUDGE-FIX/T-CLOZE 拦截“只会特定题型”的假掌握，并让 60 天 probe 真正生效。
DESIGN 只定义目标，没有定义判断/修正事件、probe 状态迁移和队列优先。

## 决定

### D1：T-JUDGE-FIX = 判断 + 可选修正

- build 显示一个 claim（声称答案）；
- 孩子选 `Correct` / `Wrong`（`tap-unit: judge:correct|judge:wrong`）；
- 选 Wrong 时显示预填输入框，提交 `edit(text)`；
- judge：
  - claim 对 + 判对 → correct；
  - claim 错 + 判错 + 改对 → correct；
  - claim 错 + 判对 → wrong（假接受）；
  - claim 对 + 判错 → wrong（假拒绝）；
- 判断与修正分开，避免“判断对但不会拼”被算对。

### D2：T-CLOZE = 句子挖空 + 拼写输入

- `params.sentence` 来自 sentences 内容；
- build 把目标词替换为 `____`；
- 孩子输入完整词；judge 复用整词分析；
- 不做选项、不做听力。

### D3：probe 状态迁移

- 词在 30 天满档且连续正确 ≥3 → `status='probe'`，`dueDate = today + 60`；
- probe 到期后队列优先选 T-CLOZE（有句子）或 T-JUDGE-FIX（无句子）；
- probe 答对 → `mastered`，`dueDate=null`；
- probe 答错 → `learning`，`intervalIndex=0`，`dueDate=明天`，错误画像回写；
- 组合的 probe 只作为候选，不直接改词状态。

### D4：UI 保持低龄可读

- T-JUDGE-FIX：显示 claim + 两个短按钮；选 Wrong 才出现编辑框；
- T-CLOZE：显示短句 + 输入框；
- 都不显示正确率/积分；不引入选择题。

## 后果

- 正面：假掌握会在 60 天后被更高提取难度的题型验证；答错回学习。
- 正面：判断/修正、语境拼写与 P1/P4 的脚手架区分开。
- 负面：T-JUDGE-FIX 的 claim 目前由 Scheduler 生成；真实错误历史可后续增强。
- 负面：只有 4 条 sentences，T-CLOZE 覆盖面有限；P7 后台补内容。
- 约束：probe 不跳过 P5 组合状态；组合 probe 候选留给后续。

## 被否决的方案

| 方案 | 否决原因 |
|---|---|
| T-JUDGE-FIX 只做对/错选择 | 违反“判断+改错”，无法验证拼写 |
| T-CLOZE 给选项 | 违反不做选择题 |
| probe 答错只降档不退回 | 假掌握无法被拦下 |
| probe 永久 60 天 | 答对后无法进入 mastered |
