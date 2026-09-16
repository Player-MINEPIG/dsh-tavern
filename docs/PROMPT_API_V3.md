# 提示词装配 Trace 与 v3 元 API

状态：2.3.0 候选，未发布。目标 DSH **0.1.5-rc.1**。
[English](PROMPT_API_V3_en.md) · [验收](TRACE_REVIEW.md)

## 定位和兼容

v3 提供当前来源与历史装配记录，第三方自行选择组合流程。Tavern Trace
使用同一组 HTTP 接口。第三方也可以使用 DSH 官方 `system-prompt/assemble`
观察、调整和贡献段落，使用 `llm/stream` 观察完整请求；无需导入 Tavern 代码。
没有 composer 注册表、唯一 owner、强制回调格式或远程回调。

这份合同取代未发布的 `prompt-composition-api-v3` 候选。
旧候选 `prompt-sources` 改为 `sources`；`prompt-mode`、`registerComposer`、
`pmpDshTavernPrompt` 不在本次合同中。正式发布的 v1/v2 路由继续存在；
v1 `/traces` 仍是原来的有界元数据审计，世界书 `decisions` 字段保持兼容。
API v3、Tavern 2.3.0、DSH 日志格式 V3 是三个独立版本号。

## 装配与来源

loader 按预设顺序展开 marker、角色覆盖、宏和兜底字段；原来的块边界映射为
官方 `{ name, text }` section，名称为 `pmp-dsh-tavern:part:<ordinal>:<kind>:<field>`。
ordinal 是该次输出的顺序，不是跨轮资源 ID。预设、角色和世界书可以交错。
Tavern 在调用装配处理链的 `next()` 前展开自己的段落，后续监听器可以直接操作。
保留现有 XML 风格标签和 `\n\n` 分隔符，因此正常模式的模型正文不变。
`pmp-dsh-tavern:profile` 保留给导入上下文；RP policy、工具及 DSH 历史仍由原组件负责。

`main` / `jailbreak` 是 ST 预设内部条目标识。`{{original}}` 可以让一个段落包含
多个输入来源；不为了区分来源而插入新换行。`sources` 保存装配时收集的来源，
不是从输出正文反推。`sourceMapping: section-contributors` **只承诺段落级输入关系**，
不声称输入字符串每个字符都出现在输出，也不提供猜测的字符映射。
未使用 original 的角色覆盖将预设条目标为 `relationship: placement-only`。
`input` 表示参与展开的输入，文本可能因宏、条件等被转换或移除。

来源含 `kind/resourceId/resourceRevision/field/text/relationship` 和三种字数。
`field` 是装配器逻辑字段（例如 `systemPrompt/greeting`）或预设条目路径；
并非一律指向导入 JSON 的 JSON Pointer。`text` 是当时交给装配器的归一化输入，
可能已 trim；要读取完整原始导入字段，请使用当前 sources 的 `documents.*.source.raw`。
世界书来源额外含 `entryId`，其资源身份来自 matcher 的明确资源元数据。
外部段落没有 Tavern 来源时标为 `unknown`；段落同名但正文被改写也不会继承旧来源。

官方装配对象不保留注册时的数字 order；v3 使用 `index` 表示实际数组排列。
`offsetUtf16` 是候选 system 文本内的起点，包含段间两个换行。
它仅在 `delivery.assemblyVerified` 为 true 时，可定位到对应实际系统消息中。
字符数 `characters` 是 Unicode 码点；另有 UTF-16 单元与 UTF-8 字节，均不是 token 数。

## 最小 HTTP 接口

根路径 `/pmp-dsh-tavern/api/v3`。所有接口只读，沿用现有 Host/Origin/TCP peer
访问控制，不放宽跨域；响应 `Cache-Control: no-store`。显式 sessionId 必须 URL 编码。

| GET 路径 | 响应 |
|---|---|
| `/capabilities` | `{ok, apiVersion, contract, currentSources, historicalAssemblies, officialSections, sourceMapping, maxSourceBytes, storage, ...}` |
| `/sessions/:sessionId/sources` | `{ok, sources}`：当前绑定和来源快照 |
| `/sessions/:sessionId/assemblies` | `{ok, sessionId, records, storage}`：有界历史索引，不带正文 |
| `/sessions/:sessionId/assemblies/:recordId` | `{ok, record}`：某次历史快照 |

`recordId` 是不透明 ID。404 表示记录不存在或已被容量策略淘汰，不能当成“该轮未注入”。
旧 v1 记录通过 v3 以 `legacy-metadata-only` 提供；没有历史正文时不会重新装配补造。
无效输入 400，非 GET 405，缺失资源快照 409，超大 sources 413；内部读取错误返回
脱敏的 500 `TRACE_READ_FAILED`。历史查询不要求 Agent 在线，也不激活 Agent。
当前 sources 经公开 Host coordinates 检查会话存在。

