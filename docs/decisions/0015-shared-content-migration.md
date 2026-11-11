# ADR-0015：后台与前台共享 IndexedDB；迁移独立

- **状态**：Accepted
- **日期**：2026-11-11
- **决策者**：后台交互修订
- **影响条款**：DESIGN §2.3、§5.3
- **相关**：`AdminApp.js`、`MigrationApp.js`、`main.js`

## 背景

P7 后台最初只能校验/导出，单词编辑要经过“下载 JSON → 再导入学习端”的假流程。
用户明确要求：

1. 后台编辑直接与学习端共享本机 IndexedDB；
2. 导出/导入只用于本机数据迁移到另一台主机，不是内容发布通道。

## 决定

### D1：内容编辑直接写共享 IndexedDB

- 后台与学习端使用同一个 `IndexedDBAdapter` 默认数据库；
- 保存单词/units 时写 `words/graphemes/sentences/confusables/meta`；
- 不要求下载 JSON、不要求手动导入学习端；
- 后台保存成功后通过 `BroadcastChannel('spellwell-content')` 通知学习端；
- 学习端只显示“Content updated / Reload”提示，不在练习中自动重载，避免丢失当前题。

### D2：内容版本保持 1

- 后台编辑不 bump `contentVersion`，避免学习端误判为“内容回滚”而重新 fetch 静态 JSON；
- 学习端刷新后直接读共享 DB；
- 内容迁移/发布是另一个动作。

### D3：导出/导入只做本机数据迁移

- 独立页面 `/migration/index.html`；
- `exportAll`/`importAll` 覆盖 8 个 store（含学习状态与 attempts）；
- 导入前确认覆盖；仅用于换主机/恢复备份；
- 不属于后台内容发布，不在 AdminApp 中放“导出内容”按钮。

### D4：后台仍是内容生产，不写学习状态

- AdminApp 只写内容 store + meta；
- MigrationApp 是迁移工具，允许全量快照，但不参与日常内容编辑；
- 后台不提供学习数据编辑入口。

## 后果

- 正面：编辑即保存，学习端刷新即可见；不再有内容 JSON 导入导出假流程。
- 正面：迁移与内容发布职责分离，避免误覆盖学习状态。
- 负面：学习端需要刷新才看到后台改动；不自动热更新当前 session。
- 负面：后台编辑的是同源 IndexedDB，清理浏览器数据会同时丢失内容与学习状态，需用迁移备份。
- 约束：后台不得 bump 内容版本；迁移页面不得被当成内容发布入口。

## 被否决的方案

| 方案 | 否决原因 |
|---|---|
| 后台导出 JSON，学习端手动导入 | 用户明确反对；多一步易错 |
| 后台直接写静态文件 | 浏览器无权限 |
| 后台 bump contentVersion | 学习端会重新 fetch 静态 JSON，覆盖编辑 |
| 迁移工具放 AdminApp | 混淆内容编辑与全量恢复，易误操作 |
