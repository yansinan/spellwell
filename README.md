# SpellWell · 拼写小屋

面向小学 1—2 年级的英文**拼写**记忆工具。只保留「看词 → 拼写 → 判定 → 调度」闭环：
不做听力、不做选择题（判断+改错除外）、不做图片配对、不做积分/排行榜。

- **定位**：纯前端 ES Modules，无构建、无框架、无运行时依赖；后期可平移 Node 后端。
- **当前阶段**：**P1 最小拼写闭环 ✅**；下一步 P2 IndexedDB 持久化与内容导入。
- **需求源**：[`docs/DESIGN.md`](docs/DESIGN.md)（定稿 v1.1）。

---

## 快速开始

需要 Node 18+（仅用于测试与本地静态服务器，应用本身跑在浏览器）。

```bash
# P1 阶段门禁（累计 P0+P1）
node tests/runTests.js --phase=p1

# 本地预览：ESM 不能走 file://，必须用 HTTP
node tools/serve.mjs
# → http://127.0.0.1:4173

# 等价 npm 脚本（若使用 npm）
npm test
npm start
```

> 若系统 PATH 中没有 `node`，在 DSH 环境可用
> `/Users/Dr/.dsh/dsh-runtimes/dsh-primary-runtime/dependencies/node/bin/node`
> 执行上述命令。项目本身不绑定该路径。

打开预览页会直接进入 P1 学习端：3 个词 × 3 个题型。
`?dev=1` 仍可查看 P0 开发状态页；`?debug=1` 会在学习端显示 AttemptResult 调试面板。

![P1 学习端](docs/p1-preview.png)

> T-SEQUENCE 拖拽重排时，其他块实时侧滑让位，缺口随左右半边移动：
> ![实时重排预览](docs/p1-reorder-preview.png)

> P0 骨架自检页保留在 `?dev=1`：![P0 开发状态页](docs/p0-preview.png)

---

## 文档怎么贯穿整个开发过程

这不是“写完就归档”的设计文档，而是仓库里的可执行约束：

| 机制 | 文件 | 作用 |
|---|---|---|
| 唯一需求源 | [`docs/DESIGN.md`](docs/DESIGN.md) | 产品决策、架构铁律、阶段划分；改动先写 ADR |
| 条款追溯 | [`docs/TRACEABILITY.md`](docs/TRACEABILITY.md) | 每条规则 → 代码 → 测试 → 阶段 → 状态 |
| 阶段门禁 | [`docs/ROADMAP.md`](docs/ROADMAP.md) | P0—P10 验收标准；当前阶段只做当前阶段 |
| 工程规范 | [`docs/FILE_SPEC.md`](docs/FILE_SPEC.md) | 目录、命名、依赖方向、测试与禁止清单 |
| 内容规范 | [`docs/CONTENT_SPEC.md`](docs/CONTENT_SPEC.md) | 人工切分、ID 稳定性、校验规则 V1—V10 |
| 执行契约 | [`AGENTS.md`](AGENTS.md) | agent/贡献者必读顺序、铁律、完成定义、P2 启动提示词 |
| 决策记录 | [`docs/decisions/`](docs/decisions/) | 对文档歧义的裁决；ADR-0001—ADR-0006 |
| 代码头 | 每个 `src/**/*.js` | `@layer` / `@phase` / `@doc §x.y`，由测试校验 |
| 架构守卫 | `tests/p0/architecture.test.js` | 无 `Math.random`、无越层 import、无 DOM 泄漏、无循环依赖、仓库只用 7 个存储方法 |
| 文档守卫 | `tests/p0/traceability.test.js` | 枚举/阶段/token/ADR/零依赖与文档一致 |

因此，**改代码必须同步改追溯矩阵**；偏离设计必须先写 ADR。
门禁命令 `node tests/runTests.js --phase=pN` 是阶段推进的唯一硬标准。

---

## 目录速览

