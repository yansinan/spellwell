# ADR-0013：ContentValidator、后台与生产导出阻断

- **状态**：Accepted
- **日期**：2026-11-11
- **决策者**：P7 实现
- **影响条款**：CONTENT_SPEC §6、DESIGN §2.3
- **相关**：`ContentValidator.js`、`AdminApp.js`、`src/admin/index.html`

## 背景

P7 要提供内容校验与标注后台，并确保未审核/切分错误的内容不能进入生产导出。
后台还必须与学习状态隔离。

## 决定

### D1：V1—V9 是结构校验，V10 是导出闸门

`validateContent` 对 4 个内容库执行：

- V1 顶层 version/items；
- V2 ID 前缀 + 唯一；
- V3 单词小写 ASCII；
- V4 units 拼接等于 text；
- V5 grapheme 存在且文本一致；
- V6 句子答案/blank 一致，目标词出现恰好一次；
- V7 句子 wordId 存在；
- V8 confusable 引用存在、无序对唯一；
- V9 reviewStatus 合法。

`buildExport` 先跑 V1—V9，再执行 V10：任何非 `reviewed` 内容都阻断，
并返回 `unreviewed[]` 便于后台定位。

### D2：后台只读、只导出

- `AdminApp` 同源加载 4 个 JSON，展示数量与校验错误；
- 有阻断时导出按钮 disabled；
- 后台不 import StateRepository/AttemptRepository，不触碰 wordStates/graphemeStates/attempts；
- 后台不提供学习数据修改入口。

### D3：不自动修复内容

- 校验只报告，不自动拆分 grapheme、不自动改 reviewStatus；
- 修复由人工完成，避免破坏“人工切分”铁律；
- 当前种子全部 unreviewed，因此导出按钮默认禁用。

### D4：导出快照只含 reviewed

`buildExport` 返回 `{version, exportedAt, counts, stores}`，stores 中仅 reviewed；
V10 通过时全部内容均为 reviewed，因此 counts 与内容库一致。

## 后果

- 正面：错误切分/未审核内容阻断导出；后台与学习状态隔离；错误可定位。
- 负面：后台目前是只读校验 + 导出，不是完整可视化编辑器；标注编辑留后续。
- 负面：V6 语义唯一仍是人工评审项；自动只校验“出现一次”。
- 约束：后台不能成为第二个调度/状态写入点。

## 被否决的方案

| 方案 | 否决原因 |
|---|---|
| 导出时过滤 unreviewed 静默放行 | 无法保证内容完整性 |
| 后台直接改 JSON 文件 | 浏览器无写文件权限，且缺少审计 |
| 自动推断 grapheme | 违反人工切分铁律 |
| 后台复用学习状态仓库 | 越界，且会污染学习数据 |
