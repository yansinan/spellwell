# 音标（IPA）缺失说明

## 1. 缺的是字段，不是发音

`words.json` 中 `phonetic` 是**可选展示字段**。
缺失表示该词条没有录入 IPA，不是应用读不到发音。

提示词规则：

```text
sentence → phonetic → translation → word
```

所以缺 IPA 的词会降级到中文或单词。

## 2. 当前统计

| 教材 | 词数 | 缺 IPA | 主要原因 |
|---|---:|---:|---|
| 人教新起点 `pep-2026` | 583 | 10 | 早期手工词条未补 |
| 外研新交际 `fltrp-2026` | 891 | 275 | 1—2 年级来源页面本身没有 IPA |

外研缺失示例：

```text
hello, nice, meet, you, play, i, too, photo,
how, say, four, five, six, seven, balloon
```

人教缺失示例：

```text
thirsty, pe, washington, astronaut, polish,
ship, chip, rain, night, sun
```

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
