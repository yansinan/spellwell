# AGENTS.md · 项目执行契约

> 任何 agent、贡献者进入本仓库，先读本文件。它规定“怎么做事”，`docs/DESIGN.md` 规定“做什么”。
> 当前阶段：**P10/P11 已完成，P12 是下一步**。不要提前实现 P12 的功能。

---

## 0. 必读顺序（5 分钟）

1. `docs/DESIGN.md` —— 唯一需求源。至少读 §1、§2、§3.2、§3.3、§3.4、§四、§5.2、§6.2。
2. `docs/TRACEABILITY.md` —— 找到你要动的条款 ID（R-*），确认状态与验证方式。
3. `docs/ROADMAP.md` —— 只做当前阶段任务书里的事。
4. `docs/FILE_SPEC.md` —— 文件放哪、依赖方向、命名、测试规则。
5. 本文件 §4 的铁律与 §6 的完成定义。

**不要**在没读 DESIGN 的情况下直接改代码；不要用“先跑起来”绕过阶段门禁。

---

## 1. 当前阶段与边界

| 阶段 | 状态 | 可以做 | 不可以做 |
|---|---|---|---|
| P0 | ✅ 完成 | 修 P0 测试、文档错字、架构守卫误报 | 改契约语义、加新题型 |
| P1 | ✅ 完成 | 修 P1 测试、文档、P1 UI/判定缺陷 | 接 IndexedDB、写调度状态、做 P4 题型 |
| P2 | ✅ 完成 | 修 P2 测试、IndexedDB 适配器/导入缺陷 | 写学习状态、做调度队列、做 P4 题型 |
| P3 | ✅ 完成 | 修 P3 测试、队列/状态/题型映射缺陷 | 做 P4 题型、后台、家长端完整报表 |
| P4 | ✅ 完成 | 修 P4 题型/映射缺陷 | 做 T-MATCH/T-CLOZE、后台、P5 组合阶梯 |
| P5 | ✅ 完成 | 修 T-MATCH/组合状态缺陷 | 做 T-JUDGE-FIX/T-CLOZE、后台 |
| P6 | ✅ 完成 | 修 P6 题型/probe 缺陷 | 做 P7 后台、导出阻断 |
| P7 | ✅ 完成 | 修 ContentValidator/后台/导出缺陷 | 做 P10 输入适配、P11 挑战 |
| P8 | ✅ 完成 | 修 Stats/统计口径缺陷 | 做 P10 输入适配、P11 挑战 |
| P9 | ✅ 完成 | 修内容计划/练习设计/设置缺陷 | 做 P10 输入适配、P11 挑战 |
| P10 | ✅ 完成 | Pointer/Keyboard 双适配、移动端 | 做 P11 挑战、P12 Node adapter |
| P11 | ✅ 完成 | 挑战旁路、morphMode | 做 P12 Node adapter |
| P12 | ⏳ 下一步 | Node adapter、调度层 Node 运行 | 改仓库层接口 |

**判断标准**：如果你写的代码在 `docs/ROADMAP.md` 的“P9 明确不做”或“后续阶段要点”里，停手。

---

## 2. 命令

```bash
# 阶段门禁（唯一验收标准；当前 P11）
node tests/runTests.js --phase=p11

# 本地预览（必须 HTTP）
node tools/serve.mjs
# → http://127.0.0.1:4173
```

若 PATH 无 `node`，DSH 环境可使用：
`/Users/Dr/.dsh/dsh-runtimes/dsh-primary-runtime/dependencies/node/bin/node`。

输出最后一行必须是 `PASS  pN gate · N passed · 0 failed`；退出码 0 才算过。

---

## 3. 工作流（每一小步都适用）

1. **定位条款**：在 TRACEABILITY 找到 R-*；没有就新增一行（条款 → 代码 → 测试 → 阶段）。
2. **先契约后实现**：跨层结构先改 `src/core/contracts.js`（JSDoc + 校验 + 测试）。
3. **写测试**：新行为先写失败测试，放 `tests/pN/`，再实现。
4. **实现**：只改当前层；不顺手重构无关文件。
5. **跑门禁**：`--phase=pN`，必须 PASS；低阶段不得回退。
6. **更新文档**：TRACEABILITY 状态、CHANGELOG、必要时 ROADMAP/ADR。
7. **提交说明**：写清“对应哪条 R-*、跑了哪个门禁、有什么已知限制”。

