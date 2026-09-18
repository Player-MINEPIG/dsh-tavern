# Prompt pipeline and compatibility map

[English](PROMPT_PIPELINE_en.md)

本文说明 Tavern **2.3.0**中，资源在 SillyTavern、TauriTavern 和 dsh-tavern
如何进入一次模型请求，并明确未实现的映射。DSH 自身的 turn/step、Inbox、Session、
system assembly 和 request/header 顺序另见 `DSH_MESSAGE_FLOW.md`。

## 1. SillyTavern 如何组装一次 Chat Completion

SillyTavern 的预设不是“把若干文本拼到最前面”这么简单。其 Chat Completion 路径大致如下：

1. `PromptManager` 从当前角色对应的 `prompt_order` 读取顺序与启用状态。全局 Chat Completion 顺序通常使用 `character_id: 100001`。
2. `preparePromptsForChatCompletion()` 把预设提示词和运行时生成的语义块放进同一个 `PromptCollection`。后者包括 main、角色描述、性格、场景、persona、World Info before/after 等。
3. `populateChatCompletion()` 按 marker 的位置建立 `MessageCollection`，加入普通有序提示词；absolute/depth injection 会进入会话消息的指定深度，而不是都变成 system 文本。
4. 对话示例与真实聊天历史分别填入 `dialogueExamples`、`chatHistory` marker，并按 token budget 从历史中取舍。控制提示词最后加入。
5. `chatCompletion.getChat()` 最终产生真正带 `system`、`user`、`assistant`、`tool` role 的消息数组，随后才交给具体 API。

只读源码证据（路径相对于对应上游 checkout）：

- `public/scripts/PromptManager.js`：`getPromptOrderForCharacter()` 读取角色顺序；默认 marker 定义包括 `worldInfoBefore`、`worldInfoAfter`、`dialogueExamples` 和 `chatHistory`。
- `public/scripts/openai.js`：`preparePromptsForChatCompletion()`、`populateChatCompletion()`、`populateChatHistory()`、`populateDialogueExamples()` 和最终 `getChat()` 构成上述链路。

因此，ST 预设中的 marker 是运行时插槽，不是本身要发送的文本；prompt 的 role、absolute position、depth 和 token budget 都可能改变最后的消息拓扑。

## 2. TauriTavern 在这条链路上改了什么

