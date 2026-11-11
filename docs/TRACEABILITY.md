# 需求追溯矩阵 · TRACEABILITY

**用途**：把 `docs/DESIGN.md` 的条款、仓库代码、验证方式、阶段绑在一起。任何新增规则都必须在此登记；任何删除测试都必须先改这里并说明原因。

**状态图例**：`✅ 已落实` / `🧪 已冻结（测试存在，功能未实现）` / `⏳ 计划中` / `👁 人工评审`

**门禁**：`node tests/runTests.js --phase=p0`（P0 回归）；`node tests/runTests.js --phase=p1`（当前 P1，累计运行）。

---

## 1. 产品哲学与边界

| ID | 设计条款 | 实现位置 | 验证方式 | 阶段 | 状态 |
|---|---|---|---|---|---|
| R-PHIL-01 | §1.1 只保留看词→拼写→判定→调度闭环 | `src/questionTypes/registry.js` 仅 9 个拼写题型；无听力/选择/图片题型 | `tests/p0/registry.test.js` 断言题型集合精确等于 9 个；👁 评审 UI | P0 | ✅ |
| R-PHIL-02 | §1.1 / §6.2 不做积分、排行榜、连胜、生命值 | 无相关模块；`ROADMAP` 明确排除 | 👁 评审 + 代码搜索 | P0 | ✅ |
| R-PHIL-03 | §1.1 题型轮转制造新鲜感，不靠外部奖励 | `TypeSelector.js` 按错误类型给候选池；`QuestionSpec.seed` 决定选择 | `tests/p0/scheduler.test.js` | P0/P3 | 🧪 |
| R-PHIL-04 | §1.2 错误结构化，不向孩子展示“错题本” | `ErrorProfile.js`；UI 只做温和反馈 | `tests/p0/scheduler.test.js`；P1 UI 测试 | P0/P3 | 🧪 |
| R-PHIL-05 | §1.3 间隔阶梯 1/3/7/14/30 | `src/scheduler/IntervalPolicy.js` | `tests/p0/scheduler.test.js` | P0 | ✅ |
| R-PHIL-06 | §1.3 答错降 2 档、连续再错归零 | `IntervalPolicy.nextReview()` | `tests/p0/scheduler.test.js` | P0 | ✅ |
| R-PHIL-07 | §1.3 连续 3 次 + 跨 2 词进抽查，60 天验证 | 常量已定义；逻辑在 P5 | `tests/p5/*` 待建 | P5 | ⏳ |
| R-PHIL-08 | §1.4 切分禁止自动推断 | 内容 JSON 显式 `units[]`；运行时无切分函数 | `tests/p0/content.test.js` + 👁 标注评审 | P0 | ✅ |

## 2. 架构铁律

| ID | 设计条款 | 实现位置 | 验证方式 | 阶段 | 状态 |
|---|---|---|---|---|---|
| R-ARCH-01 | §3.2 题型层不查库、不碰 DOM、不写状态、不造干扰项 | `src/questionTypes/*` 只依赖 `core` | `tests/p0/architecture.test.js` | P0 | ✅ |
| R-ARCH-02 | §3.2 调度层不渲染、不判定、不依赖 DOM | `src/scheduler/*` 只依赖 `core`/`repositories`/registry | `tests/p0/architecture.test.js` | P0 | ✅ |
| R-ARCH-03 | §3.2 仓库层只调用 StorageAdapter 的 7 个方法 | `src/repositories/BaseRepository.js` + 各仓库 | `tests/p0/architecture.test.js`（方法白名单扫描） | P0 | ✅ |
| R-ARCH-04 | §3.2 所有随机使用 `spec.seed` | `src/core/seedRandom.js`；全仓库无 `Math.random` | `tests/p0/architecture.test.js` + `seed.test.js` | P0 | ✅ |
| R-ARCH-05 | §3.2 UI 层只渲染/编排，不实现判定 | `src/ui/PracticeScreen.js` | `tests/p1/architecture.test.js`：屏幕不 import 题型、不调用 judge | P0/P1 | ✅ |
| R-ARCH-06 | §3.2 层间依赖单向，无循环 | 见 `FILE_SPEC §3` | `tests/p0/architecture.test.js` 循环检测 | P0 | ✅ |
| R-ARCH-07 | §5.3 换 adapter 仓库零改动 | `StorageAdapter` 抽象 + 仓库仅用接口 | `tests/p0/storage.test.js` 适配器契约套件；P10 换 Node adapter | P0/P10 | 🧪 |
| R-ARCH-08 | §3.2 组合根唯一 | `main.js` | 👁 评审 | P0 | ✅ |

