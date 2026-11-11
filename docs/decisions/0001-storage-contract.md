# ADR-0001：存储契约、状态结构与内容 ID 的裁决

- **状态**：Accepted
- **日期**：2026-11-11
- **决策者**：项目初始化（P0）
- **影响条款**：DESIGN §3.2、§3.3、§5.3
- **相关**：`docs/FILE_SPEC.md §3/§6`、`src/storage/StorageAdapter.js`、`src/core/contracts.js`

## 背景

DESIGN v1.0 是产品与架构定稿，但落地到可执行契约时有四处未定义或自相矛盾：

1. §3.2 称仓库层只调用 `StorageAdapter` 的“**6 个**存储方法”，同句却列出 **7 个**：`init/get/put/query/transaction/exportAll/importAll`。
2. §3.3 的 `errorProfile` 是单个对象，但一次整词拼写可能同时出现多个错误（如 `ship` 写成 `sip`：遗漏 `h`，同时边界从 `sh` 变成 `s`）。
3. `wordState.status`、`graphemeState.status` 没有给枚举值，P1 起会到处出现字符串字面量。
4. `query` 没有定义过滤语义，IndexedDB 与未来 SQL 适配器可能各自解释。

## 决定

### D1：存储方法以 7 个为准

`STORAGE_METHODS = ['init','get','put','query','transaction','exportAll','importAll']`，冻结在 `StorageAdapter.js`。所有仓库只能调用这 7 个方法；`tests/p0/architecture.test.js` 做静态白名单扫描，`storage.test.js` 断言数组精确相等。

**理由**：`transaction` 与 `exportAll/importAll` 是 DESIGN 明确要求的迁移/原子性能力，不能因为原文“6 个”这个数字而删减。原文数字应为笔误。

### D2：`query` 在 P0 采用等值过滤 + 分页

签名：

```js
query(storeName, { where = {}, limit, offset } = {}) => Promise<Record[]>
```

- `where` 只支持顶层字段**严格相等**；数组字段不展开。
- 结果按主键字典序排序，保证测试/导出可复现。
- `limit` / `offset` 在过滤后应用。
- P2 的 IndexedDBAdapter 可对 `dueDate` / `wordId` / `timestamp` 走索引，但语义不变；未来 SQL adapter 翻译为 `WHERE ... LIMIT ... OFFSET`。
- 复杂查询（数组包含、范围）由仓库在 `all()` 之上过滤，不扩张 adapter 接口。

**理由**：低龄词库规模小（数百词），先锁定简单语义；避免为 P0 设计一个需要重写的查询 DSL。

### D3：`errorProfile` 落库为有界数组

`wordState.errorProfile` 是 `ErrorProfile[]`，最多 **8** 条，新错误追加、超出丢弃最旧。`AttemptResult.firstError` 仍按 DESIGN 保留**单个**主错误（按位置最靠前者）。

- 追加函数：`appendErrorProfile(list, error, { max: 8 })`。
- 去重：同一 `type + unitId + position` 不重复追加（保留首次）。
- 家长端“今日卡点”读取数组，而不是只看一条。

**理由**：单对象会丢失“同时错了两处”的信号；数组也更适合未来统计。`firstError` 保持与 DESIGN 一致，避免改题型契约。

### D4：状态枚举

```js
WORD_STATUS     = ['learning', 'reviewing', 'probe', 'mastered']
GRAPHEME_STATUS = ['learning', 'reviewing', 'probe', 'steady']
```

- `learning`：新词/新组合，尚未稳定。
- `reviewing`：在间隔阶梯中。
- `probe`：待抽查池（连续 3 次正确且跨 2 词后进入，P5）。
- `mastered` / `steady`：低频验证通过（P6 定义具体阈值）。
- 到期但未作答不回退状态；状态只由调度器在记录 attempt 后改变（P3）。

### D5：内容 ID 稳定且显式

- 格式：`w.<slug>` / `g.<text>` / `s.<wordSlug>.<nn>` / `c.<a>-<b>`。
- 运行时**禁止**从 `text` 推导 ID；所有引用走显式字段。
- 修改文本保留 ID；废弃项标 `reviewStatus: "retired"`，ID 不复用。
- 组合文本与 ID 后缀一致；混淆项无序对只允许一条。

**理由**：历史 attempt、家长报表、内容导出都需要稳定外键；自动生成 ID 会在编辑文本时断链。

## 后果

- 正面：P2/P10 换 adapter 时仓库零改动；测试可复现；多错误不丢失；状态字符串不再散落。
- 负面：`query` 能力刻意有限，复杂筛选要回内存；`errorProfile` 数组需要 UI/报表适配；P2 需实现索引优化。
- 需要同步：`docs/TRACEABILITY.md` A-01—A-04；`docs/CONTENT_SPEC.md`；`tests/p0/storage.test.js`。

## 被否决的方案

| 方案 | 否决原因 |
|---|---|
| 只保留 6 个方法（去掉 transaction 或 export） | 违背 DESIGN 对原子性与迁移的要求 |
| `errorProfile` 保持单对象，覆盖写 | 丢失多错信号，家长端无法定位 |
| 用 `text` 直接当主键 | 改词/同形词/句子引用都会断 |
| P0 就做完整查询 DSL | 过度设计，P2 才能验证 IndexedDB 索引行为 |
| 状态用自由字符串 | 拼写错误无法在编译期/测试期发现 |
