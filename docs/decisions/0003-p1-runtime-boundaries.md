# ADR-0003：P1 运行边界与题型判定上下文

- **状态**：Accepted
- **日期**：2026-11-11
- **决策者**：P1 实现
- **影响条款**：DESIGN §2.1、§3.2、§3.4、§四、§5.2
- **相关**：`src/ui/bootstrap.js`、`src/ui/PracticeSession.js`、`src/questionTypes/*`

## 背景

P1 要跑通“3 词 × 3 题型”的最小闭环，但 DESIGN 只规定了层次与题型职责，
没有规定 P1 从哪里取内容、谁生成 9 条 spec、judge 如何拿到目标词单位。

如果不先把这些边界写死，很容易在 P1 就把 P2/P3 的职责提前实现：

- 题型层为了判定去查 `WordRepository`；
- UI 为了出题自己生成干扰项；
- P1 为了“刷新不丢”提前接 IndexedDB；
- judge 拿不到目标切分，只能从 RenderModel 反推答案。

## 决定

### D1：P1 内容装配走“同源 JSON → MemoryAdapter → repositories”

`src/ui/bootstrap.js` 用同源 `fetch` 读取 `src/content/words.json` 与 `graphemes.json`，
写入 `MemoryAdapter`，再通过 `WordRepository` / `GraphemeRepository` 组装 `ResourceBundle`。

- 只加载 P1 的 3 个词：`w.fish`、`w.ship`、`w.night`。
- 刷新后数据丢失是 P1 的预期行为；IndexedDB 仍是 P2。
- P2 把这段替换为“内容导入 → IndexedDBAdapter”，题型层与 session 接口不变。
- `fetch` 只出现在 UI 组合层，不进入 repositories / questionTypes / scheduler。

### D2：P1 的 9 条 spec 由 PracticeSession 生成，作为 P3 Scheduler 的占位

`PracticeSession.buildPracticeSpecs()`：

- 每个词按 `T-SEQUENCE → T-FILL → T-TYPE` 轮转一次，3 词共 9 题；
- 选词、选题型、选 focus 单位是 P1 的固定规则；
- 干扰组合从内容组合池中选一个不在目标词里的组合，通过 `params.distractorGraphemeIds` 传给题型；
- **题型层不生成干扰项，只消费 spec**。

P3 会把“选词/选题型/按错误画像抽干扰项”移到 `Scheduler`；`QuestionSpec` 不变。

### D3：judge 接收只读 `bundle` 与可注入 `now`

`judge({ spec, renderModel, events, bundle, now })`：

- `bundle` 提供目标词的**人工切分**（units），judge 不需要查库，也不能反推答案；
- `bundle` 只读，不写任何状态；
- `now` 默认 `Date.now()`，测试可注入固定时间，保证 `AttemptResult.timestamp` 可断言；
- `QuestionSpec` / `RenderModel` / `InputEvent` / `AttemptResult` 的序列化结构没有变化，
  因此 `CONTRACT_VERSION` 仍为 1；变化的是内部调用上下文，9 个题型都在本仓库内同步升级。

### D4：P1 不持久化任何学习数据

- `PracticeSession` 只在内存里保留本轮 `results`，用于 debug 面板与“Done”页。
- 不创建 `StateRepository` / `AttemptRepository`，不碰 `wordStates` / `graphemeStates` / `attempts`。
- 刷新即重置；P2 负责持久化，P3 负责把 attempt 写回状态。
- `?debug=1` 只显示当前 AttemptResult，不写入任何存储。

### D5：T-TYPE 在 P1 使用原生输入框

- P1 只验证“整个词输入 → 判定 → 错误定位”，不实现 QWERTY 视觉键盘、解锁仪式、移动端手势。
- UI 在提交时发送**完整当前输入值**的 `key-text` 事件；judge 取最后一个 `key-text`。
- P8 再实现键盘适配与移动端体验；键盘解锁依赖连续正确状态，属于 P3/P8。

### D6：T-SEQUENCE 填满后不自动提交，改为显式 Check

如果最后一个槽位填满后 320ms 自动判定，孩子没有时间“再次点击取消/修改”，
与 P1 反馈的第 2 个功能冲突。

因此 T-SEQUENCE：

- 槽位填满只启用 `Check`，不自动提交；
- 点击已填槽位或已用块会清空该槽位（可留下空槽），`Check` 重新禁用；
- 拖拽到已占用槽位会替换该槽位的单位；
- `Check` 仅在全部槽位填满时可用。

T-FILL 仍是一次选择后自动判定（P1 范围只对按序选择提出修改需求）。
这是对 DESIGN §6.2 “点选即完成”的一个 P1 例外，理由是“可修改”优先于“少一次点击”。

## 后果

- 正面：P1 可独立验收；P2/P3 替换边界清晰；题型层保持纯函数；测试可用真实内容与固定时间。
- 负面：P1 多了一层 UI 内的“迷你调度”，需要在 P3 迁移；同源 fetch 在 `file://` 下不可用（必须走本地服务器）。
- P1 的 9 题是**固定演示队列**，不是每日队列；不能据此宣称调度已完成。

## 被否决的方案

| 方案 | 否决原因 |
|---|---|
| 题型层直接查 WordRepository | 破坏可单测与可替换，违反铁律 |
| UI 临时生成干扰项并塞进 RenderModel | 题型层/调度层职责混乱，P3 难迁移 |
| 把目标 units 塞进 QuestionSpec.params | spec 冗余且鼓励题型层依赖答案字段；bundle 更自然 |
| P1 直接接 IndexedDB | 越过 P2，且 P1 还不需要持久化 |
| judge 内部 `Date.now()` 且不可注入 | AttemptResult 时间戳不可复现，测试不稳定 |
