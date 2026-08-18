# DSH 与 dsh-tavern（DT）消息流

状态：2026-08-18，基于本机 `@deepseek-ai/dsh 0.1.0-rc.6` 的公开 README 与已安装源码核对，并包含 RP 会话叠加。本文分别描述 DSH 原生流程、DT 自身流程、DT 对 DSH 的介入，以及安装 DT 后一次完整模型 step 的实际流程；它不是 README。

本文中的 `DT` 是 `dsh-tavern` 的简称。SillyTavern（ST）是 DT 兼容的资源格式与部分语义来源，不是本插件或其界面的产品身份。

## 1. DSH 原来的 flow

未安装 DT 时，一次普通 agent step 按以下顺序执行：

```text
用户提交
  │
  ▼
Agent Inbox（next-turn / next-step）
  │  插入/编辑/取消均记录 agent/inbox/spliced
  │  claim 当前待处理消息时再记录删除 splice
  ▼
systemPrompt.assemble(agent scope)
  ├─ 收集并排序原生 system sections
  ├─ 收集 runtime contexts
  ├─ 收集 tools 与 variables
  └─ 执行 system-prompt/assemble waterfall
  │
  ▼
把 assembly 渲染为 system 与 runtime context message
  │
  ▼
agent/pre-step waterfall
  └─ 接受、替换或拒绝本步骤 claimed messages
  │
  ▼
Session 追加已接受的 user/message
  │
  ▼
Session.deriveMessages() 生成本步骤历史 messages
  │
  ▼
agent/request waterfall 生成 LLM call config
  │
  ▼
记录 request/header（最终 config + system + tools）
  │
  ▼
llm.stream({ system, messages, tools, ...config })
  │
  ├─ assistant/chunk 持久事件
  ├─ assistant/message 进入 Session 历史
  └─ tool-call → tool result → 可能进入同一 turn 的下一 step
```

DSH 的四条数据通道彼此独立：

| 通道 | 权威来源 | 最终去向 |
| --- | --- | --- |
| system prompt | `systemPrompt.assemble()` | LLM 请求的 `system` |
| 会话历史 | `Session.deriveMessages()` | LLM 请求的 `messages` |
| 工具 | system assembly 的 tools | LLM 请求的 `tools` |
| 模型参数 | `agent/request` waterfall | provider/model/temperature 等 call config |

关键事实：

- Inbox 先 `claim` 当前输入，但 system assembly 执行时，当前输入尚未追加为 Session 的 `user/message`，也不在公开的 assembly context 中。
- Inbox 的每次插入、替换、取消和 claim 都先持久写入公开的 `agent/inbox/spliced` Session event。`Session.append()` 会同步通知 `session/event` 观察者，然后 Inbox 才修改实时队列；DT 从该事件重建有界待处理队列，并在 claim 删除事件发生后、system assembly 开始前得到被 claim 的消息。
- DSH 完成 system assembly 后才调用公开的 `agent/pre-step`。该 hook 能看见 claimed messages，但收到的 assembly 已经冻结。
- `Session.deriveMessages()` 从持久 message surface 投影 user、assistant 和 tool result；turn/step 边界与流式 chunk 不会重复成为模型消息。
- `agent/request` 只负责 call config，不生成历史，也不能替换已冻结的 system assembly。
- `request/header` 保存实际生效的 config、system 与 tools，是审计该步骤模型请求头的权威记录。

本机核对位置：

- `@deepseek-ai/dsh-agent-loop/lib/index.js`：`preStep()`、`turn()`、`step()`、`buildRequest()`；
- `@deepseek-ai/dsh-system-prompt/lib/index.js`：`SystemPrompt.assemble()`；
- `@deepseek-ai/dsh-session/lib/index.js`：`Session.deriveMessages()`；
- `@deepseek-ai/dsh-llm/README.zh.md`：消息、call config 与 `request/header` 契约。

## 2. DT 自己的 flow

DT 内部先把“资源管理”和“运行时编译”分开。前端及 API 属于控制面，不直接给模型发送消息；loader 才是运行时数据面。

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

### 2.2 当前已验收数据面：把已绑定资源编译为一个运行时快照

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

编译规则：

1. loader 按 session 解析 preset、角色卡、用户资料、独立世界书与角色卡内嵌书；session 显式世界书优先，随后追加当前用户绑定的世界书并按 ID 稳定去重。
2. world-book matcher 扫描公开的 `Session.deriveMessages()` 历史与 `PendingInputProjection` 提供的本步骤 claimed 输入，稳定去重后默认最多最近 64 KiB；执行普通主关键词、secondary key、概率、组与预算策略。原生 JavaScript regex 默认阻断，避免 ReDoS。
3. 统一编译器按 preset marker 放置角色字段、用户名字/描述与命中 lore。`{{user}}` 使用当前用户名字；描述只消费一次 `personaDescription`/`{{persona}}`；`chatHistory` marker 不复制 DSH 历史；creator notes 不发送。
4. 结果是一个不可混淆的运行时快照：`systemText`、受支持的 `callConfig`、资源摘要、诊断、世界书决策和审计指纹。
5. Tavern Trace 只持久化该快照的最小化元数据与最终 `request/header` 的关联，不保存完整 system、消息正文、资源正文或工具 schema。

