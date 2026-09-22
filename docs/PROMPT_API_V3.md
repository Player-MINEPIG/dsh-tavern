# 提示词装配 Trace 与 v3 元 API

合同版本：Tavern **2.3.0**，目标 DSH **0.1.7-alpha.1**。
[English](PROMPT_API_V3_en.md) · [API 总览与范围核对](API.md#api-scope) · [开发验证](TESTING.md)

## 定位和兼容

v3 提供逐次装配记录与来源追踪。Tavern Trace 使用同一组 HTTP 接口；第三方也可以通过
DSH 官方 `system-prompt/assemble` 观察、调整和贡献段落，通过 `llm/stream` 观察完整请求。
没有 composer 注册表、唯一 owner、远程回调或当前资源聚合接口。

`/sessions/:id/sources` 不属于 v3 合同，GET 返回 404。当前资源、绑定和配置通过 v1
读取；历史 `sections[].sources` 只描述当时的段落级来源关系。正式发布的 v1/v2 路由保持兼容。
API v3、Tavern 2.3.0 与 DSH 日志格式 V4 是三个独立版本号。

## 消费方读取路径与兼容边界

| 需要的内容 | 读取时机与入口 | 边界 |
| --- | --- | --- |
| 当前卡片、预设、用户、世界书原文与绑定 | 装配前通过 v1 配置预览及资源接口读取 | 当前数据，不是某个历史轮次的快照 |
| 本轮装配后的具名段落 | DSH `system-prompt/assemble` waterfall 中读取 `await next()` 的结果 | 可以同步处理该次结果并返回重排后的 sections；不需要从历史 v3 记录为本轮预取正文 |
| 已记录请求的段落/context 正文 | v3 `/sessions/:id/assemblies/:recordId` | 官方历史引用验证成功后返回；不是运行期组合输入接口 |
| 某条来源在装配前的原始字段正文 | 当前字段用 v1；历史字段没有新增归档接口 | schema 4 不返回 `source.text`，其 `textStatus` 为 `not-stored`；不能以官方段落或当前资源冒充历史原字段 |

官方段落可以经过宏展开、角色覆盖或多个来源混合。因此“读取对应的官方段”得到的是该段的
装配结果，并不等于取回某一个来源字段的原文。特别是 `{{original}}` 混合段，不能按名字或
字符数把正文重新拆成来源字段。schema 4 选择不再保存来源正文；这不是等待完成的占位能力。

当前具名段落遵循本文说明的 `pmp-dsh-tavern:part:<ordinal>:<kind>:<field>` 形式。
ordinal 至少补齐四位，随本次实际段落顺序变化；kind/field 来自首个来源，不是所有贡献者的清单。
名字可用于识别本版本的 Tavern 段，但不是跨轮次、跨版本的资源身份，也不保证一段只含一个字段。
按字段调整段落的插件应识别目标版本/合同，检查匹配结果；零匹配或歧义时明确提示，不能静默
贡献空段或复用上一轮缓存。来源归属以记录的 `sources[]` 为准。

需要调整本轮顺序时，可以使用官方 waterfall 返回当前装配结果；同步 section provider 的限制
不意味着必须先异步读取 HTTP 历史。waterfall 的实际执行顺序及其他插件的后续修改仍会影响结果，
本 API 不保证某个插件的段落永远排在最后。最终系统文本需要在 `llm/stream` 边界核对，参见
[官方观察示例](examples/official-prompt-observer.mjs)。只读 HTTP 消费方本身不能通过 v3 修改本轮装配。

已发布的 v1/v2 文档路由与响应语义继续是公开合同，包括 v1 世界书决策审计；内部存储布局、
DOM 和未文档化服务不属于 HTTP 合同。v3 消费方应核对所用版本的文档，并检查
`capabilities.contract === "prompt-trace-primitives"`，不能仅凭 `apiVersion: 3` 判断与旧组合器候选兼容。
旧候选的 composer、owner/mode、`suggestedCallConfig` 与 `/sources` 聚合不在现合同内。
正式版本的合同以对应 tag 的文档为准；新字段、可空字段和明确的 unavailable 状态须按文档处理。

## 最小只读 HTTP 接口

根路径 `/pmp-dsh-tavern/api/v3`。所有接口只读，沿用现有 TCP peer、Host 与 Origin 检查，
响应带 `Cache-Control: no-store`。显式 sessionId 和 recordId 必须 URL 编码。

| 方法 | 路径 | 作用 |
| --- | --- | --- |
| GET | `/capabilities` | `{ok,apiVersion,contract,...}`；能力与容量限制 |
| GET | `/sessions/:sessionId/assemblies` | `{ok,sessionId,records,storage}`；不含段落/context/系统消息正文的历史索引 |
| GET | `/sessions/:sessionId/assemblies/:recordId` | `{ok,record}`；按需冷读取一条历史详情 |

`recordId` 是不透明 ID。记录不存在或被容量策略淘汰时返回 404，不能据此认定该轮没有
Tavern 提示词。无效输入 400，非 GET 405，内部错误返回脱敏的 500 `TRACE_READ_FAILED`。
历史详情使用 Session controller 的只读 inspect，不激活或恢复 Agent，也不重新运行装配。
capabilities 不包含 `currentSources` 或 `maxSourceBytes`。

```js
const base = '/pmp-dsh-tavern/api/v3';
async function read(path) {
  const response = await fetch(base + path, { credentials: 'same-origin', cache: 'no-store' });
  const data = await response.json();
  if (!response.ok || !data.ok) throw new Error(data.error ?? `HTTP ${response.status}`);
  return data;
}
const sessionPath = `/sessions/${encodeURIComponent(sessionId)}`;
const { records } = await read(`${sessionPath}/assemblies`);
const latest = records.at(-1);
const detail = latest
  ? await read(`${sessionPath}/assemblies/${encodeURIComponent(latest.id)}`)
  : null;
```

空索引成功示例：

```json
{
  "ok": true,
  "sessionId": "example-session",
  "records": [],
  "storage": {
    "kind": "bounded-assembly-references",
    "maxRecords": 256,
    "maxRecordBytes": 2097152,
    "maxTotalBytes": 16777216
  }
}
```

空索引仅表示当前没有可返回的记录。索引和详情两次读取之间记录仍可能被淘汰。

## schema 4 记录

新 v1 审计和 v3 装配数据共享 `tavern-trace-records.json` 中同一条 schema 4 record。
`captureId` / `legacyCaptureId` 关联同一次采集，避免按可复用的 turn/step/attempt 或旧 v1 ID
猜测身份。`sessionId/turn/step/attempt` 说明请求位置；同一轮可以有多个 step，同一位置也可有
多次请求观察。attempt 只计 Tavern 看见的采集，不代表所有网络重试，也不等同于官方
`assistant/attempt` 编号。观察到请求不证明远端模型成功响应。

| 字段 | 定义及边界 |
| --- | --- |
| `schemaVersion` | 新记录固定为 `4` |
| `sections / contexts` | 只持久化 name/index、字符/UTF-16/UTF-8 计数、hash、provenance、sources metadata 与官方 reference；不持久化 `text` |
| `sources[]` | 保存 kind/resourceId/resourceRevision/field/identifier/role/relationship、hash 与计数；`role` 是 preset 请求的 role，`textStatus: "not-stored"`，不保存或恢复 `source.text` |
| `selection / audit` | 当次绑定与 v1 兼容的资源、世界书决策摘要；不随当前资源修改更新 |
| `sessionRef` | session 身份、格式版本、创建时间与读取截点，用于约束冷读取 |
| `systemMessageRefs` | LLM 层系统消息的官方事件引用；不持久化 `systemMessages` 副本 |
| `parameters` | 可选 `{requested,effective,fallbacks,attempt}` preset 参数准入 metadata；旧记录可缺省 |
| `delivery` | provider/model、工具名、系统 hash、日志版本/截点与核对结果 |
| `delivery.assemblyVerified` | 候选装配全文唯一匹配一个完整系统消息时才为 true |
| `delivery.historyVerified` | `assemblyVerified` 为 true，且匹配的系统消息建立了可读取的官方历史引用时才为 true |
| `delivery.systemMessageIndex` | 核对成功时的系统消息序号，不是全部聊天消息序号 |
| `failureRef` | 可选的官方失败事件引用，包含独立 session 身份/读取截点、事件 seq/type/hash；不扩大提示词引用的截点 |
| `failureStatus` | 有引用时索引为 `reference-only`；详情核验后为 `available` 或 `reference-unavailable` |
| `failure` | 仅详情核验成功时返回 `{code,message}`，字段为字符串或 null；不持久化 |
| `failureReferenceError` | 失败引用不可用的原因；不影响仍可验证的提示词正文 |

新记录的 `bodyStorage` 为 `official-session`，`sourceTextStored` 为 false。状态包括
`assembled`、`request-observed`、`request-unconfirmed`、
`request-failed-before-observation`、`assembly-or-preparation-failed`、
`superseded-unconfirmed` 与 `unloaded-unconfirmed`。失败记录不保存异常正文。
索引中的新记录通常保留落盘状态 `contentStatus: "reference-only"`；schema 4 详情读取后，
正文恢复状态变为 `available`、`partially-available` 或 `reference-unavailable`。
`assembly-unavailable` 与 `omitted-size-limit` 不会被详情读取覆盖。

### preset 参数诊断

`parameters.requested` 记录为请求提议的 preset 覆盖，`parameters.effective` 记录 DSH/adapter 默认处理后在实际 `llm/stream` 边界观察到的值；到达该边界前失败的请求不能证明已经生效交付。`parameters.attempt` 为参数策略尝试编号，与 Trace attempt 及官方 stream 身份分别解释。

`parameters.fallbacks` 的每项包含 `parameter`、`stage`（`preflight` 或 `provider`）、`reason: "parameter-rejected"`、`code` 以及可选 `status`。它们是有界 metadata，不是 provider 响应正文。不支持的 preset reasoning effort 在预检时省略并交给 adapter 默认。符合条件的明确 provider 参数拒绝可在输出前省略生效 preset 覆盖，每字段至多一次、运行期至多四次重试。取消、任何已输出内容及无关错误不触发 Tavern 重试。原 preset 不变；旧记录缺少诊断时不从当前配置补造。

### 失败详情

失败原因优先引用本次请求的官方 `assistant/attempt` 中 finish chunk 的 `reason.failure`；装配、准备或流中间件
异常没有该原因时，引用官方 `turn/end.reason.error`。一次详情调用仍只做一次 cold inspect，
分别验证提示词和失败事件。错误正文仅在响应时读取，不放入 Trace 文件或索引；官方日志缺失、
截断或被修改时，返回明确的失败引用不可用状态。较早没有引用的记录不补造错误原因。

`status: "request-observed"` 与 `failureStatus` 可以同时出现：请求到达 LLM 层之后仍可能失败。
重试是另一条记录，失败尝试的原因不转移到成功尝试；下一步装配失败也不归到上一条成功请求。
每条记录保留最具体的一处失败来源，不提供完整错误因果链，也不把某次失败解释成整个 turn
最终失败。`failure` 缺失不证明成功，取消等没有官方 error 原因的事件也不会被伪造成错误。

RP 前端和 v2 `/messages` 继续只投影消息，不添加失败占位。需要失败详情的调用方读取 v3；
该能力不会改变 RP 对话显示，也不会写入 assistant 历史。

## 官方历史引用与按需恢复

采集器只在当前公共模型 surface 上建立可验证引用：

- DSH 日志 V4 的 system section 指向对应 `system/message`，并记录 UTF-16 range；
- 保留的旧格式引用可能指向 `request/header.system`；当前支持的 Host 新请求使用 V4；
- context section 指向带 `source.kind: "runtime-context"`、`form: "snapshot"` 的官方 `user/message` snapshot 及其具名 source section；历史 V3 plugin wrapper 仍可识别；
- 每条引用绑定 event seq/type、正文 hash 与固定 log cut；message 型引用还绑定 message ID
  和内容 hash，段落引用再绑定 range 或具名 source section。

这些是 DSH 官方事件视图中的逻辑坐标，不是压缩日志文件的字节偏移。一次 schema 4 详情请求
对目标 Session 执行一次 cold inspect，再在返回的官方事件视图中核对引用。长会话仍可能有明显
读取成本；本合同不承诺日志随机访问或 O(1) 详情读取。

详情读取会冷查官方 Session 历史，并验证 session ID、格式版本、创建时间、log cut、事件类型、
message ID、内容 hash、range 和目标段落 hash。全部通过后才返回 `sections[].text` 或
`contexts[].text`。已捕获非空 `systemMessageRefs` 时，只有全部解析成功才返回临时的
`systemMessages`；其中任一引用解析失败时，`requestContentStatus` 为 `reference-unavailable`。
未建立系统消息引用的记录不承诺出现 `requestContentStatus`。

新 schema 4 的来源输入没有对应的官方历史正文引用，因此其 `source.text` 永不返回。详情仍提供
来源 hash、计数与 `textStatus: "not-stored"`。旧 schema 3 详情仍可能返回升级前已经保存的来源正文。
调用者可以通过 v1 查看**当前**资源，但不得把当前正文冒充历史来源。

Session 缺失、截点被清理、身份/格式/hash/range 不匹配或读取失败时，详情使用
`reference-unavailable`、`partially-available` 及具体 `referenceError` 表示；不会重跑装配、
读取当前卡片补造、或退回插件保存的另一份全文。`assembly-unavailable` 与
`omitted-size-limit` 也保持显式。DSH durable history 是正文权威，Trace 只是可淘汰的索引和解释层。

## 历史引用的单向升级

[离线升级](DSH_0.1.7_MIGRATION.md) 先验证官方 source/target 迁移，再改写正文/失败事件坐标、log cut、delivery 版本与 audit 坐标。V3→V4 引用必须在两代日志中解析出相同正文/错误内容；同时校验 Session 身份、hash 与记录内部格式标记的一致性。替换任何插件文件之前保留 `.pre-v4-coordinates` 备份，重复运行跳过已完成的 V4 记录。

V3 之前的 `request-header-system` 正文引用明确不在此升级能力内，会在插件发布前拒绝。读取器不猜测替代 system-message 引用，不在 GET 中改写，也不从当前资源重建历史正文。因此 Host 升级后，未转换引用可能继续明确不可用。schema 3 已存快照正文仍是历史副本，不是重新恢复出的证据。不提供回滚工具。

## 装配与来源语义

loader 按预设顺序展开 marker、角色覆盖、宏、lore 和 fallback，再输出官方
`{name,text}` sections。名称使用 `pmp-dsh-tavern:part:<ordinal>:<kind>:<field>`；ordinal
表示本次实际顺序，不是稳定资源 ID。Tavern 不向模型正文添加 profile/preset 名称、ID 或
`st-prompt` / character / user / world-info 识别包装；作者正文中本来存在的同名标签保持原样。
段落仍以两个换行连接。

`sources` 在装配时采集，而不是从输出反推。`sourceMapping: section-contributors` 只承诺段落级
输入关系，不承诺字符映射。`{{original}}` 可让一个段落包含多个来源；未使用 original 的覆盖会将
被替换预设标为 `placement-only`。preset 请求的 role 只保留在 source metadata，实际贡献仍都是
system section。

官方装配对象不保留注册时的数字 order；记录的 `index` 是实际数组位置。`offsetUtf16` 包含段间
两个换行，只有 `delivery.assemblyVerified` 为 true 且引用验证成功时才能定位官方系统消息。
characters 是 Unicode 码点数；utf16Units 与 utf8Bytes 也不是 token 数。

### 世界书条目标识

新采集的 `kind: "worldbook"` 来源使用下列字段，正文仍不另存：

| 字段 | 含义 |
| --- | --- |
| `resourceId` | 世界书资源 ID；内嵌书为 `character:<cardId>:embedded-world-book` |
| `entryId` | 归一化后的书内 UID，统一为字符串；缺失时为 null，不从完整 ID 猜测 |
| `qualifiedEntryId` | Loader 的完整条目标识，通常为 `<resourceId>:<uid>`；缺失时为 null |

例如 v1 审计 `entryId: "7"` 对应新 v3 来源的 `entryId: "7"`，其 `qualifiedEntryId`
为 `book-a:7`。在同一次记录的 `audit.worldBooks[].decisions[]` 中，按
`resourceId + entryId` 关联；不能只用 UID，因为不同世界书可以使用同一个 UID。
v1 审计受既有数量和字符串长度上限约束：UID 超过 120 个 UTF-16 单位、资源 ID 超过 200
个单位会带省略号截断；v3 来源保留完整标识。缺项、截断或重复 UID 时不得假定唯一匹配。
`entryName` 是条目 comment/name 的显示摘要，允许为空，不能用作身份。

较早候选的历史来源没有 `qualifiedEntryId`，其 `entryId` 可能是完整 Loader ID；这些记录
只读保留，不改写。以字段是否存在区分，不仅按 schemaVersion 判断；无法确认时显示未知。
`activeLoreEntries` 等 Loader 字段继续使用完整 ID。

Loader 展开 `{{char}}` 时，空或全空白 nickname 回退到角色 name；有效的显式宏上下文
和非空 nickname 仍优先。此规则也用于导入上下文的宏展开。

## 持久化、兼容读取与容量

`tavern-trace-records.json` 是新 canonical schema 4 存储，以 0600 临时文件原子替换。它只保存
metadata 和官方引用，不保存新的 section/context/system-message/source 正文副本。

兼容读取将 `tavern-traces.json`（v1 元数据）与 `tavern-assemblies.json`（schema 3 正文快照）
在普通 Host 使用中只读保留，不按新容量自动缩减。显式离线坐标升级可在保留升级前备份后改写其中已验证的 audit 坐标，已有快照正文不变。旧 v1 兼容视图仍保留每 session 最多
128 条的既有列表边界；所有新采集的实际 retention 由 schema 4 store 控制。旧 v1 记录继续以
`legacy-metadata-only` 出现在 v3；旧 schema 3 详情仍可读取其原来保存的正文。兼容读取不表示
新记录继续复制正文，也不会用旧全文为新记录兜底。

同一存储目录所有会话共享默认 256 条、总计 16 MiB、单条 2 MiB。可配置单条与总容量，硬上限
分别为 4 MiB 与 32 MiB；记录数固定。最早记录先淘汰。单条 metadata/reference 超限时保留
`omitted-size-limit` 的最小记录，不裁剪出貌似完整的详情。损坏 JSON 明确报错；采集/写盘失败只记
不含正文的诊断且不阻断模型请求。容量策略从不删除 DSH 历史。

新 schema 4 文件本身不含提示词正文，但 reference metadata、资源 ID、模型名与工具名仍可能敏感；
详情 API 还可能从 DSH 历史返回提示词正文。本地数据目录和 API 应按 DSH Session 数据保护。

## UI 与第三方边界

Tavern Trace 先展示当次保存的配置/资源摘要，再按需展开世界书决策和 loader 装配。段落/context
正文可验证恢复时显示；schema 4 来源只显示 metadata/hash/counts，不显示 `source.text`，旧 schema 3 记录仍可能包含标为旧快照的来源正文。无法恢复时显示
具体不可用原因。当前 v1 资源可辅助排查当前配置，但 UI 不把它标为历史原文。

[HTTP 只读示例](examples/trace-reader.mjs) 不 import Tavern；
[官方接口示例](examples/official-prompt-observer.mjs) 不依赖 v3。读取索引或详情不会触发装配。
第三方可以在官方 waterfall 中重排/替换 Tavern `:part:` sections；导入 context 与 RP policy 是
独立贡献。采样建议仍经 `agent/request`，本 API 不仲裁第三方组合顺序。
