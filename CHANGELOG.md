# CHANGELOG

## [0.10.0] — 2026-11-11 · P9 内容驱动题目生成与练习设计

### Added

- 单元模型 `grade/term/unit` + `unitId/unitLabel`；接入两套教材：人教新起点 583 词、外研版新交际（北京专版）891 词。
- 后台新增“教材版本”切换；学习端按当前教材取词。
- 练习设计按“一年级上/下、二年级上/下”折叠，学期下多选 unit。
- 练习设计页：只显示已完成单元 + 下一个新单元，按学期/单元顺序解锁；Review/Effort；前台不选题量。
- 答错显示正确答案并可重试，答对才进入下一题；只记录第一次作答。
- 结束页先突出正确率，再列出本次错词。
- 单元完成定义：该单元全部词至少练习过一次；完成单元可复选复习。
- 题量设置 `meta.practiceSettings`，默认 20，范围 5—30。
- 后台练习设置页 `/src/admin/settings.html`，面包屑“内容库 / 练习设置”。
- Scheduler 支持 unit 过滤、retired 过滤、Review/Effort 侧重。
- 用真实 attempts 校准权重：按词/题型错误率、小样本平滑、约束优先。
- 修复旧 DB 无 unitId 时 Start practice 空队列的问题；内容版本升到 3。
- v2→v3 迁移保留后台已编辑词，补齐 grade/term/unit。
- 内容版本升到 10，导入两套教材词库；新增外研词库报告。
- 组合库 96 → 152；切分审计：全字母保底 433 → 316。
- 魔法 e 标注 108 个 CVCe 词；例句 241 条、7 组混淆项、7 组词族。
- 填空焦点支持 _ish / f_sh / fi_h 变化，元音焦点占 50%。
- 练习阶段改为 Warm-up → Review → New → Practice；新词先搭、复习再默写；界面显示阶段标签。
- 设计页保留；默认勾选记忆周期内未掌握单元，mastered 排除；旧内容完成后有余地才自动加新单元。
- 单元掌握总进度：真实 attempts 校准记忆曲线；整行背景条+百分比。
- 提示改为中文为主、IPA 同屏辅助；低年级不单独用 IPA。
- T-FILL 约 1/3 把纯元音组合拆成字母双空（如 r _ _ n）。
- 干扰项优先相似音/相似拼写组合（ir/er/ur、ea/ee/e/a），T-MATCH 同步。
- `contentRevision`：后台保存递增；下一轮重新读内容。
- 当前会话不被内容更新打断；BroadcastChannel 提示 `New practice`。
- 计划项带 `params.plan.reason/mode/policyVersion`。
- `PlanPolicy.revise()` 兼容接口，P9 不实时改题。
- `tests/p9/`：题量、单元、mode、retired、权重、提示词、词库、教材、顺序解锁、重试与结束摘要。
- 提示词按句子 → 音标 → 中文 → 单词保底；CLOZE 不重复句子。
- 批量录入支持单元标题行（如 `一年级上unit2`），后续词继承单元直到下一个标题。
- 词库支持单独 JSON 导入/导出（按当前教材）；重复词按合并/替换/不动处理。

### Changed

- `package.json` 版本 `0.9.0` → `0.10.0`；新增 `test:p9`。
- 阶段重排：P9 内容驱动、P10 输入、P11 挑战、P12 平移。
- 内容从 10 词扩到 20 词；组合库 96 项。
- 后台单词列表按 unit 折叠，显示错/对次数。

### Verification

```bash
node tests/runTests.js --phase=p9
# PASS  p9 gate · 224 passed · 0 failed · 48 files
```

- 练习设计：3 单元全选、Review、20 questions；开始后 `1 / 20`。
- 单 unit 选择只生成该 unit 的题；retired 不进入。
- Review 新词首题 T-FILL；Effort 新词首题 T-TYPE。
- 后台设置页保存后下一轮练习生效。
- 当前会话不因后台保存中断。

### Known limitations

- 选择目前是规则优先级 + mode 侧重，未做权重校准。
- 实时改题只预留 `revise()`，未实现。
- 内容不足 20 时实际题数少于 20。
## [0.9.0] — 2026-11-11 · P8 前台学习分析 + 后台单词编辑

### Added

- **新增 P8 学习分析阶段**（输入适配顺延 P9）：
  - `src/ui/analytics.js`：session/attempts/按日/按词/状态/probe 纯统计；
  - Header `Stats` 报告页：本次练习、历史总览、最近 5 天、Word states、最近 10 次答案；
  - Done 页显示本次 `correct / total` 与正确率；
  - 只读报告，无积分/排行榜，不参与调度。
