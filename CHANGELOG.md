# CHANGELOG

## [0.7.0] — 2026-11-11 · P6 判断纠错与语境抽查

### Added

- `T-JUDGE-FIX`：claim + Correct/Wrong；判错时预填输入框改对；区分假接受/假拒绝。
- `T-CLOZE`：句子挖空 + 拼写输入，不做选项。
- probe：30 天满档连续 3 次正确 → `status=probe`，`dueDate=today+60`。
- probe 答错退回 `learning`/次日；答对 → `mastered`/`dueDate=null`。
- Scheduler probe 优先 T-CLOZE（有句子）或 T-JUDGE-FIX。
- `PracticeScreen` P6 判断/改错、句子填空 UI。
- `tests/p6/types.test.js`、`tests/p6/probe.test.js`。
- ADR-0012：判断纠错、语境抽查与 probe 迁移。

### Changed

- `package.json` 版本 `0.6.0` → `0.7.0`；新增 `test:p6`。
- P0 注册表守卫不再要求任何题型抛未实现。
- `README` / `ROADMAP` / `TRACEABILITY` / `AGENTS` / `FILE_SPEC` 状态推进到 P7。

### Verification

```bash
node tests/runTests.js --phase=p6
# PASS  p6 gate · 162 passed · 0 failed · 27 files
```

- 浏览器 T-CLOZE：`A ____ can swim.` → 输入 fish → mastered、dueDate null。
- 浏览器 T-JUDGE-FIX：claim cat → Correct → mastered。
- probe 答错 → learning/dueDate 2026-11-12；答对 → mastered。
- 满档 3 连对 → probe，dueDate 2027-01-10（60 天）。
- 390px 无横向滚动。

### Known limitations

- T-JUDGE-FIX 的 claim 由 Scheduler 生成，未直接回放真实错误历史。
- 只有 4 条 sentences；P7 后台补内容。
- probe 只作用于词状态，组合 probe 仍作候选。

---

## [0.6.0] — 2026-11-11 · P5 组合强化与 T-MATCH

### Added

- `T-MATCH` 多选分类：focus 组合 + 2—3 个包含词 + 1—2 个不包含词；非四选一。
- 组合状态独立阶梯：`intervalIndex`、`consecutiveCorrect`、`wordsPassed`、`dueDate`、`status`。
- 答对整词更新全部 unit 组合；答错只更新错误画像指向的组合。
- 跨 2 个不同词、连续 3 次正确 → `probe`。
- Scheduler 每日最多追加 1 道 T-MATCH 强化包，队列不超过 8。
- `PracticeScreen` T-MATCH 多选、Check、Clear。
- `tests/p5/match.test.js`。
- ADR-0011：组合强化包与 T-MATCH。

### Changed

- `package.json` 版本 `0.5.0` → `0.6.0`；新增 `test:p5`。
- P0 注册表守卫只要求 P6 题型继续抛未实现。
- `README` / `ROADMAP` / `TRACEABILITY` / `AGENTS` / `FILE_SPEC` 状态推进到 P6。

### Verification

```bash
node tests/runTests.js --phase=p5
# PASS  p5 gate · 157 passed · 0 failed · 25 files
```

- fish 正确后 `g.sh`：`wordsPassed=['w.fish']`、`intervalIndex=1`、`dueDate=2026-11-14`。
- fish/ship/fish：`wordsPassed` 跨 2 词、`consecutiveCorrect=3`、`status=probe`。
- 到期组合追加 1 道 T-MATCH；选项顺序可复现。
- 浏览器 T-MATCH：focus `sh`，选中 `ship` + `fish` 后 Check 完成。
- 390px 无横向滚动。

### Known limitations

- T-MATCH 是词形分类，不直接要求拼写；作为组合强化包。
- 初始没有 graphemeState 时不会生成 T-MATCH；需先做过整词。
- T-JUDGE-FIX/T-CLOZE 仍为 P6 骨架。

---

## [0.5.0] — 2026-11-11 · P4 顺序/边界错闭环

### Added

- `T-REORDER`：单位初始打乱，点两块交换；`reorder(fromIndex,toIndex)` 事件重建顺序，定位 TRANSPOSITION。
- `T-EDIT`：预填错误词，输入修错；按 OMISSION/EXTRA/TRANSPOSITION/SUBSTITUTION 生成初始文本。
- `T-SEGMENT`：逐字母 + 间隙按钮；区分 BOUNDARY_OVER/UNDER/MISPLACED。
- `PracticeScreen` P4 交互：
  - T-REORDER 点击选中/交换、Clear；
  - T-EDIT 预填输入框、Check；
  - T-SEGMENT 间隙点选/取消、Check。
