# Issue #3 回复草稿

> 待维护者审核，尚未发送。用于 [#3](https://github.com/Player-MINEPIG/dsh-tavern/issues/3)，只说明旧方案收尾和实测问题的处理结果。新合同、发布计划及公开接口边界分别在 [#7 回复草稿](ISSUE_7_REPLY_DRAFT.md) 中回答。

---

已看到你的关闭说明。#3 针对的是已停止的 `codex/prompt-composition-api-v3` 组合器方案，这里补充复现后的处理结果。以下插件自身的修复已纳入 **v2.3.0**；新版本以提示词装配追踪与溯源为主题，不再提供旧组合器接口。

原 Q3 的 composer 失败处理、Q4 的 `suggestedCallConfig` 已随组合器方案删除而失去适用对象；不将它们记为新方案中的同名能力已修复。`registerComposer` 和 `pmpDshTavernPrompt` 服务也已移除，旧插件的硬注入依赖需要清理。

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

**验证范围**：当前完整检查 654 项，652 通过、0 失败、2 条件跳过；真实 rc.1 Host 已验证成功正文及两类失败原因在重启后的冷读，v2 没有伪造失败消息。Chrome 也验证了 Trace、RP HTML 和工作区诊断，维护者已完成呈现审核。上述是 Tavern 自身与合成官方消费者的证据，**不是对你们实际插件按新合同完成端到端联调的声明**。

具体证据见 [当前验收范围](https://github.com/Player-MINEPIG/dsh-tavern/blob/codex/trace-api-v3/docs/TRACE_REVIEW.md)。#3 保持关闭；已移出的 Q1 发布计划、Q2 公开接口边界，以及 v2.3.0 的来源正文读取问题，在 [#7](https://github.com/Player-MINEPIG/dsh-tavern/issues/7) 单独回复。
