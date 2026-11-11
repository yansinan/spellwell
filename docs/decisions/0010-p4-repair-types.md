# ADR-0010：P4 顺序/边界修复题型与交互

- **状态**：Accepted
- **日期**：2026-11-11
- **决策者**：P4 实现
- **影响条款**：DESIGN §3.4、§3.5
- **相关**：`TReorder.js`、`TEdit.js`、`TSegment.js`、`PracticeScreen.js`

## 背景

P4 要补齐 `T-REORDER`、`T-EDIT`、`T-SEGMENT`，把顺序/替换/边界错误变成
可操作的修复任务。DESIGN 只给题型目标与修复信号，没有规定具体交互与错误定位。

## 决定

### D1：T-REORDER 用“点两块交换”而不是再做一个候选池

- build 把目标单位打乱后全部放入槽位；
- 孩子点第一块选中，再点第二块交换；`reorder(fromIndex,toIndex)` 进入事件流；
- judge 从 renderModel 初始顺序出发依次应用交换，再与目标顺序比较；
- 首个不匹配位置报 `TRANSPOSITION`；
- 点选是完整等价操作，不依赖拖拽；P8 再扩 PointerAdapter。

### D2：T-EDIT 预填错词 + 整词编辑

- Scheduler 根据 `errorProfile.type` 生成 `params.initialText`：
  - OMISSION 删 focus；
  - EXTRA 插干扰组合；
  - TRANSPOSITION 交换相邻单位；
  - SUBSTITUTION/SUFFIX_RULE 替换 focus；
- UI 用预填输入框，提交 `edit(text)`；
- judge 复用 `analyzeTyped`，错误定位到 grapheme；
- T-EDIT 是“修错词”，不是空白 T-TYPE。

### D3：T-SEGMENT 用字母间隙点

- build 输出 `fixedText` 与逐字母 units；
- UI 在每两个字母之间渲染 gap 按钮，点击切换 `tap-gap(gapIndex)`；
- 正确边界来自人工 `units` 的累计长度；
- judge：
  - 多选 → `BOUNDARY_OVER_SEGMENT`；
  - 少选 → `BOUNDARY_UNDER_SEGMENT`；
  - 同时多选/少选 → `BOUNDARY_MISPLACED`；
- 不自动推断 grapheme，边界只读内容 units。

### D4：错误类型选 P4 题型，但保持优先级

Scheduler 取错误画像最后一条，按 `REPAIR_PREFERENCE` **第一个可用** 题型：

| 错误 | 题型 |
|---|---|
| TRANSPOSITION | T-REORDER |
| SUBSTITUTION | T-EDIT |
| OMISSION | T-FILL |
| EXTRA | T-EDIT |
| BOUNDARY_* | T-SEGMENT |

P3 available 只含 P1 时仍会降级；P4 available 放开三种 P4 题型。

### D5：P4 难度向量继续沿用 P3 字段

P4 只把脚手架映射到既有 enum，不新增第五种 scaffold：
- T-REORDER → `sequence`
- T-EDIT → `type`
- T-SEGMENT → `fill`
- granularity 仍 `grapheme`；letter/mixed 留后续。

## 后果

- 正面：三类错误有可操作修复；点选即可完成任务；错误画像可定位。
- 负面：T-REORDER 当前是点击交换，没有拖拽；P8 再补 PointerAdapter。
- 负面：T-EDIT 的错词由错误类型生成，真实孩子错误文本不直接回放；后续可用 attempt 历史增强。
- 约束：T-SEGMENT 仅支持英文单字符字母边界；多字符组合仍按人工 units 累计。

## 被否决的方案

| 方案 | 否决原因 |
|---|---|
| T-REORDER 再做候选池 | 与 T-SEQUENCE 无本质差异 |
| T-EDIT 用空白输入 | 与 T-TYPE 重复，失去“修错”意义 |
| T-SEGMENT 自动推断组合 | 违反人工切分铁律 |
| 所有错误都选 T-EDIT | 顺序/边界错无法精准修复 |
