# ADR-0004：选择单位的粒度（grapheme / letter / mixed）

- **状态**：Accepted（方向确定，实现阶段 P3/P4）
- **日期**：2026-11-11
- **决策者**：P1 交互修订
- **影响条款**：DESIGN §1.4、§3.4、§5.2
- **相关**：`src/questionTypes/shared.js`、`TSequence`、`T-FILL`、未来的 `Scheduler`

## 背景

P1 的 T-SEQUENCE 把词条的 `units[]`（人工标注的 grapheme）直接变成选择块：

- `fish` → `f` / `i` / `sh`
- `night` → `n` / `igh` / `t`

这对组合强化是对的，但不能成为唯一模式。实际教学里有时需要：

- 把 `sh` 拆成 `s` / `h` 单独选；
- 同一题里混合粒度，例如 `sh` 保持一块、`igh` 拆成 `i` / `g` / `h`；
- 用字母级选择暴露“组合内部顺序/边界”错误，而不是只让孩子记一个整块。

如果现在把“有组合就只选组合”写死进题型层，P4 的边界诊断和 P3 的错词修复都会被限制。

## 决定

### D1：内容层继续以 grapheme 为唯一人工标注

`words.json` 的 `units[]` 仍是权威切分，不新增“字母版词条”。
把已知 unit 的文本按字符拆开是确定性操作，不属于“自动推断 grapheme 边界”，因此不违反 DESIGN §1.4。

### D2：用 spec 参数表达粒度，不由题型层猜

未来在 `QuestionSpec.params` 增加可选字段：

```js
{
  unitGranularity: 'grapheme' | 'letter' | 'mixed', // 默认 'grapheme'
  splitUnitIds: ['w.fish#u2']                       // 仅 mixed 使用
}
```

- `grapheme`：P1 当前行为，一块一个 unit。
- `letter`：每个 unit 的文本拆成单字母块，槽位数 = 单词字符数。
- `mixed`：列出的 unit 拆成字母，其余保持整块；顺序仍按原 unit 顺序展开。
- 由 **Scheduler** 决定粒度（P3 起），题型层只消费，不自行判断“这个词有组合所以只能选组合”。

### D3：字母 unit 的稳定 ID 与错误画像

字母块 ID 使用原 unit ID + 偏移，保证可追溯：

```text
w.fish#u2:letter:0  → s
w.fish#u2:letter:1  → h
```

`ErrorProfile`：

```js
{ type: 'TRANSPOSITION', unitKind: 'letter', unitId: 'w.fish#u2:letter:0', position: 3, ... }
```

- `position` 为字母级/槽位级 0-based 位置；
- `unitId` 仍能反查原 grapheme（`g.sh`），家长端可以说“`sh` 内部顺序错了”；
- `focus` 仍指向 grapheme ID；`focusCorrect` 检查该 grapheme 覆盖的字母区间。

### D4：RenderModel 不需要新字段

`RenderModel.units[]` 本来就允许 `kind: 'letter' | 'grapheme'`，`slots[]` 只描述槽位。
UI 只需要按 build 产出的 units/slots 渲染；不需要知道当前是哪种粒度。

### D5：与 T-SEGMENT 的分工

- **T-SEGMENT（P4）**：诊断“切分边界在哪”，是边界题，不改变选择粒度。
- **粒度参数**：改变“每个可选项是整块还是字母”，可作用于 T-SEQUENCE / T-FILL / T-EDIT。
- 两者可以组合，但不是同一功能，不能互相替代。

## 实现顺序（不在 P1 做）

1. P3：Scheduler 根据错误画像决定 `unitGranularity` / `splitUnitIds`。
2. P4：T-SEQUENCE / T-FILL 支持 letter/mixed；T-SEGMENT 做边界诊断。
3. 增加测试：字母块数量、槽位顺序、focusCorrect、错误 unitId 反查、同一 seed 稳定。
4. 若 P4 发现混合粒度需要内容级标注，再扩展 CONTENT_SPEC；当前不做迁移。

## 后果

- 正面：不锁死题型；内容不复制；家长端仍能定位到组合；混合粒度可在 spec 层实验。
- 负面：字母级 `position` 与 grapheme 级 `position` 含义不同，报表必须看 `unitKind`；Scheduler 需要明确选择粒度，不能默认全字母。
- P1 仍只实现 grapheme 粒度；这是有意的阶段边界。

## 被否决的方案

| 方案 | 否决原因 |
|---|---|
| 把所有词都拆成字母 | 失去 grapheme 教学与组合强化，违背 DESIGN 的组合目标 |
| 另存一份“字母版”词条 | 内容重复、ID 漂移、人工标注翻倍 |
| 题型层看到组合就自动只出整块 | 把教学决策藏进题型层，Scheduler 无法按错误修复 |
| 让 T-SEGMENT 代替粒度参数 | 边界诊断与选择粒度是两个维度，会混淆错误画像 |