---

## 4. 铁律（违反即门禁失败或评审拒绝）

1. **只做拼写输出。** 不做听力、选择题（T-JUDGE-FIX 的判断+改错除外）、图片配对、积分、排行榜、连胜、生命值。
2. **题型层只做 build/judge。** 禁止查库、碰 DOM、生成干扰项、更新记忆状态、读取全局。
3. **调度层不渲染、不判定、不依赖 DOM。** 必须能在 Node 跑。
4. **仓库层只调用 StorageAdapter 的 7 个方法**：`init/get/put/query/transaction/exportAll/importAll`；禁止 `indexedDB`/`fetch`/`localStorage`。
5. **所有随机只用 `spec.seed` + `mulberry32`。** 全仓库禁止 `Math.random`。
6. **切分以人工确认为准。** 学习端/题型层禁止自动推断 grapheme；后台可基于组合库生成建议切分，但保存前必须人工确认，`units[]` 仍是唯一真相。
7. **学习端题目/操作不出现中文。** 家长端/后台可以中文；练习设计的年级/单元导航可用中文；按钮用图标+短词。
8. **颜色/圆角/动效只来自 `styles/tokens.css`。** 不使用刺眼红色，不做强阴影。
9. **不新增依赖、不引入构建工具、不引入框架。** 纯 ESM + Node 脚本。
10. **偏离 DESIGN 必须先写 ADR。** 先改文档再改代码；禁止“代码即文档”。
11. **后台不直接写学习状态。** `src/admin/**` 不得直接写 `wordStates/graphemeStates/attempts`；只允许通过 `LearningStateService` 写 `wordStates`，不删除 attempts；单词列表可只读 `attempts` 聚合错/对次数。
12. **挑战模式不写主状态。** `RapidTapChallenge` 的结果不得进入调度/错误画像。
13. **阶段顺序不可跳。** P11 不通过不进入 P12；当前 P11 已完成，只允许修 P11 缺陷，不提前写 P12 Node adapter。

这些规则中 2/3/4/5/6/10 有自动检查（`architecture.test.js`、`traceability.test.js`、`content.test.js`）；其余靠评审。

---

## 5. 代码约定速查

- 文件头必须有：
  ```js
  /**
   * @layer repositories
   * @phase P0
   * @doc §3.2 三层解耦架构
   */
  ```
- 只用 named export；不写 `export default`。
- 未实现的功能抛 `NotImplementedError('P3', 'Scheduler.buildDailyQueue')`，不要返回空数组假装成功。
- 跨层数据先校验：`validateQuestionSpec` / `validateRenderModel` / `validateInputEvent` / `validateAttemptResult`。
- 时间用 `core/time.js` 的本地日历日；不要用 `new Date().toISOString().slice(0,10)`（UTC 会错一天）。
- 测试用 `tests/harness.js`，不引第三方框架。
- 内容 ID 永久稳定；改文本不改 ID；废弃用 `retired`。

---

## 6. 完成定义（Definition of Done）

一个任务只有同时满足以下条件才算完成：

- [ ] 对应 R-* 已在 TRACEABILITY 登记，状态更新。
- [ ] 新行为有测试；`node tests/runTests.js --phase=pN` PASS。
- [ ] 低阶段测试无回退。
- [ ] 文件头、命名、分层符合 FILE_SPEC。
- [ ] 没有新增依赖、`Math.random`、越层 import。
- [ ] 内容改动通过 `content.test.js`，且为人工切分。
- [ ] 学习端无中文；样式走 token。
- [ ] CHANGELOG 已更新；偏离项有 ADR。
- [ ] 没有提前实现下一阶段功能。

---

## 7. 文档怎么贯穿（给 agent 的具体动作）

