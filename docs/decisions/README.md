# 决策记录（ADR）

对 DESIGN 未定义点或必须偏离点的裁决。一次偏离一篇；先写 ADR，再改代码。

| 编号 | 标题 | 状态 | 影响 |
|---|---|---|---|
| [0001](0001-storage-contract.md) | 存储契约、状态结构与内容 ID | Accepted | 7 个存储方法、errorProfile 数组、状态枚举、query 语义 |
| [0002](0002-docs-as-code.md) | 让设计文档贯穿开发过程 | Accepted | 追溯矩阵、代码头、架构守卫、阶段门 |
| [0003](0003-p1-runtime-boundaries.md) | P1 运行边界与题型判定上下文 | Accepted | 内容装配、迷你调度、judge bundle/now、不持久化 |
| [0004](0004-unit-granularity.md) | 选择单位的粒度（grapheme/letter/mixed） | Accepted（P3/P4 实现） | spec.params 粒度、字母 unit ID、错误画像、T-SEGMENT 分工 |
| [0005](0005-interaction-feedback.md) | 拖拽吸附/弹回与互动音效 | Accepted | 64px 吸附、240ms 弹回、Web Audio 轻音效、静音开关 |
| [0006](0006-difficulty-gradient.md) | 难度梯度与选题计算 | Accepted（权重 P3 校准） | grapheme < mixed < letter、难度向量、P3 DifficultyPolicy |
| [0007](0007-ordered-reorder.md) | 按序选择的插入式重排 | Accepted | 左右半边插入、移源后边界修正、满槽拒绝、连续 slotIndex |
| [0008](0008-indexeddb-content.md) | IndexedDB 内容导入与降级 | Accepted | contentVersion 幂等、IndexedDB 优先、Memory 回退、8 库导出导入 |
| [0009](0009-daily-queue-state.md) | 每日队列、错词优先级与状态写入 | Accepted | 5—8 队列、错词优先、答错次日、题型映射、P3 难度向量 |
| [0010](0010-p4-repair-types.md) | P4 顺序/边界修复题型与交互 | Accepted | 点击交换、预填修错、字母间隙、P4 题型映射 |
| [0011](0011-grapheme-strengthening.md) | 组合强化包与 T-MATCH | Accepted | 多选分类、独立组合阶梯、跨 2 词 probe、每日 1 组 |
| [0012](0012-probe-judge-cloze.md) | 判断纠错、语境抽查与 probe 迁移 | Accepted | claim 判断+改错、句子挖空、60 天 probe、答错退回 |
| [0013](0013-content-admin-export.md) | ContentValidator、后台与生产导出阻断 | Accepted | V1—V10、只读后台、reviewed-only 导出 |
| [0014](0014-learning-analytics.md) | 前台学习分析与历史答题统计 | Accepted | 本次/历史/按日/状态报告；无积分排名；P8 新增 |
| [0015](0015-shared-content-migration.md) | 后台与前台共享 IndexedDB；迁移独立 | Accepted | 内容直写共享库；BroadcastChannel 提示；迁移全量快照 |
| [0016](0016-auto-segmentation-batch.md) | 后台自动切分建议、组合库扩充与批量录入 | Accepted | 最长匹配建议、人工确认、批量格式、翻译/音标 |
| [0017](0017-admin-list-stats-levels.md) | 后台列表按 level 折叠、显示错/对次数 | Accepted | 只读 attempts 聚合；教学分组；搜索展开 |
| [0018](0018-content-driven-practice.md) | 内容驱动计划、练习设计页与 20 题默认 | Accepted | 单元多选、Review/Effort、后台题量、revision、revise 预留 |
| [0019](0019-attempt-calibrated-weights.md) | 用真实 attempts 校准选词权重 | Accepted | 按词/题型错误率、小样本平滑、同层排序、约束优先 |
| [0020](0020-prompt-resource-priority.md) | 提示词资源优先级 | Accepted | 句子→音标→中文→单词；只读；CLOZE 不重复 |
| [0021](0021-word-library-import-export.md) | 词库单独导入/导出 | Accepted | 只含 words；合并/替换/不动；导入校验后落库 |
| [0022](0022-textbook-switch.md) | 多教材版本与后台切换 | Accepted | textbook 字段；meta.activeTextbook；两套词库共存 |
| [0023](0023-sequential-unit-unlock.md) | 单元顺序解锁与练习设计页 | Accepted | 完成单元 + 下一个；完成=全部词练过；不足20不跨单元 |
| [0024](0024-retry-and-session-summary.md) | 答错重试到正确与结束页 | Accepted | 首次作答记录；答错显示答案；结束时正确率+错词 |
| [0025](0025-segmentation-audit.md) | 基础词库切分审计与组合库扩充 | Accepted | 96→152；后缀词尾约束；例外表；静态自带 |
| [0026](0026-session-phase-order.md) | 练习阶段顺序与题型策略 | Accepted | 修复→复习→新词→巩固；新词先搭；计划带 phase |
| [0027](0027-admin-unit-pagination.md) | 后台单元分页 | Accepted | 12 unit/页；搜索跨全部；折叠上下文保留 |
| [0028](0028-input-ux-auto-check.md) | 输入体验：高亮目标词/自动判定/IME | Accepted | 高亮目标；composition 防误提交；正确自动提交；自动聚焦 |
| [0029](0029-auto-practice-selection.md) | 默认自动选择记忆周期内单元 | Accepted | 复习全选；mastered 排除；有余地加一个新单元；默认直接进入 |
| [0030](0030-unit-mastery-progress.md) | 单元掌握总进度 | Accepted | 记忆曲线+连对+错题；整行背景条+百分比 |
| [0031](0031-vowel-split-fill.md) | 元音组合拆字母练习 | Accepted | T-FILL 约1/3把 ai/ea/oo 拆成字母双空；保留原 units |
| [0032](0032-confusable-distractors.md) | 相似音/相似拼写干扰项 | Accepted | ir/er/ur、ea/ee/e/a 等；T-FILL/T-MATCH 优先同组干扰 |
| [0033](0033-history-distractors.md) | 历史错误优先于人工相似组 | Accepted | attempts 历史 actual 优先；静态表次之 |
| [0034](0034-judge-claim.md) | T-JUDGE-FIX 历史错题回放 | Accepted | 仅该词有历史错误时出现；claim 用自己的 actual |
| [0035](0035-visual-polish.md) | P9 视觉收口/后台入口 | Accepted | 去标签/去重复提示；圆角主按钮；/admin |
| [0036](0036-auto-review-rows.md) | 旧单元自动复习只读 | Accepted | 记忆周期旧单元固定加入；只复选下一个新单元 |
| [0037](0037-type-variety.md) | 同阶段题型轮转 | Accepted | 强复习 T-TYPE/T-FILL 交替；新词穿插 T-FILL；会话种子变化 |
| [0038](0038-admin-learning-state.md) | 后台受控维护学习状态 | Accepted | unstarted/reviewing/mastered；服务写入；单元状态派生 |
| [0039](0039-review-spacing-and-progress-cap.md) | 复习间隔优先/进度封顶 | Accepted | 未到期不 filler；未 mastered 不显示 100% |
| [0040](0040-in-session-repair.md) | 当次错题后半段换题型强化 | Accepted | 首次错词插入同词不同题型；最多一次 |
| [0041](0041-snapshot-sync.md) | 浏览器 IndexedDB 快照同步 | Accepted | /sync 代理；浏览器 merge；离线容错 |

新增 ADR 的模板：

```md
# ADR-000N：标题

- 状态：Proposed / Accepted / Superseded
- 日期：
- 影响条款：DESIGN §x.y
- 相关文件：

## 背景
## 决定
## 后果
## 被否决的方案
```
