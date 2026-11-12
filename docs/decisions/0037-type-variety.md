# ADR-0037：同阶段题型轮转与会话种子

- **状态**：Accepted
- **日期**：2026-11-12
- **影响条款**：DESIGN §3.4
- **相关**：`TypeVariety.js`、`Scheduler`、`bootstrap.js`

## 背景

旧逻辑按状态固定映射：

```text
review interval >= 2 → 全部 T-TYPE
```

一轮 20 题里如果都是强复习词，会出现约 15 题同一种输入，连续练习很枯燥。

## 决定

### D1：题型家族轮转

保留修复/复习/新词的教学方向，只在同一阶段内轮转：

```text
强复习：T-TYPE / T-FILL 交替
弱复习：T-FILL / T-SEQUENCE 交替
新词：T-SEQUENCE 为主，穿插 T-FILL
```

- 修复题、probe、历史判断题仍由错误状态决定，不参与轮转；
- 同一词在一轮里仍只出现一次，不重复刷同一个词。

### D2：会话种子

`startPractice` 用以下内容派生 session seed：

```text
attempt 总数 + 本地日期 + 所选 units + mode
```

每次练习后 attempts 变化，下一次的题型起点也会变化，避免连续几轮同样的排列。

### D3：不变的部分

- 词仍然只来自所选 units；
- 旧单元自动复习规则不变；
- 题型判定、难度状态、错误画像不变。

## 后果

- 正面：强复习不再整轮都是 T-TYPE；
- 正面：新词仍以搭建为主；
- 正面：连续练习会有不同的题型起点；
- 负面：题型不再完全按状态固定映射，需要看 plan/typeReason 解释。
