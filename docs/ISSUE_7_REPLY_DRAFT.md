# Issue #7 回复草稿

> 待维护者审核，尚未发送。用于 [#7](https://github.com/Player-MINEPIG/dsh-tavern/issues/7) 及其 A/B 实测补充。旧组合器与 #3 的复现结果见 [#3 回复草稿](ISSUE_3_REPLY_DRAFT.md)，本稿只回答当前 Trace 候选的问题。

---

这里单独回复当前 `codex/trace-api-v3` 的正文读取问题，以及从 #3 移来的发布计划、公开接口边界。

先明确本版范围：**v2.3.0 不新增可改变 Loader 装配行为的接口，v3 保持只读的 Trace 元 API。** 以后可能考虑开放自定义装配策略接口，但尚未确定设计、版本或交付时间。第三方仍可以直接使用 DSH 官方扩展点；这不等于 Tavern 提供了可写的装配接口。

### 1. v3 可以逐段查看正文和来源，不只有当轮绑定

Tavern Trace 自己就是同一套 v3 HTTP 接口的消费者，没有额外的私有正文读取通道。第三方先读 `GET /pmp-dsh-tavern/api/v3/sessions/:sessionId/assemblies`，再用记录 ID 读同一路径下的 `/:recordId`，便可以按 `record.sections[]` 展示系统段落序号、名称、字数、正文和来源；`record.contexts[]` 对应 runtime context 段落。索引不带正文，详情核验官方历史后按需返回正文。

对于已识别来源且有可验证引用的 DSH 日志 V3 系统段落，历史正文与来源的关系已经保存在记录里：

| 要知道什么 | 详情字段 |
| --- | --- |
| 属于哪条官方历史消息 | `record.sessionId`、`section.reference.messageId / eventSeq` |
| 位于这条消息的哪一段 | `section.reference.range.startUtf16 / endUtf16` |
| 该段当时实际装配的正文 | `section.text`，官方引用校验通过后返回 |
| 来自哪些资源和字段 | `section.sources[]` 的 `kind / resourceId / resourceRevision / field / relationship` |

例如，可以知道某条历史系统消息的某个范围由角色卡 A 的 `postHistoryInstructions` 贡献；如果与预设原文混合，会列出多个来源。读取时要检查正文可用状态，不能仅凭消息 ID 或偏移就认为内容仍有效。context 使用官方具名 source section 定位，不套用系统消息的 range。引用缺失、记录淘汰或校验失败时，不保证恢复；非 Tavern 段落或经第三方改写的段落也可能正文可读，但详细来源为未知，`sources[]` 为空。这是对已捕获装配段落的溯源，不是从助手回复反推其引用了哪个字段。

因此，**不保存 `source.text` 不等于无法知道历史正文来自哪里**：保存的是“官方正文引用 → 段落 → 来源 metadata”的关系，而不是第二份大角色卡正文。来源不必从段名或文本匹配中猜测。完整字段见 [v3 合同](https://github.com/Player-MINEPIG/dsh-tavern/blob/codex/trace-api-v3/docs/PROMPT_API_V3.md)。

### 2. 段名用于识别，来源判断以结构化接口为准

当前 Tavern 段名为 `pmp-dsh-tavern:part:<ordinal>:<kind>:<field>`。前缀可以帮助官方接口消费者识别当前候选中的 Tavern 段落，完整名字则便于展示与诊断；**目前不承诺完整拼接格式是跨版本稳定的字段提取接口**。

- ordinal 至少补齐四位，随本次实际段落顺序变化，不能固定成 `0005` 等资源身份。
- kind/field 只描述首个来源。一段可能包含宏展开、角色覆盖或 `{{original}}` 混合内容，不能据此断言“一段恰好对应一个字段”。
- PHI 覆盖预设 `jailbreak` 时，首个来源可能是预设，因此不能假定所有 PHI 都有 `:character:postHistoryInstructions` 后缀。

历史查看器应依赖 v3 文档定义的字段、来源关系、引用和不可用状态，不需要解析段名来还原这些语义；段内多个来源仍只保证贡献关系，不保证逐字归属。运行期若按当前候选段名匹配，应固定版本并报告零匹配或歧义，不能静默贡献空段或复用上一轮缓存。v3 的历史来源关系也不能充当本轮装配前的实时输入。

### 3. 当前 Loader 不能保证严格的 PHI 位置

角色卡原字段是 `data.post_history_instructions`，Tavern 内部归一化为 `data.postHistoryInstructions`。当前 Loader 优先用它覆盖允许覆盖的预设 `jailbreak` 段，保留预设位置并支持 `{{original}}`；没有由该路径采用时，进入角色字段的 fallback 序列。两者都是系统段落贡献，代码均标记 `CHARACTER_PHI_APPROXIMATE`。

Tavern 的 profile 注册在系统段落 `order: 10`，随后在原锚点展开为多个具名 parts。**改大 order，或把 PHI 移到所有 system sections 末尾，都不等于将它放到聊天历史及当前输入之后。** DSH `0.1.5-rc.1` 的 assemble 操作 sections/contexts 等装配材料，不接收完整历史消息数组；AgentLoop 先协调系统消息，再追加本步接纳的输入。历史内系统更新还受模型能力和请求系列状态影响，不能从 section 顺序推出整条请求的最终消息位置。[Loader 的注册与展开](https://github.com/Player-MINEPIG/dsh-tavern/blob/codex/trace-api-v3/packages/tavern-loader/src/index.js#L447)、[PHI 放置逻辑](https://github.com/Player-MINEPIG/dsh-tavern/blob/codex/trace-api-v3/packages/tavern-loader/src/profile-loader.js#L419)。

第三方可以在官方 `system-prompt/assemble` waterfall 中通过 `await next()` 观察或调整本次系统段落，这不要求先异步读取历史 v3 正文；但这条方法本身不保证严格的 post-history 位置。`arbitraryMessageDepth: false` 也不为任何插件保留“永远最后”的位置。`llm/stream` 可用于核对最终请求，AgentLoop 请求在这里是只读的。[官方 observer 示例](https://github.com/Player-MINEPIG/dsh-tavern/blob/codex/trace-api-v3/docs/examples/official-prompt-observer.mjs)。

若以后要严格实现“每轮在历史及当前输入之后贡献 PHI”，需要另行设计 Loader 的贡献／装配路径，并核验官方消息阶段、角色、持久化、重复注入和重试语义；仅新增一个策略接口或调整排序值并不足够。也不能把 runtime context 直接当作等价方案：默认它是 user-role 快照，内容未变时不会每轮重新追加到末尾。这是当前路径的限制，不代表已经证明所有官方扩展方式都不可行。

已有 user/assistant 历史保持原有时序，不通过搬动历史消息来实现强调。来源 metadata 可以供消费者分类和制定自己的重要性策略，但本版不提供模型消息权重接口，也不把来源标识自动塞进模型正文。当前候选只近似放置 PHI，不能宣称已完整实现 ST 的位置语义。

### 4. schema 4 不另存来源正文，读取路径已集中说明

这是本版的数据设计，不是暂缺实现：schema 4 不返回 `source.text`，`source.textStatus` 为 `not-stored`。不为大角色卡重复保存一份装配前的字段正文。

| 需要的内容 | 当前入口 |
| --- | --- |
| 当前资源原文、绑定与配置 | v1 配置预览及资源接口 |
| 某条已记录请求的段落/context 正文 | v3 `/sessions/:id/assemblies/:recordId`，通过官方历史引用校验后返回 |
| 本轮装配中的官方段落 | 官方 `system-prompt/assemble` 的本次结果 |
| 某个历史轮次装配前的来源字段原文 | schema 4 不新增归档或恢复接口 |

你建议的第三条指路需要区分：**官方段落提供装配结果，不一定是某个来源字段的原文**。因此本版不增加“按 field 从历史段落恢复原文”的端点，也不恢复 `/sources` 聚合。纯 HTTP 消费方可读取当前资源和历史详情；调整本轮装配需要接入官方运行期扩展点。完整说明已补到 [读取路径与兼容边界](https://github.com/Player-MINEPIG/dsh-tavern/blob/codex/trace-api-v3/docs/PROMPT_API_V3.md#消费方读取路径与兼容边界)。

### 5. 你们补充的两处失效

从你提供的 A/B 链路看，Tavern 当轮仍贡献了后处理指令，之后发生了“摘掉原段，但替代正文读取失败”。这确实会使最终请求缺少该段。迁移时应先确认拿到本轮可用的替代内容，再移除原段；失败时保留原段并提示，不能把 404 当作空正文成功。

`presetMode` 的替代读取在 v1：先 `POST /pmp-dsh-tavern/api/v1/session-configurations/preview`，请求为 `{ "source": { "mode": "current", "sessionId": "…" } }`，再用返回的 `selection.presetId` 请求 `GET /pmp-dsh-tavern/api/v1/presets/:id`，读取 `preset.systemPromptMode`（`append` / `replace`）。没有选中预设时不应判为 replace；缺失资源或读取失败要另行处理。这是当前配置读取，多个请求不保证同一快照，也不等于本轮最终生效结果。它不需要调用会重新装配的 `/active`。

### 6. Q-A：合并与发布计划

当前准备的是 **2.3.0 Trace 版本**，候选分支为 [`codex/trace-api-v3`](https://github.com/Player-MINEPIG/dsh-tavern/tree/codex/trace-api-v3)，目标 DSH `0.1.5-rc.1`。发布草稿已准备，技术检查已完成到当前候选，仍待最终审核；尚未合并、打 tag 或发布，暂无确定发布日期。

发布版 2.2.0 没有这些 v3 入口，因此不能把普通 2.2.0 用户直接导向它们。当前联调请固定候选提交，正式发布后再依据对应 tag 的文档接入。现有验证包含 654 项检查（652 通过、0 失败、2 条件跳过）、真实 Host 冷读与 Chrome 验收；你们实际插件按新合同的联调和原生 Windows 验证仍未完成，详见 [验收范围](https://github.com/Player-MINEPIG/dsh-tavern/blob/codex/trace-api-v3/docs/TRACE_REVIEW.md)。

### 7. Q-B：哪些面可依赖，以及删除端点的提示

文档列出的已发布 v1/v2 HTTP 路由和响应语义继续保留，包括 `/pmp-dsh-tavern/api/v1/traces` 的 `records[].worldBooks[].decisions[]`。它是公开审计面，可以按文档消费，同时处理空值、可选字段和数量/长度限制。内部存储布局、DOM 和未文档化服务不属于 HTTP 合同。

v3 的主要公开合同是文档定义的只读路由与结构化响应语义，包括段落、来源关系和官方历史引用，不是对完整段名字符串的解析约定。当前 v3 仍是未发布候选，只有 capabilities、装配索引、单条详情三个只读入口。`apiVersion: 3` 和 `contract: "prompt-trace-primitives"` 用于识别 API 类别，**不是候选版本号，也不能证明旧 `/sources` 仍存在**；你们这次两版 contract 一样但端点不同，正说明仅检查这两项不够。候选联调需固定提交并按实际接口返回处理不兼容，不能静默降为空内容。

已将上述边界和迁移指路补入 [v3 文档](https://github.com/Player-MINEPIG/dsh-tavern/blob/codex/trace-api-v3/docs/PROMPT_API_V3.md)。关于 410 或弃用期的建议，当前候选尚未实现过渡别名或 410，`/sources` 仍返回 404；这份回复不将建议写成已完成能力。正式版本的合同以对应 tag 文档为准。
