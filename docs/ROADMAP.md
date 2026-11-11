# 开发路线图 · ROADMAP

**当前阶段**：P2 ✅（2026-11-11）
**下一阶段**：P3（记忆曲线与错词调度）
**纪律**：严格按序；`--phase=pN` 全绿才可把该阶段标为完成。P2 不通过不进入 P3。

---

## 1. 门禁命令

```bash
# 当前阶段（P2，累计 p0..p2）
node tests/runTests.js --phase=p2

# 后续阶段（累计运行 p0..pN）
node tests/runTests.js --phase=p3

# 默认：自动跑到仓库中已存在的最高阶段
node tests/runTests.js

# 本地预览（必须走 HTTP，ESM 不能 file://）
node tools/serve.mjs
```

> 若系统 PATH 中没有 `node`，在 DSH 环境可用
> `/Users/Dr/.dsh/dsh-runtimes/dsh-primary-runtime/dependencies/node/bin/node`
> 执行上述命令。项目本身不绑定该路径。

---

## 2. 阶段总表

| 阶段 | 目标 | 门禁 | 状态 |
|---|---|---|---|
| **P0** | 契约与骨架 | `--phase=p0` PASS | ✅ 完成 |
| **P1** | 最小拼写闭环（T-SEQUENCE/T-FILL/T-TYPE） | `--phase=p1` PASS + 3 词 3 题型人工验收 | ✅ 完成 |
| **P2** | IndexedDB 持久化与内容导入 | `--phase=p2` PASS + 刷新不丢、导出导入一致 | ✅ 完成 |
| **P3** | 记忆曲线与错词调度 | `--phase=p3` PASS + 次日必现 | ⏳ 下一步 |
| **P4** | 顺序/边界错闭环（T-REORDER/T-EDIT/T-SEGMENT） | `--phase=p4` PASS + 三类错误触发对应修复 | ⏳ |
| **P5** | 组合强化与配对（T-MATCH） | `--phase=p5` PASS + 跨 2 词连续正确 | ⏳ |
| **P6** | 判断纠错与语境抽查（T-JUDGE-FIX/T-CLOZE） | `--phase=p6` PASS + 假掌握被拦下 | ⏳ |
| **P7** | 人工标注后台系统 | `--phase=p7` PASS + 错误切分阻断导出 | ⏳ |
| **P8** | 输入适配与体验（PC/移动） | `--phase=p8` PASS + 同 spec+seed 双端一致 | ⏳ |
| **P9** | 挑战旁路与变换预留 | `--phase=p9` PASS + 挑战不写主状态 | ⏳ |
| **P10** | 平移准备 | `--phase=p10` PASS + 换 adapter 仓库零改动 | ⏳ |

---

## 3. P0 任务书（已完成）

**目标**：把 DESIGN 的契约、分层、目录、测试门禁固定下来，让后续每个阶段都有可执行的边界。

### 交付物

- [x] 目录骨架与 `@layer/@phase/@doc` 文件头规范。
- [x] `core/contracts.js`：QuestionSpec / RenderModel / InputEvent / AttemptResult / 状态结构 + 运行时校验。
- [x] `core/seedRandom.js`：mulberry32、种子归一化、确定性 shuffle；全仓库无 `Math.random`。
- [x] `core/time.js`、`core/eventBus.js`、`core/errors.js`。
- [x] `storage/StorageAdapter.js` 7 方法契约、`MemoryAdapter`（事务/导出导入）、`schema.js` 8 个 store。
- [x] 6 个仓库的 P0 能力（内容查询、状态默认值、尝试追加）。
- [x] `IntervalPolicy`（1/3/7/14/30、降 2 档、连续错归零）、`ErrorProfile`、`TypeSelector`。
- [x] 9 个题型注册表 + 未到阶段的 `NotImplementedError` 骨架。
- [x] `tests/p0/` 十个测试文件：契约、seed、存储、仓库、调度、注册表、内容、架构守卫、追溯、P0 状态页。
- [x] `tests/runTests.js` 阶段门 runner：累计运行、PASS/FAIL、退出码。
- [x] 开发状态页（`index.html` + `ui/App.js`）与 `tools/serve.mjs`。
- [x] 文档体系：DESIGN / FILE_SPEC / TRACEABILITY / CONTENT_SPEC / ADR / AGENTS。

### 验收

```bash
node tests/runTests.js --phase=p0
# 期望最后一行：PASS  p0 gate · N passed · 0 failed
```

浏览器打开 `http://127.0.0.1:4173/?dev=1`，应看到 P0 状态页：契约版本、9 题型、8 集合、seed 说明、视觉样片。
P0 **不包含**：任何题型的真实出题/判定、IndexedDB 写入、调度队列、学习端 UI。

### P0 明确不做

- 不实现 T-SEQUENCE/T-FILL/T-TYPE 的 build/judge（P1）。
- 不接 IndexedDB（P2）。
- 不做每日队列/次日错词（P3）。
- 不做家长端/后台/挑战模式（P3/P7/P9）。
- 不引入任何 npm 依赖、构建工具、框架。

---