- Scheduler 错误映射：TRANSPOSITION→T-REORDER、SUBSTITUTION→T-EDIT、BOUNDARY_*→T-SEGMENT；OMISSION 仍优先 T-FILL。
- `QuestionSpecBuilder` 支持 P4 题型与 T-EDIT `initialText`。
- `tests/p4/types.test.js`、`tests/p4/schedulerTypes.test.js`。
- ADR-0010：P4 题型交互与映射。

### Changed

- `package.json` 版本 `0.4.0` → `0.5.0`；新增 `test:p4`。
- `TypeSelector.SUBSTITUTION` 首选从 T-SEQUENCE 改为 T-EDIT，T-REORDER/T-SEGMENT 进入 P4 候选。
- P0 注册表守卫只要求 P5/P6 题型继续抛未实现。
- `README` / `ROADMAP` / `TRACEABILITY` / `AGENTS` / `FILE_SPEC` 状态推进到 P5。

### Verification

```bash
node tests/runTests.js --phase=p4
# PASS  p4 gate · 153 passed · 0 failed · 24 files
```

浏览器实测：

- TRANSPOSITION 错 → `T-REORDER`，fish 初始 `i / sh / f`，交换后 correct。
- SUBSTITUTION 错 → `T-EDIT`，预填 `fia`，改为 `fish` 后 correct。
- BOUNDARY_OVER_SEGMENT 错 → `T-SEGMENT`，字母 `f i s h`，点 2 个正确间隙后 correct。
- 三次正确均写 wordStates、清空错误画像、attempts 增加；无控制台异常。
- 390px 移动端无横向滚动。

### Known limitations

- T-REORDER 目前是点击交换；拖拽版留 P8。
- T-EDIT 的错词由错误类型生成，不直接回放真实输入文本。
- T-MATCH/T-CLOZE 仍为 P5/P6 骨架。

---

## [0.4.0] — 2026-11-11 · P3 记忆曲线与错词调度

### Added

- `Scheduler.buildDailyQueue()`：5—8 个唯一词，默认 6；
  - 优先错词/错误画像，其次到期复习，再补新词与未到期填充；
  - 队列大小非法值明确报错。
- `Scheduler.recordAttempt()`：attempts + wordStates 落 IndexedDB；
  - 答错降 2 档、连续错归零，`dueDate = 明天`；
  - 答对升档、清空错误画像；状态 `learning/reviewing`。
- `QuestionSpecBuilder`：单题 spec 装配，写入 P3 难度向量（grapheme、slot/letter、tier、distractor、inputMode）。
- `TypeSelector` 按错误类型选 P1 可用修复题型；P4 题型通过 `available` 过滤。
- `PracticeSession` 支持注入 Scheduler specs；`PracticeScreen` `onResult` 回调落库。
- 学习端每日队列 `1 / 6`；刷新后状态/attempts 仍在。
- `tests/p3/scheduler.test.js`：队列 5—8、次日必现、答对升级、OMISSION→T-FILL、难度向量。
- ADR-0009：每日队列、错词优先级与状态写入。

### Changed

- `package.json` 版本 `0.3.0` → `0.4.0`；新增 `test:p3`。
- `main.js` 向 `PracticeScreen` 注入 `scheduler.recordAttempt`。
- P0/P1 的历史“Scheduler 必须未实现 / bootstrap 不得碰状态仓库”守卫随阶段推进更新。
- `README` / `ROADMAP` / `TRACEABILITY` / `AGENTS` / `FILE_SPEC` 状态推进到 P4。

### Verification

```bash
node tests/runTests.js --phase=p3
# PASS  p3 gate · 148 passed · 0 failed · 22 files
```

浏览器验收：

- 队列 `1 / 6`，首题 T-SEQUENCE `book`；正确后进入 `2 / 6`。
- IndexedDB：`wordStates=1`、`attempts=1`；book `intervalIndex=1`、`dueDate=2026-11-14`、错误画像空。
- 刷新：`contentSeeded=false`、`wordStates=1`、`attempts=1`、content 请求 0；队列仍 6。
- 390px 移动端无横向滚动。
- 固定时钟单测覆盖：答错 dueDate 明天、次日队列首词、OMISSION→T-FILL、答对清错/升级。

### Known limitations

- 同一天再次打开会重新组队，可能和刚完成的队列顺序不同；P3 不缓存“今日队列快照”。
- `mastered` 与 60 天假掌握抽查仍留 P6；P3 最高状态为 `reviewing`。
- P3 不实现 P4 题型，顺序/边界错误暂时回退到 P1 题型。

---

## [0.3.0] — 2026-11-11 · P2 IndexedDB 持久化与内容导入

