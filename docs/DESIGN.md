# 小学 1—2 年级英语拼写记忆软件 · 项目设计文档

**版本**：v1.1
**变更**：v1.1 增补 §3.5 难度梯度；不改变已有条款。
**入库日期**：2026-11-11
**状态**：定稿（canonical）
**定位**：纯前端 JS，单机使用，后期可平移后端
**目标用户**：小学 1—2 年级、具备基础英文阅读能力、可脱离中文的孩子
**核心约束**：只做拼写输出，不做听力、不做选择题、不做图片配对、不做积分排行榜

> **本文档是唯一需求源（single source of truth）。**
> 代码、测试与任务书不得与本文档冲突。若实现必须偏离，先写 ADR（`docs/decisions/`），
> 再更新 `docs/TRACEABILITY.md` 与本文档版本号；禁止“代码改了、文档没改”。
> 条款锚点使用 `§x.y` 形式，例如 `§3.2`、`§5.2`，供代码头注释与追溯矩阵引用。

## 一、设计哲学

### 1.1 克制的拼写工具，不是游戏

《轻轻松松背单词》的核心价值不在功能数量，而在于它最早把**循环记忆**和**对错词自动收集**做进了背单词流程。本产品继承这两个机制，但做减法：砍掉听力、选择、跟读、例句翻译，只保留**看词 → 拼写 → 判定 → 调度**的闭环。

趣味性不来自积分、排行榜、关卡包装，而来自：
- **题型轮转**：同一个词用不同方式“进入”，新鲜感来自提取方式的变化，而非外部奖励。
- **即时拼写反馈**：字母块被点选后填入槽位的视觉闭合感，对低龄儿童本身就是正向反馈。
- **QWERTY 键盘作为“升级仪式”**：键盘输入不是一开始就出现的，而是连续正确后的解锁，让孩子对“用键盘”产生目标感而非畏难。

### 1.2 错误是信号，不是失败

每一次拼写错误都携带结构化信息：错在哪个位置、属于哪种类型（遗漏/替换/顺序/边界）。系统不展示“你错了”，而是把错误写入画像，**次日用能修复该具体位置的题型再次呈现**。家长端看到的不是“正确率 85%”，而是“今天卡在 `sh/ch`，位置在 `fish` 的 `sh` 块”。

### 1.3 记忆曲线是调度器，不是装饰

间隔阶梯采用 `1 → 3 → 7 → 14 → 30` 天。答对升档，答错降 2 档但不清零，同一词降档后再错才归零。连续正确 3 次且跨至少 2 个不同词，进入待抽查池，每 60 天换题型验证一次。防止“只在特定题型下会拼”的假掌握。

### 1.4 人工标注优先于自动推断

字母组合（grapheme）的切分必须人工完成。`ea`、`ou`、`igh` 等歧义切分不能依赖算法。后台标注系统是内容生产的基础设施，不是附属工具。

## 二、功能目的

### 2.1 孩子端（学习模块）

| 功能 | 目的 | 不做什么 |
|---|---|---|
| **每日拼写队列** | 5—8 个词，包含昨日错词、到期复习、新词 | 不设通关、不设积分 |
| **9 种题型** | 用不同脚手架和输入方式完成拼写 | 不做选择题、不做听力 |
| **错词次日强制再现** | 按错误类型匹配修复题型，精准修复而非重拼整词 | 不展示“错题本”给孩子 |
| **字母组合强化包** | 每天最多 1 个组合，2—3 个词，从组合块点选过渡到键盘整词 | 不做自然拼读课程 |
| **节奏连击（可选）** | 默认关闭的挑战模式，结果不写入记忆状态 | 不计入调度、不污染错误画像 |

### 2.2 家长端

| 功能 | 目的 |
|---|---|
| **今日卡点** | 显示具体字母/组合位置，而非笼统正确率 |
| **待抽查池** | 哪些词已进入低频验证，可能“假掌握” |
| **组合进度** | 哪些字母组合已跨词稳定，哪些仍在混淆 |

### 2.3 内容后台