## 4. P1 任务书（已完成）

**目标**：3 个词 × 3 个题型，完成“看词 → 拼写 → 判定 → 错误定位”的最小闭环。

### 交付物

- [x] `T-SEQUENCE` / `T-FILL` / `T-TYPE` 的 `build(spec, bundle)` 与 `judge({ spec, renderModel, events, bundle, now })`。
- [x] 错误定位到 grapheme unit / position，覆盖 OMISSION、SUBSTITUTION、EXTRA、TRANSPOSITION。
- [x] `ResourceBundle`：`{ word, graphemes }`；`src/ui/bootstrap.js` 从同源 JSON 装配，题型层只消费。
- [x] `PracticeSession`：3 词 × 3 题型共 9 条 spec，同 seed 可复现；结果只存内存。
- [x] `PracticeScreen`：渲染 RenderModel、接收 InputEvent、温和反馈；学习端全英文。
- [x] T-SEQUENCE 同时支持按序点选与指针拖拽（鼠标/触摸），点击已填槽位可取消并修改；已使用待选块置灰禁用。
- [x] T-SEQUENCE judge 按 `slotIndex` 重建答案，允许取消中间选择、拖拽放置与点选混用。
- [x] 拖拽距离槽位 64px 内吸附；未命中时浮层 240ms 缓动弹回待选区，原块不丢。
- [x] 已到位块可拖拽重排：拖到目标块左/右半边决定插前/插后，其余块顺移；满槽时新候选弹回。
- [x] 拖拽中实时侧滑：源块隐藏、其他块平移让位，插入点显示虚线缺口；释放才提交，离开/弹回则还原。
- [x] Web Audio 合成轻音效（选中/拾取/吸附/取消/返回/对/错/完成），Header 提供 Sound/Muted 开关。
- [x] `?debug=1`：开发模式显示 AttemptResult，孩子端不显示。
- [x] `tests/p1/`：题型 build/judge、session、seed 复现、UI 边界、拖拽几何、音效静音、学习端英文检查。
- [x] 浏览器验收：3 个词 × 3 题型完整走通；`fish` 的 `sh` 替换为 `oo` 时 debug 显示 `SUBSTITUTION`、位置 2。

### 验收结果

```bash
node tests/runTests.js --phase=p1
# PASS  p1 gate · 135 passed · 0 failed · 19 files
```

- 累计运行 P0 + P1，低阶段无回退。
- 无头浏览器完成 9/9：`T-SEQUENCE → T-FILL → T-TYPE` 三词轮转，结束页 `Done.`。
- T-SEQUENCE 鼠标拖拽三块入槽、触摸拖拽 `f → slot 0`、点击已填槽位取消后不误提交；灰色待选块禁用，均通过。
- 拖拽到槽位附近 40px 可吸附；拖到舞台远处会弹回且槽位保持空，浮层最终移除。
- `[f,i,sh]` 拖 f 到 sh 右侧变 `[i,sh,f]`；sh 拖到 f 左侧变 `[sh,f,i]`；候选插入与满槽拒绝均通过。
- 拖拽悬停时其他块实时侧滑、缺口位置随左右半边变化，未释放前不修改状态。
- Sound/Muted 可切换，全流程无控制台报错。
- 390px 移动端：`clientWidth = scrollWidth = 390`，无横向滚动。
- 不写 `wordStates` / `graphemeStates` / `attempts`；刷新即重置。
- 边界裁决见 ADR-0003。

### P1 明确不做（已在 P2/P3 之前保持）

- 不接 IndexedDB（P2）。
- 不写调度状态、不做每日队列/次日错词（P3）。
- 不做 `T-REORDER` / `T-EDIT` / `T-SEGMENT`（P4）。
- 不做完整 QWERTY 解锁、家长端、后台、挑战模式。

---

## 5. P2 任务书（已完成）

**目标**：把 P1 的内存内容切到 IndexedDB，做到刷新不丢、导出导入一致。

### 交付物

- [x] 实现 `IndexedDBAdapter` 的 7 个方法，使用 `schema.js` 的 8 个 store 与索引。
- [x] 内容导入 `contentImport.js`：4 个内容库 + `meta.contentVersion`，同版本幂等跳过。
- [x] `bootstrap.js` 优先 `IndexedDBAdapter`，不可用时回退 `MemoryAdapter`。
- [x] `exportAll` / `importAll` 覆盖 8 个 store，事务内 clear + put。
- [x] `?debug=1` 暴露只读调试句柄：`window.__SPELLWELL_DEBUG__ = { session, adapter, storage, contentSeeded }`。
- [x] `tests/p2/`：内容导入幂等/版本/非法内容、适配器 7 方法结构、无 IndexedDB 降级、未 init 报错；浏览器验收持久化。
- [x] 写出 ADR-0008（IndexedDB 内容导入与降级）。

### 验收结果

```bash
node tests/runTests.js --phase=p2
# PASS  p2 gate · 142 passed · 0 failed · 21 files
```