```
src/core          契约、seed 随机、时间、事件总线、错误
src/storage       StorageAdapter / MemoryAdapter / IndexedDBAdapter(骨架) / schema
src/repositories  词条、组合、句子、混淆项、状态、尝试
src/scheduler     间隔策略、错误画像、题型选择、Scheduler(骨架)
src/questionTypes 9 个题型注册表；P1 三题型已实现
src/input         指针/键盘/挑战适配器（P8/P9 骨架）
src/ui            P1 学习端、PracticeSession、bootstrap；P0 状态页
src/content       人工切分种子内容（全部 unreviewed）
tests/p0,p1       累计门禁：P0 骨架 + P1 三题型/session/英文/不持久化
docs              设计、规范、路线图、ADR
tools/serve.mjs   零依赖静态服务器
```

---

## 已固定的关键裁决

- 存储方法是 **7 个**：`init/get/put/query/transaction/exportAll/importAll`（DESIGN 原文“6 个”为笔误）。
- `wordState.errorProfile` 是有界数组（最多 8 条），`AttemptResult.firstError` 保留单条主错误。
- 学习状态枚举：词 `learning/reviewing/probe/mastered`，组合 `learning/reviewing/probe/steady`。
- P0 种子内容全部 `unreviewed`；生产导出只放行 `reviewed`（P7 实现阻断）。
- P1 的内容装配是“同源 JSON → MemoryAdapter → ResourceBundle”；P2 才切 IndexedDB。
- P1 的 9 题是固定演示队列；P3 才把选题/干扰项移到 Scheduler。
- P1 judge 上下文为 `{ spec, renderModel, events, bundle, now }`；不持久化任何学习状态。
- P1 只按 grapheme 整块选择；字母级/混合粒度是 P3/P4 预留，见 [`ADR-0004`](docs/decisions/0004-unit-granularity.md)。
- 同词同脚手架：`grapheme < mixed < letter`；难度是多维向量，P3 才校准权重，见 DESIGN §3.5 与 [`ADR-0006`](docs/decisions/0006-difficulty-gradient.md)。

详见 [`ADR-0001`](docs/decisions/0001-storage-contract.md)、[`ADR-0003`](docs/decisions/0003-p1-runtime-boundaries.md)、[`ADR-0004`](docs/decisions/0004-unit-granularity.md)、[`ADR-0005`](docs/decisions/0005-interaction-feedback.md) 与 [`ADR-0006`](docs/decisions/0006-difficulty-gradient.md)。

---

## P1 已实现

- `T-SEQUENCE`：按序点选单位，支持鼠标/触摸拖拽；靠近槽位 64px 吸附，未命中 240ms 弹回待选区；已到位块可拖拽重排，按目标块左右半边插前/插后并顺移；拖拽中其他块实时侧滑让位并显示缺口；点击已填槽位可取消；已使用的灰色待选项禁用；错误定位到 `OMISSION` / `SUBSTITUTION` / `EXTRA` / `TRANSPOSITION`。
- `T-FILL`：骨架已给、只填空位，候选池含干扰组合。
- `T-TYPE`：整词输入，按 grapheme unit 定位错误。
- `PracticeScreen`：纯英文学习端，点选/拖拽/键盘输入、显式 Check、温和反馈、`?debug=1` 调试面板。
- 互动音效：Web Audio 合成轻提示音（选中/拾取/吸附/取消/返回/对/错/完成），Header 有 Sound/Muted 开关。
- 3 词 × 3 题型完整闭环；同 `spec.seed` 渲染稳定；刷新即重置（P2 才持久化）。

---

## 下一步

P2：实现 `IndexedDBAdapter` 与内容导入，把 P1 的 `bootstrap.js` 从 `MemoryAdapter` 切到 IndexedDB；
刷新不丢、导出导入一致，保持题型层与 session 接口不变。
任务书与启动提示词见 [`docs/ROADMAP.md`](docs/ROADMAP.md) 与 [`AGENTS.md`](AGENTS.md)。