| 功能 | 目的 |
|---|---|
| **词条标注** | 人工点击字母间隙完成切分，禁止自动推断 |
| **组合库管理** | T1—T4 分层，家族关系维护 |
| **混淆项管理** | 成对维护 `sh-ch`、`ck-k` 等，禁止单边 |
| **句子库管理** | 语境补全素材，必须语义唯一 |
| **校验与导出** | 切分完整性、组合存在性、混淆对称性校验后导出 JSON |

## 三、实现路径

### 3.1 技术选型

| 项 | 选择 | 理由 |
|---|---|---|
| 语言 | 纯 ES Modules JavaScript | 无构建、无框架，浏览器直接运行 |
| 类型 | JSDoc | 不引入 TypeScript 编译步骤 |
| 存储 | IndexedDB（浏览器） | 后期可替换为 Node.js + SQLite/PostgreSQL |
| 随机 | `mulberry32(seed)` | 可复现，PC/移动端同 spec 一致 |
| 测试 | 纯 Node 脚本，无框架 | 降低依赖，agent 可直接运行 |

### 3.2 三层解耦架构

```
UI 层（DOM 渲染、输入适配）
    ↕ RenderModel / InputEvent
题型层（9 个题型，只做 build/judge）
    ↕ QuestionSpec / AttemptResult
调度层（选词、选组合、选题型、更新记忆状态）
    ↕ ResourceBundle / 状态读写
仓库层（WordRepository、GraphemeRepository 等）
    ↕ 存储方法
存储层（IndexedDBAdapter / 未来 NodeAdapter）
```

**铁律**：
- 题型层禁止查库、碰 DOM、更新记忆状态、生成干扰项。
- 调度层禁止渲染、判定、依赖 DOM。
- 仓库层只调用 `StorageAdapter` 的存储方法：`init/get/put/query/transaction/exportAll/importAll`。
- 所有随机使用 `spec.seed`。

### 3.3 关键数据结构

**单词状态** `wordState`：
`{ wordId, intervalIndex, consecutiveCorrect, lastResult, errorProfile, status, dueDate }`

**组合状态** `graphemeState`：
`{ graphemeId, intervalIndex, consecutiveCorrect, wordsPassed[], status, dueDate }`

**错误画像** `errorProfile`：
`{ type, unitKind, unitId, position, expected, actual }`

**错误枚举**：
`OMISSION | SUBSTITUTION | TRANSPOSITION | EXTRA | BOUNDARY_OVER_SEGMENT | BOUNDARY_UNDER_SEGMENT | BOUNDARY_MISPLACED | SUFFIX_RULE | UNKNOWN`

### 3.4 9 个题型注册表

| 题型 ID | 任务 | 修复信号 | 落地阶段 |
|---|---|---|---|
| `T-SEQUENCE` | 从候选池按序选单位 | 新词/新组合初拼、替换错 | P1 |
| `T-FILL` | 骨架已给，只填空位 | 遗漏、组合替换、边界错 | P1 |
| `T-REORDER` | 打乱单位排成正确顺序 | 顺序颠倒、组合内部顺序 | P4 |
| `T-TYPE` | QWERTY 整词输入 | 迁移验证、常态练习 | P1 |
| `T-JUDGE-FIX` | 判断对错并改对 | 替换、边界、假掌握抽查 | P6 |
| `T-EDIT` | 插入/删除/替换/移动修错词 | 错词次日修复主力 | P4 |
| `T-MATCH` | 配对/分类 | 组合家族、混淆辨析 | P5 |
| `T-CLOZE` | 英文句子挖空拼写 | 待抽查、语境提取 | P6 |
| `T-SEGMENT` | 字母间隙点切分点 | 组合边界诊断 | P4 |

**已剔除**：记忆翻牌、纯四选一、纯对错无改错、图片配对、积分排行榜、速度排名、纯拖拽（必须有点选等价）、抄写描红、中英互译选择题。

### 3.5 难度梯度：grapheme 块选 < 字母级拼写

