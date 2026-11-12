# ADR-0032：相似音/相似拼写干扰项

- **状态**：Accepted
- **日期**：2026-11-12
- **影响条款**：DESIGN §3.4
- **相关**：`ConfusableGraphemes.js`、`QuestionSpecBuilder`、`Scheduler`

## 背景

T-FILL/T-MATCH 的干扰项原来从组合池随机取，常出现 `ir` 对 `tion` 这种毫无关系的选项，孩子靠排除即可答对。

## 决定

### D1：组合混淆组

维护相似组合组：

```text
ir / er / ur
ea / ee / e / a
oa / ow / o / oe
ch / sh / tch
ck / k / c
...
```

完整表见 `docs/CONFUSABLES.md`。

### D2：T-FILL/T-SEQUENCE

`QuestionSpecBuilder` 根据 focus 组合取最多 2 个同组干扰项。
例：

```text
bird 的 ir → er / ur
bread 的 ea → e / a / ee
```

不足时再补一个随机多字母组合。

### D3：T-MATCH

目标组合为 `ir` 时，干扰词优先选含 `er/ur` 的词；
目标为 `ea` 时，优先选含 `ee/e/a` 的词。

### D4：边界

- 相似表只影响干扰项，不参与 judge；
- 不修改内容 units；
- 不新增“四选一”；
- Vowel split 时排除与拆分字母重复的干扰 tile。

## 后果

- 正面：选项之间有真实联系，减少靠长度/词形排除；
- 正面：错题更可能暴露“ir/er/ur”这类真实混淆；
- 负面：干扰项更难，需要观察首次正确率是否过低。
