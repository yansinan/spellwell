# ADR-0018：内容驱动计划、练习设计页与 20 题默认

- **状态**：Accepted
- **日期**：2026-11-11
- **决策者**：P9 实现
- **影响条款**：DESIGN §2.1、§3.5
- **相关**：`Scheduler.js`、`PracticeSetupScreen.js`、`practiceSettings.js`、`AdminApp.js`

## 背景

P8 之前学习端直接进入固定队列；后台内容和单元选择没有进入练习入口。
用户要求：

1. 内容驱动题目生成；
2. 前台在开始前选择练习单元和难度；
3. 前台不选题量，后台决定，默认 20；
4. 题量设置用面包屑分页；
5. 当前会话不因内容更新中断，下一轮使用新内容；
6. 为实时微调保留接口。

## 决定

### D1：练习设计页只保留孩子可理解的选择

- 单元多选（按 `unitId` / `unitLabel`）；
- 学期按“一年级上/一年级下/二年级上/二年级下”折叠，单元在学期下复选；
- 练习设计页的学期/单元标签使用中文，具体拼写题面仍保持英文；
- Review / Effort 两档；
- 不显示题量选择；
- 显示后台决定的题量（可用词不足时显示实际可出题量）；
- 开始后直接进入 PracticeScreen。

### D2：题量由后台设置

`meta.practiceSettings`：

```js
{ questionsPerPractice: 20, defaultMode: 'review' }
```

- 默认 20，范围 5—30；
- 后台页面 `/src/admin/settings.html`，面包屑“内容库 / 练习设置”；
- 前台不写题量。

### D3：单元标准

- 单词新增 `unitId` / `unitLabel`；
- 当前 seed：2026 人教新起点基础词库，583 个词、72 个单元、12 个学期；
- `grade/term/unit`：支持 1—6 年级上/下；
- 练习设计按学期折叠，学期下多选 unit；
- 学期/单元导航可中文，具体拼写题面保持英文；
- 后台按 unit 分组；
- 学习端按 unit 多选。

### D4：内容驱动与 revision

- `meta.contentRevision` 在后台保存时递增；
- 学习端开始新练习前重新读取内容；
- 当前会话不重建；
- BroadcastChannel 只提示 `New practice`；
- 下一轮计划使用新 revision。

### D5：Review / Effort

- Review：到期/错词优先，旧词填充优先于新词，题型偏 T-FILL/T-SEQUENCE；
- Effort：新词优先于填充，题型偏 T-TYPE；
- 错词/边界/顺序修复约束始终优先，mode 不覆盖修复。
- 每个 spec 带：
```js
params.plan = { reason, mode, policyVersion: 1 }
```

### D6：实时微调预留

`src/scheduler/PlanPolicy.js` 提供 `revisePlan({plan, attempt})`。
P9 固定返回 `changed:false`，当前题目不实时替换。
未来可以在 attempt 后调整尚未开始的计划项。

## 后果

- 正面：练习入口可控、题量由后台统一、单元/模式可解释。
- 正面：内容更新不打断当前题，下一轮重新读内容。
- 负面：当前选择仍是规则优先级 + mode 侧重，未做权重校准。
- 负面：题量默认20但内容不足时实际题数会少于20。
- 约束：前台不写题量；后台不写学习状态。

## 被否决的方案

| 方案 | 否决原因 |
|---|---|
| 前台选题量 | 孩子无法判断，且与后台设置冲突 |
| 固定 5—8 题 | 用户明确默认20 |
| 内容更新自动 reload | 会丢失当前题 |
| 每题实时换题型 | 复杂度和可解释性不足，P9 只预留 |
