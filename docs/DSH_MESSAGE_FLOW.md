# DSH message flow with dsh-tavern

状态：2026-08-15，基于本机 `@deepseek-ai/dsh 0.1.0-rc.6` 的公开 README 与已安装源码核对。本文描述一次普通 agent 模型 step 的数据流，以及 `dsh-tavern` 实际改变和不改变的部分；它不是 README。

## 1. 未安装插件时的 DSH 默认消息流

```text
用户提交
  │
  ▼
Agent Inbox（next-turn / next-step，持久 splice）
  │ claim
  ▼
agent/pre-step
  ├─ systemPrompt.assemble(agent scope)
  │    ├─ 收集并排序 system sections
  │    ├─ 收集 runtime contexts
  │    ├─ 收集 tools 与 variables
  │    └─ system-prompt/assemble waterfall
  └─ 接受、替换或拒绝本步骤 user messages
       │
       ▼
Session 追加 user/message → deriveMessages()
       │
       ▼
agent/request waterfall → LLM call config
       │
       ▼
记录 request/header（config + system + tools）
       │
       ▼
llm.stream({ system, messages, tools, ...config })
       │
       ├─ assistant/chunk 持久事件
       ├─ assistant/message 进入 Session 历史
       └─ tool-call 时执行工具，并可能进入下一 step
```

关键事实：

- Inbox 中的用户消息先被 `claim`，但 `systemPrompt.assemble()` 执行时它尚未追加成 `Session` 的 `user/message`。
- `Session.deriveMessages()` 从持久 message surface 投影 user、assistant 和 tool result，是最终请求 `messages` 的权威来源；turn/step 边界和流式 chunk 本身不会重复变成消息。
- system prompt、runtime context、工具 schema 与普通历史是不同通道。组装后的 system 字符串作为请求的 `system` 字段，历史作为 `messages` 数组。
- `agent/request` 只提议 provider/model/reasoning/temperature/maxTokens/stop 等 call config；它不负责生成消息历史。
- 生效的 config、system 和 tools 在发生初始/恢复/变化时写入持久 `request/header`。因此 `request/header` 是审计“该轮模型实际获得什么 system/config”的权威记录。
- assistant 流先记录为 `assistant/chunk`，成功结束后再产生完整 `assistant/message`。工具调用会让循环执行工具，并可能带着 tool result 进入同一 turn 的后续 step。

本机核对位置：

- `@deepseek-ai/dsh-agent-loop/lib/index.js`：`preStep()`、`turn()`、`step()`、`buildRequest()`；
- `@deepseek-ai/dsh-system-prompt/lib/index.js`：`SystemPrompt.assemble()`；
- `@deepseek-ai/dsh-session/lib/index.js`：`Session.deriveMessages()`；
- `@deepseek-ai/dsh-llm/README.zh.md`：消息、call config 与 `request/header` 契约。

## 2. 安装 dsh-tavern 后增加的路径

插件不替换 DSH agent loop，也不维护第二份聊天历史。它只在两个公开 waterfall 和一个 system section 上贡献内容：

```text
SessionSelectionStore（当前 session 的 preset / character / world-info）
  │
  ├─ preset adapter ───────────────┐
  ├─ character adapter ────────────┼─ TavernProfileLoader.compile()
  └─ World Info matcher            │       │
      （扫描既有 deriveMessages）──┘       ├─ dsh-tavern:profile system section
                                          ├─ diagnostics / audit fingerprint
                                          └─ supported call config

DSH systemPrompt.assemble()
  ├─ DSH identity/persona/tool sections
  └─ dsh-tavern:profile
       │
       ▼
request/header.system

DSH agent/request
  └─ 合并 preset 支持的 temperature/maxTokens/reasoningEffort/stop
       │
       ▼
request/header.config
```

具体变化：

1. `agent/session-start` 时，loader 为 session 固化资源选择。普通 fork 复制父会话当时的选择；delegated subagent 默认选择为空。
2. `systemPrompt.assemble()` 调用 `dsh-tavern:profile` section 时，loader 读取该 session 的 preset 和角色卡。
3. 若角色卡含 `character_book`，世界信息 adapter 扫描已经存在于 `Session.deriveMessages()` 的 user/assistant 文本，执行关键词、secondary key、regex、概率、组和预算策略。
4. preset marker、角色字段与命中 lore 被组合为一个 Tavern profile。creator notes 永远不进入 profile；`chatHistory` marker 被消费但不复制历史。
5. 默认 append 模式把 Tavern profile 放在 DSH 其他 system sections 之后。高级 replace 模式只保留 Tavern profile，但仍保留 tools、runtime contexts、variables 和执行层安全机制。
6. `agent/request` 将 DSH 已公开支持的 preset 参数投影到 call config。未公开的 ST sampler 仅保存，不伪造已经生效。

## 3. 插件明确不改变的内容

- 不删除、重写或复制 DSH durable history；请求 `messages` 仍完全来自 `Session.deriveMessages()`。
- 不把 preset 中标记为 user/assistant 的静态 prompt 伪装成真实历史；它们目前只是 system profile 中可审阅的标签块。
- 不把 greeting 写成一条虚构的 assistant 历史；当前仅作为明确标注的风格参考。
- 不发送 creator notes。
- 不让 UI 菜单、未实现的用户/persona 面板或未接线的独立世界信息 ID 产生占位 prompt。
- 不绕过 DSH 的工具权限、沙箱或审批。replace 模式会移除模型可见的部分宿主说明，但不会关闭执行层限制。

## 4. 为什么同轮 World Info 可能晚一轮触发

DSH 当前顺序是：`claim 当前输入 → assemble system prompt → agent/pre-step 接受 → 把输入追加到 Session`。loader 在 assemble 阶段只能从公开的 `deriveMessages()` 读取已经持久化的历史，因此此刻通常还看不到刚被 claim 的当前用户输入。

结果是：

- 历史中已有关键词：本轮可以命中；
- 关键词只出现在刚提交的当前输入：通常在下一模型 step（例如工具继续）或下一 turn 才可见；
- 解绑角色卡：下一次 assemble 不再解析其 `character_book`，对应 lore 随即停止进入后续请求，但已经受其影响的旧 assistant 文本仍属于历史。

若将来要实现严格同轮匹配，应在 `agent/pre-step` 取得已 claim messages 后构造可审计、可重建的注入，而不是读取 Agent 私有 inbox 或修改历史。

## 5. 如何审阅一次真实请求

按可信度从高到低：

1. DSH 持久 `request/header`：最终 system、tools 和生效 call config；
2. 请求对应的 `Session.deriveMessages()`：最终历史消息数组；
3. loader `/dsh-tavern/api/active?sessionId=...`：选择、资源、诊断和无当前输入的预览 audit；
4. 前端侧栏状态：用于操作和解释，不是模型请求事实。

`active` API 没有活跃 Agent 的已 claim 当前输入，因此世界信息侧栏会把命中数明确标为“无会话历史预览”，不能代替真实 `request/header`。