## 3. 核心契约

| ID | 设计条款 | 实现位置 | 验证方式 | 阶段 | 状态 |
|---|---|---|---|---|---|
| R-CONTRACT-01 | §5.2 `QuestionSpec` 字段与类型 | `src/core/contracts.js` `validateQuestionSpec` | `tests/p0/contracts.test.js` | P0 | ✅ |
| R-CONTRACT-02 | §5.2 `RenderModel` 与设备无关 | `validateRenderModel` | `tests/p0/contracts.test.js` | P0 | ✅ |
| R-CONTRACT-03 | §5.2 `InputEvent` 六种语义事件 | `validateInputEvent` | `tests/p0/contracts.test.js` | P0 | ✅ |
| R-CONTRACT-04 | §5.2 `AttemptResult` 判定结果 | `validateAttemptResult` | `tests/p0/contracts.test.js` | P0 | ✅ |
| R-CONTRACT-05 | §3.3 `wordState` / `graphemeState` 字段 | `validateWordState` / `validateGraphemeState` | `tests/p0/contracts.test.js` | P0 | ✅ |
| R-CONTRACT-06 | §3.3 九种错误类型完整 | `ERROR_TYPES` | `tests/p0/contracts.test.js` 精确断言 | P0 | ✅ |
| R-CONTRACT-07 | 跨层契约版本化 | `CONTRACT_VERSION = 1` | `tests/p0/traceability.test.js` | P0 | ✅ |

## 4. 存储与仓库

| ID | 设计条款 | 实现位置 | 验证方式 | 阶段 | 状态 |
|---|---|---|---|---|---|
| R-STORE-01 | §3.2 适配器 7 方法：`init/get/put/query/transaction/exportAll/importAll` | `src/storage/StorageAdapter.js` | `tests/p0/storage.test.js` 精确断言 | P0 | ✅ |
| R-STORE-02 | §5.1 8 个 store：words/graphemes/sentences/confusables/wordStates/graphemeStates/attempts/meta | `src/storage/schema.js` | `tests/p0/storage.test.js` | P0 | ✅ |
| R-STORE-03 | §3.2 查询不暴露底层细节 | `query(store,{where,limit,offset})` | `tests/p0/storage.test.js` | P0 | ✅ |
| R-STORE-04 | 事务失败回滚 | `MemoryAdapter.transaction` | `tests/p0/storage.test.js` | P0 | ✅ |
| R-STORE-05 | 导出/导入一致 | `exportAll/importAll` | `tests/p0/storage.test.js` 往返断言 | P0 | ✅ |
| R-STORE-06 | IndexedDB 持久化 | `src/storage/IndexedDBAdapter.js` | `tests/p2/indexeddbAdapter.test.js` + 浏览器刷新不丢 | P2 | ✅ |
| R-STORE-07 | 内容仓库查询 | `WordRepository` 等 | `tests/p0/repositories.test.js` | P0 | ✅ |
| R-STORE-08 | 状态默认值与到期查询 | `StateRepository` | `tests/p0/repositories.test.js` | P0 | ✅ |
| R-STORE-09 | 尝试记录只追加 | `AttemptRepository` | `tests/p0/repositories.test.js` | P0 | ✅ |
| R-P2-01 | 内容导入 4 库 + meta 版本，幂等 | `contentImport.js` | `tests/p2/contentImport.test.js` | P2 | ✅ |
| R-P2-02 | 刷新后内容仍在，不重复 fetch | `bootstrap.js` + IndexedDB | 浏览器 reload：0 个 content 请求 | P2 | ✅ |
| R-P2-03 | exportAll/importAll 往返一致 | `IndexedDBAdapter` | 浏览器 39 条记录往返 + `tests/p0/storage.test.js` | P2 | ✅ |
| R-P2-04 | IndexedDB 不可用回退 MemoryAdapter | `bootstrap.js` | 无 IndexedDB 时 `STORAGE_UNAVAILABLE` / 浏览器 fallback | P2 | ✅ |

## 5. 调度与题型

