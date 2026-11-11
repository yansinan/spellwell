# 文件与工程规范 · FILE_SPEC

**适用版本**：DESIGN v1.1 / 仓库 v0.2.0（P1）
**地位**：本文件是 `docs/DESIGN.md` 的工程实施细则。与 DESIGN 冲突时，以 DESIGN 为准；本文件负责把 DESIGN 翻译成可机械检查的规则。

---

## 1. 总原则

1. **一个文件只承担一个层级的责任。** 目录即层级，禁止跨层“顺手调用”。
2. **无构建、无框架、无运行时依赖。** 浏览器直接跑 ES Modules；测试直接跑 Node。
3. **契约先行。** 跨层数据必须先有 JSDoc 类型与运行时校验，再写实现。
4. **可机械检查的规则必须写成测试。** 写在文档里但没人执行的规则，会在三个迭代内失效。
5. **命名表达意图，不表达实现。** `TSequence` 而不是 `DragLetters`；`MemoryAdapter` 而不是 `FakeDB`。
6. **内容 ID 永久稳定。** 修改文字不得重新生成 ID；废弃内容保留记录并标记 `retired`。

---

## 2. 目录树与职责

```
.
├── index.html                  # P1 学习端；`?dev=1` 查看 P0 状态页
├── main.js                     # 唯一启动入口：装配 adapter → repositories → UI
├── package.json                # 仅脚本，无 dependencies
├── styles/
│   ├── tokens.css              # DESIGN §6.2 的唯一色彩/圆角/动效来源
│   ├── app.css                 # 开发壳/P0 状态页样式
│   └── practice.css            # P1 学习端样式
├── src/
│   ├── core/                   # 契约、错误、随机、时间、事件总线；零业务
│   │   ├── contracts.js        # QuestionSpec / RenderModel / InputEvent / AttemptResult / 状态
│   │   ├── errors.js           # ContractError / NotImplementedError
│   │   ├── eventBus.js         # 层间通信；不得用于替代返回值
│   │   ├── seedRandom.js       # mulberry32 + 种子归一化 + shuffle
│   │   └── time.js             # dayKey / addDays / isDue（本地日历日）
│   ├── storage/                # 只认 adapter 接口，不认业务
│   │   ├── StorageAdapter.js   # 抽象基类 + assertStorageAdapter + 方法白名单
│   │   ├── MemoryAdapter.js    # P0 测试/演示用；支持事务回滚与导出导入
│   │   ├── IndexedDBAdapter.js # P2 实现；P0 仅保留骨架
│   │   └── schema.js           # store 名、keyPath、索引、DB 版本
│   ├── repositories/           # 领域查询；只调用 StorageAdapter 的 7 个方法
│   │   ├── BaseRepository.js
│   │   ├── WordRepository.js
│   │   ├── GraphemeRepository.js
│   │   ├── SentenceRepository.js
│   │   ├── ConfusableRepository.js
│   │   ├── StateRepository.js
│   │   └── AttemptRepository.js
│   ├── scheduler/              # 纯逻辑；禁止 DOM / 渲染 / 判定
│   │   ├── Scheduler.js        # P3 才实现；P0 仅接口 + 明确抛错
│   │   ├── IntervalPolicy.js   # 1/3/7/14/30 阶梯与升降档
│   │   ├── ErrorProfile.js     # 错误画像构造、截断、主错误
│   │   └── TypeSelector.js     # 错误类型 → 修复题型
│   ├── questionTypes/          # 只做 build/judge；禁止查库、DOM、写状态、造干扰项
│   │   ├── QuestionType.js     # defineQuestionType 契约与元数据校验
│   │   ├── shared.js           # P1 共享判定：错误定位、整词输入分析
│   │   ├── registry.js         # 9 个题型的唯一注册表
│   │   └── T*.js               # 每个题型一个文件；P1 已实现 TSequence/TFill/TType
│   ├── input/                  # DOM 事件 → InputEvent；不得判定对错
│   │   ├── PointerAdapter.js
│   │   ├── KeyboardAdapter.js
│   │   └── RapidTapChallenge.js # P9；不得写主状态
│   ├── ui/                     # DOM 渲染与流程编排；不得实现判定算法
│   │   ├── App.js               # P0 状态页（?dev=1）
│   │   ├── PracticeSession.js   # P1 9 题会话与 spec 生成
│   │   ├── bootstrap.js         # P1 内容装配（P2 切 adapter）
│   │   ├── PracticeScreen.js    # P1 学习端（点选/拖拽/显式 Check）
│   │   ├── dragGeometry.js      # 64px 吸附半径与最近槽位
│   │   ├── sound.js             # Web Audio 轻音效 + 静音开关
│   │   ├── ParentScreen.js
│   │   └── skins/              # P8；皮肤只换 token，不换行为
│   ├── content/                # 人工标注内容，只读；格式见 CONTENT_SPEC
│   │   ├── words.json
│   │   ├── graphemes.json
│   │   ├── sentences.json
│   │   └── confusables.json
│   └── admin/                  # P7；内容生产，不写学习状态
│       ├── index.html
│       ├── AdminApp.js
│       ├── AnnotationEditor.js
│       ├── ContentValidator.js
│       └── ExportImport.js
├── tests/
│   ├── runTests.js             # 阶段门 runner；无测试框架
│   ├── harness.js              # test/assert/run
│   ├── p0/ p1/ … p10/          # 测试按阶段归档；门禁累计运行
│   ├── fixtures/               # 小型固定数据；不复制生产内容
│   └── snapshots/              # 随机序列等锁定快照
├── tools/
│   └── serve.mjs               # 本地静态服务器（ESM 不能走 file://）
├── docs/
│   ├── DESIGN.md               # 唯一需求源
│   ├── FILE_SPEC.md            # 本文件
│   ├── TRACEABILITY.md         # 条款 → 代码 → 测试
│   ├── ROADMAP.md              # P0—P10 门禁与状态
│   ├── CONTENT_SPEC.md         # 内容数据规范
│   └── decisions/              # ADR，一次偏离一篇
├── AGENTS.md                   # agent/贡献者执行契约
├── CHANGELOG.md
└── README.md
```

