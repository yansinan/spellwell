# CHANGELOG

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
