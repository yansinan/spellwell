# ADR-0008：IndexedDB 内容导入、持久化与降级

- **状态**：Accepted
- **日期**：2026-11-11
- **决策者**：P2 实现
- **影响条款**：DESIGN §5.3、§2.1
- **相关**：`src/storage/IndexedDBAdapter.js`、`src/storage/contentImport.js`、`src/ui/bootstrap.js`

## 背景

P1 用同源 fetch + MemoryAdapter 装配 3 个词，刷新即丢。P2 要把内容放到 IndexedDB，
做到刷新不丢、导出导入一致，同时保持 P1 的 `PracticeSession` 与题型层接口不变。

## 决定

### D1：IndexedDBAdapter 实现 7 个方法，查询语义与 MemoryAdapter 一致

- `init/get/put/query/transaction/exportAll/importAll` 全部实现；
- `query` 仍为顶层等值过滤 + 主键字典序 + offset/limit；
- `transaction` 回调拿到只带 `get/put/query/clear` 的事务作用域；
- `importAll` 在单个事务里 clear 8 个 store 再写入，失败整体回滚；
- IndexedDB 不可用时 `init()` 明确抛 `STORAGE_UNAVAILABLE`。

### D2：内容导入用 meta.contentVersion 幂等

`contentImport.js`：

- 写入 `words/graphemes/sentences/confusables` 4 个内容库；
- `meta` 写 `{ key: 'contentVersion', value: 1 }`；
- 同一版本再次调用直接返回 `seeded: false`，不重写；
- 版本变化时覆盖写入（P2 不删除旧记录；P7 做完整迁移/校验）；
- 所有写入在一个事务里，失败不留下半套内容。

### D3：bootstrap 优先 IndexedDB，失败回退 Memory

- 首次加载：IndexedDB 为空 → fetch 4 个 content JSON → import；
- 刷新：读到 `contentVersion` 匹配 → 跳过 fetch 与写入，直接用 IndexedDB；
- IndexedDB 不可用/初始化失败：`console.warn` 并回退 MemoryAdapter，应用仍可用；
- P2 不写 `wordStates/graphemeStates/attempts`。

### D4：调试句柄只在 `?debug=1` 暴露

`window.__SPELLWELL_DEBUG__ = { session, adapter, storage, contentSeeded }` 仅在 debug 模式存在，
用于验收导出/导入、持久化与存储类型；孩子端不显示。

### D5：导出/导入覆盖 8 个 store

`exportAll` 返回 `{ schemaVersion: 1, exportedAt, stores }`；
`importAll` 校验版本/集合/主键后，事务内整体替换。
P2 虽然还没有学习状态，但快照结构已包含状态与 attempts，P3 可直接复用。

## 后果

- 正面：刷新不丢内容；同版本不重复网络请求；导出导入可验证；P3 可直接写状态。
- 负面：P2 内容版本升级不删除旧记录，需要 P7 的 ContentValidator/迁移；IndexedDB 查询仍是全表扫描，词库规模小可接受。
- 约束：仓库层仍只能调用 7 个存储方法；题型层不感知存储类型。

## 被否决的方案

| 方案 | 否决原因 |
|---|---|
| 继续用 MemoryAdapter + localStorage | 容量/结构不适合内容库与未来状态 |
| 每次加载都重新 import | 无谓写放大，无法体现持久化 |
| 把内容导入放进题型层 | 破坏分层与可替换性 |
| IndexedDB 不可用就崩溃 | 低龄单机场景需要优雅降级 |
| 在 P2 顺便写 wordStates | 越过 P3，调度算法未定 |