- 浏览器首次加载：`storage = indexeddb`、`contentSeeded = true`，内容计数 `10 / 22 / 4 / 2`。
- 刷新后：`contentSeeded = false`，`/src/content/` 网络请求为 0，9 题仍可开始。
- `exportAll` → `importAll` 往返导入 39 条记录，内容计数一致；临时 meta 在回滚后消失。
- Node 无 IndexedDB 时明确报 `STORAGE_UNAVAILABLE`；浏览器不可用时回退内存。
- P0/P1 测试无回退；仍不写 `wordStates` / `graphemeStates` / `attempts`。

### P2 明确不做

- 不写学习状态、不做每日队列/次日错词（P3）。
- 不做 P4 题型、家长端、后台。
- 内容版本变化时暂不删除旧记录（P2 只覆盖写入，P7 再做完整迁移/校验）。

---

## 6. P3 任务书（下一阶段）

**目标**：把 P2 的内容持久化接到记忆曲线与错词调度，让“答错降档、次日必现、按错误类型选题型”真正跑起来。

### 范围

1. `Scheduler.buildDailyQueue()`：5—8 个词，包含昨日错词、到期复习、新词；可复现。
2. `Scheduler.recordAttempt()`：写 `attempts`，按 `IntervalPolicy` 更新 `wordStates`；答错降 2 档、连续错归零。
3. 次日到期：答错后 `dueDate = 明天`；下次队列强制包含。
4. `ErrorProfile` 写入状态；`TypeSelector` 按错误类型选择 P1 题型。
5. 队列/状态全部走 repositories + IndexedDB；刷新不丢。
6. `tests/p3/`：固定时钟、队列 5—8、次日必现、题型映射、状态持久化、不提前做 P4。
7. 最小只读家长视图（今日卡点/待抽查计数）可选，若做不得提供修改入口。

### 验收

- `node tests/runTests.js --phase=p3` PASS。
- 模拟 3 天：今天答错 → 明天队列包含该词 → 答对升级 → 3 天后再现。
- 刷新后状态仍在；挑战/调试不写主状态。
- 不实现 T-REORDER/T-EDIT/T-SEGMENT；不做后台。

### 启动提示词（可直接交给 agent）

> 只做 P3，不提前做 P4。先读 `AGENTS.md`、`docs/DESIGN.md §1.3/§2.1/§3.3`、`docs/TRACEABILITY.md` 的 R-SCHED-01/02/03。
> 实现 Scheduler 每日队列与 recordAttempt，用固定时钟测试次日必现；复用 P1 三题型，不新增 P4 题型。
> 每步运行 `node tests/runTests.js --phase=p3`，最后更新 TRACEABILITY、ROADMAP、CHANGELOG。

---

## 7. 后续阶段要点（防止提前实现）

| 阶段 | 关键新增 | 不得提前做的事 |
|---|---|---|
| P2 | IndexedDBAdapter、内容导入、导出导入一致性 | 不要做调度算法 |
| P3 | Scheduler 每日队列、错词次日必现 | 不要做 T-REORDER/T-EDIT |
| P4 | 顺序/边界错闭环 | 不要做 T-MATCH/T-CLOZE |
| P5 | 组合阶梯、T-MATCH | 不要做家长端完整报表 |
| P6 | T-JUDGE-FIX/T-CLOZE、假掌握抽查 | 不要做后台 |
| P7 | 标注后台、ContentValidator、导出阻断 | 后台不得写学习状态 |
| P8 | Pointer/Keyboard 双适配、移动端 | 不得引入手势库 |
| P9 | 挑战旁路、morphMode | 挑战不得写主状态 |
| P10 | Node adapter、调度层 Node 运行 | 不得改仓库层接口 |

**P3/P4 预留：选择粒度**。当前 T-SEQUENCE 只按人工标注的 grapheme 整块选择。
后续通过 `spec.params.unitGranularity`（`grapheme | letter | mixed`）和 `splitUnitIds`
支持把一个组合拆成字母或混合粒度；由 Scheduler 决定，题型层只消费。详见
[`ADR-0004`](decisions/0004-unit-granularity.md) 与 [`TRACEABILITY`](TRACEABILITY.md) 的 R-UNIT-01。
P1 不实现字母级/混合粒度。

**P3 预留：难度向量**。P3 的 `DifficultyPolicy` 必须按 DESIGN §3.5 记录
`scaffold/granularity/slotCount/letterCount/tier/distractor/confusable` 等维度，
不能用题型 ID 代替难度。权重用真实数据校准；错误修复和假掌握抽查必须记录本次难度。
详见 [`ADR-0006`](decisions/0006-difficulty-gradient.md) 与 R-DIFF-01/02。

---

## 8. 阶段完成检查

- [ ] 本阶段门禁 PASS，且低阶段测试未回退。
- [ ] `TRACEABILITY.md` 中本阶段条目从 ⏳/🧪 改为 ✅。
- [ ] `CHANGELOG.md` 记录新增/变更/已知限制。
- [ ] 若有偏离 DESIGN，ADR 已写并链接。
- [ ] `ROADMAP.md` 状态更新，下一阶段任务书写明。
- [ ] 没有提前实现下一阶段功能（代码搜索阶段标记）。