| ID | 设计条款 | 实现位置 | 验证方式 | 阶段 | 状态 |
|---|---|---|---|---|---|
| R-TYPE-01 | §3.4 9 个题型精确注册 | `src/questionTypes/registry.js` | `tests/p0/registry.test.js` | P0 | ✅ |
| R-TYPE-02 | §3.4 每个题型只做 build/judge | `defineQuestionType` 契约 | `tests/p0/registry.test.js` + `architecture.test.js` | P0 | ✅ |
| R-TYPE-03 | §3.4 题型 ID 与修复信号对应 | `REPAIR_PREFERENCE` / 各 meta | `tests/p0/scheduler.test.js` | P0 | ✅ |
| R-TYPE-04 | P1 三题型可出题判定 | `TSequence/TFill/TType` | `tests/p1/*.test.js` + 浏览器 3×3 | P1 | ✅ |
| R-TYPE-05 | `ai→ia` 顺序修复 | `TReorder` | `tests/p4/types.test.js` + 浏览器 | P4 | ✅ |
| R-TYPE-06 | `sh→ch`、`ck/k` 边界修复 | `TSegment/TEdit/TMatch` | `tests/p4/types.test.js` + `tests/p5/match.test.js` | P4/P5 | ✅ |
| R-SCHED-01 | §2.1 每日 5—8 词队列 | `Scheduler.buildDailyQueue` | `tests/p3/scheduler.test.js` | P3 | ✅ |
| R-SCHED-02 | 错词次日强制再现 | `Scheduler.recordAttempt` | `tests/p3/scheduler.test.js` 固定时钟 | P3 | ✅ |
| R-SCHED-03 | 按错误类型选修复题型 | `TypeSelector` + Scheduler | `tests/p3/scheduler.test.js` + `tests/p4/schedulerTypes.test.js` | P0/P4 | ✅ |
| R-SCHED-04 | 组合独立阶梯、跨 2 词 | `GraphemeRepository` / `Scheduler` | `tests/p5/match.test.js` | P5 | ✅ |
| R-SCHED-05 | 假掌握抽查 60 天 | `Scheduler` + `PROBE_INTERVAL_DAYS` | `tests/p6/probe.test.js` | P6 | ✅ |
| R-P3-01 | 尝试落库、wordState 升降档与错误画像 | `Scheduler.recordAttempt` | `tests/p3/scheduler.test.js` | P3 | ✅ |
| R-P3-02 | 每日队列优先错词/到期/新词 | `Scheduler.buildDailyQueue` | `tests/p3/scheduler.test.js` | P3 | ✅ |
| R-P3-03 | 每个 spec 记录 P3 难度向量 | `QuestionSpecBuilder` | `tests/p3/scheduler.test.js` | P3 | ✅ |
| R-P3-04 | 刷新后学习状态仍在 | P2 IndexedDB + StateRepository | 浏览器刷新：wordStates/attempts 保留 | P3 | ✅ |
| R-P4-01 | T-REORDER 打乱单位、交换重排、TRANSPOSITION | `TReorder` + PracticeScreen | `tests/p4/types.test.js` + 浏览器 | P4 | ✅ |
| R-P4-02 | T-EDIT 预填错词、编辑修错、错误定位 | `TEdit` + PracticeScreen | `tests/p4/types.test.js` + 浏览器 | P4 | ✅ |
| R-P4-03 | T-SEGMENT 字母间隙、过度/不足/错位 | `TSegment` + PracticeScreen | `tests/p4/types.test.js` + 浏览器 | P4 | ✅ |
| R-P4-04 | P4 错误类型映射到 P4 题型 | `Scheduler` + `TypeSelector` | `tests/p4/schedulerTypes.test.js` | P4 | ✅ |
| R-P5-01 | T-MATCH 多选分类 build/judge | `TMatch` | `tests/p5/match.test.js` | P5 | ✅ |
| R-P5-02 | 组合独立间隔与 wordsPassed | `Scheduler.recordAttempt` + StateRepository | `tests/p5/match.test.js` | P5 | ✅ |
| R-P5-03 | 跨 2 词连续 3 次进入 probe | `isProbeEligible` | `tests/p5/match.test.js` | P5 | ✅ |
| R-P5-04 | 每日最多 1 个 T-MATCH 强化包 | `Scheduler.buildGraphemeDrill` | `tests/p5/match.test.js` | P5 | ✅ |
| R-P6-01 | T-JUDGE-FIX 判断对错并改对 | `TJudgeFix` + PracticeScreen | `tests/p6/types.test.js` + 浏览器 | P6 | ✅ |
| R-P6-02 | T-CLOZE 句子挖空拼写 | `TCloze` + PracticeScreen | `tests/p6/types.test.js` + 浏览器 | P6 | ✅ |
| R-P6-03 | probe 到期、答错退回、答对 mastered | `Scheduler.recordAttempt` | `tests/p6/probe.test.js` | P6 | ✅ |
| R-P6-04 | probe 队列优先 T-CLOZE/T-JUDGE-FIX | `Scheduler.buildDailyQueue` | `tests/p6/probe.test.js` | P6 | ✅ |
| R-P7-01 | ContentValidator V1—V9 | `src/admin/ContentValidator.js` | `tests/p7/content.test.js` | P7 | ✅ |
| R-P7-02 | V10 只导出 reviewed，未审核阻断 | `buildExport` | `tests/p7/content.test.js` | P7 | ✅ |
| R-P7-03 | 后台不写学习状态 | `src/admin/**` | `tests/p7/adminArchitecture.test.js` | P7 | ✅ |
| R-P7-04 | 后台可访问并显示校验/阻断 | `/src/admin/index.html` | 浏览器 admin 验收 | P7 | ✅ |
| R-P7-05 | 后台维护单词与 unit 切分 | `ContentEditor` + AdminApp | `tests/p7/editor.test.js` + 浏览器 | P7 | ✅ |
| R-P7-06 | 后台保存到共享 IndexedDB，学习端可见 | `AdminApp` + BroadcastChannel | 浏览器双页验收 | P7/P8 | ✅ |
| R-P7-07 | 批量录入 + 自动切分建议 + 翻译/音标 | `WordImporter` + AdminApp | `tests/p7/import.test.js` + 浏览器 | P7 | ✅ |
| R-P7-08 | 后台列表按 unit 折叠，显示错/对次数 | `AttemptStats` + AdminApp | `tests/p7/attemptStats.test.js` | P7 | ✅ |
| R-P9-01 | 内容 revision 与下一轮重新读取 | `bootstrap` / AdminApp | `tests/p9/practiceSettings.test.js` + 浏览器 | P9 | ✅ |
| R-P9-02 | 单元多选、Review/Effort、前台不选题量 | `PracticeSetupScreen` | 浏览器 setup + `tests/p9/unitSelection.test.js` | P9 | ✅ |
| R-P9-03 | 后台题量默认20、范围5—30 | `practiceSettings.js` + settings 页 | `tests/p9/practiceSettings.test.js` | P9 | ✅ |
| R-P9-04 | 计划项 reason/mode/policyVersion | `Scheduler` + `PlanPolicy` | `tests/p9/unitSelection.test.js` + `planPolicy.test.js` | P9 | ✅ |
| R-P9-05 | 真实 attempts 校准选词权重 | `SelectionWeights` + Scheduler | `tests/p9/selectionWeights.test.js` + `unitSelection.test.js` | P9 | ✅ |
| R-P9-06 | 年级/学期/单元多选与出题范围 | `bootstrap` + PracticeSetupScreen + Scheduler | `tests/p9/unitSelection.test.js` + 浏览器 | P9 | ✅ |
| R-P9-07 | 提示词句子/音标/中文/单词优先级 | `promptSelector` + PracticeScreen | `tests/p9/promptSelector.test.js` | P9 | ✅ |
| R-P9-08 | 2026 人教新起点 1—6 年级基础词库 | `src/content/words.json` + report | content tests + data audit | P9 | ✅ |
| R-P7-09 | 批量单元标题行切换后续词单元 | `WordImporter.parseBatch` + AdminApp | `tests/p7/import.test.js` + `tests/p7/editor.test.js` | P7 | ✅ |
| R-P7-10 | 词库单独导入/导出与重复词合并/替换/不动 | `WordLibrary` + AdminApp | `tests/p7/wordLibrary.test.js` + 浏览器 | P7 | ✅ |
| R-P8-05 | 本机数据全量迁移独立于内容编辑 | `MigrationApp` | 浏览器迁移页 | P8 | ✅ |
| R-P8-01 | 本次练习效果统计 | `summarizeSession` + Done 页 | `tests/p8/analytics.test.js` + 浏览器 | P8 | ✅ |
| R-P8-02 | 历史答题汇总/按日/按词 | `summarizeAttempts` / `groupAttemptsByDay` | `tests/p8/analytics.test.js` + Stats 页 | P8 | ✅ |
| R-P8-03 | 词状态与 probe 分布 | `summarizeWordStates` | `tests/p8/analytics.test.js` | P8 | ✅ |
| R-P8-04 | Stats 只读，不写状态/不参与调度 | `PracticeScreen.loadReport` | P8 浏览器 + 架构检查 | P8 | ✅ |

