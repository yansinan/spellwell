# 单词与例句朗读

使用浏览器原生 `speechSynthesis`，不引入音频资源或第三方依赖。

## 行为

- 单词：优先选择英语自然 voice，语速约 `0.86`；
- 例句：完整句子朗读，保留标点，语速约 `0.94`；
- 答对/答错后自动朗读正确单词；
- Feedbacks 提供 `Hear word` / `Hear sentence`；
- T-TYPE 答前不显示单词按钮，避免泄露答案；
- T-EDIT/T-JUDGE-FIX/T-CLOZE 答前也不直接朗读目标词；
- T-SEQUENCE/T-FILL/T-SEGMENT/T-MATCH/T-REORDER 答前可 `Hear word`；
- 例句只在答题后朗读，避免 T-CLOZE 直接读出空格答案。

## 兼容性

- 语音列表异步加载，监听 `voiceschanged`；
- 优先 `en-US`、自然/神经 voice、本地 voice；
- 移动端必须在点击事件中调用；
- 没有语音或 API 不可用时静默降级；
- 自动朗读在 `await` 之前调用，保留用户手势上下文。

## 测试

```bash
node tests/runTests.js --phase=p12
```

覆盖：

- voice 选择；
- 单词/例句语速；
- 不支持时返回 false；
- T-TYPE/T-EDIT/T-JUDGE/T-CLOZE 答前禁止朗读。