### 当前 sources

- `selection`：会话绑定、角色选项、开场序号等；`worldBookSelection`：各来源绑定与去重后的顺序。
- `documents`：当前 `preset/character/user/worldBooks`，包含保留的导入原文及未知扩展。
- `greeting`：请求序号、有效序号、正文及 `first-turn-reference` 语义。
- `fieldLengths`：以 documents 为根的 JSON Pointer → 三种计数。
- `suggestedCallConfig`：预设的可映射采样建议，读取不等于应用。
- `revision`：当前快照哈希；不能用于表示历史装配、世界书命中或模型请求身份。

当前快照最多 16 MiB（含元数据），超限整体拒绝，不截断字段。读取不运行装配、
世界书匹配、随机宏或开场消费。编辑后的归一化文档优先于 `source.raw` 导入快照。

### 历史 record

`sessionId/turn/step/attempt` 关联请求位置，一轮可有多个 step 和重试。
`recordedAt` 是采集时间；索引和详情使用相同 ID。attempt 根据仍保留的记录递增；
淘汰后不能用 attempt 代替不透明 recordId 作为持久身份。

- `sections/contexts`：在 Tavern 装配处理链返回点采集的渲染结果，含来源、计数和哈希。
- `selection`：装配时绑定；`audit`：该次 v1 兼容的资源/世界书决策摘要。
- `systemMessages`：在 `llm/stream` 观察到的系统消息文本，不含普通聊天历史或工具正文。
- `delivery`：请求的 provider/model、工具名称、系统消息哈希、会话日志版本和截点（可用时）。
- `delivery.assemblyVerified`：候选 system 全文在实际请求中有且仅有一次完整系统消息匹配。
  为 false 时只说明不能证明一致，可能是 complete 覆盖、其他插件变更、重复正文或尚未发起。
- `delivery.systemMessageIndex`：核对成功的系统消息序号；不是所有聊天消息中的序号。

状态：`assembled`（尚未观察到请求）、`request-observed`（到达 LLM 层，**不代表远端
模型成功响应**）、`request-unconfirmed`、`request-failed-before-observation`、
`assembly-or-preparation-failed`、`superseded-unconfirmed`、`unloaded-unconfirmed`。
失败记录不保存异常正文。运行期未确认的记录重启后仍保持未确认，不能凭重启推断成功。
`contentStatus` 为 `available`、`assembly-unavailable`、`omitted-size-limit` 或旧记录状态。

contexts 是装配阶段的上下文，不以 system 全文核对来宣称它们已经进入实际 user 消息。
历史快照不会回读当前卡片重算。DSH 历史仍是权威，Trace 是可淘汰的派生审计数据。

## 持久化与容量

v3 独立保存 `tavern-assemblies.json`，原有 `tavern-traces.json` 不迁移、不扩大正文范围。
为使历史查看不依赖活跃 Host/角色文件，快照保存渲染段、来源输入及观察到的系统正文。
这会含敏感提示词，应和 DSH 本地会话数据同等保护；文件以 0600 原子写入。
不保存凭据配置、完整普通聊天历史、工具参数或结果，不写入 DSH 日志。

默认最多 256 条记录、单条 2 MiB、总计 16 MiB；可用 `traceAssemblies.maxRecordBytes`
和 `maxTotalBytes` 配置，上限分别 4 MiB / 32 MiB。最早保留记录优先淘汰。
单条超限保留明确的 `omitted-size-limit` 元数据，不悄悄裁剪正文。
损坏 JSON 在加载时明确报错；不能通过丢弃历史假装恢复成功。
采集/写盘错误只记不含正文的诊断日志，不阻断模型请求。容量策略不删除 DSH 历史。

## 第三方组合与示例

[HTTP 只读示例](examples/trace-reader.mjs) 不 import Tavern；
[官方接口示例](examples/official-prompt-observer.mjs) 不依赖 v3。
Tavern 内置装配默认仍运行。需要自行重排或替换时，第三方可在官方处理链中明确
修改 Tavern 的 `:part:` 段落；导入上下文和 RP 段是独立贡献，不应顺带删除。
采样配置由官方 `agent/request` 处理；只改装配段落不会自动关闭 Tavern 的采样建议。
多个第三方之间的处理顺序和策略由各自组合决定，本 API 不仲裁。

实时查询建议面板打开且运行中每 1.5 秒刷新索引，详情按需读取；关闭面板取消请求。
客户端必须丢弃会话切换后的过期响应。读取快照不触发装配。