### 5.1 九题型覆盖（与 `QUESTION_TYPE_IDS` 一一对应）

| 题型 | 阶段 | 当前状态 | 验证 |
|---|---|---|---|
| `T-SEQUENCE` | P1 | 已实现 | `tests/p1/tsequence.test.js` |
| `T-FILL` | P1 | 已实现 | `tests/p1/tfill.test.js` |
| `T-REORDER` | P4 | 已实现 | `tests/p4/types.test.js` |
| `T-TYPE` | P1 | 已实现 | `tests/p1/ttype.test.js` |
| `T-JUDGE-FIX` | P6 | 已实现 | `tests/p6/types.test.js` |
| `T-EDIT` | P4 | 已实现 | `tests/p4/types.test.js` |
| `T-MATCH` | P5 | 骨架 | 同上 |
| `T-CLOZE` | P6 | 已实现 | `tests/p6/types.test.js` |
| `T-SEGMENT` | P4 | 已实现 | `tests/p4/types.test.js` |

### 5.2 P1 最小闭环

| ID | 设计条款 | 实现位置 | 验证方式 | 阶段 | 状态 |
|---|---|---|---|---|---|
| R-P1-01 | §2.1 3 词 × 3 题型最小队列 | `src/ui/PracticeSession.js` | `tests/p1/session.test.js` | P1 | ✅ |
| R-P1-02 | §5.2 资源装配不查库 | `src/ui/bootstrap.js` | `tests/p1/architecture.test.js` + 浏览器 | P1 | ✅ |
| R-P1-03 | §3.4 T-SEQUENCE 出题与判定 | `src/questionTypes/TSequence.js` | `tests/p1/tsequence.test.js` | P1 | ✅ |
| R-P1-04 | §3.4 T-FILL 出题与判定 | `src/questionTypes/TFill.js` | `tests/p1/tfill.test.js` | P1 | ✅ |
| R-P1-05 | §3.4 T-TYPE 出题与判定 | `src/questionTypes/TType.js` | `tests/p1/ttype.test.js` | P1 | ✅ |
| R-P1-06 | §1.2 错误定位到 unit/position/type | `src/questionTypes/shared.js` | 三题型错误用例测试 | P1 | ✅ |
| R-P1-07 | §6.2 学习端纯英文、不显示“错误” | `src/ui/PracticeScreen.js` | `tests/p1/architecture.test.js` + 👁 | P1 | ✅ |
| R-P1-08 | P1 不持久化、不写调度状态 | `PracticeSession` 内存 results | `tests/p1/architecture.test.js` | P1 | ✅ |
| R-P1-09 | 同 spec.seed 渲染稳定 | `createRng` + 各 build | `tests/p1/tsequence.test.js` 等 | P1 | ✅ |
| R-P1-10 | 3 词 × 3 题型端到端 | 浏览器 `/` | 无头 Edge 3×3 + `?debug=1` | P1 | ✅ |
| R-P1-11 | T-SEQUENCE 点选 + 拖拽 + 点击已填槽取消/修改；灰色待选块禁用 | `src/ui/PracticeScreen.js` | 鼠标/触摸拖拽 + 槽位取消 + disabled 待选块的浏览器验收 | P1 | ✅ |
| R-P1-12 | 拖拽靠近槽位吸附，未命中弹回待选区 | `src/ui/dragGeometry.js` + PracticeScreen | `tests/p1/dragGeometry.test.js` + 浏览器远/近放置 | P1 | ✅ |
| R-P1-13 | 轻量互动音效 + 静音开关 | `src/ui/sound.js` | `tests/p1/sound.test.js` + 浏览器 Sound/Muted | P1 | ✅ |
| R-P1-14 | 已到位块可重排，按左右半边插入并顺移；拖拽中实时侧滑 | `src/ui/sequenceOrder.js` + PracticeScreen | `tests/p1/sequenceOrder.test.js` + 浏览器悬停/释放 | P1 | ✅ |
| R-UNIT-01 | 组合可拆成字母、支持混合粒度 | `spec.params.unitGranularity`（P3/P4） | ADR-0004；P3/P4 测试待建 | P3/P4 | ⏳ |
| R-DIFF-01 | §3.5 同词同脚手架：grapheme < mixed < letter | `DifficultyPolicy`（P3） | `tests/p1/difficultyDesign.test.js` + ADR-0006 | P3/P4 | 🧪 |
| R-DIFF-02 | §3.5 难度是向量，不用题型 ID 代替 | `QuestionSpec.params.difficulty`（P3） | P3 `DifficultyPolicy` 测试待建 | P3 | ⏳ |