**核心规则：同一词、同一脚手架、同一候选池下，按 grapheme 整块选择的难度低于逐字母拼写。**
`sh` 作为一个块选，和把 `sh` 拆成 `s` / `h` 逐个选，不是同一难度，不能当作等价题型。

原因不是“块大所以简单”，而是：

- 整块选择减少了同时要维持的单位数量和边界判断；
- 字母级选择要求孩子维持组合内部的字母顺序，工作记忆负荷更高；
- 组合块仍保留“组合是一个整体”的线索，字母级则把这条线索拆掉。

因此难度是一个**多维向量**，不是单一题型 ID：`题型 ID` 只表示脚手架，不表示难度等级。

| 维度 | 从易到难（其它条件相同时） | 说明 |
|---|---|---|
| 选择粒度 | `grapheme` < `mixed` < `letter` | 整块 < 部分拆开 < 全字母 |
| 脚手架 | `T-FILL` < `T-SEQUENCE` < `T-TYPE` | 只填一个空位 < 全部单位排序 < 无候选块整词提取 |
| 单位/字母数量 | 少 < 多 | 槽位、候选块、要维持的顺序越多，负荷越高 |
| 组合层级 | `T1` < `T2` < `T3` < `T4` | 见 CONTENT_SPEC；层级不是难度总分 |
| 干扰项 | 无 < 随机 < 形近/易混 | 数量与相似度都增加负荷 |
| 输入方式 | 点选/拖拽、键盘 | 键盘要求整词提取，通常更难；设备/手势差异单独记录 |

**P3 起每个 `QuestionSpec` 记录难度向量**，至少包含：

```js
{
  scaffold: 'fill' | 'sequence' | 'type',
  granularity: 'grapheme' | 'mixed' | 'letter',
  slotCount,
  letterCount,
  graphemeTierMax: 1 | 2 | 3 | 4,
  distractorCount,
  confusableCount,
  inputMode: 'tap' | 'drag' | 'keyboard'
}
```

使用原则：

1. **不把题型 ID 直接当难度分**。`T-SEQUENCE` 的 grapheme 版与 letter 版必须区分。
2. **先满足到期/错误修复约束，再在可行集合里选接近目标难度的题**；不能为了难度破坏“错词次日再现”。
3. **新词从较易粒度开始**（grapheme / fill），随连续正确逐步升到 mixed / letter / type；
   具体权重在 P3 的 `DifficultyPolicy` 中用数据校准，P1 不写死总分。
4. **错误修复可以临时提高粒度难度**（如边界错 → 拆字母），但必须在 attempt 中记录本次难度向量，
   避免把“高难度下答对”误当成低难度已掌握。
5. **假掌握抽查应使用更高粒度/更少脚手架**；只在 grapheme 块选下连续正确，不足以进入 `mastered`。

当前 P1 只实现 grapheme 粒度；letter/mixed 的 spec 参数与实现顺序见 ADR-0004。
T-SEGMENT 的边界诊断与粒度选择是两个维度，不能互相替代。

## 四、分阶段开发规划

| 阶段 | 目标 | 验收标准 |
|---|---|---|
| **P0** | 契约与骨架 | `node tests/runTests.js --phase=p0` 输出 PASS |
| **P1** | 最小拼写闭环（T-SEQUENCE/T-FILL/T-TYPE） | 3 词 3 题型出题判定，错误可定位 |
| **P2** | IndexedDB 持久化与内容导入 | 刷新不丢，导出导入一致 |
| **P3** | 记忆曲线与错词调度 | 答错降档、次日必现、题型按错误类型选 |
| **P4** | 顺序/边界错闭环（T-REORDER/T-EDIT/T-SEGMENT） | `ai→ia`、`sh→ch`、`ck/k` 触发对应修复 |
| **P5** | 组合强化与配对（T-MATCH） | 组合独立阶梯，跨 2 词连续正确后进抽查 |
| **P6** | 判断纠错与语境抽查（T-JUDGE-FIX/T-CLOZE） | 假掌握被短句拦下并退回学习队列 |
| **P7** | 人工标注后台系统 | 切分校验阻断错误导出，后台不写学习状态 |
| **P8** | 输入适配与体验（PC/移动） | 同 spec+seed 两端渲染一致，移动端有点选等价 |
| **P9** | 挑战旁路与变换预留 | 挑战不写主状态，`morphMode` 可开关 |
| **P10** | 平移准备 | 换 adapter 仓库零改动，调度层可跑 Node |

