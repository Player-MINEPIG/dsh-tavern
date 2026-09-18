# Issue #7 回复草稿

> 待维护者审核，尚未发送。用于 [#7](https://github.com/Player-MINEPIG/dsh-tavern/issues/7) 及其 A/B 实测补充。旧组合器与 #3 的复现结果见 [#3 回复草稿](ISSUE_3_REPLY_DRAFT.md)，本稿只回答当前 Trace 候选的问题。

---

这里单独回复当前 `codex/trace-api-v3` 的正文读取问题，以及从 #3 移来的发布计划、公开接口边界。

### 1. 从官方段落取正文可以，但段名不是字段原文接口

第三方可以使用 DSH 官方 `system-prompt/assemble` 观察、调整和贡献段落。当前 Tavern 段名为 `pmp-dsh-tavern:part:<ordinal>:<kind>:<field>`，这个格式已写入候选文档；**目前不承诺它是跨版本稳定的字段提取接口**。

- ordinal 至少补齐四位，随本次实际段落顺序变化，不能固定成 `0005` 等资源身份。
- kind/field 只描述首个来源。一段可能包含宏展开、角色覆盖或 `{{original}}` 混合内容，不能据此断言“一段恰好对应一个字段”。
- 按目标候选版本匹配并移动整个段落可以使用这条官方路径；零匹配或歧义要报告，不能静默输出空段或沿用上一轮缓存。

同步 section provider 并不要求你们必须提前异步读历史 HTTP：可以在官方 assemble waterfall 中先 `await next()`，拿到**本次** `assembly.sections` 后直接返回重排后的结果。参见 [官方 observer 示例](https://github.com/Player-MINEPIG/dsh-tavern/blob/codex/trace-api-v3/docs/examples/official-prompt-observer.mjs)。其他插件和 waterfall 执行顺序仍可能影响结果；`arbitraryMessageDepth: false` 表示 Tavern 没提供任意消息深度装配能力，并不为某个第三方保留“永远最后”的位置。最终请求仍需在 `llm/stream` 边界核对。

### 2. schema 4 不另存来源正文，读取路径已集中说明

这是本版的数据设计，不是暂缺实现：schema 4 不返回 `source.text`，`source.textStatus` 为 `not-stored`。不为大卡重复保存一份装配前的字段正文。

| 需要的内容 | 当前入口 |
| --- | --- |
| 当前资源原文、绑定与配置 | v1 配置预览及资源接口 |
| 某条已记录请求的段落/context 正文 | v3 `/sessions/:id/assemblies/:recordId`，通过官方历史引用校验后返回 |
| 本轮装配中的官方段落 | 官方 `system-prompt/assemble` 的本次结果 |
| 某个历史轮次装配前的来源字段原文 | schema 4 不新增归档或恢复接口 |

你建议的第三条指路需要区分：**官方段落提供装配结果，不一定是某个来源字段的原文**。因此本版不增加“按 field 从历史段落恢复原文”的端点，也不恢复 `/sources` 聚合。纯 HTTP 消费方可读取当前资源和历史详情；调整本轮装配需要接入官方运行期扩展点。完整说明已补到 [读取路径与兼容边界](https://github.com/Player-MINEPIG/dsh-tavern/blob/codex/trace-api-v3/docs/PROMPT_API_V3.md#消费方读取路径与兼容边界)。

### 3. 你们补充的两处失效

从你提供的 A/B 链路看，Tavern 当轮仍贡献了后处理指令，之后发生了“摘掉原段，但替代正文读取失败”。这确实会使最终请求缺少该段。迁移时应先确认拿到本轮可用的替代内容，再移除原段；失败时保留原段并提示，不能把 404 当作空正文成功。

`presetMode` 的替代读取在 v1：先 `POST /pmp-dsh-tavern/api/v1/session-configurations/preview`，请求为 `{ "source": { "mode": "current", "sessionId": "…" } }`，再用返回的 `selection.presetId` 请求 `GET /pmp-dsh-tavern/api/v1/presets/:id`，读取 `preset.systemPromptMode`（`append` / `replace`）。没有选中预设时不应判为 replace；缺失资源或读取失败要另行处理。这是当前配置读取，多个请求不保证同一快照，也不等于本轮最终生效结果。它不需要调用会重新装配的 `/active`。

### 4. Q-A：合并与发布计划

当前准备的是 **2.3.0 Trace 版本**，候选分支为 [`codex/trace-api-v3`](https://github.com/Player-MINEPIG/dsh-tavern/tree/codex/trace-api-v3)，目标 DSH `0.1.5-rc.1`。发布草稿已准备，技术检查已完成到当前候选，仍待最终审核；尚未合并、打 tag 或发布，暂无确定发布日期。

发布版 2.2.0 没有这些 v3 入口，因此不能把普通 2.2.0 用户直接导向它们。当前联调请固定候选提交，正式发布后再依据对应 tag 的文档接入。现有验证包含 654 项检查（652 通过、0 失败、2 条件跳过）、真实 Host 冷读与 Chrome 验收；你们实际插件按新合同的联调和原生 Windows 验证仍未完成，详见 [验收范围](https://github.com/Player-MINEPIG/dsh-tavern/blob/codex/trace-api-v3/docs/TRACE_REVIEW.md)。

### 5. Q-B：哪些面可依赖，以及删除端点的提示

文档列出的已发布 v1/v2 HTTP 路由和响应语义继续保留，包括 `/pmp-dsh-tavern/api/v1/traces` 的 `records[].worldBooks[].decisions[]`。它是公开审计面，可以按文档消费，同时处理空值、可选字段和数量/长度限制。内部存储布局、DOM 和未文档化服务不属于 HTTP 合同。

当前 v3 仍是未发布候选，只有 capabilities、装配索引、单条详情三个只读入口。`apiVersion: 3` 和 `contract: "prompt-trace-primitives"` 用于识别 API 类别，**不是候选版本号，也不能证明旧 `/sources` 仍存在**；你们这次两版 contract 一样但端点不同，正说明仅检查这两项不够。候选联调需固定提交并按实际接口返回处理不兼容，不能静默降为空内容。

已将上述边界和迁移指路补入 [v3 文档](https://github.com/Player-MINEPIG/dsh-tavern/blob/codex/trace-api-v3/docs/PROMPT_API_V3.md)。关于 410 或弃用期的建议，当前候选尚未实现过渡别名或 410，`/sources` 仍返回 404；这份回复不将建议写成已完成能力。正式版本的合同以对应 tag 文档为准。
