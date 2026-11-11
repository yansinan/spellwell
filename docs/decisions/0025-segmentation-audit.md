# ADR-0025：基础词库切分审计与组合库扩充

- **状态**：Accepted
- **日期**：2026-11-12
- **影响条款**：DESIGN §2.3、CONTENT_SPEC
- **相关**：`WordImporter.js`、`graphemes.json`、`words.json`

## 背景

基础词库从 583/891 词导入后发现大量“全字母保底”切分，
典型问题是后缀被任意位置匹配：`desk → d/es/k`、`bed → b/ed`、`yes → y/es`。

## 决定

### D1：组合库从 96 扩到 152

新增双写辅音、辅音簇、三字母簇、词尾块。

### D2：后缀只在词尾匹配

`-ed/-es/-ing/-ly/-est/-ous/-able/...` 必须满足：

- 结束于词尾；
- 达到最小词长；
- `tokens.join('') === word.text`。

### D3：人工例外表

`SEGMENTATION_OVERRIDES` 只覆盖规则不稳定的高频词；
例外同样通过拼接校验。

### D4：词库随工程发布

`src/content/words.json` 是工程静态基础数据：
1474 词、152 graphemes、contentVersion 6；
上线包自带，运行时只从同源静态文件导入 IndexedDB。

## 结果

- 全字母保底 433 → 316；
- 最长块 16 → 14；
- 平均块 4.25 → 3.98；
- `classroom/different/desk/table/small` 等已修正。

全字母保底不为 0 是合理的：CVC/CVCe 词在没有魔法 e 标注前按字母切分是可接受的。

## 约束

- 自动切分仍是后台草稿；人工确认后才应 `reviewed`；
- 不能为了“好看”破坏 `units.join('') === text`；
- 词库是静态工程数据，不引入运行时外部词典/网络依赖。