**执行纪律**：严格按序，P0 不通过不进入 P1。每阶段结束运行测试，全绿才算完成。

## 五、架构设计

### 5.1 目录结构

```
/src
  /core          contracts.js, eventBus.js, seedRandom.js
  /storage       StorageAdapter.js, MemoryAdapter.js, IndexedDBAdapter.js, schema.js
  /repositories  WordRepository.js, GraphemeRepository.js, SentenceRepository.js,
                 ConfusableRepository.js, StateRepository.js, AttemptRepository.js
  /scheduler     Scheduler.js, IntervalPolicy.js, ErrorProfile.js, TypeSelector.js
  /questionTypes registry.js, TSequence.js, TFill.js, TReorder.js, TType.js,
                 TJudgeFix.js, TEdit.js, TMatch.js, TCloze.js, TSegment.js
  /input         PointerAdapter.js, KeyboardAdapter.js, RapidTapChallenge.js
  /ui            App.js, PracticeScreen.js, ParentScreen.js, /skins
  /content       words.json, graphemes.json, sentences.json, confusables.json
  /admin         index.html, AdminApp.js, AnnotationEditor.js,
                 ContentValidator.js, ExportImport.js
  main.js, index.html
/tests           runTests.js, /fixtures, /snapshots
```

### 5.2 核心契约

**`QuestionSpec`**：调度层产出的题目规格。
```js
{ specId, typeId, target:{kind:'word',id}, focus?:{kind:'grapheme',id},
  params, resourceHints, seed }
```

**`RenderModel`**：题型产出的与设备无关的渲染描述。
```js
{ layout, slots[], units[], fixedText?, focus?,
  interactionHints:{allowTap,allowDrag,allowKeyboard,keyboardScope,
                    allowReorder,allowEdit}, seed }
```

**`InputEvent`**：输入适配器产出的语义事件。
```js
{ kind:'tap-unit'|'drag-unit'|'key-text'|'reorder'|'edit'|'tap-gap',
  unitId?, slotIndex?, fromIndex?, toIndex?, text? }
```

**`AttemptResult`**：题型产出的判定结果。
```js
{ specId, wordId, wordCorrect, focusCorrect?, firstError?, timestamp }
```

### 5.3 存储层平移策略

前端使用 `IndexedDBAdapter`，未来 Node.js 后端使用 `NodeSqliteAdapter` 或 `NodePgAdapter`。仓库层只依赖 `StorageAdapter` 抽象接口，切换 adapter 时仓库代码零改动。调度层不依赖 DOM，可在 Node 环境运行，前端只保留题型层和输入适配器。

## 六、视觉语言

### 6.1 操作与功能参考：《轻轻松松背单词》

继承其**循环记忆 + 对错词自动收集**的底层逻辑，但操作上做减法：

- **单词初记** → 本产品的“新词初拼”：只做一次看词拼写，不要求跟读、不要求手写。
- **强化复习** → 本产品的“间隔调度”：按错误画像自动决定下次出现时间和题型。
- **对错单词自动收集** → 本产品的“errorProfile + 次日强制修复”：不给孩子看错题本，系统内部消化。
- **界面简洁、按钮明确**：继承其“所有按钮有中文标注”的易用原则，但本产品面向低龄儿童，按钮用图标+短词，减少文字阅读负担。

**不继承的**：14 项功能模块、听力实战、打字神功、趣味打靶、词库选择界面。本产品只保留拼写闭环。

### 6.2 UI 风格参考：多邻国

参考多邻国的**游戏化视觉语言**，但严格控制在“拼写工具”范围内，不引入其成瘾机制中的外部奖励循环。

