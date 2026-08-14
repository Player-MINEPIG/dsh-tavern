# Tavern Trace implementation

状态：2026-08-15，Phase 2 feature branch 实现说明。本文不是 README。

## 目标与边界

Tavern Trace 用来回答“这一轮 Tavern loader 选择了哪些资源、世界书条目为什么接受或拒绝、最后落到什么近似位置”。它不回答 provider 是否成功消费请求，也不取代 DSH 自己的 durable `request/header`。

实现遵守四条硬边界：

- 不构造 `user/message`、`assistant/message` 或 `tool/call`；
- 不向 Session append 自定义事件，不改写 `deriveMessages()`；
- 不保存 preset、character、user、world-book 正文、聊天历史、完整 system/header/tool payload；
- 只使用 DSH rc.6 公开的 client slot、Agent event 与 Session 读取面，不依赖 DOM、monkey patch 或私有 inbox。

## 公开 DSH API 核对

本机安装的 `@deepseek-ai/dsh 0.1.0-rc.6` 暴露：

- `conversation.view`：`list/session` slot；Trajectory 用 `id: "trajectory"` 注册同类标签页；
- `agent/request`：公开 payload 包含 `agent`、`turn`、`step` 和 `signal`；
- `session/event`：append 后的只读发布流；`Session.events`、`requestHeader()` 和 `deriveMessages()` 是公开读取面；
- `request/header`：一次 request epoch 的完整 config/system/tools 权威 snapshot。

虽然 `SessionEventMap` 在 TypeScript 层允许 declaration merge，rc.6 的 persistence reader 使用固定 `KNOWN_SESSION_EVENT_TYPES`，并明确说第三方注册面尚未提供。未知必需事件会使恢复拒绝；`Session.append()` 也没有供插件安全声明 ignorable envelope 的稳定调用契约。因此本阶段不写自定义 session event。

## 数据流

```text
systemPrompt.assemble
  └─ TavernProfileLoader.forAssembleContext()
       └─ exact assembly snapshot (in memory, per Agent)
              │
agent/request(turn, step) ── TavernTraceRecorder.begin()
              │                    └─ minimized metadata → tavern-traces.json
              ▼
DSH buildRequest()
  └─ request/header event ── public session/event observer
                               └─ seq + hashes + consistency booleans

GET /dsh-tavern/api/traces?sessionId=...
  └─ conversation.view / Tavern Trace
```

保存的 record 包含 `turn/step/attempt`、资源 id/name 摘要、profile 长度与 hash、支持的 Tavern call-config 字段、诊断、world-book budget 和 entry decisions。Entry decision 包含命中的主/附加关键词、secondary logic、概率阈值与显式 roll、token cost、接受/拒绝原因、请求位置与 loader 实际位置。

最终 header 仅保存 event seq、reason、header/system/config SHA-256，以及“本次 Tavern profile 是否存在”“Tavern 提议字段是否一致”的布尔值。完整 header 不进入插件文件或 API。

## 存储与恢复

默认文件是插件 data 目录下的 `tavern-traces.json`，权限模式与其他 Tavern JSON state 相同并使用临时文件 rename 原子替换。四个同时生效的默认限制是：128 个 session、每 session 128 条 record、每条 compact JSON 64 KiB、完整持久文件 8 MiB。Host config 可用 `trace.maxSessions`、`trace.maxRecordsPerSession`、`trace.maxRecordBytes`、`trace.maxTotalBytes` 收紧；四项硬上限分别也是 128、128、64 KiB、8 MiB，所以配置不能重新放大存储。`maxTotalBytes` 的安全下限是 1 KiB；无效或更小的值回退到 8 MiB 默认值。

每次事务先做 session/record 数量裁剪，再按 record 的 `updatedAt`、`recordedAt` 和确定性 session/index tie-break 跨 session 淘汰最旧记录，删除空 bucket，直到 `${JSON.stringify(state, null, 2)}\n` 的实际 UTF-8 字节数不超过 `maxTotalBytes`。预算检查与写盘复用同一份序列化字符串。即使 compact record 未超过 64 KiB，只要它连同最小 state envelope 不能单独装进总预算，也会在修改内存或磁盘前拒绝。单条审计还限制为 16 个 world-book 资源、合计 128 条 entry decision 和 64 条诊断。

