# 决策记录（ADR）

对 DESIGN 未定义点或必须偏离点的裁决。一次偏离一篇；先写 ADR，再改代码。

| 编号 | 标题 | 状态 | 影响 |
|---|---|---|---|
| [0001](0001-storage-contract.md) | 存储契约、状态结构与内容 ID | Accepted | 7 个存储方法、errorProfile 数组、状态枚举、query 语义 |
| [0002](0002-docs-as-code.md) | 让设计文档贯穿开发过程 | Accepted | 追溯矩阵、代码头、架构守卫、阶段门 |
| [0003](0003-p1-runtime-boundaries.md) | P1 运行边界与题型判定上下文 | Accepted | 内容装配、迷你调度、judge bundle/now、不持久化 |
| [0004](0004-unit-granularity.md) | 选择单位的粒度（grapheme/letter/mixed） | Accepted（P3/P4 实现） | spec.params 粒度、字母 unit ID、错误画像、T-SEGMENT 分工 |
| [0005](0005-interaction-feedback.md) | 拖拽吸附/弹回与互动音效 | Accepted | 64px 吸附、240ms 弹回、Web Audio 轻音效、静音开关 |
| [0006](0006-difficulty-gradient.md) | 难度梯度与选题计算 | Accepted（权重 P3 校准） | grapheme < mixed < letter、难度向量、P3 DifficultyPolicy |

新增 ADR 的模板：

```md
# ADR-000N：标题

- 状态：Proposed / Accepted / Superseded
- 日期：
- 影响条款：DESIGN §x.y
- 相关文件：

## 背景
## 决定
## 后果
## 被否决的方案
```
