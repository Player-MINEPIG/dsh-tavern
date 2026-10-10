# DSH 与 dsh-tavern（DT）消息流

[English](DSH_MESSAGE_FLOW_en.md)

Tavern **3.0.2** 接入独立 Assembler **v1.1.0**。Tavern 解析资源并拥有来源权限；Assembler 拥有策略、渲染与排列；DSH 拥有会话与 Provider 调用。标准策略使用公开 sections/context/pre-step；只有另行安装的 core addon 启用协议 1 请求投影。未应用策略时的 loader 渲染器是保留的兼容路径，不是默认 RP 策略。见[接入说明](ASSEMBLER_INTEGRATION.md)与[Host/资源合同](LOADER_CONTRACT.md)。

本文描述 Tavern 3.0.2 在 DSH `0.2.0-rc.2` 上的当前消息合同：DSH
原生流程、DT 自身流程、DT 的介入点，以及一次完整模型 step。V4 的系统提示词以
`system/message` 进入有效消息 surface，`request/header` 保留 config/tools；Trace schema 4
只持久化 metadata 与官方 Session 引用，并由 [v3 API](PROMPT_API_V3.md) 按需验证正文。

Tavern Host adapter 显式调用 session/workspace/directory-picker controllers。history 先用
`inspect()` 固定 inclusive `throughSeq`，再以 `page()` 读完同一快照；进程内事件读取使用
`session.seq`、`snapshotEvents()` 与 `ownEvents()`。会话坐标与迁移规则见
[升级指南](DSH_0.1.7_MIGRATION.md)。

本文中的 `DT` 是 `dsh-tavern` 的简称。SillyTavern（ST）是 DT 兼容的资源格式与部分语义来源，不是本插件或其界面的产品身份。

## 1. DSH 原生 flow

在 stock rc.2 上，未接入 Tavern 或装配策略时，DSH `0.2.0-rc.2` 的普通 agent step 按以下顺序工作：

