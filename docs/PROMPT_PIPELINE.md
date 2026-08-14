# Prompt pipeline and compatibility map

本文说明预设在 SillyTavern、TauriTavern 和 dsh-tavern 中如何进入一次模型请求，并明确当前版本没有实现的映射。它是技术评审文档，不是产品 README。

## 1. SillyTavern 如何组装一次 Chat Completion

SillyTavern 的预设不是“把若干文本拼到最前面”这么简单。其 Chat Completion 路径大致如下：

1. `PromptManager` 从当前角色对应的 `prompt_order` 读取顺序与启用状态。全局 Chat Completion 顺序通常使用 `character_id: 100001`。
2. `preparePromptsForChatCompletion()` 把预设提示词和运行时生成的语义块放进同一个 `PromptCollection`。后者包括 main、角色描述、性格、场景、persona、World Info before/after 等。
3. `populateChatCompletion()` 按 marker 的位置建立 `MessageCollection`，加入普通有序提示词；absolute/depth injection 会进入会话消息的指定深度，而不是都变成 system 文本。
4. 对话示例与真实聊天历史分别填入 `dialogueExamples`、`chatHistory` marker，并按 token budget 从历史中取舍。控制提示词最后加入。
5. `chatCompletion.getChat()` 最终产生真正带 `system`、`user`、`assistant`、`tool` role 的消息数组，随后才交给具体 API。

本机只读源码证据：

- `D:\AI\SillyTavern\public\scripts\PromptManager.js`：`getPromptOrderForCharacter()` 读取角色顺序；默认 marker 定义包括 `worldInfoBefore`、`worldInfoAfter`、`dialogueExamples` 和 `chatHistory`。
- `D:\AI\SillyTavern\public\scripts\openai.js`：`preparePromptsForChatCompletion()`、`populateChatCompletion()`、`populateChatHistory()`、`populateDialogueExamples()` 和最终 `getChat()` 构成上述链路。

因此，ST 预设中的 marker 是运行时插槽，不是本身要发送的文本；prompt 的 role、absolute position、depth 和 token budget 都可能改变最后的消息拓扑。

## 2. TauriTavern 在这条链路上改了什么