**色彩系统**：
- 底色：云朵奶白 `#FBFAFF`
- 主色：奶雾天蓝 `#A8D8F8`、薄荷奶绿 `#B4E8CC`
- 强调/正确：薄荷奶绿加深 `#7BC9A0`
- 纠错/提示：暖橘 `#FFD9C2`（不使用刺眼红色）
- 文字：柔炭灰 `#444444`

**圆角与形状**：
- 基础圆角 20px，卡片 28px，按钮 32px 超大泡泡圆角
- 字母块/组合块使用圆角矩形，点选后“吸入”槽位的动效
- 无尖锐边缘，无强阴影，哑光柔渐变质感

**字体**：
- 英文：圆体无衬线（如 Nunito、Quicksand），字号宽松
- 中文（家长端）：PingFang SC 粗圆体
- 学习端不出现中文，保持纯英文输入环境

**动效原则**：
- 字母块点选后填入槽位：200ms 弹性缓动，视觉闭合感
- 答对：轻微绿色脉冲，不撒花、不弹窗
- 答错：温和抖动，直接进入下一题，不展示“错误”字样
- QWERTY 键盘解锁时：键盘从底部滑入，字母键有轻微亮度变化

**多邻国元素的使用边界**：

| 借鉴 | 不借鉴 |
|---|---|
| 圆润卡片、柔和色彩、清晰视觉层级 | 连胜机制（Streak）、排行榜、生命值 |
| 即时反馈的动效节奏 | 吉祥物情感绑架（“多儿哭了”） |
| 简洁的操作路径（点选即完成） | 经验值（XP）、虚拟货币、宝箱 |
| 加载状态用趣味动画缓解焦虑 | 付费/商业化入口 |

**核心差异**：多邻国的游戏化服务于“让用户每天回来”，本产品的视觉服务于“让孩子专注于字母顺序”。没有连胜压力，没有排行榜焦虑，没有“今天不学就失去什么”的机制。打开就是拼写，拼完就结束。

## 七、附：设计决策速查

| 问题 | 决策 | 理由 |
|---|---|---|
| 要不要听力？ | 不要 | 用户明确只做拼写 |
| 要不要选择题？ | 不要（除 T-JUDGE-FIX 的判断+改错） | 猜对概率高，提取负荷低 |
| 要不要积分/排行榜？ | 不要 | 外部奖励转移拼写注意力 |
| 记忆翻牌？ | 已剔除 | 记忆游戏稀释拼写输出 |
| 节奏连击？ | 保留，默认关闭，不写主状态 | 可选趣味，不污染信号 |
| 变换题（s/ed/ing）？ | 后段以参数形态加入，成熟后独立 | 1—2 年级后段需求 |
| 切分自动推断？ | 禁止 | `ea/ou/igh` 歧义必须人工标注 |
| 后台能不能改学习状态？ | 不能 | 后台只产内容、只校验 |
| 题型能不能查库？ | 不能 | 保持可单测、可替换 |

---

## 八、仓库落地约定（不属于原始设计决策）

以下内容是把本文档落到仓库后的工程约定，详细规则见：

- `docs/FILE_SPEC.md`：文件、命名、分层、依赖方向、测试规范。
- `docs/TRACEABILITY.md`：条款 → 代码 → 测试 的追溯矩阵。
- `docs/ROADMAP.md`：阶段任务书、门禁命令与当前状态。
- `docs/CONTENT_SPEC.md`：词条 / 组合 / 句子 / 混淆项的数据规范与人工标注流程。
- `docs/decisions/`：对本文档未定义点的裁决（ADR）。

**已知的文档内不精确处**（不修改原文，由 ADR 裁决）：
1. §3.2 写“6 个存储方法”，但同句列出 7 个；以 7 个为准（ADR-0001）。
2. §3.3 的 `errorProfile` 是单对象，实际一次尝试可能产生多个错误；落库为有界数组，`AttemptResult.firstError` 保留主错误（ADR-0001）。
3. §3.4 原始表格没有“落地阶段”列，本仓库版本为执行需要补充，不改变题型定义。

**文档状态**：定稿。P0 任务由 `docs/ROADMAP.md` 承接；每阶段验收通过后再进入下一阶段。