### Added

- `src/storage/IndexedDBAdapter.js`：实现 `init/get/put/query/transaction/exportAll/importAll`；
  - 使用 `schema.js` 的 8 个 store 与索引；
  - `query` 保持等值过滤 + 主键字典序 + offset/limit；
  - `importAll` 单事务 clear + put，失败整体回滚；
  - IndexedDB 不可用明确抛 `STORAGE_UNAVAILABLE`。
- `src/storage/contentImport.js`：4 个内容库 + `meta.contentVersion`，同版本幂等，版本变化覆盖写入。
- `src/ui/bootstrap.js`：IndexedDB 优先；首次加载 fetch + import，刷新按版本跳过网络；失败回退 MemoryAdapter。
- `?debug=1` 暴露 `window.__SPELLWELL_DEBUG__ = { session, adapter, storage, contentSeeded }`。
- `tests/p2/`：内容导入/幂等/版本/非法内容、7 方法契约、无 IndexedDB 降级、未 init 报错。
- ADR-0008：IndexedDB 内容导入、持久化与降级。

### Changed

- `package.json` 版本 `0.2.0` → `0.3.0`；新增 `test:p2`。
- P0 存储测试从“IndexedDB 必须抛未实现”改为“无 IndexedDB 时明确报 `STORAGE_UNAVAILABLE`”。
- `README` / `ROADMAP` / `TRACEABILITY` / `AGENTS` / `FILE_SPEC` 状态推进到 P3。

### Verification

```bash
node tests/runTests.js --phase=p2
# PASS  p2 gate · 142 passed · 0 failed · 21 files
```

浏览器验收：

- 首次加载 `storage=indexeddb`、`contentSeeded=true`，内容计数 `10 / 22 / 4 / 2`；
- 刷新后 `contentSeeded=false`，`/src/content/` 请求 0 个，9 题仍可开始；
- `exportAll` → `importAll` 往返 39 条记录，内容计数一致；
- 事务内临时 meta 写入可见，`importAll` 回滚快照后消失；
- 无控制台异常；P0/P1 测试无回退。

### Known limitations

- 内容版本升级只覆盖写入，不删除旧记录；完整迁移/校验留 P7。
- `query` 仍为全表扫描；词库规模小，索引优化留到需要时。
- 学习状态（wordStates/graphemeStates/attempts）仍未写入，P3 才接调度。

---

## [0.2.0] — 2026-11-11 · P1 最小拼写闭环

### Added

- `T-SEQUENCE` / `T-FILL` / `T-TYPE` 的 `build` 与 `judge`：
  - 错误定位到 grapheme unit / position；
  - 覆盖 OMISSION、SUBSTITUTION、EXTRA、TRANSPOSITION；
  - judge 接收只读 `bundle` 与可注入 `now`，不查库、不写状态。
- `src/questionTypes/shared.js`：资源校验、错误画像构造、整词输入分析。
- `src/ui/PracticeSession.js`：3 词 × 3 题型共 9 条 spec；同 seed 可复现；结果只存内存。
- `src/ui/bootstrap.js`：同源 JSON → MemoryAdapter → repositories → ResourceBundle。
- `src/ui/PracticeScreen.js`：纯英文学习端，点选/拖拽/键盘输入、显式 Check、温和反馈、`Done.` 结束页。
- `src/ui/dragGeometry.js`：64px 吸附半径与最近槽位计算。
- `src/ui/sequenceOrder.js`：已到位块重排，左右半边决定插前/插后，移源后修正边界。
- `src/ui/sound.js`：Web Audio 合成轻音效，Sound/Muted 开关，无外部音频资源。
- 拖拽未命中槽位时，浮层 240ms 缓动弹回来源块；原块保留，不产生错误画像。
- 已到位块可拖拽重排；满槽时新候选块弹回，不覆盖原顺序。
- 拖拽中实时侧滑：源块隐藏、其他块平移让位、插入点显示缺口；释放才提交，离开则还原。
- 已使用的灰色待选块设为 disabled，不再响应点击/拖拽；取消/修改只通过已填槽位。
- `styles/practice.css`：学习端样式，颜色/圆角/动效全部来自 token。
- `?dev=1` 保留 P0 状态页；`?debug=1` 显示 AttemptResult 调试面板；`/` 默认进入学习端。
- `tests/p1/`：T-SEQUENCE/T-FILL/T-TYPE、PracticeSession、UI 边界、拖拽几何、有序重排、音效静音、难度梯度文档、学习端英文检查。
- ADR-0003：P1 运行边界与 judge 上下文。
- ADR-0004：选择粒度（grapheme/letter/mixed）的后续方案。
- ADR-0005：拖拽吸附/弹回与互动音效。
- ADR-0006：grapheme < mixed < letter 的难度梯度与 P3 难度向量。
- ADR-0007：已到位块的插入式重排、左右半边判定与满槽拒绝。

