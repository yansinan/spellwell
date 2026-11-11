# AGENTS.md · 项目执行契约

> 任何 agent、贡献者进入本仓库，先读本文件。它规定“怎么做事”，`docs/DESIGN.md` 规定“做什么”。
> 当前阶段：**P1 已完成，P2 是下一步**。不要提前实现 P2 及以后的功能。

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
| P2 | ⏳ 下一步 | IndexedDBAdapter、内容导入、导出导入 | 写学习状态、做调度队列、做 P4 题型 |

**判断标准**：如果你写的代码在 `docs/ROADMAP.md` 的“P1 明确不做”或“后续阶段要点”里，停手。

---

## 2. 命令

```bash
# 阶段门禁（唯一验收标准；当前 P1）
node tests/runTests.js --phase=p1

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
6. **切分只人工。** 禁止写自动推断 grapheme 的代码；内容 `units[]` 是唯一真相。
7. **学习端不出现中文。** 家长端/后台可以中文；按钮用图标+短词。
8. **颜色/圆角/动效只来自 `styles/tokens.css`。** 不使用刺眼红色，不做强阴影。
9. **不新增依赖、不引入构建工具、不引入框架。** 纯 ESM + Node 脚本。
10. **偏离 DESIGN 必须先写 ADR。** 先改文档再改代码；禁止“代码即文档”。
11. **后台不写学习状态。** `src/admin/**` 不得触碰 `wordStates/graphemeStates/attempts`。
12. **挑战模式不写主状态。** `RapidTapChallenge` 的结果不得进入调度/错误画像。
13. **阶段顺序不可跳。** P1 不通过不进入 P2；当前 P1 已完成，只允许修 P1 缺陷，不提前接 P2 持久化。

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

> 只做 P2，不提前做 P3。先读 `AGENTS.md`、`docs/DESIGN.md §5.3`、`docs/TRACEABILITY.md` 的 R-STORE-06。
> 实现 IndexedDBAdapter 的 7 个方法与内容导入，把 P1 的 `bootstrap.js` 从 MemoryAdapter 切到 IndexedDBAdapter；
> 保持 `PracticeSession`/题型层接口不变，不写学习状态、不做调度队列。
> 每完成一步运行 `node tests/runTests.js --phase=p2`，最后更新 TRACEABILITY 与 CHANGELOG。
> 不新增依赖、不做 P4 题型、不做家长端。

---

## 9. 已知裁决（不要重新发明）

- 存储方法是 **7 个**，不是 6 个（DESIGN 原文数字笔误）：见 ADR-0001。
- `wordState.errorProfile` 是**有界数组**，`AttemptResult.firstError` 是单条主错误：见 ADR-0001。
- `query` 只做等值过滤 + `limit/offset`，复杂查询在仓库内存过滤：见 ADR-0001。
- P0 种子内容全部 `unreviewed`，生产导出必须 `reviewed`：见 CONTENT_SPEC。
- P1 的内容装配是“同源 JSON → MemoryAdapter”，9 题是固定演示队列；P2 才切 IndexedDB，P3 才切 Scheduler：见 ADR-0003。
- P1 的 judge 上下文为 `{ spec, renderModel, events, bundle, now }`；`bundle` 只读，`now` 可注入：见 ADR-0003。
- P1 不持久化；`IndexedDBAdapter` 仍是 P2 骨架。不要为了“刷新不丢”提前写。
- T-SEQUENCE 的点选/拖拽/取消是 P1 UI 行为；P8 再扩到 PointerAdapter 与全部题型。
- 组合拆分粒度用 spec 参数，不由题型层猜；当前只 grapheme，P3/P4 支持 letter/mixed：见 ADR-0004。
- 拖拽 64px 吸附、未命中 240ms 弹回；音效是低音量 Web Audio 合成音，不引入音频资源：见 ADR-0005。
- 同词同脚手架：grapheme 块选 < mixed < letter；难度是多维向量，P3 才校准权重：见 DESIGN §3.5 与 ADR-0006。
