# DSH 与 dsh-tavern（DT）消息流

[English](DSH_MESSAGE_FLOW_en.md)

本文描述 Tavern **2.3.0 候选**在 DSH `0.1.5-rc.1` 上的当前消息合同：DSH
原生流程、DT 自身流程、DT 的介入点，以及一次完整模型 step。V3 的系统提示词以
`system/message` 进入有效消息 surface，`request/header` 保留 config/tools；Trace schema 4
只持久化 metadata 与官方 Session 引用，并由 [v3 API](PROMPT_API_V3.md) 按需验证正文。

Tavern Host adapter 显式调用 session/workspace/directory-picker controllers。history 先用
`inspect()` 固定 inclusive `throughSeq`，再以 `page()` 读完同一快照；进程内事件读取使用
`session.seq`、`snapshotEvents()` 与 `ownEvents()`。会话坐标与迁移规则见
[升级指南](DSH_0.1.5_MIGRATION.md)。

本文中的 `DT` 是 `dsh-tavern` 的简称。SillyTavern（ST）是 DT 兼容的资源格式与部分语义来源，不是本插件或其界面的产品身份。

## 1. DSH 原生 flow

未安装 DT 时，DSH `0.1.5-rc.1` 的普通 agent step 按以下顺序工作：

```text
用户提交
  │
  ▼
Agent Inbox（next-turn / next-step）
  │  插入/编辑/取消与 claim 均记录 agent/inbox/spliced
  ▼
systemPrompt.assemble(agent scope)
  ├─ 收集并排序原生 system sections
  ├─ 收集 runtime contexts、tools 与 variables
  └─ 执行 system-prompt/assemble waterfall
  │
  ▼
DSH 把装配结果写入有效消息 surface
  ├─ system sections → 官方 system/message
  └─ runtime contexts → 带来源 metadata 的官方 user/message snapshot
  │
  ▼
agent/pre-step waterfall
  └─ 接受、替换或拒绝本步骤 claimed messages
  │
  ▼
Session 追加已接受的 user/message
  │
  ▼
Session.deriveMessages() 生成有效消息数组
  │
  ▼
agent/request waterfall 生成 LLM call config
  │
  ▼
prepareCall() 校验配置；request/header 记录最终 config + tools
  │
  ▼
llm.stream({ messages, tools, ...config })
  │
  ├─ assistant/chunk 持久事件
  ├─ assistant/message 进入 Session 历史
  └─ tool-call → tool result → 可能进入同一 turn 的下一 step
```

当前请求有四类权威输入：

| 通道 | 权威来源 | 最终去向 |
| --- | --- | --- |
| system 与 runtime context | `systemPrompt.assemble()` 产出的官方 `system/message` / context `user/message` | LLM 请求的 `messages` |
| 会话历史 | `Session.deriveMessages()` 的有效 message surface | LLM 请求的 `messages` |
| 工具 | system assembly 的 tools | LLM 请求的 `tools` 与 `request/header.tools` |
| 模型参数 | `agent/request` waterfall | provider/model/temperature 等 call config 与 `request/header.config` |

关键事实：

- Inbox 先 `claim` 当前输入，但 system assembly 执行时，该输入尚未追加为普通 Session
  `user/message`。Inbox 的插入、替换、取消和 claim 会先持久写入公开的
  `agent/inbox/spliced`；DT 从这些事件重建有界队列，并在 claim 删除事件之后、system
  assembly 之前得到本次 batch。
- DSH 完成 system assembly 后才调用公开的 `agent/pre-step`。该 hook 能看见 claimed
  messages，但不能回写已经冻结的装配。
- `Session.deriveMessages()` 从当前有效 message surface 投影 system、context、user、
  assistant 与 tool 内容；turn/step 边界和流式 chunk 不会重复成为模型消息。
- `agent/request` 只负责 call config，不生成历史，也不能替换已冻结的 system assembly。
- V3 的系统正文权威是有效 `system/message`，context 正文权威是对应 `user/message`
  snapshot。`request/header` 记录最终 config 与 tools，不保存 system 正文。
- `llm/stream` 接收最终运行时 messages/tools/config；观察该 hook 可以核对实际请求形状，
  但不会自动建立第二份持久历史。

代码核对位置：

