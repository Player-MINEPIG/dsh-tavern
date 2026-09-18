# Trace 验收

当前版本为 Tavern **2.3.0**，目标 DSH **0.1.5-rc.1**，分支为 `codex/trace-api-v3`。
Trace 实现、自动回归、Host 与 Chrome 验证及维护者呈现审核已完成，具体范围和验证限制见下文。
文档与公告内容待维护者审核，审核通过后再合并 `main`；尚未合并、打 tag 或发布。
实际第三方联调及 Windows 验证仍缺少外部证据。
[English](TRACE_REVIEW_en.md) · [API 与设计合同](PROMPT_API_V3.md) · [周目验收](PLAY_REVIEW.md)

## 当前交付

| 要求 | 实现 |
| --- | --- |
| 按预设装配并识别来源 | 使用官方具名 sections，保留预设顺序、宏和混合输入关系；自动身份包装不进入模型正文，作者自行写入的标签保留 |
| 最小 v3 元接口 | capabilities、装配索引、单条详情三个只读端点；当前资源和配置仍由 v1 提供，RP 流程由 v2 提供 |
| 按轮次回看装配 | 记录 turn/step/attempt、当时配置、世界书决策、来源及官方事件引用；新 v1/v3 采集共用一条 schema 4 记录 |
| 避免重复保存提示词 | 新记录不存系统消息、段落、context 或来源原文副本；详情冷读官方历史并验证身份、格式、截点、事件、hash 与范围 |
| 明确缺失与兼容 | 官方日志缺失或校验失败时提示 unavailable；旧 v1 元数据和 schema 3 快照只读兼容，不自动清理，也不作新记录的正文兜底 |
| 直观查看与第三方组合 | Trace 默认显示当次配置，世界书和 Loader 详情分别折叠；第三方可以选择 v3 或官方装配/请求接口 |

## 已完成的验证

验证环境为 Node.js 22.23.1，官方 CLI 与实际解析的核心依赖均固定到 `0.1.5-rc.1`。
以下为当前代码的验证结果。

- `npm run check`：654 项、652 通过、0 失败、2 个条件跳过。已启用真实 AgentLoop 和
  官方 codec；跳过项为外部私有卡片 fixture 和 opt-in live v2 测试，后者另在真实 Host 执行。
- `npm run verify:2.0`、构建与 206 文件打包检查通过；真实 Host 的 v2 smoke 16/16 通过。
- 自动回归覆盖交错段落、宏/混合来源、Unicode、重试与多步、重启、官方消息复用/替换、继承前缀、
  格式变化、截断/缺失日志、hash/身份/range 错误、未知来源与 complete 覆盖、容量与损坏文件。
- 存储回归确认大卡正文增长不会按正文长度扩大 Trace 记录；v1/v3 只存一份新采集元数据，
  首次 attempt 为 1，旧 v3 的过时 audit 不覆盖旧 v1 最终状态，旧文件字节不变。
- 新建/导入卡片的空昵称和全空白昵称均回退到卡片名；世界书来源分别保存书内 UID 与完整
  Loader ID，旧来源记录保持原样。路径测试已改用平台原生绝对路径，本次未在 Windows 主机运行。
- 真实 rc.1 AgentLoop 的 7 类失败场景通过：提供方失败、重试成功、LLM 中间件失败、首次装配失败、
  请求准备失败、重试准备失败及下一步装配失败。失败归属对应尝试；索引与落盘无错误正文副本，
  详情通过独立官方事件引用读取，缺失或校验失败时明确不可用，RP 不增加失败消息。
- 独立 Web Host 通过 HTTP 验证正常装配、提供方失败和装配失败；真正停止/重启 Host 后，
  未附着目标 Session/Agent 即可回读相同正文与失败原因。读取没有激活会话或改写 Trace 文件，
  v2 仍只包含成功产生的助手消息。