TauriTavern 的普通生成路径保留上游 SillyTavern 前端及其 prompt builder；主要变化是宿主和传输层：浏览器式 `fetch`/`jQuery.ajax` 被拦截并路由到 Tauri/Rust，宿主能力通过 `window.__TAURITAVERN__` 暴露。换言之，普通聊天并没有另写一套不同的预设排列算法，而是尽量让上游 ST 前端继续产出相同请求形状。官方说明见 [Frontend Integration](https://tauritavern.github.io/en/architecture/frontend.html) 和 [TauriTavern repository](https://github.com/Darkatse/TauriTavern)。

TauriTavern 的 Agent 路径则多了一层快照边界：

- `startRunFromLegacyGenerate()` 先运行一次 ST legacy generate 的 dry run；
- 捕获该轮最终 Chat Completion payload 和 `WORLDINFO_SCAN_DONE` 的激活结果；
- 生成 `promptSnapshot` 后启动 Agent run；
- Agent profile 再提供 agent system prompt、工具白名单、Skills、workspace 和提交协议。

这意味着 Agent 仍以 ST 已组装完成的消息快照为输入，而不是只读取某个 preset JSON。当前 `preset.mode` 只记录快照或引用信息，并不会再次改写快照。详见官方 [Agent API](https://tauritavern.github.io/en/api/agent.html)。

## 3. dsh-tavern 当前如何兼容

dsh 没有 ST 的 `PromptManager`、marker collection 或任意历史深度插入接口。当前实现采用一个明确受限的适配：

1. 导入时把 preset、角色卡和 World Info/Character Book 分别归一化，并保留未知字段。
2. loader 根据当前 session 选择读取 preset、角色卡和一个用户资源；角色卡内嵌 `character_book` 自动成为世界信息来源。
3. loader 从公开 `agent/inbox/spliced` 投影本次 claimed batch，与 DSH durable user/assistant 历史按稳定 message id 去重并有界组合；世界信息 matcher 在首个 assembly 就据此得到本次激活条目。
4. loader 按 preset marker 组合静态 prompt、用户名/描述、角色字段和激活 lore，形成有序的 `pmp-dsh-tavern:part:*` system sections。
5. DSH 自己继续从 Session 投影用户输入、历史和工具结果；插件不复制 `chatHistory`。
6. `temperature`、`maxTokens`、`reasoningEffort` 和 `stop` 通过 `agent/request` 映射；其他 ST sampler 目前只保存，不宣称已经下发。

代码边界与这条数据流对应：`tavern-format` 只把 ST JSON 归一化，`preset` 只管理持久化/API/UI，`tavern-loader` 才执行第 3–5 步并作为根插件入口。因而以后改变 DSH 注入策略，不需要修改或重新解释 ST parser。完整决策见 `docs/ARCHITECTURE.md`。

第 3 步不使用空转 step 或私有 Inbox。loader 从公开 `agent/inbox/spliced` Session event 重建有界待处理队列，在 claim 删除 splice 后、system assembly 前暂存本次 batch，并形成 `ActivationContext = durable history + claimed messages`。world-book 纯 matcher 仍只接收显式输入，不知道 DSH event；Trace 仍记录首次 assembly 的真实结果，不在请求后补算。

默认 system 段顺序为：DSH harness identity（约 `-100`）→ Agent/deployment persona（约 `0`）→ dsh-tavern preset（`10`）→ RP 开启时的 `rp:policy`（`45`）→ 工具引导（`100–199`）。`rp:policy` 默认只说明高风险操作被锁，不是扮演身份；身份和文风仍来自 preset / 角色卡。

高级“仅使用预设”模式通过 `system-prompt/assemble` 把 system sections 替换为当前预设与 `rp:policy`（若有），但保留 assembly 的 tools、contexts 和 variables。它会移除模型可见的 harness identity、persona 和工具文字说明，所以 Code Mode 或结构化输出可能失效；工具执行策略、文件沙箱和审批不因删除文本而关闭。RP 锁仍由 `tools.guard` 执行。DSH 对这一边界的本机参考是 `@deepseek-ai/dsh-system-prompt/README.zh.md`。

## 4. 当前映射是否完整

不完整。现在完成的是“ST 预设静态提示块 → DSH system section”和有限 sampler 映射，不是 ST 消息拓扑的逐项复刻。

| ST 概念 | 当前行为 | 完整度 |
| --- | --- | --- |
| 普通 enabled prompt 与顺序 | 正文按顺序装配为 DSH system sections；官方 waterfall section 只有 `name`/`text`，identifier、请求 role 与来源保留在 Tavern Trace metadata | 部分；所有实际贡献仍是 system，不是真正的 `user`/`assistant` 消息 role |
| marker | 填充角色字段、before/after lore 和 example dialogue；`chatHistory` 由 DSH 原生历史拥有 | 部分；不支持任意真实 role/depth 拓扑 |
| 用户本轮输入 | 由 DSH 原生会话发送，插件不复制；loader `ActivationContext` 只让它在首个 assembly 前参与激活判断 | 已接入首 step 激活；没有插入到 ST `chatHistory` marker，也不写伪 durable message |
| 会话历史 | 由 DSH 原生 durable history 重放，插件不复制 | 已接入请求，但没有 ST token-budget/marker/depth 语义 |
| dialogue examples | 读取角色卡字段并作为普通 system 近似正文；来源关系记录在 Tavern Trace metadata | 部分；不是真实 user/assistant 示例消息 |
| absolute/depth injection | 字段被保留，装配器不执行 | 未实现 |
| World Info before/after | 角色卡内嵌书与 per-session 多选独立书使用同一 matcher 并填入 | 已接入基础 before/after；严格 depth/outlet 仍降级 |
| 角色描述、性格、场景、首条消息 | 前三者进入 profile；首条消息仅在首轮生成作 greeting-reference | 部分；不伪造历史，也不在后续轮次重复注入 |
| ST macro | 支持常见变量、随机与骰子；缺少完整 ST runtime context | 部分 |

尤其要注意：ST 的 `user`/`assistant` 请求 role 只保存在模型不可见的 Tavern Trace `sources[].role` metadata 中；官方 waterfall section 本身没有 `source.role`。这不等价于向模型发送真实 `user`/`assistant` 消息。

## 5. 世界信息与角色卡的当前放置及未支持能力

当前 loader 已将逻辑 profile 展开为多个具名 system sections，并由同一次 per-request assembly 统一放置 marker 内容。实际映射如下：

| 资源 | 当前映射 |
| --- | --- |
| 预设静态 instruction | 使用具名 system sections，并在同一次装配中提供 ST marker anchor |
| 角色 description/personality/scenario | 按 preset marker 或稳定 fallback 进入 Tavern system 正文；不覆盖 DSH Agent persona |
| 用户名字与描述 | 名字解析 `{{user}}`；描述进入一次 `personaDescription`/`{{persona}}`，缺少放置点时诊断并稳定 fallback；不覆盖 DSH Agent persona |
| 世界信息条目 | 扫描 durable history 与本步骤 claimed 输入，并按 before/after anchor 进入 profile；严格 depth/outlet 未支持 |
| example dialogue | 作为普通 system 近似正文，来源与位置降级由 Tavern Trace metadata/diagnostics 说明；真实 user/assistant 示例消息未支持 |
| first message / alternate greeting | 首轮生成作为 greeting-reference；首个真实回复形成后不再注入，且始终不创建 seed/history message |
| 用户输入与历史 | 始终以 DSH 原生 durable messages 为权威来源；世界书只读扫描，不重复发送 |
| Agent system prompt | 默认共存并先于 preset；高级 replace 明确由用户承担工具提示丢失风险 |

任意 role-message/depth 注入当前未支持；相关字段原样保存并在 UI 标注“尚未执行”，不能声称完整兼容。

## 6. 为什么同一会话切换预设仍会受旧预设影响

这是预期内的上下文效应，不是“旧 preset 仍被直接注入”的必然证据。每次发送前，当前 system prompt 会重新组装，下一条请求只应带当前选择；但旧预设已经影响过的 assistant 回复和后续 user 对话仍存在于 durable conversation history。模型会从这些文本间接推断旧身份、格式或任务，因此产生认知残留。

可靠的干净切换方式是选择新预设后使用“维持当前 Tavern 设置新开对话”，或从旧预设尚未产生回复的位置 fork。插件现已提供显式的干净会话与配置模板操作：DSH 模式通过公开 New Session seam 创建或取得真实 blank session；魔丸模式按配置角色创建或复用其权威空周目。两者都只复制 Tavern selection 投影并在导航前原子应用，不会删除、改写、隐藏或复制旧历史。