- `@deepseek-ai/dsh-agent-loop/lib/index.js`：`preStep()`、`turn()`、`step()`、`buildRequest()`；
- `@deepseek-ai/dsh-system-prompt/lib/index.js`：`SystemPrompt.assemble()`；
- `@deepseek-ai/dsh-session/lib/index.js`：`Session.deriveMessages()`；
- `@deepseek-ai/dsh-llm/README.zh.md`：messages、call config、`request/header` 与 `llm/stream` 合同。

### 1.1 为什么周目分支没有使用 message surface replacement

DSH 的 Session 同时保留 append-only 事件日志和 model-visible message surface。surface replacement 不删除原事件，而是追加一个新 message 节点，用它遮蔽当前 surface 上的一段连续节点。替换节点本身仍是当前 surface 节点，因此以后可以再次被 replace；已经被遮蔽的原始 user、assistant 和 tool 事件则继续留在本地 Session 日志中，可供 transcript、审计和重新计算使用。

这项能力仍不是可逆的 ST 式历史重组接口：

- 后续 replacement 只能定位当前 surface 上仍可见的节点，不能执行 `unreplace` 让旧节点原位重新可见；
- 一次 replacement 是“连续区间 → 一个新 message”，不能原子返回多条 user/assistant 交替消息；
- `agent/request` 只改变 call config，当前也没有公开的 per-request history waterfall 可在不写 Session 的情况下返回任意 `messages[]`；
- 用单个 user checkpoint 承载整段 RP 对话会丢失原生 role、tool-call/result 和逐消息 action 边界；把原文复制成多条新消息又会制造第二份 durable history，并需要额外的原子性和并发协议；
- DSH 原生 compaction 也使用同一 surface replacement。DT 若再把它当分支树使用，会让两种不同语义争用同一个 model-visible surface。

因此 DT 的 swipe、同周目回退和分支新周目采用 DSH 公开 session branch/fork 能力创建 continuation session，而不是改写原 session surface。每个分支都拥有 DSH 原生可解释的历史、工具配对、请求头和独立 compaction；原生“对话”视图、其他插件和卸载后的 Host 仍能按普通 DSH session 工作。Tavern timeline 只保存这些权威消息的指针、父 variant 与活动 head，用多个 session 组合出周目树，不伪造或复制历史正文。

当前 DSH 没有 request-time arbitrary `messages[]` history projection，也没有原子的多 message surface replacement。因此 DT 的 system/context 注入不等同于历史替换，严格 ST role/depth 投影不属于当前能力。

## 2. DT 自己的 flow

DT 将“资源管理”和“运行时装配”分开。前端及 API 属于控制面，不直接给模型发送消息；loader 才是运行时数据面。

### 2.1 控制面：导入、编辑与 session 绑定

```text
DT 悬浮球 / 资源侧栏
  │
  ▼
/pmp-dsh-tavern/api/v1/*
  │
  ├─ PresetStore
  ├─ CharacterStore
  ├─ WorldBookStore
  ├─ UserStore
  ├─ SessionSelectionStore
  │    └─ 当前 session 显式绑定的 preset / character / world books / user
  └─ UserWorldBookBindingStore
       └─ 每个用户绑定的零本或多本独立世界书
```

- 导入的 ST 预设、角色卡与世界书先经过各自 format adapter，归一化后进入插件资源库；未知兼容字段不参与 DSH session history。
- 创建、编辑、删除和绑定只改变 DT 的资源或选择状态。未绑定资源不会进入 prompt。
- 普通 fork 与 delegated subagent 都固化父会话当时的资源选择；委派任务是否收窄由主 agent 的 spawn 提示决定。
- UI 的红/绿点表示“当前 session 是否绑定资源”，不表示世界书是否在本轮命中。

### 2.2 数据面：把已绑定资源装配为运行时快照

```text
SessionSelectionStore
  │
  ├─ preset adapter ───────────────┐
  ├─ character adapter ────────────┤
  ├─ user adapter ─────────────────┼─ TavernProfileLoader.compile()
  └─ world-book adapter ───────────┘          │
       ├─ 独立世界书                           ├─ systemText
       ├─ 角色卡内嵌 character_book            ├─ runtimeContexts
       └─ matcher 扫描历史 + 本次 claimed 输入    ├─ supported callConfig
                                                ├─ resources / diagnostics
                                                └─ audit + fingerprint
```