- 真实 Host + 合成模型验证带预设轮次的 23 个段落和 2 条 Tavern 来源；移除请求 fixture 并重启后，
  未重新装配也可回读同一记录。两条样本记录合计约 34 KiB，仅为样本，不是固定容量估算。
- Chrome 在端口 `18977` 的测试环境中验证了两张真实卡片之间的切换，无串会话；Trace 配置优先、
  世界书命中/拒绝、Loader 交错段落与官方正文核对均已检查。来源原文未另存及请求 ST role 说明可见。
  Trace 的段落原文按文本展示，不执行 HTML；实际模型消息中没有自动生成的身份包装。
- Chrome 已检查 `1024×768` 和 `1280×900` 窗口、Tavern 125% 缩放、中英文、DSH 亮/暗/系统主题，
  以及原生/魔丸切换；完成后恢复中文、100% 缩放和系统主题。
- RP 完整 HTML 围栏的源码显示问题已修复并在 Chrome 核验：真实卡片的 4 个完整文档分别渲染为
  独立 Shadow DOM 面板，静态标题、主题颜色和背景可见，变量更新标记仍不在 RP 显示。
  另有 32 项合成 Chrome 检查通过，覆盖完整文档围栏、根 CSS 变量、渐变简写及 CSS import 的字节保留、
  文档间样式隔离、脚本过滤、流式闭合与实际 `staticHtmlExport`。这不代表依赖 JavaScript/MVU 的动态数值和按钮已实现。
- 已使用测试环境配置的真实模型完成普通回复。执行停止生成后，输入栏恢复发送控件；只读核查确认
  该请求的 31/31 段仍可通过官方引用读取，Tavern 未伪造成功或错误。该轮官方持久化日志停在
  `step/end`，缺少 `turn/end`；官方冷读仅在内存补出 `interrupted`。这不能证明用户取消原因已完整落盘，
  无官方失败信息时 v3 不补造 `failure`。核查前后日志和 Trace 文件不变。
- DT「诊断」集中展示当前 RP 工作区读取问题；Chrome 已验证五个真实不可用周目（其中两个时间线为空）的警告、摘要关闭、
  单项/全部详情、技术详情折叠、重新检查、刷新页面后保留关闭偏好，以及原生/魔丸切换。
  窄窗口无横向溢出，合成页面的英文显示、工作区整体失败、恢复和复发提示通过；复制全部报告
  已通过本机粘贴核对 JSON 结构。新增 29 项状态/异步补绑测试覆盖并发读取、关闭偏好、存储不可用和取消队列，
  以及空周目、归档/移出工作区、列表加载顺序和恢复后的自动清除。健康的空周目保持可用且无警告。
  面板没有持久日志或新 API；诊断不会自动恢复缺失日志。
- 控制台出现的 CSSPeeper inspector / FileSaver unload 警告来自浏览器扩展，不归因于 Tavern。
  三个 404 均明确为旧日志缺失的 `PLAY_SESSION_NOT_FOUND`；诊断面板显示对应原因，未阻断有效 RP 会话。
- 测试环境的安装文件与验证包逐字节匹配；实际解析的核心包版本一致。更新已安装的运行中 Host
  后，需要重启才会加载新后端。
- 维护者已完成 RP 富文本、Trace 信息层次与交互的呈现审核。

复验时将两个环境变量指向可解析目标 DSH 模块的依赖目录（包含 `package.json`）。
安装版 CLI 通常可以共用一个根；源码检出中 format 包和 Host 包可能位于不同目录，
两个变量可以分别设置。`DSH_TAVERN_COMPAT_ROOT` 需要解析 session format/catalog/迁移包及
session controller；`DSH_TAVERN_PROMPT_COMPAT_ROOT` 需要解析 Cordis、SystemPrompt、AgentLoop
等 Host 包。测试按指定根解析模块，不自动搜索 `apps/cli` 或其他工作区目录。