### Changed

- `package.json` 版本 `0.1.0` → `0.2.0`。
- `index.html` 默认页面从 P0 状态页改为 P1 学习端；P0 页移到 `?dev=1`。
- P0 注册表测试改为只断言未实现题型（P4/P5/P6）继续抛 `PHASE_NOT_IMPLEMENTED`。
- `README` / `ROADMAP` / `TRACEABILITY` / `AGENTS` 状态推进到 P2。

### Verification

```bash
node tests/runTests.js --phase=p1
# PASS  p1 gate · 135 passed · 0 failed · 19 files
```

浏览器验收：3 词 × 3 题型完整 9/9；T-SEQUENCE 鼠标拖拽三块入槽、触摸拖拽 `f → slot 0`、
点击已填槽位取消后不误提交；灰色待选块禁用；拖到槽位附近可吸附、拖到远处弹回；
Sound/Muted 可切换；拖拽悬停时其他块实时侧滑、缺口随左右半边移动；错误路径 `fish → f i oo` 的 debug 面板显示
`SUBSTITUTION`、位置 2、expected `sh`、actual `oo`；390px 移动端无横向滚动。

### Known limitations

- 刷新仍会重置：P1 不持久化（P2）。
- 9 题是固定演示队列，不是每日队列（P3）。
- `T-TYPE` 使用原生输入框，完整 QWERTY 解锁与移动端体验在 P8。
- 内容仍为 `unreviewed`，不用于生产。
- `?debug=1` 仅供验收，不属于孩子端功能。

---

## [0.1.0] — 2026-11-11 · P0 契约与骨架

### Added

- 目录骨架与文件规范：`@layer/@phase/@doc` 头、分层依赖、命名与测试规则。
- `src/core/contracts.js`：QuestionSpec / RenderModel / InputEvent / AttemptResult /
  WordState / GraphemeState 的 JSDoc 类型与运行时校验；9 种错误枚举。
- `src/core/seedRandom.js`：mulberry32、FNV-1a seed 哈希、确定性 shuffle；全仓库无环境随机数。
- `src/core/time.js`：本地日历日 `YYYY-MM-DD`、addDays、isDue，避免 UTC 跨日。
- `src/core/eventBus.js`、`src/core/errors.js`。
- `src/storage/`：7 方法 `StorageAdapter` 契约、`MemoryAdapter`（事务回滚、导出导入）、
  8 个 store 的 `schema.js`、`IndexedDBAdapter` P2 骨架。
- `src/repositories/`：词条、组合、句子、混淆项、状态、尝试 6 个仓库。
- `src/scheduler/`：1/3/7/14/30 间隔策略、降档/归零、错误画像、题型选择、Scheduler P3 骨架。
- `src/questionTypes/`：9 个题型注册表；build/judge 在各自阶段前抛 `NotImplementedError`。
- 内容种子：10 词、22 组合、4 句、2 组混淆项；全部 `unreviewed`，仅用于结构验证。
- P0 开发状态页（`index.html` + `src/ui/App.js`）与零依赖静态服务器 `tools/serve.mjs`。
- 测试：`tests/p0/` 10 个文件 + 零框架 runner，支持 `--phase=p0` 与累计阶段门。
- 文档：`docs/DESIGN.md`、`FILE_SPEC.md`、`TRACEABILITY.md`、`ROADMAP.md`、
  `CONTENT_SPEC.md`、ADR-0001/0002、`AGENTS.md`。

### Decisions

- 存储方法以 DESIGN 列出的 **7 个**为准（原文“6 个”为笔误）——ADR-0001。
- `errorProfile` 改为有界数组（最多 8 条），`firstError` 仍为单条主错误——ADR-0001。
- `query` P0 仅支持等值过滤 + limit/offset；P2 再走索引——ADR-0001。
- 混淆项 ID 按字母序规范化（`c.ch-sh`），同一无序对唯一——CONTENT_SPEC。

### Known limitations

- `IndexedDBAdapter` 未实现，刷新丢数据是 P0 预期行为（P2）。
- 9 个题型的 build/judge 未实现；调用会明确抛 `PHASE_NOT_IMPLEMENTED`。
- `Scheduler` 未实现每日队列与错词调度（P3）。
- 内容尚未经过教学人工复核，不得作为生产内容导出（P7）。
- 家长端、后台、挑战模式、变换题均未开始。

### Verification

```bash
node tests/runTests.js --phase=p0
# PASS  p0 gate
```
