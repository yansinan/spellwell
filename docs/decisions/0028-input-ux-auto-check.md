# ADR-0028：输入体验：高亮目标词、自动判定、IME 与焦点

- **状态**：Accepted
- **日期**：2026-11-12
- **影响条款**：DESIGN §2.1
- **相关**：`PracticeScreen.js`

## 背景

T-TYPE 显示句子 “My brother can run.” 时，没有指出要拼哪个词，
提示仍是 “Type all the letters.”，孩子不知道目标。

同时：

- 中文输入法选词的回车会提交半成品；
- 所有输入都要手动 Check；
- T-TYPE 输入框没有自动聚焦。

## 决定

### D1：T-TYPE 句子高亮目标词

句子提示中把目标词高亮：

```text
My [brother] can run.
```

提示改为：

```text
Type the highlighted word.
```

音标/中文/单词提示仍显示 “Type the word.”。

### D2：中文输入法保护

所有输入框的 Enter 处理：

```js
if (event.isComposing || event.keyCode === 229) return;
```

并把 `compositionstart/end` 计入自动判定状态，避免拼音回车误提交。

### D3：自动判定

- T-TYPE/T-EDIT/T-CLOZE：输入等于目标词后 240ms 自动提交；
- T-SEQUENCE/T-FILL：所有槽位/空位齐备后自动提交；
- T-REORDER：顺序正确时自动提交；
- T-SEGMENT：切分点与目标一致时自动提交；
- T-MATCH：选中集合与正确答案一致时自动提交；
- T-JUDGE-FIX：选择 Correct 自动提交；选择 Wrong 且改正文本正确时自动提交；
- 答错仍保留 Check / 重试，不自动跳题。

### D4：焦点与 Enter

- T-TYPE/T-EDIT/T-CLOZE 渲染后自动聚焦输入框；
- Enter 在输入框中等同提交；
- Enter 在反馈区等同 Try again / Check；
- 正确后仍按 900ms 自动进入下一题。

## 后果

- 正面：输入正确无需回车/点击 Check；
- 正面：中文输入法不会误判；
- 正面：T-TYPE 意图明确；
- 负面：自动提交仍基于当前 UI 与 spec，复杂题型（T-JUDGE-FIX）保留手动 Check 兜底。