```sh
DSH_TAVERN_COMPAT_ROOT="$DSH_RUNTIME_ROOT" \
DSH_TAVERN_PROMPT_COMPAT_ROOT="$DSH_RUNTIME_ROOT" npm run check
DSH_TAVERN_COMPAT_ROOT="$DSH_RUNTIME_ROOT" \
DSH_TAVERN_PROMPT_COMPAT_ROOT="$DSH_RUNTIME_ROOT" npm run verify:2.0
```

未设置变量时相应集成测试会跳过，不能把跳过当成验收通过。仓库内可复现的真实 AgentLoop
路径见 `test/trace-v3-host.test.mjs` 和 `test/trace-failures-host.test.mjs`。上面的真实模型和卡片验证
是独立的浏览器证据；合成故障通过不证明真实提供方的超时/重试或实际第三方插件已经验收。

## 剩余外部验收

已完成的 API、Host 和 Chrome 项目不再要求维护者逐项重做。剩余范围为：

1. **实际第三方插件联调。** 由插件开发者使用 [v3 reader](examples/trace-reader.mjs) 或 [官方 observer](examples/official-prompt-observer.mjs) 接入自己的界面与流程，确认来源展示、加载顺序和采样策略。官方接口的观察、重排、改写与 complete 覆盖已用合成插件验证；这不能代替对方真实插件的验收。
2. **Windows 环境验证。** 平台路径夹具已经修正，但本次没有 Windows 主机证据，需要在 Windows 运行存储路径及安装相关检查。

反馈问题时提供测试环境、操作步骤、预期/实际结果，必要时附会话 ID、turn/step/attempt 和 recordId；公开报告避免包含私密提示词正文。

## 可选复验

更换构建、环境或发现新问题时，可按 [安装文档](INSTALLATION.md)安装对应版本并重启 Host，再使用上面的命令复验。以下是定向排查入口，不是新增人工必做清单：

- **接口和配置：** capabilities 应为 200，旧 `/sessions/:id/sources` 为 404；当前绑定用 v1 `POST /session-configurations/preview`，历史记录用 v3 索引/详情。当前配置查询不应产生新的历史记录；`/active` 会运行装配，不能用于验证这一点。
- **装配和引用：** 对照官方系统正文检查顺序、换行和核对状态；来源是段落级输入关系，不是逐字符映射。世界书关联使用 `resourceId + entryId`，`qualifiedEntryId` 保存完整 Loader ID。修改当前资源后，旧详情仍依赖旧官方日志；在测试副本移走日志应明确不可用，不能补造。
- **失败和迁移：** 官方日志含失败原因时，v3 详情通过引用返回 `failureStatus` 和 `failure`，RP 不增加失败助手消息。旧周目坐标按 [迁移指南](DSH_0.1.5_MIGRATION.md)处理；卸载回退只在测试 profile 验证。

## 当前限制

Trace 是有界的近期追踪：所有会话共享默认 256 条、总计 16 MiB、单条 2 MiB 的新记录容量。
元数据和来源关系被淘汰后不能只凭官方消息完整重建；淘汰不删除 DSH 历史。
正文能否显示依赖官方日志保留且校验通过；元数据中的名称、关键词等仍可能敏感。
来源是段落输入关系，不是逐字符 source map。请求的 ST role 是元数据，当前贡献仍为 system sections；
不支持任意消息深度、独占接管或永久归档。来源原文不另存；当前资源通过 v1 查询。

RP HTML 面板支持经过过滤的静态 HTML/CSS；脚本不执行，依赖 JavaScript/MVU 的动态数值和按钮尚未实现。
Trace 中的提示词原文仍按文本展示，不执行 HTML。

真实提供方的超时和重试尚未人为诱发；目前相关失败归属由上述 7 类真实 AgentLoop 合成故障覆盖。
这不是同一提供方端到端故障验收，也不要求维护者重复已完成的全部检查。

一个 Host 写一个存储目录，不承诺多进程并发写入。冷 inspect 使用逻辑事件坐标，不提供压缩日志的
O(1) 随机读取。保留的较旧 DSH 路径不扩大本次目标运行时的验证范围。