| 文档 | 什么时候看 | 什么时候改 |
|---|---|---|
| `docs/DESIGN.md` | 开工前；有歧义时 | 产品决策变化；版本 +0.1；先写 ADR |
| `docs/TRACEABILITY.md` | 每条任务开始/结束 | 新增规则、改测试、阶段状态变化 |
| `docs/ROADMAP.md` | 确认当前阶段 | 阶段完成/开始 |
| `docs/FILE_SPEC.md` | 新建文件、跨层引用 | 工程规范变化 |
| `docs/CONTENT_SPEC.md` | 改内容 JSON、做后台 | 内容格式/标注流程变化 |
| `docs/decisions/*.md` | 遇到未定义点 | 每次裁决新增一篇 |
| `CHANGELOG.md` | 交接/验收 | 每次合并/阶段完成 |

**反模式**：改了行为但不改 TRACEABILITY；测试挂了先删测试；把“暂时这样”写进代码不写 ADR；在当前阶段提前写下一阶段。

---

## 8. 下一阶段启动提示词（复制给 agent）

> 只做 P12，不提前做后续。先读 `AGENTS.md`、`docs/DESIGN.md §3.2/§5.3`、`docs/TRACEABILITY.md` 的 R-ARCH-07。
> 实现 Node adapter 与调度层 Node 运行验收，不修改仓库层接口。
> 每步运行 `node tests/runTests.js --phase=p12`，最后更新 TRACEABILITY、ROADMAP、CHANGELOG。

---

## 9. 已知裁决（不要重新发明）

