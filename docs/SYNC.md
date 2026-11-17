# 同步服务接入

## 目录

```text
default-workspace/
  spellwell/                 主应用
  indexDB-snapshot-sync/     自建快照同步服务
```

## 架构

```text
浏览器 A                          浏览器 B
IndexedDB A                       IndexedDB B
    │                                 │
    └──── /sync 同源代理 ──────────────┘
                   │
          http://helix:8787
          indexDB-snapshot-sync
```

- 调度、题型、判定仍然全部在浏览器；
- 服务器只保存 opaque snapshot，不参与业务；
- 浏览器通过同源 `/sync` 代理访问同步服务，避免 CORS；
- 同步失败时主应用继续离线运行。

## 启动

主应用：

```bash
cd default-workspace/spellwell
node tools/serve.mjs
# http://localhost:4173
```

同步服务已由另一台主机运行：

```text
http://helix:8787
```

`tools/serve.mjs` 默认代理：

```text
/sync/* → http://helix:8787/*
```

也可覆盖：

```bash
SYNC_SERVER_URL=http://127.0.0.1:8787 node tools/serve.mjs
```

## 首次 enrollment

打开：

```text
http://<spellwell-host>:4173/sync-setup
```

填入：

- Bootstrap Code；
- 用户名；
- 设备名。

成功后 device token 只保存到浏览器 `localStorage`，不会写入同步快照。

本次已经完成首个项目的 enrollment；一次性 code 已轮换。项目凭据保存在工作区外的本机文件：

```text
../sync-enrollment.local.json
```

权限为 600，不进入 Git，也不会被静态服务器提供。

原始 code（已失效，仅记录使用过）：

```text
BOOT-REV41qXQbBbxjxwnhBPAABdDrISGQ4Mm
```

> Bootstrap Code 是一次性的；使用成功后会轮换。不要把 token 或 code 提交到仓库。后续设备使用 `/sync-setup` 的 Pairing Code，或粘贴已有 Device Token。

## 第二台设备

在第一台设备打开 `/sync-setup`，点击“生成配对码”，
在第二台设备的 `/sync-setup` 使用该 Pairing Code。

同一项目的新用户可使用 Project ID，但会获得独立用户命名空间。

## 同步内容

`StorageAdapter.exportAll()` 的完整快照：

- 内容库：按 contentRevision 取较新一侧；
- attempts：按 id 取并集；
- wordStates / graphemeStates：按 updatedAt 取较新；
- meta：contentVersion/contentRevision/speedHistory 合并。

## 容错

- 初始同步最多等待约 2.5 秒；
- 服务不可用不会阻塞练习；
- 定时同步和 online 事件会重试；
- 409 revision conflict 最多重试 3 次；
- 任何同步错误只记录状态，不写入学习状态。

## 生产部署

浏览器所在静态站点需要把 `/sync/*` 反向代理到同步服务；
否则浏览器会因为跨域无法直接访问 `helix:8787`。

示例 Nginx：

```nginx
location /sync/ {
  proxy_pass http://helix:8787/;
  proxy_set_header Host $host;
}
```

不要把同步服务直接暴露到公网而不加访问控制。
