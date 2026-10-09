# Tavern 公开接口索引

[English](API_SURFACES_en.md) · [HTTP 资源与历史合同](API.md) · [前端接入](FRONTEND_INTEGRATION_zh-CN.md)

按所需能力选择接口。HTTP v1 管当前资源与配置，v2 管 RP 元操作，v3 管历史装配 metadata 与经验证的官方引用。当前来源、运行期装配、历史记录各有职责。包入口是程序接口，不是分别安装的插件。

## 稳定边界与依赖

Tavern 单向依赖另行启用的 assembler Host bundle。Memory Manager 为可选扩展，Tavern 与 assembler 的包和服务都不要求它。assembler 拥有策略存储、来源注册和请求排列；Tavern 拥有正文、解析、权限、MVU 提交与 RP 界面。`tavernRequestSources` 是共享 `dshPromptSources` 的别名；旧 Tavern assembly-presets HTTP 转发同一 store/runtime。既有 v1/v2/v3 根路径、资源读取、selection、消息原文、Trace 官方引用、格式 exports、原生 DSH 与卸载回退继续支持。

Tavern 3.0.0 的接口以本文和对应合同为准；旧版本行为查看其 Git tag。响应允许增加字段。当前请求 owner 为 `dsh-prompt-assembler`，历史仍接受 `pmp-dsh-tavern`；卸载来源撤销后续贡献，不删除历史。V4 坐标版本校验、模板未知字段拒绝、来源授权与 CAS 保留。旧调用方不能把完整 GET 响应直接回传为 mutation，不能把当前正文当作历史原文。

## 程序入口

| 公开 import | 作用 | 实现 |
| --- | --- | --- |
| `pmp-dsh-tavern` | Host 插件与兼容 loader 原语 | [source](.././packages/tavern-loader/src/index.js) |
| `pmp-dsh-tavern/format` | ST 格式归一化与宏 | [source](.././packages/tavern-format/src/index.js) |
| `pmp-dsh-tavern/loader` | DSH 资源组合与安全 Host/API 入口 | [source](.././packages/tavern-loader/src/index.js) |
| `pmp-dsh-tavern/world-book` | 纯世界书格式、匹配与投影 | [source](.././packages/world-book/src/index.js) |
| `pmp-dsh-tavern/world-book-library` | 独立世界书存储与 HTTP factory | [source](.././packages/world-book-library/src/index.js) |
| `pmp-dsh-tavern/preset` | 预设存储、选择与 HTTP factory | [source](.././packages/preset/src/index.js) |
| `pmp-dsh-tavern/character` | 角色卡存储、导入导出与 HTTP factory | [source](.././packages/character/src/index.js) |
| `pmp-dsh-tavern/user` | Persona 存储与 HTTP factory | [source](.././packages/user/src/index.js) |
| `pmp-dsh-tavern/trace` | 有界 metadata、官方引用与历史审计 | [source](.././packages/tavern-trace/src/index.js) |
| `pmp-dsh-tavern/session-template` | 无历史的会话配置模板 | [source](.././packages/session-template/src/index.js) |
| `pmp-dsh-tavern/client` | DSH 浏览器插件入口 | [source](.././dist/client.js) |
| `pmp-dsh-tavern/identity` | 插件 ID、版本化 API 前缀 | [source](.././packages/identity.js) |
| `pmp-dsh-tavern/package.json` | 包 metadata | [source](.././package.json) |
| `pmp-dsh-tavern/request-assembler` | assembler 兼容装配原语 | [source](.././packages/request-assembler/index.js) |
| `pmp-dsh-tavern/mvu` | MVU 来源、状态与卡片绑定 | [source](.././packages/mvu-adapter/src/index.js) |
| `pmp-dsh-tavern/prompt-template` | 只读模板语法与有界运行时 | [source](.././packages/prompt-template/index.js) |
| `pmp-dsh-tavern/memory-sources` | 世界书/模板公开资源 adapter | [source](.././packages/memory-sources/index.js) |
| `pmp-dsh-tavern/opening-worldbook` | 开场世界书提案与提交 | [source](.././packages/opening-worldbook/index.js) |
| `pmp-dsh-tavern/opening-worldbook/manifest` | 固定公开开场快照身份 | [source](.././packages/opening-worldbook/manifest.js) |
| `pmp-dsh-tavern/scope-catalog` | 索引化身份目录与作用域租约 | [source](.././packages/scope-catalog/index.js) |

Factory handler 是可组合原语，需挂到文档规定的 Host admission/安全 wrapper；import 不提供认证、模型 grant 或跨资源事务。浏览器调用沿既有安全 fetch。来源私有文件与 `store.requestAssembler` 不是第三方合同。

## HTTP 目录

以下 Tavern 路径相对 `/pmp-dsh-tavern/api`；标识符和 JSON 查询值须 URL 编码。既有 v1 资源、v2 周目/会话/工作区、v3 Trace 路由完整保留在 [API](API.md)。下表补齐来源运行时与草稿路由。