**暂不创建的空目录**（避免占位文件污染）：`src/ui/skins/`、`src/admin/AnnotationEditor.js` 等，到对应阶段再建。目录树中的 P7/P8 文件在 P0 不提前实现。

---

## 3. 分层与依赖方向

依赖只能从上往下，禁止反向或平级互调：

```
ui / admin / input
        ↓
questionTypes  ←  scheduler
        ↓             ↓
      core  ←  repositories
                      ↓
                   storage
```

| 来源层 | 允许导入 | 明确禁止 |
|---|---|---|
| `core` | 仅 `core` | 任何业务层、DOM、存储 |
| `storage` | `core`、`storage` | repositories/scheduler/ui |
| `repositories` | `core`、`storage` | scheduler/questionTypes/ui/input |
| `scheduler` | `core`、`repositories`、`questionTypes/registry.js`（只读元数据） | ui/input/storage 具体实现、DOM |
| `questionTypes` | `core`、同目录 | storage/repositories/scheduler/ui、DOM、全局状态 |
| `input` | `core`、同目录 | UI 渲染、判定、存储 |
| `ui` | 所有下层 | 直接写数据（必须经 repositories/scheduler） |
| `admin` | `core`、`storage`、`repositories`、自身 | scheduler 学习状态写入、孩子端 UI |

**存储方法白名单（7 个，精确冻结）**：
`init` / `get` / `put` / `query` / `transaction` / `exportAll` / `importAll`。
仓库层只能调用这 7 个方法；新增方法必须先写 ADR 并更新 `TRACEABILITY.md`。

**例外只有一条**：`main.js` 是组合根（composition root），可以导入所有层完成装配；它不含业务规则。

静态检查见 `tests/p0/architecture.test.js`，它会读取每个文件头部的 `@layer` 并与目录比对、扫描 `from` 路径、检测循环依赖。

---

## 4. 模块文件规范

### 4.1 文件头（强制）

每个 `src/**/*.js` 文件必须以如下 JSDoc 开头，缺一即 P0 门禁失败：

```js
/**
 * @layer scheduler
 * @phase P3
 * @doc §1.3 记忆曲线是调度器，不是装饰
 */
```

- `@layer` 必须等于文件所在目录名（`questionTypes`、`repositories` 等）。
- `@phase` 是该文件**首次可用**的阶段；骨架文件可以标未来阶段（如 `IndexedDBAdapter` 标 `P2`）。
- `@doc` 必须引用 `docs/DESIGN.md` 中真实存在的十进制小节（如 `§3.4`），由 `traceability.test.js` 校验。
- 一个文件可以有多行 `@doc`，但至少一行。

### 4.2 导出与类型

