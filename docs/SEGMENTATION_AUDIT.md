# 基础词库分词审计与修正

**范围**：`src/content/words.json` 中全部 1474 个词（人教版 583、外研版 891）。

## 1. 审计发现

原切分是“最长匹配 + 单字母保底”，主要问题：

| 问题 | 例子 | 原切分 |
|---|---|---|
| 后缀被任意位置匹配 | `desk`、`bed`、`red`、`yes` | `d/es/k`、`b/ed`、`r/ed`、`y/es` |
| 常见辅音簇被拆成字母 | `classroom`、`school`、`small` | `c/l/a/s/s/r/oo/m` |
| 双写辅音未合并 | `happy`、`rabbit`、`dinner` | `h/a/p/p/y` |
| `-able` 过度匹配 | `table`、`timetable` | `t/able` |
| 部分固定词切分不自然 | `different`、`favourite`、`transportation` | `d/i/f/f/ere/n/t` 等 |

原数据统计：

- 全字母保底：433 / 1474；
- 最长切分块数：16；
- 平均块数：4.25；
- 组合库：96 项。

## 2. 修正

### 组合库扩充

从 96 项扩到 **152 项**，新增：

- 双写辅音：`bb/dd/ff/gg/ll/mm/nn/pp/rr/ss/tt/zz`；
- 辅音簇：`bl/br/cl/cr/dr/fl/fr/gl/gr/pl/pr/sc/sk/sl/sm/sn/sp/st/sw/tr/tw`；
- 三字母簇：`scr/spr/str/shr/thr/squ/sch`；
- 词尾：`able/ible/ance/ence/ous/ious/all`；
- 词尾稳定块：`ble/cle/dle/fle/gle/kle/ple/tle/zle`。

### 后缀位置约束

`-ed/-es/-ing/-ly/-est/-ous/-able/...` 只在**词尾**参与匹配，并设置最小长度；
避免：

```text
desk → d/es/k
bed  → b/ed
yes  → y/es
```

### 人工例外

新增 `SEGMENTATION_OVERRIDES`，只处理规则仍不稳定的词，例如：

```text
different      → d / i / ff / er / e / n / t
interesting    → i / n / t / er / e / st / ing
favourite      → f / a / v / ou / r / i / t / e
classroom      → cl / a / ss / r / oo / m
table          → t / a / ble
transportation → tr / a / n / s / p / or / t / a / tion
```

例外仍会校验：

```js
tokens.join('') === word.text
```

## 3. 修正后

- 全字母保底：316 / 1474；
- 最长切分块数：14；
- 平均块数：3.98；
- 组合库：152 项。

全字母保底仍然存在是合理的：`nice/five/name/home/...` 这类 CVC/CVCe 词按字母切分，
在没有引入“魔法 e”教学标注前，不应强行拼成非连续块。

## 4. 仍在观察的点

- `neighbourhood` 的 `our` 在非重读音节中读 /ə/，但文字上仍是 `our`；
- `countryside` 的 `tr` 跨音节，但作为 /tr/ 辅音簇可接受；
- 人名/地名（如 `stratforduponavon`）仍是字母级；
- 少量多音节词可能按拼写簇而非音节切分。

这些不影响“units 拼接 = text”和题型判定，但生产前仍应由教研人工确认。

## 5. 工程基础数据

词库是工程静态数据，不依赖运行时网络：

```text
src/content/words.json      1474 个词
src/content/graphemes.json  152 个组合
src/content/sentences.json  句子
src/content/confusables.json 混淆项
```

`contentVersion = 6`；应用首次启动从同源静态文件导入 IndexedDB。
词库本身随工程提交，上线包自带，不需要外部接口。