## 6. 内容与后台

| ID | 设计条款 | 实现位置 | 验证方式 | 阶段 | 状态 |
|---|---|---|---|---|---|
| R-CONTENT-01 | §1.4 / §2.3 人工切分 | `src/content/words.json` 的 `units[]` | `tests/p0/content.test.js`（join + grapheme 引用 + 禁止自动切分） | P0 | ✅ |
| R-CONTENT-02 | §2.3 混淆项成对，禁止单边 | `src/content/confusables.json` | `tests/p0/content.test.js` 对称/重复检查 | P0 | ✅ |
| R-CONTENT-03 | §2.3 句子语义唯一 | `src/content/sentences.json` | `tests/p0/content.test.js` 挖空恰好一次；语义唯一 👁 | P0 | 🧪 |
| R-CONTENT-04 | §2.3 T1—T4 分层 | `graphemes.json` 的 `tier` | `tests/p0/content.test.js` | P0 | ✅ |
| R-CONTENT-05 | 未审核内容不得生产导出 | `reviewStatus` + `buildExport` | `tests/p7/content.test.js` | P0/P7 | ✅ |
| R-ADMIN-01 | §2.3 后台只产内容、只校验 | `src/admin/*`（P7） | P7 测试：不写学习状态 | P7 | ⏳ |
| R-ADMIN-02 | §2.3 切分校验阻断错误导出 | `ContentValidator`（P7） | P7 测试 | P7 | ⏳ |