装配规则：

1. loader 按 session 解析 preset、角色卡、用户资料、独立世界书与角色卡内嵌书；session 显式世界书优先，随后追加当前用户绑定的世界书并按 ID 稳定去重。
2. world-book matcher 扫描公开的 `Session.deriveMessages()` 历史与 `PendingInputProjection` 提供的本步骤 claimed 输入，稳定去重后默认最多最近 64 KiB；执行普通主关键词、secondary key、概率、组与预算策略。原生 JavaScript regex 默认阻断，避免 ReDoS。
3. 统一装配器按 preset marker 放置角色字段、用户名字/描述与命中 lore。`{{user}}` 使用当前用户名字；描述只消费一次 `personaDescription`/`{{persona}}`；`chatHistory` marker 不复制 DSH 历史；creator notes 不发送。
4. 结果是一个不可混淆的运行时快照：`systemText`、受支持的 `callConfig`、资源摘要、诊断、世界书决策和审计指纹。
5. 新 v1 审计与 v3 装配 metadata 共用 schema 4 record；llm/stream 核对结果只落 hash/引用，详情冷读官方历史并验证恢复段落/context 正文，`source.text` 不保存。旧 v1/schema 3 文件只读兼容。

## 3. DT 对 DSH flow 做了什么改动

DT 不替换 agent loop，也不维护第二套会话历史。它通过 DSH 的公开扩展点进行以下加法：

| DSH 扩展点 | DT 的动作 | 对最终请求的影响 |
| --- | --- | --- |
| `agent/session-start` | 为 agent 建立或恢复 session 资源选择；RP 开启时钉只读沙箱 | 决定本 session 可加载哪些 DT 资源，以及是否进入 RP 锁 |
| `systemPrompt.section` | 注册 `pmp-dsh-tavern:profile`（order 10）锚点与 `rp:policy`（order 45） | 让 waterfall 接收本次 Tavern 装配与可选 RP 锁说明 |
| `system-prompt/assemble` | 把逻辑 profile 锚点展开为有序 `pmp-dsh-tavern:part:*` sections，并独立追加 import runtime contexts；高级 replace 只保留这些 parts 与 `rp:policy` | 决定本步骤写入官方 system/context messages 的内容，不改普通历史与工具执行权限 |
| `agent/pre-step` | RP 边界提交待处理开关，并再次钉只读沙箱 | 不改 messages；保证聊天栏改权限无法在下一步前解开 RP |
| `tools.guard` | RP 开启时拒绝高风险工具并 `agent.cancel` | 不进入执行；告警弹窗记在父会话（子 agent 违规时） |
| `agent/request` | 合并 preset 中 DSH 明确支持的 call config；用本次 assembly metadata 建立共享 schema 4 记录 | 可改变 temperature/maxTokens/reasoningEffort/stop 等；不改 messages |
| `llm/stream` | 核对完整 system message 并建立官方 system/context event 引用 | 不复制正文；让 v3 详情可按需冷读并验证官方历史 |
| `session/event` | 对齐旧格式 Trace 与请求事件；RP 开启时若看到 `sandbox/mode` 再次钉只读 | 只增加插件审计元数据；聊天栏改权限无法解开 RP |
| `agent/request-error` | 标记相应 Trace 尝试失败 | 不改变模型输入 |
| Web server / client slots | 提供受保护的资源 API、`DT` 悬浮球、侧栏与 Tavern Trace 视图 | 控制面与可视化；不直接进入 prompt |

loader 通过 `session/event` 处理公开 `agent/inbox/spliced`，建立不持久化正文的 `PendingInputProjection`。该投影只影响世界书激活判断，不改变最终 DSH messages。

默认 append 模式下，DSH 原有 system sections 仍然存在，waterfall 将 DT 逻辑 profile 展开为按原顺序排列的 `pmp-dsh-tavern:part:*` sections；RP 开启且 `rp:policy` 非空时再插入 order 45 的锁说明。高级 replace 模式从模型可见的 system 文本中移除其他 section，只保留这些 DT parts 与 `rp:policy`。import runtime context 仍是独立 context contribution；tools、其他 runtime contexts、variables、沙箱、审批与执行层安全限制继续由 DSH 管理。RP 在此之上再拒绝一部分工具，不能用聊天栏权限芯片解开。

DT 明确不做以下改动：