- 存储方法是 **7 个**，不是 6 个（DESIGN 原文数字笔误）：见 ADR-0001。
- `wordState.errorProfile` 是**有界数组**，`AttemptResult.firstError` 是单条主错误：见 ADR-0001。
- `query` 只做等值过滤 + `limit/offset`，复杂查询在仓库内存过滤：见 ADR-0001。
- P0 种子内容全部 `unreviewed`，生产导出必须 `reviewed`：见 CONTENT_SPEC。
- P1 的内容装配是“同源 JSON → MemoryAdapter”；P2 已切到 IndexedDBAdapter，P3 才接 Scheduler：见 ADR-0003、ADR-0008。
- P1 的 judge 上下文为 `{ spec, renderModel, events, bundle, now }`；`bundle` 只读，`now` 可注入：见 ADR-0003。
- P2 持久化内容与 8 个 store；P3 才写学习状态。不要提前写调度状态。
- T-SEQUENCE 的点选/拖拽/取消是 P1 UI 行为；P10 再扩到 PointerAdapter 与全部题型。
- 组合拆分粒度用 spec 参数，不由题型层猜；当前只 grapheme，P3/P4 支持 letter/mixed：见 ADR-0004。
- 拖拽 64px 吸附、未命中 240ms 弹回；音效是低音量 Web Audio 合成音，不引入音频资源：见 ADR-0005。
- 同词同脚手架：grapheme 块选 < mixed < letter；难度是多维向量，P3 才校准权重：见 DESIGN §3.5 与 ADR-0006。
- 已到位块可重排；目标槽位左半边插前、右半边插后；拖拽中其他块实时侧滑、显示插入缺口；满槽候选弹回；已使用待选块置灰禁用：见 ADR-0007。
- P2 内容导入按 meta.contentVersion 幂等；IndexedDB 不可用回退 MemoryAdapter：见 ADR-0008。
- P3 队列 5—8：错词/错误画像 → 到期 → 新词 → 填充；答错次日、答对清错：见 ADR-0009。
- P4 修复题：T-REORDER 点击交换、T-EDIT 预填修错、T-SEGMENT 字母间隙；错误映射见 ADR-0010。
- P5 组合独立阶梯 + T-MATCH 多选分类；跨 2 词 3 次正确进 probe；每日最多 1 组：见 ADR-0011。
- P6 T-JUDGE-FIX 判断+改错、T-CLOZE 句子填空；probe 60 天，答错退回、答对 mastered：见 ADR-0012。
- P7 ContentValidator V1—V10；单词/unit 编辑器；导出只放行 reviewed，未审核阻断：见 ADR-0013。
- P8 前台 Stats：本次/历史/按日/状态报告；纯统计只读，不参与调度：见 ADR-0014。
- 后台自动切分只生成草稿建议；组合库 152 项；批量格式 `w,ea,th,er | 中文 | 音标`；见 ADR-0016、ADR-0025。
- 后台列表按 unit 折叠，展示错/对次数；只读 attempts，不写学习状态。
- P9 练习设计：年级学期折叠 + unit 多选 + Review/Effort；题量后台设置（默认20，5—30）；计划项带 reason；`revise()` 预留但不实时改题。
- P9 权重：按真实 attempts 的词/题型错误率 + 小样本平滑；同层排序，约束优先；见 ADR-0019。
- P9 提示词：中文为主，IPA 同屏辅助；低年级不单独用 IPA；CLOZE 句子即题面；见 ADR-0020。
- 词库可单独导入/导出（只含 words）；重复词合并/替换/不动；全量迁移仍走 migration；见 ADR-0021。
- 两套教材词库：`pep-2026` 583 词、`fltrp-2026` 891 词；后台 `meta.activeTextbook` 切换；全部 unreviewed；见 ADR-0022。
- 练习单元顺序解锁：完成=全部词练过；只显示已完成+下一个；不足20不跨单元凑数；见 ADR-0023。
- 答错显示正确答案并重试到正确；session 只记录第一次；结束页正确率+错词；见 ADR-0024。
- 基础词库切分：组合库 152；后缀仅词尾；人工例外表；魔法 e 双空 T-FILL；静态词库随工程发布；见 ADR-0025。
- 练习阶段：修复→复习→新词→巩固；新词先 T-SEQUENCE，复习逐步转 T-TYPE；见 ADR-0026。
- T-FILL 对纯元音组合约 1/3 可拆成字母双空；不修改 units 契约；见 ADR-0031。
- 干扰项优先历史错误，其次人工相似组合（ir/er/ur、ea/ee/e/a 等）；见 ADR-0032/0033。
- T-JUDGE-FIX 只在该词有历史错误时出现，claim 回放自己的错误；没有历史用 T-TYPE；见 ADR-0034。
- 输入：T-TYPE 只用语义/音标回忆，不显示目标词；句子提示留给 T-CLOZE；IME composition 回车不提交；正确自动判定；输入框自动聚焦；见 ADR-0028。
- 视觉：提示只显示内容（中文 + IPA），不显示 Meaning/Sounds 标签；主按钮绿色圆角；后台入口 `/admin`；见 ADR-0035。
- 记忆周期旧单元在设置页只读自动复习；只有下一个新单元可复选；见 ADR-0036。
- 强复习题型 T-TYPE/T-FILL 轮转；会话种子随 attempts 变化；见 ADR-0037。
- 后台可经 `LearningStateService` 设置 unstarted/reviewing/mastered；单元状态派生；见 ADR-0038。
- 所有例句必须有中文 `translation`；T-CLOZE 显示中文翻译；见 CONTENT_SPEC。
- 同步服务为 P12 接入：浏览器 IndexedDB + `/sync` 代理 + 快照 merge；固定 projectId 见 `src/sync/config.js`；首次 Pairing 远端优先，之后设备平等；配对面板/版本状态见 `SyncAdmin`；见 ADR-0041。
- 未到期词不 filler 补题；未 mastered 进度封顶（learning 88/reviewing 92/probe 96）；见 ADR-0039。
- 单元选择按年级/学期分组，每个序列以最后一个已练单元推导下一个新单元；未启动序列不显示；序列练到末尾时激活下一学期；见 ADR-0039。
- 首次错词在本轮后半段换题型强化一次；不额外写状态；见 ADR-0040。
- 朗读使用 `src/ui/speech.js` 的原生 speechSynthesis；所有题型自动朗读单词，首轮等待 voice 就绪；字母块点击朗读；按钮高对比；见 docs/SPEECH.md。
- 后台做题分析只读 attempts/wordStates，不改状态；场次按 30 分钟间隔估算；练习场次可展开错误详情；见 `src/admin/HistoryAnalytics.js`。