```text
用户提交
  │
  ▼
Agent Inbox（next-turn / next-step）
  │  插入/编辑/取消与 claim 记录 agent/inbox/spliced
  ▼
systemPrompt.assemble(agent scope)
  ├─ 收集并排序 system sections、runtime contexts、tools、variables
  └─ 执行 system-prompt/assemble；投影待提交的 runtime-context snapshot
  │
  ▼
agent/pre-step waterfall 接受、替换或拒绝待提交消息
  │
  ▼
step/start → agent/request waterfall → prepareCall() 校验配置并绑定 adapter
  │
  ▼
DSH 接纳已冻结装配与已接受输入
  ├─ system sections → 官方 system/message
  └─ 已接受的 user 与 runtime-context messages → user/message（每 step 一次）
  │
  ▼
request/header 记录 config + tools；request/context 记录 adapter context
  │
  ▼
Session.deriveMessages() 生成冻结的有效消息数组
  │
  ▼
PreparedLlmCall.stream(request) 到达 llm/stream
  ├─ 实时 agent/assistant-stream frames
  ├─ assistant/message 或 assistant/attempt 持久结算并保留 stream
  └─ tool-call → tool-role tool/result → 可能进入下一 step
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
- V4 的系统正文权威是有效 `system/message`，context 正文权威是对应 `user/message`
  snapshot。`request/header` 记录最终 config 与 tools，不保存 system 正文。
- `llm/stream` 接收最终运行时 messages/tools/config；观察该 hook 可以核对实际请求形状，
  但不会自动建立第二份持久历史。

V4 使用 producer-owned message source：system message 为 `system-prompt`，context snapshot 为 `runtime-context`。工具结果使用 `tool` role、顶层 `toolCallId` 和直接 content，不再是包裹 `tool-result` content block 的 user message。Tavern 保留原生 role 与事件归属。

`prepareCall()` 在接纳模型可见消息之前绑定 prepared adapter call。重试重新经过公开 request 边界，不重复调用同一个 middleware continuation，也不修改已准备好的请求。实时 `agent/assistant-stream` frames 结算为官方 `assistant/message` 或 `assistant/attempt`，不另写持久 `assistant/chunk` 行。

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
- `agent/request` 只改变 call config，stock rc.2 也没有公开的 per-request history waterfall 可在不写 Session 的情况下返回任意 `messages[]`；
- 用单个 user checkpoint 承载整段 RP 对话会丢失原生 role、tool-call/result 和逐消息 action 边界；把原文复制成多条新消息又会制造第二份 durable history，并需要额外的原子性和并发协议；
- DSH 原生 compaction 也使用同一 surface replacement。DT 若再把它当分支树使用，会让两种不同语义争用同一个 model-visible surface。

因此 DT 的 swipe、同周目回退和分支新周目采用 DSH 公开 session branch/fork 能力创建 continuation session，而不是改写原 session surface。每个分支都拥有 DSH 原生可解释的历史、工具配对、请求头和独立 compaction；原生“对话”视图、其他插件和卸载后的 Host 仍能按普通 DSH session 工作。Tavern timeline 只保存这些权威消息的指针、父 variant 与活动 head，用多个 session 组合出周目树，不伪造或复制历史正文。

stock rc.2 不提供任意 request-time `messages[]` 投影或原子的多消息 surface replacement。标准策略因此受原生投递边界约束。可选 core addon 提供进阶 request-only 排列，但不会把它变成可逆的 durable-history 分支接口；周目分支仍使用公开 session fork。

## 2. DT 自己的 flow

### 2.1 控制面：导入、编辑与 session 绑定

Tavern UI 与 `/pmp-dsh-tavern/api/v1/*` 管理资源和会话选择。ST 预设、角色卡与世界书先经各自 format adapter，再进入资源库。编辑资源与绑定会话是不同操作。有效世界书按 session/开场、用户、预设、角色关系稳定去重，再合入角色卡内嵌书。

Assembler 的设置入口与 Tavern 内嵌面板共享策略库和会话应用快照。编辑/保存策略不会自动应用；成功的显式应用决定后续装配。独立 DSH 会话没有隐式 RP 策略；新 Tavern 开场默认标准“预设插槽优先”。既有显式选择（包括退出装配）保持不变。

### 2.2 数据面：先解析资源，再装配请求

```text
会话选择 + 公开历史/claimed input 投影
  → TavernProfileLoader.compile()
       preset / character / user / 激活 lore / 资源 audit
       按权限租约读取来源拥有的 MVU 与模板
  → 共享 Assembler registry + 已应用策略快照
       来源解析与各来源自己的渲染
       有序排列算法 / delivery / retention
  → 原生官方贡献 或 进阶请求投影
  → 冻结的 DSH 请求 + 已记录证据
```

应用策略后，loader 返回资源模型，不先渲染另一份 profile。Assembler 解析预设、角色、用户、世界书、模板、MVU 与 DSH 原生文本等注册来源。解析语法与访问规则由来源决定；选择模块不等于获准执行任意脚本或读取其他会话。

标准“预设身份优先”在原生投递区域内保留受支持的原角色；“预设插槽优先”围绕原生历史/输入边界适配预设控制的内容，并在预览标出调整。system 贡献走官方 sections；user 贡献走 context 或接纳的 pre-step 投递，**会进入 durable history**。移除来源停止后续贡献，旧 user 正文仍属于历史。原生历史、输入和工具事务保持受保护的内部顺序。

进阶策略同时要求 core addon 与协议 1 Host，按受支持的 role/depth/retention 规则投影冻结请求，并记录官方 `request/assembly`；request-only 正文不会伪造为持久聊天消息。缺后端能力时明确失败。精确行为与限制见[请求装配](REQUEST_ASSEMBLY.md)和 [Assembler 后端规则](https://github.com/Player-MINEPIG/dsh-prompt-assembler/blob/v1.1.0/docs/BACKENDS.md)。

未应用策略时，兼容渲染器才把 Tavern profile 展开为 system parts。其 role/depth 近似只适用于该路径，不能用来描述当前标准或进阶策略。

## 3. Tavern 与 Assembler 对 DSH flow 的改动

| 公开边界 | 所有者与动作 | 对请求的影响 |
| --- | --- | --- |
| `agent/created` | Tavern 初始化资源选择、pending input 与 RP；Assembler 继承父策略选择 | 请求前完成初始化，失败向外传播 |
| `agent/inbox/spliced` / `agent/inbox/claimed` | Tavern 从公开 splice 投影激活输入；Assembler 捕获 claimed input 供原生投递 | 当前输入可在 system assembly 前参与本步骤世界书匹配 |
| `systemPrompt.section` | Tavern 提供资源快照锚点、导入上下文与可选 `rp:policy` | 应用策略后不先渲染重复的 Tavern profile |
| `system-prompt/assemble` | Assembler 取得完整官方装配并应用 native 策略；Tavern 保留未应用策略时的兼容展开 | 标准后端产生合法 sections/context 与 pre-step 计划 |
| `agent/pre-step` | Assembler 接纳原生输入贡献；Tavern 接纳开场草稿并执行 RP 约束 | 原生 user 贡献写入 DSH 历史，不事后重扫冻结的 system assembly |
| `agent/assemble-request` | 可选 core addon 执行协议 1；Tavern 复核来源权限 | 仅进阶请求投影；标准 bundle 不注册此执行器 |
| `agent/request` / `agent/request-error` | Tavern 准入 preset 参数、开始 Trace，并在符合条件时申请有界原生重试 | 调整 call config，不改写历史 |
| `llm/stream` / `session/event` | Tavern 核验实际请求证据、记录引用、观察更新并执行 RP 约束 | Trace 解释已记录请求；MVU 只从获接纳的 durable events 提交 |
| `tools.guard` | Tavern 在 DSH 权限/沙箱之上叠加 RP 限制 | 拒绝高风险执行，改变提示词布局不会移除执行层约束 |
| Web API / 公开 client slots | Tavern 与 Assembler 分别提供资源、策略控制与检查入口 | UI/预览不发起 Provider 调用 |

preset 降级仅在尚无输出且未取消时，省略被明确拒绝的生效 preset 覆盖（`temperature`、`maxTokens`、`reasoningEffort` 或 `stop`）。每字段至多一次，原生重试至多四次。预检不支持的 effort 使用 adapter 默认，不猜别名。认证、额度和无关网络错误不触发此降级。原 preset 保持原文，Trace 记录请求值、生效值与省略原因。

外部记录仍是首次请求的 untrusted 只读上下文；greeting 是开场参考，不伪造 assistant 回复；creator notes 不发送。各来源渲染、RP 限制、受限 MVU 与模板语义仍归来源，布局不覆盖其权限。

## 4. 安装 Tavern 与 Assembler 后的完整 flow

```text
用户提交 → DSH Inbox claim
  → 公开 claim/splice 观察
  → DSH systemPrompt.assemble
       原生 sections / contexts / tools / variables
       Tavern 解析所选资源 + 世界书激活
       Assembler 按已应用快照解析/渲染来源
       native 返回 sections/context 与 pre-step 计划
       未应用策略则走兼容 profile 渲染
  → agent/pre-step
       开场接纳 + RP 约束
       接纳 native 策略的 user 贡献
  → agent/request：call config + preset 准入 + Trace candidate
  → DSH call preparation 与官方 system/user/context/header 事件
  → DSH 构建有效原生请求
       native：发送冻结的原生 messages
       core：可选协议 1 执行器投影并记录 request/assembly
  → llm/stream：核验实际 messages/tools/config，补齐 Trace
  → assistant/tool events 仍归 DSH
  → 获接纳的 durable assistant events 可提交 MVU 更新
  → 下一 step 重新读取资源/策略快照
```

标准路径保留 DSH 消息投递与 context snapshot 复用，因此逻辑预览位置不是历史请求日志。进阶事件冻结其实际投影后的消息数组。两条路径都不把 durable history 复制进 Tavern 资源库或 Trace。Trace 保存 metadata、hash 与官方引用；详情 cold-read 并验证引用正文。见 [Trace 合同](PROMPT_API_V3.md)。

## 5. 当前 ActivationContext 边界

DSH 当前顺序是：

```text
claim 当前输入
  → assemble 并冻结 system prompt
  → agent/pre-step 才公开 claimed messages
  → agent/request / prepareCall
  → 提交 system/message 与已接受的 user/context messages
  → request/header / deriveMessages
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

1. 在 Tavern Trace 选择确切的历史请求：标准读取完整的已记录原生请求引用；进阶读取对应 `request/assembly`，保留 system/user/assistant/tool 顺序。
2. 用该请求的官方 `request/header` 核对 tools/生效参数，并用已验证的 system/context 事件核对单项贡献。只在今天的会话上读取 `deriveMessages()` 不能恢复旧请求。
3. Trace metadata 解释来源、策略与世界书决策；MVU 查看按需展开，变量更新有自己的持久来源记录。
4. `active?sessionId=...`、逻辑预览与 assembler 的 latest-only actual 端点各自描述当前/最近状态，不能补填缺失的历史正文。
5. 资源/策略面板是控制面，不是实际发送证据。

Trace 位于原生 Conversation / Trajectory 同级的公开 `conversation.view` 槽，既不替代官方证据，也不进入模型上下文。

## 7. 干净会话与 UI 设置为何不进入消息流

配置模板复制有界资源选择意图，不包含消息、Trace、Inbox 或资源正文。干净会话入口使用公开 controllers，校验后再提交完整选择；具体事务与运行态边界见 [Host/资源合同](LOADER_CONTRACT.md)。

角色侧栏的新建周目入口先持久保存独立开场草稿、资源/策略快照与初始 MVU，不创建 DSH 会话或调用 Provider。首次发送准备真实会话，获接纳后才关联周目。草稿预览既不包含原生历史，也不包含待发送输入；已有 root session 的周目保留原会话。

语言、缩放与 RP 跟随偏好是 UI/控制状态，不成为提示词正文。可选 `rp:policy` 只在 RP 开启时贡献；来源拥有的初始 MVU 可被获准模块/卡片读取，但不伪造 assistant 消息。

## 8. MVU 在请求与更新周期中的位置

MVU 拥有初始化、schema、状态实例和受限读写。世界书变量宏、受限提示词模板或 MVU 来源可按来源权限与 revision 租约读取所绑定的快照。未使用的模块与预览不会隐式初始化或提交状态；最终装配复核会拒绝已撤销的读取。

获接纳的 durable assistant 回复后，受支持变量命令经来源策略、schema 与原子 CAS 校验才提交。fork/swipe 实例使用自己的 checkpoint，历史卡片读取不转向当前焦点会话的最新值。Trace 可检查这些来源事实，但不是状态库。完整合同与受支持 Helper 调用形状见 [MVU](MVU.md)和[提示词模板](PROMPT_TEMPLATE.md)。