## 3. DT 对 DSH flow 做了什么改动

DT 不替换 agent loop，也不维护第二套会话历史。它通过 DSH 的公开扩展点进行以下加法：

| DSH 扩展点 | DT 的动作 | 对最终请求的影响 |
| --- | --- | --- |
| `agent/session-start` | 为 agent 建立或恢复 session 资源选择；RP 开启时钉只读沙箱 | 决定本 session 可加载哪些 DT 资源，以及是否进入 RP 锁 |
| `systemPrompt.section` | 注册 `dsh-tavern:profile`（order 10）与 `rp:policy`（order 45） | 把编译后的 Tavern profile 与可选 RP 锁说明贡献给 system assembly |
| `system-prompt/assemble` | 追加 DT runtime contexts；高级 replace 模式可只保留 DT profile 与 `rp:policy` | 改变最终 `system`/context，但不改历史与工具执行权限 |
| `agent/pre-step` | RP 边界提交待处理开关，并再次钉只读沙箱 | 不改 messages；保证聊天栏改权限无法在下一步前解开 RP |
| `tools.guard` | RP 开启时拒绝高风险工具并 `agent.cancel` | 不进入执行；告警弹窗记在父会话（子 agent 违规时） |
| `agent/request` | 合并 preset 中 DSH 明确支持的 call config；把刚完成的 assembly snapshot 交给 Trace | 可改变 temperature/maxTokens/reasoningEffort/stop 等；不改 messages |
| `session/event` | 对齐 Trace 与 `request/header`；RP 开启时若看到 `sandbox/mode` 再次钉只读 | 只增加插件审计元数据；聊天栏改权限无法解开 RP |
| `agent/request-error` | 标记相应 Trace 尝试失败 | 不改变模型输入 |
| Web server / client slots | 提供受保护的资源 API、`DT` 悬浮球、侧栏与 Tavern Trace 视图 | 控制面与可视化；不直接进入 prompt |

既有 `session/event` 观察者除 request/header 对齐外，也由 loader 独占处理公开 `agent/inbox/spliced`，建立不持久化正文的 `PendingInputProjection`。该投影只影响世界书激活判断，不改变最终 DSH messages。

默认 append 模式下，DSH 原有 system sections 仍然存在，DT profile 作为新增 section 参与组装；RP 开启且 `rp:policy` 非空时再插入 order 45 的锁说明。高级 replace 模式会从模型可见的 system 文本中移除其他 section，只保留 DT profile 与 `rp:policy`；但 tools、runtime contexts、variables、沙箱、审批与执行层安全限制仍由 DSH 管理，不会被关闭。RP 是在此之上再拒绝一部分工具，不能用聊天栏权限芯片解开。

DT 明确不做以下改动：

- 不删除、重写或复制 DSH durable history；最终 `messages` 仍来自 `Session.deriveMessages()`。
- 不把 preset 中标成 user/assistant 的静态块伪装成真实历史消息。
- 不把 greeting 伪造成 assistant 历史；当前只作为带来源标记的参考内容。
- 不覆盖 DSH Agent 身份；用户资料只提供 Tavern 用户名字与描述。
- 不发送 creator notes。
- 不绕过 DSH 的工具权限、沙箱或审批。RP 额外拦住一部分高风险工具，清单见 `docs/RP_SECURE_MODE.md`。
- 不向 Session 写入伪造的 Trace、未知事件或第二套对话记录。

## 4. 安装当前已验收 DT 后的完整 flow

下面把控制面已经保存的资源选择，与一次真实模型 step 合并起来：

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
  ├─ 调用 DT 的 dsh-tavern:profile section
  │    ├─ 读取该 session 的资源选择
  │    ├─ 解析 preset / character / user / world books
  │    ├─ matcher 扫描 deriveMessages() + 去重后的本步骤 claimed batch
  │    ├─ 组合 marker、角色字段、用户描述与已命中 lore
  │    └─ 缓存本次 systemText / callConfig / audit snapshot
  │
  └─ system-prompt/assemble waterfall
       ├─ append：保留 DSH sections，并加入 DT profile/contexts
       └─ replace：仅保留 DT profile section，仍保留能力与执行层限制
  │
  ▼
DSH 渲染并冻结本步骤 system assembly
  │
  ▼
DSH agent/pre-step
  └─ 现在公开 claimed 当前输入；接受/替换/拒绝消息
  │
  ▼
DSH Session 追加已接受的 user/message
  │
  ▼
DSH Session.deriveMessages() 生成最终历史 messages
  │
  ▼