- 不删除、重写或复制 DSH durable history；最终 `messages` 仍来自 `Session.deriveMessages()`。
- 不把 preset 中标成 user/assistant 的静态块伪装成真实历史消息。
- 不把 greeting 伪造成 assistant 历史；首轮只作为普通 system 正文，来源关系记录在 Tavern Trace metadata 中。
- 不覆盖 DSH Agent 身份；用户资料只提供 Tavern 用户名字与描述。
- 不发送 creator notes。
- 不绕过 DSH 的工具权限、沙箱或审批。RP 额外拦住一部分高风险工具，清单见 `docs/RP_SECURE_MODE.md`。
- 不向 Session 写入伪造的 Trace、未知事件或第二套对话记录。

## 4. 安装 DT 后的完整 flow

控制面保存资源与 session 选择；一次模型 step 只在 loader/Host seam 中读取这些状态：

```text
【请求前：DT 控制面】
用户在 DT UI 导入/编辑资源
  → /pmp-dsh-tavern/api/v1/*
  → 插件资源库
  → SessionSelectionStore 保存当前 session 绑定

【一次模型 step】
用户提交
  │
  ▼
DSH Agent Inbox
  │ claim 当前输入；公开删除 splice 让 DT 暂存该 batch
  ▼
DSH systemPrompt.assemble(agent scope)
  │
  ├─ 收集 DSH 原生 system sections / contexts / tools / variables
  │
  ├─ 调用 DT 的 pmp-dsh-tavern:profile contribution
  │    ├─ 读取该 session 的资源选择
  │    ├─ 解析 preset / character / user / world books
  │    ├─ matcher 扫描 deriveMessages() + 去重后的本步骤 claimed batch
  │    ├─ 按 marker 装配角色字段、用户描述与已命中 lore
  │    └─ 展开为有序 pmp-dsh-tavern:part:* sections；保留 call config/audit metadata
  │
  └─ system-prompt/assemble waterfall
       ├─ append：保留 DSH sections，并加入 DT sections/contexts
       └─ replace：模型可见 system sections 只保留 DT parts 与 rp:policy；能力和执行层限制仍保留
  │
  ▼
DSH 把冻结的装配写为官方 system/message 与 context user/message snapshot
  │
  ▼
DSH agent/pre-step
  └─ 接受/替换/拒绝 claimed 当前输入
  │
  ▼
DSH Session 追加已接受的 user/message
  │
  ▼
DSH Session.deriveMessages() 生成最终 effective messages
  │
  ▼
DSH agent/request
  ├─ DSH/其他插件生成基础 call config
  ├─ DT 合并受支持的 preset 参数
  └─ Trace 以本次装配 metadata 开始共享 schema 4 record
  │
  ▼
DSH prepareCall() 校验并冻结模型配置
  │
  ▼
DSH 记录 request/header（最终 config + tools）
  │
  ▼
DSH llm/stream 接收最终 messages / tools / config
  └─ Trace 核对完整系统消息，并为官方 system/context events 建立引用
  │
  ▼
assistant stream / tool calls
  ├─ chunk 与完整 assistant message 由 DSH 持久化
  ├─ tool result 仍由 DSH 管理
  └─ 下一 step/turn 重新装配；DT 不缓存第二份聊天历史
```

当前模型请求可简化为：

```text
request.messages = DSH effective message surface
  ├─ native + DT official system/message
  ├─ official runtime-context user/message snapshots
  └─ durable user / assistant / tool messages
request.tools    = DSH assembly tools
request.config   = DSH/adapter 配置 + DT 可映射的 preset 参数
request/header  = config + tools 的持久审计事件
```

append/replace 只改变进入 effective messages 的 system sections；messages、tools 与 config 仍由
DSH 的官方 surface 和 waterfall 拥有。Trace 新记录不保存 section/context/system-message/
source 正文副本，只保存 metadata、hash 与官方逻辑事件引用；详情按需 cold inspect 并验证恢复
section/context 正文。

## 5. 当前 ActivationContext 边界

DSH 当前顺序是：

```text
claim 当前输入
  → assemble 并冻结 system prompt
  → agent/pre-step 才公开 claimed messages
  → 追加 user/message
  → agent/request / request/header
```

当前 DT 在 system assembly 时扫描有界 `ActivationContext`：