## 7. 体验与阶段纪律

| ID | 设计条款 | 实现位置 | 验证方式 | 阶段 | 状态 |
|---|---|---|---|---|---|
| R-UI-01 | §6.2 色彩/圆角/动效 token | `styles/tokens.css` | `tests/p0/traceability.test.js` 检查 token 存在 | P0 | ✅ |
| R-UI-02 | §6.2 学习端不出现中文 | `PracticeScreen` | P1 静态扫描；P9 再扩到全部学习视图 | P1/P9 | ✅ |
| R-UI-03 | §6.2 点选与拖拽等价（全部题型/适配器） | PointerAdapter / 其余题型；T-SEQUENCE 已由 R-P1-11 覆盖 | P8 双端测试 | P8 | ⏳ |
| R-UI-04 | §6.2 答错温和反馈，无红色/弹窗 | `styles/practice.css` + PracticeScreen | 👁 评审 + 浏览器 | P1 | 👁 |
| R-CHALLENGE-01 | §2.1 挑战模式不写主状态 | `RapidTapChallenge` | P9 测试 | P9 | ⏳ |
| R-DOC-01 | §四 阶段门禁累计运行 | `tests/runTests.js` | `--phase=p0` 自身即验证 | P0 | ✅ |
| R-DOC-02 | 文档条款 → 代码 → 测试可追溯 | `docs/TRACEABILITY.md` + 文件头 `@doc` | `tests/p0/traceability.test.js` | P0 | ✅ |
| R-DOC-03 | 偏离设计必须 ADR | `docs/decisions/` | `tests/p0/traceability.test.js` 检查目录与索引 | P0 | ✅ |
| R-DOC-04 | 未到阶段的题型明确抛 NotImplementedError | 未实现题型 build/judge | `tests/p0/registry.test.js` | P0 | ✅ |

---

## 8. 文档歧义裁决记录

