# SpellWell 当前工程状态

> 更新时间：2026-11-12 · contentVersion 11 · P9 已完成

## 1. 阶段

| 阶段 | 状态 |
|---|---|
| P0—P8 | ✅ 完成 |
| P9 内容驱动题目生成与练习设计 | ✅ 完成 |
| P10 输入适配/移动端 | ⏳ 下一步 |
| P11 挑战 | 未开始 |
| P12 平移 | 未开始 |

门禁：

```bash
node tests/runTests.js --phase=p9
# P7 190 · P8 193 · P9 233
```

## 2. 教材与内容

| 内容 | 数量 |
|---|---:|
| 教材 | 2（人教新起点 / 外研新交际北京专版） |
| words | 1474 |
| graphemes | 152 |
| sentences | 241 |
| confusables | 7 |
| word families | 7 |
| units | 144（每套 72） |
| magic-e 标注 | 108 |
| reviewStatus | 全部 unreviewed |

静态文件：

```text
src/content/words.json
src/content/graphemes.json
src/content/sentences.json
src/content/confusables.json
```

首次启动从同源静态文件导入 IndexedDB；上线包自带，不依赖远程内容。

## 3. 学习流程

默认自动选择所有已学但未 mastered 的单元；完全掌握不加入；旧单元完成后有余地才加一个新单元。设计页保留，自动结果作为默认勾选；`Units` 可手动调整。

```text
练习设计（年级学期折叠 + 已完成/下一个 unit）
  → Warm-up 修复错词
  → Review 到期复习
  → New 新词（先 T-SEQUENCE）
  → Practice 巩固
  → 结束页：正确率 → 错词
```

- 答错显示正确答案，必须重试正确才进入下一题；
- 只记录第一次作答；
- 错词按记忆曲线下次回来；
- 当前会话不因后台内容更新中断。

## 4. 关键文档

| 文档 | 内容 |
|---|---|
| [DESIGN](DESIGN.md) | 产品契约 |
| [ROADMAP](ROADMAP.md) | 阶段任务 |
| [TRACEABILITY](TRACEABILITY.md) | 条款→代码→测试 |
| [CONTENT_SPEC](CONTENT_SPEC.md) | 内容格式 |
| [CONTENT_INVENTORY](CONTENT_INVENTORY.md) | 预制内容清单 |
| [SESSION_FLOW](SESSION_FLOW.md) | 出题顺序/题型 |
| [SEGMENTATION_AUDIT](SEGMENTATION_AUDIT.md) | 分词审计 |
| [PEP_VOCAB_BASE](PEP_VOCAB_BASE.md) | 人教词库来源 |
| [FLTRP_VOCAB_BASE](FLTRP_VOCAB_BASE.md) | 外研词库来源 |
| [decisions/](decisions/) | ADR-0001—0026 |

## 5. 已知限制

1. **全部内容 `unreviewed`**，V10 阻断生产导出；
2. 全部 1474 词已补 IPA，但仍需人工复核；
3. 241 条例句只覆盖核心词，不是 1474 词全覆盖；
4. T-TYPE 只用中文/音标回忆，不显示目标单词；中文为主、IPA 同屏辅助；
5. 单元行显示真实 attempts 校准的记忆曲线进度条/百分比；
6. T-FILL 对纯元音组合约 1/3 拆成字母双空（如 r _ _ n）；候选只保留空位答案+干扰项；干扰项按历史错误→相似组→随机。
7. T-JUDGE-FIX 只在该词有历史错误时出现，claim 回放该词自己的错误。
8. 提示去标签、练习页去阶段小标题；主按钮改圆角绿色；后台入口 `/admin`。
4. 魔法 e 词支持 T-FILL 双空 `n_m_`（选 a、e），不是 `a_e` 非连续单块；
6. 后台单元按 12 个/页，搜索跨全部；
7. 一个词目前只能属于一个 unit；跨单元重复会被折叠；
8. 7 个词族是人工示例，未覆盖全词库；
9. 单元完成定义是“全部词练过一次”，不是“全部掌握”。