- 组合库扩充到 96 项（单字母 + 常见 digraph/vowel-team/r-controlled/trigraph/suffix）。
- 后台批量录入：每行一词，逗号显式切分，无逗号最长匹配自动建议；支持中文/音标。
- 后台单词列表按 level 折叠（1 单元/一年级下学期、2 单元/二年级上学期），显示只读错/对次数，隐藏内部 ID。
- 后台单词库/unit 编辑器（交互重做）：
  - 左侧搜索/单词列表，右侧编辑器；内联新增，不再 prompt；
  - 增删改 unit、人工选择 grapheme、拼接一致性提示；
  - 从共享 IndexedDB 读取内容，保存后再读仍是编辑后的内容；
  - 保存到与学习端共享的 IndexedDB，BroadcastChannel 提示学习端刷新；
  - 未保存/已同步状态、撤销、删除、全局校验；
  - 逗号切分输入 + 实时 chip 预览 + 自动切分/按字母；
  - 移除内容“下载/导入”假流程，避免与迁移混淆。
- 本机数据迁移独立页面 `/migration/index.html`：全量 8 store 导出/导入，仅用于换主机；不在 AdminApp 中导出内容。
- `tests/p7/editor.test.js`、`tests/p8/analytics.test.js`。
- ADR-0014：前台学习分析与历史统计。
- ADR-0015：后台/前台共享 IndexedDB；本机迁移独立。

### Changed

- `package.json` 版本 `0.8.0` → `0.9.0`；新增 `test:p8`。
- 阶段重排：P8 学习分析、P9 输入适配、P10 挑战、P11 平移。
- 后台从只读统计升级为单词/unit 编辑 + 共享 IndexedDB；内容导出入口移除。
- `README` / `ROADMAP` / `TRACEABILITY` / `AGENTS` / `FILE_SPEC` 状态推进到 P9。

### Verification

```bash
node tests/runTests.js --phase=p7
# PASS  p7 gate · 188 passed · 0 failed · 34 files

node tests/runTests.js --phase=p8
# PASS  p8 gate · 191 passed · 0 failed · 35 files
```

- Stats：4 answers / 50%，按日正确率、词状态、最近 4 条答案均显示。
- 后台：批量/单条 word + units，自动切分建议，中文/音标；保存到 IndexedDB；当前种子仍 112 条 unreviewed，发布校验阻断。
- 390px Stats 无横向滚动。

### Known limitations

- Stats 固定最近 10 条/5 天，无筛选/导出。
- 后台句子库/混淆项仍只读；完整可视化标注编辑器待后续。
- 不做积分/排行榜/家长端完整报表。

---

## [0.8.0] — 2026-11-11 · P7 内容后台与导出校验

### Added

- `ContentValidator`：V1—V9 校验 + V10 reviewed-only 导出。
- `buildExport`：未审核/无效内容阻断，返回可定位 `unreviewed[]`。
- `AdminApp` + `/src/admin/index.html`：同源加载 4 库、显示计数/错误、导出按钮。
- 后台不 import 状态仓库，不触碰 wordStates/graphemeStates/attempts。
- `tests/p7/content.test.js`、`tests/p7/adminArchitecture.test.js`。
- ADR-0013：ContentValidator、后台与导出阻断。

### Changed

- `package.json` 版本 `0.7.0` → `0.8.0`；新增 `test:p7`。
- `README` / `ROADMAP` / `TRACEABILITY` / `AGENTS` / `FILE_SPEC` 状态推进到 P8。

### Verification

```bash
node tests/runTests.js --phase=p7
# PASS  p7 gate · 168 passed · 0 failed · 29 files
```

- 当前种子：V1—V9 通过；V10 阻断 38 条 unreviewed；导出按钮 disabled。
- reviewed 副本：导出 10/22/4/2，只含 reviewed。
- 切分不闭合、缺组合、重复 ID、句子答案错、混淆项重复均可定位。
- 后台浏览器：words 10 / graphemes 22 / sentences 4 / confusables 2；显示 `CONTENT_EXPORT_UNREVIEWED`。
- 后台无学习状态访问；无控制台异常。

### Known limitations

- 后台目前是只读校验+导出，不是完整可视化标注编辑器。
- V6 语义唯一仍靠人工评审；自动只校验答案出现一次。
- P8 输入适配/P9 挑战未实现。

---

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