DSH agent/request
  ├─ DSH/其他插件生成基础 call config
  └─ DT 合并受支持的 preset 参数，并让 Trace 捕获“刚才实际组装的”快照
  │
  ▼
DSH prepareCall() 校验并冻结模型配置
  │
  ▼
DSH 记录 request/header（最终 config + system + tools）
  └─ DT 通过 session/event 将 Trace 对齐到 header seq 与摘要
  │
  ▼
LLM 收到：
  ├─ system = DSH sections +/或 DT profile
  ├─ messages = DSH durable history + 本步骤已接受输入
  ├─ tools = DSH system assembly 提供的工具
  └─ config = DSH 基础配置 + DT 支持的 preset 参数
  │
  ▼
assistant stream / tool calls
  ├─ chunk 与完整 assistant message 由 DSH 持久化
  ├─ tool result 仍由 DSH 管理
  └─ 下一 step/turn 重新执行以上 assembly；DT 不缓存第二份聊天历史
```

最终模型请求可简化为：

```text
request.system   = DSH 原生 system sections（append 模式） + DT 编译的 Tavern profile
request.messages = DSH Session.deriveMessages()
request.tools    = DSH assembly tools
request.config   = DSH/adapter 配置 + DT 可映射的 preset 参数
```

replace 模式下只有第一行不同：`request.system = DT 编译的 Tavern profile`；其他三条权威通道不变。

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

不能仅把 Tavern Trace 的扫描推迟到 `agent/pre-step`、`agent/request` 或 `request/header`：此时虽然能看见当前输入，但 system 已冻结。晚扫描会让 Trace 显示“本轮命中”，而实际 `request/header.system` 没有该 lore，形成错误审计。DT 因此记录真正参与该请求的 assembly，不把事后推演冒充本轮激活。

实现使用的公开顺序是：

```text
agent/inbox/spliced（插入消息）
  → loader 投影 next-turn / next-step 队列
  → claim 产生删除 splice（outcome 不是 canceled）
  → loader 暂存本次 claimed batch
  → systemPrompt.assemble
  → ActivationContext = durable history + claimed batch
  → world-book matcher
  → 本 step 的真实 Tavern profile / Trace snapshot
```

该路径已实现，并保持以下约束：

- `PendingInputProjection` 只存在于 loader Host 层；format、world-book、character、user 和 UI 不分别订阅或复制 Inbox 状态；
- 按 splice 的 `target/start/removedCount/inserted/outcome` 精确处理插入、替换、取消、steer、next-step 和排队 next-turn；
- 当前输入正文只作有界内存匹配输入，不写入 DT 资源、selection 或 Tavern Trace；DSH 自己的 durable inbox event 仍是来源权威；
- assembly 完成、取消、异常或 agent/session 结束后清理 claimed batch，下一 step 已进入 history 的消息不得重复拼接；
- Trace 仍在 `agent/request` 记录真正参与本次请求的 exact assembly snapshot，不在事后重跑 matcher；
- 不读取 Agent 私有 Inbox、不提前 append `user/message`、不增加空转模型请求，也不把 lore 伪装成额外 user message。

## 6. 如何审阅一次真实请求

按可信度从高到低：

1. DSH 持久 `request/header`：最终 system、tools 和生效 call config；
2. 请求对应的 `Session.deriveMessages()`：最终历史消息数组；
3. Tavern Trace：解释该 turn/step 使用的 DT 资源、世界书决策，以及它与 header seq/摘要是否对齐；
4. loader `/pmp-dsh-tavern/api/v1/active?sessionId=...`：当前选择、资源、诊断和不含 claimed 当前输入的预览；
5. DT 侧栏：资源编辑和绑定控制面，不是模型请求日志。

Tavern Trace 位于 Conversation / Trajectory 同级的公开 `conversation.view` 槽中。它是对实际 loader snapshot 的最小化解释层，不取代 `request/header`，也不会进入模型上下文。

## 7. 干净会话与 UI 设置为何不进入消息流

“维持当前 Tavern 设置新开对话”和配置模板属于显式控制面事务：

```text
预检当前选择或模板
  → DSH workspaces.connectWorkspace() 返回真实 blank session
  → loader 原子写入完整 Tavern selection
  → DSH sessions.open() 导航
```

模板只保存 preset、角色/greeting 开关、用户、独立世界书和 RP 叠加的资源 ID/选项；不会读取或复制 durable messages、Tavern Trace、Inbox、claimed input、turn/step 或资源正文。若任一资源已缺失，预检和应用都会返回诊断并阻止导航，因此不会留下“只应用了一半”的 Tavern 组合。

语言、缩放与「绑卡跟随 RP」同样是控制面状态，只写入全局 `ui-settings.json` 并作用于 Tavern 浏览器根节点。它们不进入 profile 编译、world-book matcher、`agent/request` 或 `request/header`。可选的 `rp:policy` 正文写入 `rp-policy.json`，只在 RP 开启时进入 system 段。
