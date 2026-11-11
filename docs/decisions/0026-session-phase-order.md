# ADR-0026：练习阶段顺序与题型策略

- **状态**：Accepted
- **日期**：2026-11-12
- **影响条款**：DESIGN §2.1、§3.4
- **相关**：`Scheduler.js`、`PracticeScreen.js`

## 背景

原先题目顺序是错词/到期/新词/填充混合，新词题型按 `index % 3` 轮转，
孩子感知为“题型随机、不知道为什么出这道”。

## 决定

### D1：固定四段

```text
Warm-up (repair) → Review → New → Practice
```

- 修复错词永远最前；
- 到期复习其次；
- 新词再次；
- 填充最后。

### D2：阶段决定题型

新词：

- Review：T-SEQUENCE（先搭再拼）；
- Effort：T-FILL（少一点支架）。

到期复习：

- interval < 2：T-FILL；
- interval ≥ 2：T-TYPE（逐步转向回忆）。

巩固：

- Review：T-FILL；
- Effort：T-TYPE。

错误画像、probe 仍优先，不因阶段覆盖。

### D3：计划 metadata

```js
spec.params.plan.phase = 'repair'|'review'|'new'|'practice'
spec.params.plan.typeReason = 'repair'|'new:build'|'review:recall'|'practice:apply'
```

界面在题型上方显示阶段标签。

### D4：记忆曲线不变

- 错词次日；
- interval 升降；
- probe；
- 单元顺序解锁。

## 后果

- 正面：顺序稳定、可解释；
- 正面：新词先搭、复习再默写；
- 负面：同阶段题型相对固定，变化少于随机轮转；
- 负面：阶段规则仍需教研按年级微调。
