# ADR-0042：T-MATCH 必须选全，提示必须明确

- **状态**：Accepted
- **日期**：2026-11-18
- **影响条款**：DESIGN §3.4
- **相关**：`src/questionTypes/TMatch.js`、`PracticeScreen`

## 背景

T-MATCH 是多选分类：给出一个 focus 组合，选项中有多个包含该组合的词，也有不包含的词。旧界面只显示：

```text
Words with ai?
```

孩子容易理解为“选一个含 ai 的词”，只选 `rainy` 就提交，但正确集合还包括 `rain`、`paint` 等，因而判错。

## 决定

### D1：判定保持集合完全匹配

```text
selected == correct
```

即必须选中全部正确词，选中错误词或漏选都判错。

### D2：界面必须明确“选全部”

提示改为：

```text
Select every word with "ai".
Use ← → to move, Enter/Space to choose, then Tab to Check.
0 selected
```

并在答错时明确说明：

```text
Select every word with "ai".
```

不再显示与本题无关的 “The word is …”。

## 后果

- 正面：孩子能理解题目要求；
- 正面：保留原有多选分类语义；
- 正面：键盘用户可用方向键选择；
- 负面：仍要求穷举正确词，单点一个不会通过；这是分类题的本意。

## 约束

- 不改变选项生成；
- 不改变正确集合；
- 不写学习状态。
