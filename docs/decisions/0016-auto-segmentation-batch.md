# ADR-0016：后台自动切分建议、组合库扩充与批量录入

- **状态**：Accepted
- **日期**：2026-11-11
- **决策者**：后台交互修订
- **影响条款**：DESIGN §1.4、CONTENT_SPEC §2/§3/§6
- **相关**：`WordImporter.js`、`AdminApp.js`、`graphemes.json`

## 背景

后台人工逐 unit 编辑效率低。用户要求：

- `w,ea,th,er` 可直接录入 `weather` 并设定切分；
- 批量录入，无逗号时自动分词；
- 先补全常见字母组合库；
- 支持可选中文翻译/音标。

原 DESIGN §1.4 写“切分必须人工完成”，与自动分词冲突。

## 决定

### D1：自动切分只发生在后台，且只是建议

- 学习端/题型层仍禁止自动推断 grapheme；
- 后台可用 `WordImporter.autoSegment` 生成草稿 units；
- 保存前仍走 ContentValidator，并由人工确认；
- 自动建议不得直接进入学习端而不经保存/校验。

### D2：最长匹配的基础算法

1. 用 graphemes 库建 `text → graphemeId`；
2. 从左到右取最长 6 字符匹配；
3. 匹配不到时用单字母（库含 a—z）；
4. 仍无匹配则报错；
5. 结果可编辑。

示例：`weather → w/ea/th/er`、`teacher → t/ea/ch/er`、`night → n/igh/t`。
该算法不保证语言学唯一正确，歧义必须人工确认。

### D3：组合库一次性扩充

- 单字母 a—z；
- 常见辅音组合：th/wh/ph/ng/qu/kn/wr/gh/gn/mb/dge/tch 等；
- 元音组合：ea/ay/ey/ie/oa/oe/oi/oy/ou/ow/ue/ui/au/aw/ew/eu；
- r-controlled：ar/er/ir/or/ur/are/ere/ire/ore/ure/oar/our；
- 三元/四元：air/ear/eer/igh/eigh/ough/augh；
- 常见后缀：ing/ed/es/ly/est/tion/sion/ment/ness/ful/less/ture/sure/le/al/el。
- 新增 kind：`r-controlled`/`quadgraph`/`suffix`。

### D4：批量格式

```text
# 每行一个词；逗号显式切分；无逗号自动建议
w,ea,th,er | 天气 | /ˈweðər/
weather | 天气 | /ˈweðər/
fish
```

- `|` 依次分隔词/切分、中文翻译、音标；
- 中文/音标可空；
- 重复文本跳过，不生成 `-2` 副本；
- 预览显示将新增/跳过/错误，确认后批量写入共享 IndexedDB。

### D5：单词元数据

`translation`、`phonetic` 为可选字段，只展示，不参与判定/调度/难度。
不引入翻译题、听力题。

## 后果

- 正面：批量录入高效；切分有建议但可人工修正；组合库覆盖常见词。
- 正面：中文/音标便于家长查看，不改变拼写输出边界。
- 负面：最长匹配会产生非语言学最优切分；必须人工确认。
- 负面：新增组合需要未来补充；当前库不是完整词典。
- 约束：自动切分不能出现在学习端/题型层。

## 被否决的方案

| 方案 | 否决原因 |
|---|---|
| 学习端自动推断 | 违反分层与人工确认铁律 |
| 纯最长匹配直接入库 | 歧义切分不可控 |
| 只允许逐词人工 | 批量录入效率太低 |
| 中文/音标参与判定 | 超出拼写输出边界 |
