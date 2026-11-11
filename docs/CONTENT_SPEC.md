# 内容数据规范 · CONTENT_SPEC

**版本**：v1（P0）
**适用**：`src/content/*.json`、P7 标注后台、P2 内容导入
**铁律**：grapheme 切分只能人工完成；运行时不得由算法推断（DESIGN §1.4）。

---

## 1. 文件与版本

| 文件 | 内容 | 顶层结构 |
|---|---|---|
| `src/content/words.json` | 词条与人工切分 | `{ "version": 1, "items": Word[] }` |
| `src/content/graphemes.json` | 字母组合库 | `{ "version": 1, "items": Grapheme[] }` |
| `src/content/sentences.json` | 语境补全素材 | `{ "version": 1, "items": Sentence[] }` |
| `src/content/confusables.json` | 成对混淆项 | `{ "version": 1, "items": Confusable[] }` |

- 版本变更必须更新本文件与 `tests/p0/content.test.js`。
- 内容文件是**只读数据**；前端加载后不得回写内容库（学习状态另存）。
- P0 种子内容全部 `reviewStatus: "unreviewed"`，只用于开发与结构验证，不得当作教学定稿。

---

## 2. 词条 Word

```json
{
  "id": "w.fish",
  "text": "fish",
  "grade": 1,
  "term": "下",
  "unit": 1,
  "unitId": "g1-s2-u1",
  "unitLabel": "一年级下 · 第1单元",
  "units": [
    { "text": "f", "graphemeId": "g.f" },
    { "text": "i", "graphemeId": "g.i" },
    { "text": "sh", "graphemeId": "g.sh" }
  ],
  "tags": ["animal", "water"],
  "sentenceIds": ["s.fish.01"],
  "reviewStatus": "unreviewed"
}
```

**字段规则**：

| 字段 | 规则 |
|---|---|
| `id` | `w.<slug>`，永久稳定；同形异义词用 `w.bow.1` / `w.bow.2` |
| `text` | 小写 ASCII 字母，无空格、连字符；长度 1—12 |
| `grade` | 1 或 2（一年级/二年级） |
| `term` | `上` 或 `下` |
| `unit` | 单元序号，正整数；同一 grade+term 下可多个 |
| `unitId` | `g<grade>-s<1|2>-u<unit>`，由 grade/term/unit 派生，稳定 |
| `unitLabel` | 展示标签，如“一年级下 · 第1单元” |
| `units` | 非空、有序；`units.map(u => u.text).join('') === text` |
| `units[].text` | 连续字母子串，不得为空 |
| `units[].graphemeId` | 必须存在于 `graphemes.json`，且组合文本等于 `unit.text` |
| `translation` | 可选，中文翻译；只展示，不参与判定/调度 |
| `phonetic` | 可选，音标字符串；只展示，不参与判定/调度 |
| `tags` | 可选，小写短标签；不参与调度 |
| `sentenceIds` | 可为空；每个 ID 必须存在且句子的 `wordId` 回指本词 |
| `reviewStatus` | `unreviewed` / `reviewed` / `retired`；生产导出仅 `reviewed` |

**切分示例（人工确认）**：

| 单词 | 正确切分 | 常见错误切分 |
|---|---|---|
| `fish` | `f` / `i` / `sh` | `f` / `is` / `h` |
| `night` | `n` / `igh` / `t` | `n` / `ig` / `ht` |
| `rain` | `r` / `ai` / `n` | `r` / `a` / `in` |
| `duck` | `d` / `u` / `ck` | `d` / `uc` / `k` |

> `ea`、`ou`、`igh` 等歧义组合一律人工确认；同一文本在不同词中允许不同切分，但必须逐词显式标注。
> 后台可基于组合库生成建议切分，保存前必须人工确认；学习端/题型层不得自动推断。

**批量录入格式**：

```text
# 每行一个词；逗号显式切分，无逗号自动建议
一年级上unit2
w,ea,th,er | 天气 | /ˈweðər/
weather | 天气 | /ˈweðər/
fish

# 标题行切换单元；后续词继承该单元，直到下一个标题行
二年级下unit5
boat
```
- 标题行格式：`<年级><学期><unit><n>`，如 `一年级上unit2`、`二年级下 unit 5`；
- 标题行本身不生成单词；
- 标题行后的单词继承该单元；没有标题时使用当前编辑词所属单元；
- 合并/替换已有词时，显式标题会更新该词的 `grade/term/unit/unitId/unitLabel`。

**自动切分（后台建议）**：

1. 用 `graphemes.json` 构建 `text → id` 表；
2. 从左到右做最长匹配（最多 6 字符）；
3. 匹配不到时使用单字母；单字母也不存在则报错；
4. 结果只填入草稿，保存时仍走 V1—V10。

示例：`weather → w / ea / th / er`、`teacher → t / ea / ch / er`、`night → n / igh / t`。
这不是语言学意义上的唯一正确切分；歧义仍由人工确认。

---

## 3. 组合 Grapheme

```json
{
  "id": "g.sh",
  "text": "sh",
  "tier": "T1",
  "kind": "digraph",
  "reviewStatus": "unreviewed"
}
```

