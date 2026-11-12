# ADR-0038：后台受控维护学习状态

- **状态**：Accepted
- **日期**：2026-11-12
- **影响条款**：DESIGN §2.3、§3.3
- **相关**：`LearningStateService`、`AdminApp`、`StateRepository`

## 背景

孩子可能已经在校外学过部分单词。家长/老师需要在首次使用时跳过已掌握内容，
或把旧单元标记为“复习中”，而不是从一年级重新开始。

此前后台只允许读学习状态，不能写 `wordStates`。

## 决定

### D1：只开放三个后台放置状态

```text
unstarted  未开始
reviewing  复习中
mastered   已掌握
```

不开放 `learning` / `probe`，它们仍由调度器和真实 attempts 决定。

### D2：受控服务

新增 `src/admin/LearningStateService.js`：

```text
AdminApp
  → LearningStateService
    → StateRepository(wordStates)
```

`AdminApp` 不直接 import `StateRepository`，不直接写 store。
所有写操作经过服务校验，并二次确认。

### D3：状态语义

- `unstarted`：保留旧 attempts，但当前视为没学过；
- `reviewing`：`intervalIndex=2`、due today，进入自动复习；
- `mastered`：`intervalIndex=MAX`、`dueDate=null`，不再自动复习。

写入 `source: 'admin-placement'`，便于识别来源。

### D4：单元状态

不新增 `unitStates` 表；单元状态由单词状态派生：

```text
全部 unstarted → 未开始
全部 reviewing → 复习中
全部 mastered  → 已掌握
混合           → 混合
```

后台单元操作批量写该 unit 下的词。

### D5：历史数据

- 不删除 attempts；
- 不删除状态记录；
- `unstarted` 是可逆的“重置为未开始”，不是物理删除；
- 真实答题后，状态会从 `unstarted/reviewing` 回到正常学习曲线。

### D6：安全

后台允许写学习状态后，必须只在本机/可信网络使用；
后续可加 PIN 或只绑定 loopback。目前 `/admin` 仍绑定 `0.0.0.0`，需在部署时限制访问。

## 后果

- 正面：可以先跳过已学年级，再进入正常调度；
- 正面：家长可纠正明显不符合实际的旧状态；
- 正面：保留历史 attempts；
- 负面：后台可以覆盖真实学习进度，需要操作确认与备份意识；
- 负面：`unstarted` 被真实练习后会重新积累状态。
