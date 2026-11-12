# 音标（IPA）补齐说明

## 1. 缺的是字段，不是发音

`words.json` 中 `phonetic` 是**可选展示字段**。
现在全部基础词条都已补齐 IPA；以下保留历史原因和补齐方式。

提示词规则：

```text
sentence → phonetic → translation → word
```

因此提示以中文为主，IPA 作为同屏辅助；低年级不会只给 IPA。

## 2. 当前统计

| 教材 | 词数 | 缺 IPA | 主要原因 |
|---|---:|---:|---|
| 人教新起点 `pep-2026` | 583 | 0 | 已补齐 |
| 外研新交际 `fltrp-2026` | 891 | 0 | 已补齐 |

补齐来源：

- 优先复用另一套教材同名词条；
- 外部 [dictionaryapi.dev](https://dictionaryapi.dev/) 的 IPA；
- 专有词/API 未覆盖词由人工补：`pe`、`mr`、`ok`、`sun`、`student`、`sing` 等。

全部 1474 词均已具备 `/.../` 格式的 IPA，但仍为 `unreviewed`。

## 3. 为什么不能自动猜

音标依赖：

- 重音；
- 弱读；
- 同形异音；
- 英式/美式差异；
- 词性差异。

例如 `record`、`present`、`read` 不能只靠拼写确定读音，不能在没有词典/人工确认时自动填。

## 4. 建议

1. 优先补 1—2 年级高频词；
2. 外研版逐个 unit 对照教材音频/教师用书；
3. 补完后把对应词从 `unreviewed` 转为 `reviewed`；
4. 词库导入支持 `phonetic` 字段，可批量导入。