| 编号 | 歧义 | 裁决 | 位置 |
|---|---|---|---|
| A-01 | §3.2 称“6 个存储方法”，实际列出 7 个 | 以 7 个为准；`STORAGE_METHODS` 精确冻结 | ADR-0001 |
| A-02 | §3.3 `errorProfile` 单对象 vs. 一次多错 | 落库为有界数组（最多 8 条）；`AttemptResult.firstError` 为主错误 | ADR-0001 |
| A-03 | `wordState.status` / `graphemeState.status` 未给枚举 | 词：`learning/reviewing/probe/mastered`；组合：`learning/reviewing/probe/steady` | ADR-0001 |
| A-04 | `query` 语义未定义 | P0 仅等值过滤 + limit/offset；P2 再基于索引优化 | ADR-0001 |
| A-05 | 内容 `reviewStatus` 未定义 | `unreviewed/reviewed/retired`；生产导出只放行 reviewed | CONTENT_SPEC |
| A-06 | P1 的内容装配、迷你队列、judge 上下文未定义 | 同源 fetch → MemoryAdapter；PracticeSession 生成 9 条 spec；judge 接收只读 bundle 与注入 now | ADR-0003 |
| A-07 | 是否只能按 grapheme 整块选择 | 内容仍人工标注 grapheme；P3/P4 用 spec 粒度参数支持字母/混合，不由题型猜 | ADR-0004 |
| A-08 | 拖拽未命中如何处理、音效尺度 | 64px 吸附 + 240ms 弹回；Web Audio 低音量合成音 + Sound/Muted | ADR-0005 |
| A-09 | 已到位块如何重排/插入 | 左右半边决定插前/插后；移源后修正边界；满槽拒绝新候选 | ADR-0007 |
| A-10 | 内容如何进入 IndexedDB、失败如何降级 | meta.contentVersion 幂等；IndexedDB 优先、Memory 回退；导出导入覆盖 8 库 | ADR-0008 |
| A-11 | 每日队列排序、错词优先级与状态迁移 | 5—8 队列；错词→到期→新词→填充；答错次日；答对清错；P3 难度向量 | ADR-0009 |
| A-12 | P4 三种修复题型如何交互与定位 | 点击交换、预填修错、字母间隙；P4 错误映射 | ADR-0010 |
| A-13 | 组合独立阶梯与 T-MATCH 形态 | 多选分类、wordsPassed、跨 2 词 probe、每日 1 组 | ADR-0011 |
| A-14 | 判断纠错、语境抽查与 probe 迁移 | claim 判断+改错、句子挖空、60 天 probe、答错退回 | ADR-0012 |
| A-15 | 后台校验与生产导出如何阻断 | V1—V10、只读后台、只导出 reviewed、后台不碰状态 | ADR-0013 |
| A-16 | 前台学习分析包含什么、如何避免游戏化 | 本次/历史/按日/状态；无积分排名；只读报告 | ADR-0014 |
| A-17 | 后台编辑如何进入学习端、迁移是否内容发布 | 共享 IndexedDB + BroadcastChannel；全量迁移独立 | ADR-0015 |
| A-18 | 后台自动切分与人工确认边界 | 最长匹配仅后台草稿；保存校验；批量/翻译/音标 | ADR-0016 |
| A-19 | 后台列表如何展示学习情况 | 错/对次数只读聚合；level 折叠；隐藏内部 ID | ADR-0017 |
| A-20 | 练习入口/题量/单元/内容更新如何决定 | 单元多选+Review/Effort；后台20题；下一轮读新 revision；revise 预留 | ADR-0018 |
| A-21 | 选词权重如何从真实数据校准 | 按词/题型错误率、小样本平滑、约束优先、下一次计划生效 | ADR-0019 |
| A-22 | 提示词优先用哪种资源 | 句子→音标→中文→单词；只读；CLOZE 句子即题面 | ADR-0020 |
| A-23 | 词库导入导出如何与迁移区分 | 只含 words；合并/替换/不动；导入校验落库；全量迁移独立 | ADR-0021 |

---

## 9. 维护规则

1. 新增代码文件若对应新规则，先在本表加一行，再写代码。
2. 删除/重命名测试，必须同步改本表“验证方式”列，并在 CHANGELOG 说明。
3. 每个阶段门禁前，逐行检查本阶段状态；`⏳` 不得出现在已完成阶段。
4. `👁 人工评审` 的条款在阶段验收时由人确认，确认后在 CHANGELOG 记录。
