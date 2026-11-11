# 预制内容清单（contentVersion 8）

## 1. 已内置

| 内容 | 数量 | 说明 |
|---|---:|---|
| words | 1474 | 人教版 583 + 外研版 891 |
| graphemes | 152 | 单字母、辅音簇、双写、元音组合、r-controlled、后缀 |
| sentences | 162 | 核心词配例句，按教材词条挂接 |
| confusables | 7 | ch/sh、ck/k、ai/ay、ea/ee、oa/ow、ir/ur、s/th |
| practiceSettings | 1 | 默认 20 题、Review 模式 |
| textbooks | 2 | pep-2026 / fltrp-2026 |
| units | 144 | 两套教材各 72 个 unit |
| magic e 标注 | 108 | CVCe 词标记 `magicE`、`magicEPattern`、silent e |

## 2. 每词已预填字段

- `id/text/units`
- `grade/term/unit/unitId/unitLabel`
- `textbook/textbookLabel`
- `translation`、`phonetic`（有来源时）
- `sentenceIds`（核心词）
- `reviewStatus: unreviewed`

## 3. 尚未填充/需人工的内容

| 内容 | 现状 | 建议 |
|---|---|---|
| 剩余词例句 | 162 词有句 | 逐 unit 补 core words |
| 音标 | 外研 1—2 年级和部分词缺失 | 补 IPA |
| Unit 标题 | 只用 `第N单元` | 可从教材目录补 `unitTitle` |
| 全部审核 | 0 reviewed | 教研逐词确认切分/释义 |
| 音频 | 无（按设计不引入资源） | 保持合成音/不依赖音频 |

## 4. 上线方式

词库随工程静态文件发布：

```text
src/content/words.json
src/content/graphemes.json
src/content/sentences.json
src/content/confusables.json
```

`contentVersion=8`，首次启动从同源静态文件导入 IndexedDB；
不依赖外部接口、运行时网络或远程词库。