| 字段 | 规则 |
|---|---|
| `id` | `g.<text>`，一个文本只允许一个 ID |
| `text` | 小写 ASCII 字母串，与 ID 后缀一致 |
| `tier` | `T1` / `T2` / `T3` / `T4` |
| `kind` | `letter` / `digraph` / `trigraph` / `vowel-team` / `r-controlled` / `quadgraph` / `suffix` |
| `reviewStatus` | 同上 |

**T1—T4 分层（P0 暂定，P7 教学评审后冻结）**：

| 层级 | 定义 | 当前示例 |
|---|---|---|
| T1 | 透明单字母 + 常见辅音组合 | `a`—`z`、`sh`、`ch`、`ck` |
| T2 | 常见元音组合 | `ai`、`ee`、`oo` |
| T3 | 较少见/多字母组合 | `igh` |
| T4 | 高歧义组合 | `ea`、`ou`、`ow`、`ough`、`eigh` |

> 分层不是难度总分，而是“教学引入顺序 + 强化包优先级”的标签；
> 选择粒度（grapheme 块选 < mixed < letter）是另一个独立维度，见 DESIGN §3.5 与 ADR-0006。

---

## 4. 句子 Sentence

```json
{
  "id": "s.fish.01",
  "wordId": "w.fish",
  "text": "A fish can swim.",
  "blank": "fish",
  "answer": "fish",
  "reviewStatus": "unreviewed"
}
```

| 字段 | 规则 |
|---|---|
| `id` | `s.<wordSlug>.<两位序号>` |
| `wordId` | 必须存在；句子只服务一个目标词 |
| `text` | 英文单句，首字母大写、有标点；不得包含中文 |
| `blank` | 必须与 `answer` 完全一致，且在 `text` 中恰好出现一次 |
| `answer` | 等于目标词的 `text`（大小写按句中使用形式；当前全小写） |
| `reviewStatus` | 同上 |

**语义唯一**：句子挖空后，只能填目标词（或目标词的同形词），不能有多个合理答案。这是人工评审项，P7 在导出前强制确认。

---

## 5. 混淆项 Confusable

```json
{
  "id": "c.ch-sh",
  "a": "g.ch",
  "b": "g.sh",
  "kind": "digraph",
  "note": "ship / chip 的词首对比",
  "wordPairIds": ["w.ship", "w.chip"],
  "reviewStatus": "unreviewed"
}
```

| 字段 | 规则 |
|---|---|
| `id` | `c.<aText>-<bText>`，文本按字母序排列，保证无序对唯一 |
| `a` / `b` | 必须存在，且 `a !== b` |
| `kind` | `digraph` / `vowel` / `ending` / `other` |
| `note` | 给家长/后台看的中文说明，可空 |
| `wordPairIds` | 可选；每个 ID 必须存在，且两个词至少各包含 `a` 或 `b` 之一 |
| `reviewStatus` | 同上 |

**禁止单边**：不允许只有 `sh` 的混淆记录而没有 `ch`；同一无序对只允许一条（ID 按字母序规范化，如 `c.ch-sh`）。

---

## 6. 校验规则（V1—V10）

| 编号 | 规则 | P0 测试 | P7 后台 |
|---|---|---|---|
| V1 | JSON 顶层有 `version` 与 `items` 数组 | ✅ | ✅ |
| V2 | ID 唯一且前缀正确 | ✅ | ✅ |
| V3 | 单词 text 为小写 ASCII | ✅ | ✅ |
| V4 | `units` 拼接等于 `text` | ✅ | ✅ |
| V5 | 每个 `graphemeId` 存在且文本一致 | ✅ | ✅ |
| V6 | 句子挖空恰好一次，`answer` 等于词条 | ✅ | ✅ |
| V7 | 句子/词的引用双向一致 | ✅ | ✅ |
| V8 | 混淆项引用存在、无序对唯一、无单边 | ✅ | ✅ |
| V9 | 每个内容项有 `reviewStatus` | ✅ | ✅ |
| V10 | 生产导出仅 `reviewed` | — | ✅（阻断） |

运行：

```bash
node tests/runTests.js --phase=p0
```

---

## 7. 标注流程（P7 落地，P0 先守规则）

1. 录入词条文本 → 系统只给字母间隙，不预填组合。
2. 标注者点击间隙形成 `units`；每段手动指定 `graphemeId`（可新建组合）。
3. 保存时跑 V1—V9；失败阻断保存。
4. 第二人复核 `reviewStatus`，通过后改 `reviewed`。
5. 导出时跑 V10；任何 `unreviewed` 内容阻断导出。
6. 后台不得读写 `wordStates` / `graphemeStates` / `attempts`（只读内容库）。

---

## 8. ID 生命周期

- 词条文字修改：**保留原 ID**，更新 `text` 与 `units`；旧 ID 永不复用。
- 词条废弃：`reviewStatus: "retired"`，从学习队列排除，但保留引用以免历史 attempt 断链。
- 组合合并：新建新 ID，旧 ID 标记 retired，并迁移引用；不得直接改 `text`。
- 句子改写：若挖空词不变可保留 ID；若目标词变化，新建 ID 并退休旧句。
