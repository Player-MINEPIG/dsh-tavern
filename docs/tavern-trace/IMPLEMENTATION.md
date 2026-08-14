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

默认文件是插件 data 目录下的 `tavern-traces.json`，权限模式与其他 Tavern JSON state 相同并使用临时文件 rename 原子替换。默认最多保存 128 个 session、每 session 128 条 record、每条 256 KiB；可用 Host config `trace.maxSessions`、`trace.maxRecordsPerSession`、`trace.maxRecordBytes` 收紧。单条审计还限制为 16 个 world-book 资源、合计 128 条 entry decision 和 64 条诊断。超限 session/record 按最近更新时间和顺序裁剪；超大单条拒绝写入且 Trace 捕获错误，不阻断模型请求。

进程在 header 对齐前退出时，已创建的 `awaiting-header` record 仍可恢复，但不会虚构 header link。页面刷新、session 切换或宿主重启后，view 重新 GET 插件 API。插件不承诺把 trace 跟随 DSH fork/compaction 复制：每个 session 只记录该 session 自己实际进入 `agent/request` 的轮次。

## Client view

浏览器入口通过 `ctx.slots.inject('conversation.view', ...)` 注册 `id: "tavern-trace"`、`order: 20`。它只使用 slot 注入的 `sessionId/useSession` 和同源 GET API；不查询 Conversation/Trajectory DOM，不覆盖它们的 seat，也没有 MutationObserver。

正文没有“显示完整内容”开关。用户需要确认最终 system/config 时应查看 DSH request/header；Trace 只提供资源组合和 matcher 决策解释。

## 已知限制

- rc.6 的 header 事件在请求 dispatch 前写入；header 对齐证明 DSH 构造了该请求边界，不证明 provider 成功返回。
- header 未变化时 DSH 会沿用上一条 header event；Trace 在第一条 assistant event 或 request error 上引用最近 header 并标记 reused。
- 在公开 same-turn input seam 出现前，world-book 仍按 system assembly 当时可见的 durable history 匹配；Trace 特意复用 exact assembly snapshot，不用稍后的当前输入重新计算。
- 当前 main 基线只有角色内嵌 world book；独立书和 user profile 接入后可直接填充同一 resources/decision schema。