- 关键词已在历史中：本步骤可以命中并注入；
- 关键词只在刚提交的当前输入中：本步骤首次 assembly 即可命中；
- 解绑角色卡或独立世界书：下一次 assembly 不再读取它，但已经受其影响的旧 assistant 文本仍属于历史。

不能仅把 Tavern Trace 的扫描推迟到 `agent/pre-step`、`agent/request` 或 `request/header`：此时虽然能看见当前输入，但 system 已冻结。晚扫描会让 Trace 显示“本轮命中”，而同一步官方 `system/message` 实际没有该 lore，形成错误审计。DT 因此记录真正参与该请求的 assembly，不把事后推演冒充本轮激活。

实现使用的公开顺序是：

```text
agent/inbox/spliced（插入消息）
  → loader 投影 next-turn / next-step 队列
  → claim 产生删除 splice（outcome 不是 canceled）
  → loader 暂存本次 claimed batch
  → systemPrompt.assemble
  → ActivationContext = durable history + claimed batch
  → world-book matcher
  → 本 step 的真实 Tavern sections / Trace metadata candidate
```

该路径已实现，并保持以下约束：

- `PendingInputProjection` 只存在于 loader Host 层；format、world-book、character、user 和 UI 不分别订阅或复制 Inbox 状态；
- 按 splice 的 `target/start/removedCount/inserted/outcome` 精确处理插入、替换、取消、steer、next-step 和排队 next-turn；
- 当前输入正文只作有界内存匹配输入，不写入 DT 资源、selection 或 Tavern Trace；DSH 自己的 durable inbox event 仍是来源权威；
- assembly 完成、取消、异常或 agent/session 结束后清理 claimed batch，下一 step 已进入 history 的消息不得重复拼接；
- Trace 在 `agent/request` 记录真正参与本次请求的 assembly metadata，并在 `llm/stream` 建立经过正文核对的官方历史引用；它不在事后重跑 matcher；
- 不读取 Agent 私有 Inbox、不提前 append `user/message`、不增加空转模型请求，也不把 lore 伪装成额外 user message。

## 6. 如何审阅一次真实请求

按可信度从高到低：

1. DSH 官方 `system/message` 与 context `user/message`：本次装配实际进入有效消息面的提示词正文；
2. DSH 持久 `request/header`：最终 tools 与生效 call config；
3. 请求对应的 `Session.deriveMessages()`：最终有效消息数组；
4. Tavern Trace：解释该 turn/step 使用的 DT 资源、世界书决策和官方引用，并在详情读取时验证可恢复正文；
5. loader `/pmp-dsh-tavern/api/v1/active?sessionId=...`：当前选择、资源、诊断和不含 claimed 当前输入的预览；
6. DT 侧栏：资源编辑和绑定控制面，不是模型请求日志。

Tavern Trace 位于 Conversation / Trajectory 同级的公开 `conversation.view` 槽中。它是对实际 loader snapshot 的最小化解释层，不取代官方消息或 `request/header`，也不会进入模型上下文。

## 7. 干净会话与 UI 设置为何不进入消息流

“维持当前 Tavern 设置新开对话”和配置模板属于显式控制面事务：

```text
预检当前选择或模板
  → DSH 模式：uiWorkspace.connectWorkspace() 返回真实 blank session
    魔丸模式：按预检中的角色复用共享周目控制器，创建或复用权威空周目
  → loader 原子写入完整 Tavern selection
  → 魔丸模式回读校验 session 角色与周目角色一致
  → DSH sessions.open() 导航
```

模板只保存 preset、角色/greeting 开关、用户、独立世界书和 RP 叠加的资源 ID/选项；不会读取或复制 durable messages、Tavern Trace、Inbox、claimed input、turn/step 或资源正文。魔丸模式要求该投影含角色卡，DSH 模式则允许无角色卡的普通会话。若任一资源已缺失，预检和应用都会返回诊断并阻止导航，因此不会留下“只应用了一半”的 Tavern 组合。

语言、缩放与「绑卡跟随 RP」同样是控制面状态，只写入全局 `ui-settings.json` 并作用于 Tavern 浏览器根节点。它们不进入 profile 装配、world-book matcher、`agent/request` 或 `request/header`。可选的 `rp:policy` 正文写入 `rp-policy.json`，只在 RP 开启时进入 system 段。
