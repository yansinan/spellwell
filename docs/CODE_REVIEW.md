# 代码审查记录

> 范围：P9 当前 session/content 流程 · 2026-11-12

## 1. 已修正

- 批量导入重复词按 `textbook` 隔离；
- 词库导入重复词支持合并/替换/不动；
- 后台切换教材后学习端按 activeTextbook 取词；
- 答错不再自动下一题，重试只记录第一次；
- 单元顺序解锁只显示已完成 + 下一个；
- 填空焦点按 seed 变化，元音偏重；
- 词库全部重切分，152 组合；
- 例句 241、混淆项 7、词族 7；
- WordLibrary 的 3—6 年级 fallback 标签修正。

## 2. 需要关注

### A. 魔法 e 与连续 units

当前 `ContentValidator` 和题型都以 `unit.text` 拼接/长度计算。
若把 `name` 改成 `n/a_e/m`，必须引入：

```json
{ "text": "a_e", "letters": "ae" }
```

并同步：

- join 校验；
- T-SEGMENT 边界；
- T-EDIT 初始文本；
- 错误位置映射。

这是可行但跨层改动，不能只改 JSON。

### B. 内容版本迁移

已按“导入新静态内容”的选择：任何版本不匹配都直接导入工程静态词库。
旧版迁移函数保留但不再作为启动路径。

### C. 数据量

- 1474 words / 72 groups per textbook；
- 后台一次渲染全部 group，虽然默认折叠，仍建议后续虚拟滚动；
- 学习端 readContent 每轮读取全部 words/wordStates，目前规模可接受。

### D. 全局练习设置

`questionsPerPractice` 目前全局；两套教材词量差异大，建议后续按 textbook 设置。

### E. 内容审核

全部 1874 条内容 `unreviewed`，生产导出被 V10 阻断。
上线前必须有审核流，不是代码问题。

## 3. 不建议现在做

- 直接把 `units.join === text` 删除而不加 `letters`/span；
- 用实时 runtime 外部词典补 IPA；
- 为词族引入新题型（先用提示/关联展示）。
