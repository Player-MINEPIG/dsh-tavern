# v2.3.0 — 提示词装配 Trace 与诊断

> 发布草稿，尚未合并、打 tag 或发布。当前候选分支为 `codex/trace-api-v3`，目标环境为 DSH `0.1.5-rc.1`。

这次更新以 Trace 为主题：提示词按预设顺序贡献到 DSH 官方具名段落，Tavern 记录来源与装配关系；历史正文由 DSH 会话日志提供，第三方可以选择 Tavern v3 或官方接口观察和处理装配结果。

## 提示词装配与 Trace

- 保留预设中的角色卡 marker、宏、覆盖和交错顺序。插件自动生成的来源 ID、`st-prompt` 等识别包装不再进入模型正文；作者原文中的标签保留。
- Tavern Trace 先展示该次配置，再分别展开世界书触发与 Loader 装配。按 turn / step / request capture 区分记录，不把请求观察当作模型成功回复。
- 新 schema 4 只保存配置摘要、世界书决策、来源 metadata、计数/hash 和官方历史引用。v1 审计与 v3 共用一条记录，不按大卡正文大小重复保存片段。
- 详情从官方历史冷读并校验段落/context 正文与失败原因；不激活会话、不重新装配。日志缺失或核对失败时明确显示不可用，不用当前卡片补造历史。旧 v1 元数据和旧 schema 3 快照保持只读兼容。

## 最小 v3 元 API

只提供三个只读入口：`/capabilities`、`/sessions/:id/assemblies`、`/sessions/:id/assemblies/:recordId`。当前资源和配置仍用 v1，周目与工作区元操作仍用 v2。

本版不提供旧候选的 composer / owner / external mode、`suggestedCallConfig` 或 `/sources` 聚合。第三方请检查 `capabilities.contract === "prompt-trace-primitives"`，不能只看 `apiVersion: 3`。

当前资源原文、某轮装配后的段落、装配前的历史来源原文是不同内容。schema 4 不保存或返回 `source.text`；官方具名段落也可能已展开宏或混合多个来源。接入说明和示例见 [v3 合同](https://github.com/Player-MINEPIG/dsh-tavern/blob/codex/trace-api-v3/docs/PROMPT_API_V3.md)。

## 工作区诊断与 RP 修复

- 新增 **DT → 诊断**，原生/RP 模式均可查看。侧栏只留可关闭的摘要；周目旁的 `⚠` 可打开原因、恢复建议和技术详情，支持重新检查、复制报告。
- 相同问题在本标签页刷新或切换模式后不重复提示。空时间线但没有可用会话的周目也会标记；健康的新空周目不误报。诊断不是历史日志，不新增 API 或保存错误正文。
- 修复旧会话日志缺失时阻断新建周目、RP 视图丢失，以及空周目警告漏标的问题。缺失日志仍需从原数据目录或备份恢复。
- RP 与静态 HTML 导出支持闭合无语言/HTML 围栏内的完整 HTML 文档；文档样式分别隔离，保留根变量和渐变等静态效果。模板 JavaScript / MVU 变量系统仍不支持。
- 兼容角色卡 `tags: null`，保留原字段并给出提示；修复空昵称的角色名宏回退，以及没有下一条有效开场白时仍可点击的导航问题。
- 新世界书来源用 `resourceId + entryId` 对应审计条目，完整 Loader 标识另存 `qualifiedEntryId`；失败原因通过官方引用供 v3 读取，RP 不增加失败助手消息。

## 安装与数据

目标 DSH 要求 Node.js `^22.19.0 || >=24.0.0`。发布前测试请使用独立环境并固定候选分支：

```sh
dsh plugin --profile web add github:Player-MINEPIG/dsh-tavern#codex/trace-api-v3
```

升级前停止目标 Host，并同时备份 Tavern 数据、RP 工作区及对应 DSH 会话日志；安装后重启。RP 工作区只含引用，不能单独恢复旧会话。详见 [安装与迁移](https://github.com/Player-MINEPIG/dsh-tavern/blob/codex/trace-api-v3/docs/INSTALLATION.md)。

本候选的 Trace 默认在所有会话间共享 256 条、16 MiB 总容量、2 MiB 单条限制，是近期追踪而非永久归档；淘汰 Trace 不删除 DSH 历史。

## 验证与剩余审核

- 全量检查：**654 项，652 通过，0 失败，2 项条件跳过**；已启用目标 DSH 的真实 AgentLoop 和 codec。
- 发布分组检查、构建、206 文件打包核对通过；另有真实 Host v2 smoke 16/16、重启后正文/失败引用冷读，以及 Chrome 的 Trace、HTML、诊断、刷新与模式切换验证。
- 剩余范围：维护者呈现审核、对方实际插件按新合同联调、原生 Windows 验证。合成消费者和路径测试通过不代表这些已完成。

[完整验收范围](https://github.com/Player-MINEPIG/dsh-tavern/blob/codex/trace-api-v3/docs/TRACE_REVIEW.md) · [使用指南](https://github.com/Player-MINEPIG/dsh-tavern/blob/codex/trace-api-v3/docs/USAGE_zh-CN.md) · [English API contract](https://github.com/Player-MINEPIG/dsh-tavern/blob/codex/trace-api-v3/docs/PROMPT_API_V3_en.md)
