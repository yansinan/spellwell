# ADR-0041：浏览器 IndexedDB + 自建快照同步

- **状态**：Accepted
- **日期**：2026-11-17
- **影响条款**：DESIGN §5.3
- **相关**：`src/sync/`、`tools/serve.mjs`

## 决定

- 主应用继续使用 IndexedDB 和浏览器端 Scheduler；
- 同步服务只交换 opaque snapshot；
- 浏览器通过同源 `/sync` 代理访问服务，避免服务端 CORS 缺口；
- 快照 merge 在浏览器完成；
- 同步失败不阻塞练习，不做云端调度。

## 冲突策略

- attempts：并集；
- wordStates/graphemeStates：updatedAt LWW；
- 内容：contentRevision 较新者；
- speedHistory：按 at 去重合并；
- device token 不进入快照。

## 边界

- 不替换 StorageAdapter；
- 不改 Scheduler；
- 不上传设备 token；
- 生产环境必须配置 `/sync` 反向代理和访问控制。