- 一律 **named export**，不写 `export default`。
- 对外函数/类必须有 JSDoc：`@param`、`@returns`、必要时 `@throws`。
- 跨层对象在 `core/contracts.js` 定义 `@typedef`；实现文件用 `@returns {import('../core/contracts.js').QuestionSpec}` 引用。
- 运行时校验只在边界做一次：调度层产出 spec、题型层产出 render/attempt、adapter 写入前。内部纯函数不重复校验。

### 4.3 错误

- 契约失败抛 `ContractError`，带稳定 `code`（如 `QUESTION_SPEC_INVALID`）。
- 未到阶段的功能抛 `NotImplementedError(phase, feature)`，**禁止静默返回空值**。这样 P0 测试可以断言“确实还没做”。
- 业务判定“拼错”不是异常，用 `AttemptResult` 返回。

### 4.4 随机与时间

- **禁止 `Math.random`**（全仓库 `src/` 静态扫描）。
- 需要随机时只接受 `seed`，用 `createRng(seed)`；`spec.seed` 是唯一真源。
- 禁止用 `Date.now()` 生成内容/顺序；时间只用于 `timestamp`、`dueDate`、导出元数据。
- 日期统一用本地日历日 `YYYY-MM-DD`（`core/time.js` 的 `dayKey`），避免跨时区把“明天”算错。

### 4.5 异步

- StorageAdapter 与 repositories 的方法一律 `async`，即使 MemoryAdapter 即时返回。
- 禁止在 repositories 之外直接 `await adapter.*`。
- 事务回调内不得调用 UI 或发事件。

---

## 5. 命名规范

| 对象 | 规则 | 示例 |
|---|---|---|
| 类/契约模块 | `PascalCase.js` | `StorageAdapter.js`、`TSequence.js` |
| 工具模块 | `camelCase.js` | `seedRandom.js`、`eventBus.js` |
| 数据/配置 | `camelCase.js` 或复数 JSON | `schema.js`、`words.json` |
| 测试 | `<主题>.test.js`，放 `tests/pN/` | `tests/p0/contracts.test.js` |
| CSS token | `--sw-<语义>` | `--sw-mint-deep`、`--sw-radius-card` |
| CSS 类 | `sw-` 前缀 + BEM 轻量变体 | `sw-card`、`sw-slot--filled` |
| 题型 ID | `T-` + 大写下划线语义 | `T-JUDGE-FIX` |
| 内容 ID | 前缀 + 稳定 slug | `w.fish`、`g.sh`、`s.fish.01`、`c.ch-sh` |
| 存储集合 | 小写复数 | `words`、`wordStates`、`attempts` |
| 事件名 | `domain:action` | `attempt:recorded`、`queue:built` |

**ID 规则**：
- 单词 `w.<小写单词>`；同形异义词后续用 `w.bow.1` / `w.bow.2`。
- 组合 `g.<组合文本>`；一个文本只允许一个组合 ID。
- 句子 `s.<wordSlug>.<两位序号>`。
- 混淆项 `c.<a文本>-<b文本>`，无序对只允许一条。
- 运行时不得由 `text` 推导 ID；所有引用都靠显式 `id` 字段。

---

## 6. 数据契约版本

- `core/contracts.js` 导出 `CONTRACT_VERSION`；跨层结构变更必须 +1，并写 ADR。
- 存储 `schema.js` 导出 `DB_VERSION`；IndexedDB 升级必须写迁移函数与测试（P2 起）。
- 内容 JSON 顶层带 `"version": 1`；内容格式变更 +1，并更新 `CONTENT_SPEC.md`。
- `package.json` 版本跟阶段走：P0 `0.1.0`，P1 `0.2.0`，以此类推；P10 `1.0.0`。

---

## 7. 测试规范

- 不使用 Jest/Vitest/Mocha；`tests/harness.js` + `node tests/runTests.js`。
- 测试文件按阶段放：`tests/p0/`…`tests/p10/`；runner 用 `--phase=pN` **累计**运行 `p0..pN`。
- 每个阶段必须有门禁测试；P0 门禁命令固定为：
  ```bash
  node tests/runTests.js --phase=p0
  ```
- 输出必须包含 `PASS` 或 `FAIL`，退出码 0/1，CI 与 agent 只认这个。
- 测试命名用“行为 + 条件”，中文或英文均可，但同一文件保持一致。
- 测试不得依赖网络、真实时间、真实 IndexedDB、随机顺序。
- 快照只用于锁定“必须永远一致”的序列（如 mulberry32 输出）；更新快照必须在提交说明中解释原因。
- 架构守卫测试（`architecture.test.js`）与追溯测试（`traceability.test.js`）属于 P0 门禁，任何阶段都不得删除或跳过。

