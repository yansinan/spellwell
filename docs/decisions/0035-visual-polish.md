# ADR-0035：P9 视觉收口与后台入口

- **状态**：Accepted
- **日期**：2026-11-12
- **影响条款**：DESIGN §6.2
- **相关**：`tokens.css`、`practice.css`、`PracticeScreen`、`PracticeSetupScreen`、`serve.mjs`

## 背景

练习页提示堆叠了 `Meaning / Sounds / Sentence / Word` 标签和重复 hint，
字体与按钮也偏装饰；后台入口仍是长路径 `/src/admin/index.html`。

参考 Duolingo 的简洁、圆角、强主按钮风格做收口。

## 决定

### D1：提示只留内容

```text
祖父 /ˈɡɹæmpɑː/
```

- 不再显示 `Meaning` / `Sounds` 标签；
- 中文主提示 + IPA 同屏辅助；
- T-TYPE 不显示目标词；
- 句子只留给 T-CLOZE。

### D2：减少重复文案

- T-TYPE/T-EDIT/T-JUDGE-FIX/T-CLOZE 不再显示重复 hint；
- 移除练习页的 `NEW WORD / REVIEW` 阶段小标题；
- 设置页移除 `PRACTICE SETUP` 和说明句；
- Mode 去掉 `Keep it steady / Try harder` 副文案。

### D3：字体与按钮

- 英文使用 rounded/system 字体栈，中文使用 PingFang/系统无衬线；
- 主按钮使用 token 绿色 + 底部实心阴影 + 16px 圆角；
- 按钮按下有 2px 下沉，不做强投影；
- 卡片圆角从 28px 收到 24px。

### D4：后台入口

- 静态服务器默认绑定 `0.0.0.0`；
- `/admin` 映射到 `src/admin/index.html`；
- admin HTML 使用 `<base href="/src/admin/">` 保证相对资源正确。

## 后果

- 正面：首屏更少文字，主操作更突出；
- 正面：后台地址更短；
- 负面：阶段信息只在计划/调试中，不在主界面突出显示；
- 负面：不引入 Web Font，仍依赖系统字体可用性。