| 方法 | 路径 | 输入与结果 |
| --- | --- | --- |
| GET | `/request-token` | `X-Tavern-Client: embedded`；取得现有桌面 mutation transport 的内存 token |
| GET | `/v1/assembly-presets?sessionId=…` | 策略库、已应用 selection、capability 与来源 descriptor |
| POST | `/v1/assembly-presets` | 策略 JSON 或 `{preset}`；只保存库 |
| GET / PUT / DELETE | `/v1/assembly-presets/:id` | 读取/保存/删除；内置与应用中策略受限制 |
| PUT | `/v1/assembly-presets/selection` | `{sessionId,id}`；保存独立应用快照，`id:null` 关闭；生成中或无协议 1 返回 409 |
| POST | `/v1/assembly-presets/preview` | `{sessionId,preset}` 或 `{sessionId,presetId}`；只读，不含未发送输入 |
| GET | `/v1/assembly-presets/actual?sessionId=…` | 最近 durable `request/assembly` 或 null；不重算 |
| GET | `/v1/mvu/resources?scope=…` | JSON `{authority:'local',sessionId}`；返回 records |
| GET | `/v1/mvu/resource?id=…&scope=…` | 返回 record；只有该 trace read 接受 messageId/endEventId |
| GET | `/v1/mvu/history?id=…&scope=…` | 当前本地 session scope；版本 metadata 与旧值 |
| GET | `/v1/mvu/facts?id=…&scope=…` | 当前本地 session scope；来源执行事实 |
| POST | `/v1/mvu/update` | `{id,scope,content,expectedRevision,operationId}`；来源授权的 CAS，不产生卡片 grant |
| GET | `/v1/mvu/snapshot?scope=…` | 验证 timeline/greeting/initial/draft scope；返回变量与 revision |
| POST | `/v1/mvu/card-binding` | `{scope,grantId,sourceIdentity,bindingId?}`；建立受限执行绑定 |
| POST | `/v1/mvu/card-write` | `{capability,operation,value,expectedRevision,operationId,cause}`；patch/replace 通过 schema/CAS/幂等 |
| POST | `/v1/mvu/card-binding/revoke` | `{capability}`；撤销对应 session/draft 绑定 |
| POST / DELETE | `/v1/rendering-write-grants[/:grantId]` | 完整已下载/开启 execution identity；建立/撤销可信渲染器 grant |
| POST | `/v1/sessions/:id/opening-worldbook/prepare` | 固定来源身份与 opening ID；只读提案 |
| POST | `/v1/sessions/:id/opening-worldbook/commit` | 已审核提案、revision、operationId 与独立写确认；会话专属回执 |
| POST | `/v2/drafts` | `{characterId,source?,selection?,assemblyPresetId?}`；保存草稿与空周目，不创建 DSH 会话 |
| GET / PUT | `/v2/drafts/:id` | 读取；以 `{expectedRevision,selection?,assemblyPresetId?,variables?,importContextRef?,resetVariables?}` 修改，角色身份不能更换 |
| POST | `/v2/drafts/:id/materialize` | `{expectedRevision,operationId,text}`；准备唯一真实 session/request；调用方另经公开 DSH 消息接口提交完全相同的 text/requestId |
| POST | `/v2/drafts/:id/cancel` | 协调取消，保留已接纳历史 |
| GET | `/v2/operation-logs` | 有界诊断查询；筛选与 JSONL 见[操作合同](OPERATION_LOGS.md) |

完整 scope/binding/error 见 [MVU](MVU.md)，位置规则见[装配](REQUEST_ASSEMBLY.md)，世界书写确认见 [API](API.md#会话开场世界书)，草稿受理顺序见[生命周期](ARCHITECTURE.md#无会话开场生命周期)。materialize 本身不发送模型请求。冲突先回读权威状态，再以同一意图重试；不能盲目重复副作用。HTTP 成功不代表模型或 Provider 已完成。

## Host 能力目录

| 能力 | 合同与所有者 |
| --- | --- |
| `dshPromptAssembler`、`dshPromptSources` | 必需的独立 assembler；其公开指南定义 store/runtime/registry |
| `tavernRequestSources` | 协议 1 兼容别名，不是第二个 registry |
| `tavernMvu` | [MVU](MVU.md)：list/read/update/history/facts、scope 快照/绑定、prompt 依赖、来源命令处理器 |
| `tavernMemorySources` | [模板与来源管理](PROMPT_TEMPLATE.md)：世界书/模板 adapter、无正文 listBound 与来源默认租约 |
| `tavernScopeCatalog` | [API](API.md)：searchScopes / resolveScopeContext，只给身份与同步 Host-only checkCurrent |
| `tavernOpeningWorldBooks` | prepare/commit；世界书另行显式确认 |
| `tavernRenderingAuthority` | 可信渲染执行 grant；不开放任意 guest Host 调用 |
| `pmpDshTavernChrome` | [前端合同](FRONTEND_INTEGRATION_zh-CN.md)：native/play 生命周期，消费者拥有并清理自己的 slots |

Host-only 租约与 callback 不是 HTTP 值，不能序列化为权威。来源可见、注册、编辑预设、显示卡片都不授予 prompt 使用或写权限。Stock DSH rc.2 没有 `agentLoop.requestAssemblyVersion === 1`；安装插件不修改核心。实际装配前检查 capability，不可用时保留原生路径。

标准版与可选 core 的能力、迁移及证据范围见[装配策略](REQUEST_ASSEMBLY.md)。对所选后端检查 capabilities() 与 requireAvailable(preset)。
