# Issue #3 回复草稿

> 待维护者审核，尚未发送。对照 [#3](https://github.com/Player-MINEPIG/dsh-tavern/issues/3) 及其关闭说明：旧组合器候选已终止，剩余问题转入 [#7](https://github.com/Player-MINEPIG/dsh-tavern/issues/7)。以下正文用于说明 #3 的处理结果与当前接法，不重新打开旧方案讨论。

---

已看到你将旧候选相关的 #3 收口，并把剩余问题转到 #7。这里补充本机复现后的处理结果和当前合同，便于对照迁移。

**发布状态**：当前准备的是 **2.3.0 Trace 版本**，分支为 [`codex/trace-api-v3`](https://github.com/Player-MINEPIG/dsh-tavern/tree/codex/trace-api-v3)，目标 DSH `0.1.5-rc.1`。技术检查已完成到当前候选，仍待维护者审核；尚未合并、打 tag 或发布，也不在这里承诺发布日期。发布版 2.2.0 没有这些 v3 入口，当前联调需固定候选分支/提交。

**v3 已调整为元 API**：只有 capabilities、逐次装配索引、单条详情三个只读入口。旧候选的 `registerComposer`、`pmpDshTavernPrompt`、owner/external mode、`suggestedCallConfig` 和 `/sources` 聚合都不在当前合同内，不应继续硬依赖旧服务。识别时请同时检查 `capabilities.contract === "prompt-trace-primitives"`。第三方可以通过 DSH 官方装配接口处理段落，无需接管 Tavern 的独占组合器。

你在 #3 后续实测中涉及的几点，当前处理如下：

| 项目 | 当前结果 |
| --- | --- |
| 世界书 UID 与完整 ID 混用 | 已修复新采集记录：v3 `entryId` 是字符串形式的书内 UID，`qualifiedEntryId` 是完整 Loader 标识；按同一记录中的 `resourceId + entryId` 关联 v1 审计。早期记录保留原样，不靠猜测拆 ID。 |
| `entryName` 为空 | 允许无标题条目；名称用于显示，不是身份，也不为填名称而保存正文副本。消费者应按 ID 回退显示，并处理截断/缺项。 |
| 失败轮次在 `/v2/.../messages` 中没有占位 | 这是消息投影的边界。现在 v3 详情可通过校验后的官方失败事件引用返回 `failure {code,message}`；索引和持久文件不保存错误正文。RP 不添加失败助手消息，具体运行错误仍可在 DSH“对话”视图查看。 |
| 查看器只拍注册表，漏掉动态段落 | 观察官方 `system-prompt/assemble` 的实际结果；最终系统文本再以 `llm/stream` 核对。注册表不等于本轮装配结果。 |
| ST 原文宏直接交给官方段落导致 unknown variable | 官方插值与 ST 宏不是一回事。Tavern 内置路径会处理其支持的宏；第三方自行读取原始字段并贡献段落时，需要自行处理。另已修复 Tavern 空/全空白 nickname 未回退角色名的问题。 |
| 旧组合器多余字段的 422 | 对应旧校验器已随方案删除，不宣称为新路径修复；也不把任意额外属性列为官方支持字段。 |
| 测试依赖根与 Windows 路径 | 文档明确 codec 与 Host 依赖根可以分别设置；存储测试已使用平台绝对路径。没有原生 Windows 验收证据，暂不宣称 Windows 实机问题已完全关闭。 |

关于 **哪些接口可依赖**：文档列出的已发布 v1/v2 HTTP 路由和响应语义继续保留，包括 `/pmp-dsh-tavern/api/v1/traces` 的 `records[].worldBooks[].decisions[]`。这是公开审计面，消费者仍需处理文档中的空值、数量/长度限制和可选字段。内部存储文件、DOM 和未文档化服务不属于该 HTTP 合同；当前未发布 v3 候选也不等于已经发布的稳定版本。

你在 #7 提到的正文读取时机，现已在 [读取路径与兼容边界](https://github.com/Player-MINEPIG/dsh-tavern/blob/codex/trace-api-v3/docs/PROMPT_API_V3.md#消费方读取路径与兼容边界) 集中说明：

- 当前资源字段/绑定：读 v1。
- 某条历史装配的段落/context 正文：读 v3 detail，验证官方引用后返回。
- 本轮装配中的官方段落：在 `system-prompt/assemble` waterfall 的 `await next()` 结果里观察或重排，不必先从历史 HTTP 记录为本轮预取。
- 装配前的历史来源字段原文：schema 4 不另存，也没有来源正文恢复接口。官方段落可能已展开宏或混合多个来源，**不能把段落正文等同于来源原文**。

当前命名形式是 `pmp-dsh-tavern:part:<ordinal>:<kind>:<field>`；ordinal 随本次顺序变化，kind/field 只来自首个来源，因此不能按名字认定“一段恰好是一个字段”，或承诺精确到字段的提取。按本轮匹配结果移动整段可以利用官方 waterfall，但零匹配/歧义应显式报告，不能静默贡献空段或沿用上一轮缓存。Tavern 不保证第三方段落永远排在所有插件之后，也不恢复旧 `/sources` 聚合端点。

**验证范围**：当前完整检查 654 项，652 通过、0 失败、2 条件跳过；真实 rc.1 Host 已验证成功正文及两类失败原因在重启后的冷读，v2 没有伪造失败消息。Chrome 也验证了 Trace、RP HTML 和工作区诊断。上述是 Tavern 自身与合成官方消费者的证据，**不是对你们实际插件按新合同完成端到端联调的声明**。

可参考 [HTTP reader](https://github.com/Player-MINEPIG/dsh-tavern/blob/codex/trace-api-v3/docs/examples/trace-reader.mjs)、[官方 observer](https://github.com/Player-MINEPIG/dsh-tavern/blob/codex/trace-api-v3/docs/examples/official-prompt-observer.mjs) 和 [当前验收范围](https://github.com/Player-MINEPIG/dsh-tavern/blob/codex/trace-api-v3/docs/TRACE_REVIEW.md)。#3 保持关闭，后续新合同的联调问题可集中在 #7。