写入只在临时文件成功 rename 后提交新的内存 state，避免 API 暴露未持久化状态。加载时会再次 normalization 和全局裁剪；若旧文件在可安全读取范围内但超过当前预算，会裁剪后重写。为避免旧版或外部损坏文件在启动时触发巨量 `readFileSync`/`JSON.parse`，超过 16 MiB 的 legacy trace 文件不会读入内存，而会重置为空状态并记录 Host warning。Trace 是可再生成的审计副本，这一安全恢复策略不会删除 DSH Session 或 Tavern 资源。

GET API 的 `storage` 元数据通常返回全部实际限制、`maxTotalBytes` 与当前 `persistedBytes`。单 session response 在发送前也按相同总字节上限检查；若 API envelope 使它超限，先省略 authority 和非必要 count 元数据，再只从响应副本移除最旧 record。唯一/最新 record 优先保留，极限 compact response 至少仍返回 `storage.maxTotalBytes`，且任何 response 裁剪都不改变持久状态。

### 同步写入延迟边界

正常请求仍有两次同步整文件事务：`begin()` 持久化 `awaiting-header`，`finalize()` 持久化 header 对齐。这样保留了 finalize 前崩溃时可恢复 pending record 的确定性。若同一 session 尚有未确认 record，`begin()` 会把 supersede 更新和新 record 合并到一次 `upsertMany()`，不再额外重写一次。没有后台 Promise 或异步丢写窗口。

每个事务写入不超过 8 MiB canonical JSON；预算判定前的工作 state 最多比已有预算多当前 batch（`begin()` 最多两条 64 KiB record）。每轮 I/O 是两次整文件 write/rename；CPU 还包括 `begin()` 的有界 list clone、每个事务的 canonical stringify，发生超预算时再增加候选排序、compact-size 遍历和精确重序列化等多个有界 pass，不能简化为只有两次序列化。实际 wall-clock 延迟没有硬上界，会受磁盘、杀毒软件和网络文件系统影响，并会同步阻塞 Node event loop。`traceSafely` 只保证存储错误不否决模型请求，不能消除这段阻塞；部署者可进一步收紧 `maxTotalBytes`。临时文件 rename 防止正常进程崩溃留下半份 JSON，但没有 `fsync`，不承诺断电持久性；替换期间旧文件与临时文件还可能短暂占用接近两倍总预算的磁盘空间。

进程在 header 对齐前退出时，已创建的 `awaiting-header` record 仍可恢复，但不会虚构 header link。页面刷新、session 切换或宿主重启后，view 重新 GET 插件 API。插件不承诺把 trace 跟随 DSH fork/compaction 复制：每个 session 只记录该 session 自己实际进入 `agent/request` 的轮次。

## Client view

浏览器入口通过 `ctx.slots.inject('conversation.view', ...)` 注册 `id: "tavern-trace"`、`order: 20`。它只使用 slot 注入的 `sessionId/useSession` 和同源 GET API；不查询 Conversation/Trajectory DOM，不覆盖它们的 seat，也没有 MutationObserver。

正文没有“显示完整内容”开关。用户需要确认最终 system/config 时应查看 DSH request/header；Trace 只提供资源组合和 matcher 决策解释。

## 已知限制

- rc.6 的 header 事件在请求 dispatch 前写入；header 对齐证明 DSH 构造了该请求边界，不证明 provider 成功返回。
- header 未变化时 DSH 会沿用上一条 header event；Trace 在第一条 assistant event 或 request error 上引用最近 header 并标记 reused。
- 在公开 same-turn input seam 出现前，world-book 仍按 system assembly 当时可见的 durable history 匹配；Trace 特意复用 exact assembly snapshot，不用稍后的当前输入重新计算。
- 当前 main 基线只有角色内嵌 world book；独立书和 user profile 接入后可直接填充同一 resources/decision schema。