---

## 8. 样式规范

- 颜色、圆角、字号、动效时长只能来自 `styles/tokens.css`；组件 CSS 里出现 `#RRGGBB` 视为违规（`tokens.css` 除外）。
- 学习端（`PracticeScreen` 及其子视图）**不得出现中文字符串**；家长端可以中文。P8 加静态扫描。
- 不使用尖锐边框、强投影、红色报错；错误态用暖橘 `--sw-peach`。
- 点选与拖拽必须等价：任何拖拽交互都必须有 tap 路径（P8 验收）。
- 动画必须尊重 `prefers-reduced-motion`。

---

## 9. 内容规范

完整规则见 `docs/CONTENT_SPEC.md`，此处只列硬约束：

1. 切分必须人工完成，**禁止**在运行时或导入时自动切分。
2. `units.map(u => u.text).join('') === word.text`，逐词校验。
3. 每个 unit 的 `graphemeId` 必须存在，且 `graphemes[graphemeId].text === unit.text`。
4. 混淆项必须成对，且只能出现一次；禁止 `sh-ch` 与 `ch-sh` 两条。
5. 句子挖空必须恰好命中一次，答案等于词条文本。
6. 生产导出只允许 `reviewStatus: "reviewed"` 的内容；P0 种子内容全部是 `unreviewed`，仅用于开发。

---

## 10. 禁止清单（P0 起生效）

| 禁止 | 原因 | 检查 |
|---|---|---|
| `Math.random` | 同 seed 不可复现 | `architecture.test.js` |
| 题型层 import 仓库/存储/DOM | 破坏可单测与可替换 | `architecture.test.js` |
| 调度层 import UI/DOM | 必须能跑 Node | `architecture.test.js` |
| 仓库层直接 `indexedDB` / `fetch` / `localStorage` | 平移后端时零改动 | `architecture.test.js` |
| 新增 npm 依赖 | 纯前端、无构建 | 人工评审 + `package.json` 无 deps |
| 自动推断 grapheme 切分 | DESIGN §1.4 | 人工评审 + `content.test.js` 反例 |
| 学习端中文 | DESIGN §6.2 | P8 静态扫描 |
| 积分/排行榜/连胜/生命值 | DESIGN §1.1 / §6.2 | 人工评审 |
| 后台写 `wordStates`/`graphemeStates` | DESIGN §七 | P7 测试 + 静态扫描 |
| 挑战模式写主状态 | DESIGN §2.1 | P9 测试 |
| 跳过阶段门禁 | DESIGN §四 | `AGENTS.md` + 评审 |

---

## 11. 文档贯穿与变更控制

1. **需求只进 DESIGN。** 新想法先判断是否属于本产品；属于则更新 DESIGN（版本 +0.1）并写 ADR，不属于则记入 `docs/decisions/` 的“已拒绝”列表。
2. **每条可执行条款进 TRACEABILITY。** 新增规则必须同时给：条款锚点、代码位置、验证方式、阶段。没有验证方式的规则标“人工评审”，不得假装有测试。
3. **每个模块头写 `@doc`。** 代码审查时先看它指向哪条设计；指不出来说明这个文件不该存在。
4. **偏离必须写 ADR。** ADR 至少包含：背景、决定、后果、被替代的方案、对 DESIGN 的影响。
5. **阶段完成要更新 ROADMAP 状态 + CHANGELOG。** 未更新视为阶段未完成。
6. **文档与测试冲突时，先停手。** 以 DESIGN 为准；如果 DESIGN 本身有歧义，写 ADR 裁决，不要靠代码“先跑起来”。

---

## 12. 提交前检查清单

- [ ] `node tests/runTests.js --phase=pN` 输出 PASS（N = 当前阶段）。
- [ ] 新增/修改文件有 `@layer/@phase/@doc` 头。
- [ ] 跨层数据有运行时校验。
- [ ] 没有新增依赖、`Math.random`、越层 import。
- [ ] 内容改动通过 `content.test.js`，且新增词条是人工切分。
- [ ] `TRACEABILITY.md` 与 `ROADMAP.md` 已更新。
- [ ] 若偏离 DESIGN，已有 ADR。
- [ ] 学习端没有中文，颜色来自 token。
