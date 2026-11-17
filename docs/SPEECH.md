# 单词与例句朗读

使用浏览器原生 `speechSynthesis`，不引入音频资源或第三方依赖。

## 行为

- 单词：优先选择英语自然 voice，语速约 `0.86`；
- 例句：完整句子朗读，保留标点，语速约 `0.94`；
- 题面出现时自动尝试朗读目标词（仅答前可见词的题型）；
- 答对/答错后自动朗读正确单词；
- 点击字母块（tile）朗读该字母/组合；T-REORDER 点击也朗读；
- 朗读按钮为高对比 pill，带喇叭图标；
- Feedbacks 提供 `Hear word` / `Hear sentence`；
- T-TYPE 答前不自动朗读、不显示单词按钮，避免泄露答案；
- T-EDIT/T-JUDGE-FIX/T-CLOZE 答前也不直接朗读目标词；
- T-SEQUENCE/T-FILL/T-SEGMENT/T-MATCH/T-REORDER 答前可 `Hear word`；
- 例句只在答题后朗读，避免 T-CLOZE 直接读出空格答案。

## 字母组合限制

`speechSynthesis` 对 `sh`、`ue`、`ea` 等孤立组合的发音依赖语音引擎，
可能读成字母名或近似音，而不是精确音素。当前为 best-effort；
若要稳定的自然发音，需要后续为 152 个 grapheme 预生成音频。

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