TauriTavern 的普通生成路径保留上游 SillyTavern 前端及其 prompt builder；主要变化是宿主和传输层：浏览器式 `fetch`/`jQuery.ajax` 被拦截并路由到 Tauri/Rust，宿主能力通过 `window.__TAURITAVERN__` 暴露。换言之，普通聊天并没有另写一套不同的预设排列算法，而是尽量让上游 ST 前端继续产出相同请求形状。官方说明见 [Frontend Integration](https://tauritavern.github.io/en/architecture/frontend.html) 和 [TauriTavern repository](https://github.com/Darkatse/TauriTavern)。

TauriTavern 的 Agent 路径则多了一层快照边界：

- `startRunFromLegacyGenerate()` 先运行一次 ST legacy generate 的 dry run；
- 捕获该轮最终 Chat Completion payload 和 `WORLDINFO_SCAN_DONE` 的激活结果；
- 生成 `promptSnapshot` 后启动 Agent run；
- Agent profile 再提供 agent system prompt、工具白名单、Skills、workspace 和提交协议。

这意味着 Agent 仍以 ST 已组装完成的消息快照为输入，而不是只读取某个 preset JSON。当前 `preset.mode` 只记录快照或引用信息，并不会再次改写快照。详见官方 [Agent API](https://tauritavern.github.io/en/api/agent.html)。

本机 `D:\AI\TauriTavern` 是便携版运行目录，并不包含完整源码 checkout；其中的迁移说明和 manifest 只能证明角色卡、聊天、预设、世界书等数据采用一次性 ST 数据快照。对 TauriTavern 实现的上述结论以其官方源码仓库和官方架构文档为准。

## 3. dsh-tavern 当前如何兼容

dsh 没有 ST 的 `PromptManager`、marker collection 或任意历史深度插入接口。当前实现采用一个明确受限的适配：

1. 导入时选择 `character_id: 100001` 的顺序；没有该顺序时，选择能解析最多 prompt identifier 的顺序。
2. 保存原始顶层 JSON 和 prompt 的未知字段，供后续兼容升级使用。
3. 发送前按已保存顺序编译所有“启用且非 marker”的 prompt，处理一部分 ST macro。
4. 编译结果通过 `systemPrompt.section()` 作为 order `10` 的一个 DSH system 段注入。
5. `temperature`、`maxTokens`、`reasoningEffort` 和 `stop` 通过 `agent/request` 映射；其他 ST sampler 目前只保存，不宣称已经下发。

代码边界与这条数据流对应：`tavern-format` 只把 ST JSON 归一化，`preset` 只管理持久化/API/UI，`tavern-loader` 才执行第 3–5 步并作为根插件入口。因而以后改变 DSH 注入策略，不需要修改或重新解释 ST parser。完整决策见 `docs/ARCHITECTURE.md`。

默认 system 段顺序为：DSH harness identity（约 `-100`）→ Agent/deployment persona（约 `0`）→ dsh-tavern preset（`10`）→ 工具引导（`100–199`）。

高级“仅使用预设”模式通过 `system-prompt/assemble` 把 system sections 替换为当前预设，但保留 assembly 的 tools、runtime contexts 和 variables。它会移除模型可见的 harness identity、persona 和工具文字说明，所以 Code Mode 或结构化输出可能失效；工具执行策略、文件沙箱和审批不因删除文本而关闭。DSH 对这一边界的本机参考是 `@deepseek-ai/dsh-system-prompt/README.zh.md`。

## 4. 当前映射是否完整

不完整。现在完成的是“ST 预设静态提示块 → DSH system section”和有限 sampler 映射，不是 ST 消息拓扑的逐项复刻。

| ST 概念 | 当前行为 | 完整度 |
| --- | --- | --- |
| 普通 enabled prompt 与顺序 | 按顺序编译进一个 DSH system 段 | 部分；原 role 只写入 `<st-prompt role="…">` 标签，不是真正的消息 role |
| marker | 保留记录但不发送 marker 文本 | 正确保留语义，但尚无对应运行时填充器 |
| 用户本轮输入 | 由 DSH 原生会话发送，插件不复制 | 已接入请求，但没有插入到 ST `chatHistory` marker 位置 |
| 会话历史 | 由 DSH 原生 durable history 重放，插件不复制 | 已接入请求，但没有 ST token-budget/marker/depth 语义 |
| dialogue examples | 尚无来源与角色消息注入 | 未实现 |
| absolute/depth injection | 字段被保留，编译器不执行 | 未实现 |
| World Info before/after | marker 被跳过，无扫描器 | 未实现 |
| 角色描述、性格、场景、首条消息 | 尚无角色卡运行时 | 未实现 |
| ST macro | 支持常见变量、随机与骰子；缺少完整 ST runtime context | 部分 |

尤其要注意：把 ST 的 `user`/`assistant` prompt 包在 system 文本标签内只保留了审阅信息，并不等价于向模型发送真实 `user`/`assistant` 消息。这是当前兼容层最重要的边界。

## 5. 世界书与角色卡的后续占位设计

后续不应把所有内容继续压成一个大字符串，而应新增一个 per-request assembly coordinator：

| 未来资源 | 推荐映射 |
| --- | --- |
| 预设静态 instruction | 继续使用命名 system sections；由 coordinator 提供 ST marker anchor |
| 角色 description/personality/scenario | 独立、可排序的角色 sections；只有明确要替换 Agent persona 时才占用 persona 层 |
| 世界书条目 | 先扫描 DSH 当前用户输入与历史决定激活项，再按 before/after anchor 生成 sections；需要 depth 的条目等待角色消息插入 seam |
| example dialogue | 需要真实 user/assistant 示例消息 seam，不能用 system 标签冒充 |
| first message / alternate greeting | 作为创建会话时的 seed message，而不是每轮 system prompt |
| 用户输入与历史 | 始终以 DSH 原生 durable messages 为权威来源；世界书只读扫描，不重复发送 |
| Agent system prompt | 默认共存并先于 preset；高级 replace 明确由用户承担工具提示丢失风险 |

在 DSH 尚未提供任意 role-message/depth 注入 seam 前，相关字段应继续原样保存并在 UI 标注“尚未执行”，不能声称完整兼容。

## 6. 为什么同一会话切换预设仍会受旧预设影响

这是预期内的上下文效应，不是“旧 preset 仍被直接注入”的必然证据。每次发送前，当前 system prompt 会重新组装，下一条请求只应带当前选择；但旧预设已经影响过的 assistant 回复和后续 user 对话仍存在于 durable conversation history。模型会从这些文本间接推断旧身份、格式或任务，因此产生认知残留。

可靠的干净切换方式是选择新预设后创建新会话，或从旧预设尚未产生回复的位置 fork。插件不会自动删除、改写或隐藏历史，因为那会破坏用户数据和审计语义。将来可以增加“选择并新建会话”，但它应是显式操作。
