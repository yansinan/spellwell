# 词库常见相似音/相似拼写组合

> 目标不是增加“四选一”，而是让 T-FILL/T-MATCH 的候选有真实迷惑性。

## 核心对照

| 目标组合 | 常见错误 | 词库例子 | 易混组合 |
|---|---|---|---|
| ir | berd / burd | bird | er, ur |
| er | birt / burt | water | ir, ur |
| ur | birt / bert | turn, hurt | ir, er |
| ea | bred / brad / grean | bread, weather | ee, e, a |
| ee | grean / grene | green | ea, e |
| ai | rayn / rane | rain | ay, a |
| ay | rai / pla | play | ai, a |
| oa | bowt / bote | boat | ow, oe, o |
| ow | snoa / snou | snow, cow | oa, ou |
| ou | howse / hoose | house | ow, oo |
| oi | boy / boi | coin, boy | oy |
| oy | coi / coin | boy | oi |
| oo | bouk / bewk | book | ou, ue, ew |
| ue | blewe / bloo | blue | ew, oo |
| ew | bloo / blue | new | ue, oo |
| au | awtumn | autumn | aw |
| aw | sau / saw | saw | au |
| igh | nite / niet | night | ie, i |
| ch | ship | chip | sh, tch |
| sh | chip | ship | ch |
| ck | duk / duc | duck | k, c |
| ph | fone | phone | f |
| wh | wat | what | w |
| kn | now / nite | know | n |
| wr | rite | write | r |
| dge | brige | bridge | ge |
| mb | lam | lamb | m |
| tion | sion | action | sion |

## 词级例子

```text
bird  → berd（er） / burd（ur）
bread → bred（e） / brad（a）
green → grean（ea）
boat  → bowt（ow） / bote（o）
night → nite（ie）
phone → fone（f）
```

这些错词不一定在词库中，只用于说明“为什么这些组合容易混”。

## 应用方式

### T-FILL

正确答案是 `ir` 时，候选会优先加入：

```text
ir / er / ur
```

而不是随机 `ch`、`tion`。

### T-MATCH

目标组合为 `ir` 时，干扰词优先选含 `er/ur` 的词；
目标为 `ea` 时，优先选含 `ee/e/a` 的词。

## 边界

- 只为干扰项服务，不修改 `units`；
- 不判定“错词”本身；
- 纯音标提示仍按低年级策略关闭，避免用 IPA 代替拼写线索。
