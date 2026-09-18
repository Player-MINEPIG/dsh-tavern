# 提示词装配 Trace 与 v3 元 API

状态：Tavern 2.3.0 候选，未发布；更新于 2026-09-18。目标 DSH **0.1.5-rc.1**。
[English](PROMPT_API_V3_en.md) · [API 总览与范围核对](API.md#api-scope) · [验收](TRACE_REVIEW.md)

## 定位和兼容

v3 提供逐次装配记录与来源追踪。Tavern Trace 使用同一组 HTTP 接口；第三方也可以通过
DSH 官方 `system-prompt/assemble` 观察、调整和贡献段落，通过 `llm/stream` 观察完整请求。
没有 composer 注册表、唯一 owner、远程回调或当前资源聚合接口。

已删除未发布的 `/sessions/:id/sources` 候选，GET 返回 404。当前资源、绑定和配置仍通过 v1
读取；历史 `sections[].sources` 只描述当时的段落级来源关系。正式发布的 v1/v2 路由保持兼容。
API v3、Tavern 2.3.0 与 DSH 日志格式 V3 是三个独立版本号。

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
| `delivery` | provider/model、工具名、系统 hash、日志版本/截点与核对结果 |
| `delivery.assemblyVerified` | 候选装配全文唯一匹配一个完整系统消息时才为 true |
| `delivery.historyVerified` | `assemblyVerified` 为 true，且匹配的系统消息建立了可读取的官方历史引用时才为 true |
| `delivery.systemMessageIndex` | 核对成功时的系统消息序号，不是全部聊天消息序号 |

新记录的 `bodyStorage` 为 `official-session`，`sourceTextStored` 为 false。状态包括
`assembled`、`request-observed`、`request-unconfirmed`、
`request-failed-before-observation`、`assembly-or-preparation-failed`、
`superseded-unconfirmed` 与 `unloaded-unconfirmed`。失败记录不保存异常正文。
索引中的新记录通常保留落盘状态 `contentStatus: "reference-only"`；schema 4 详情读取后，
正文恢复状态变为 `available`、`partially-available` 或 `reference-unavailable`。
`assembly-unavailable` 与 `omitted-size-limit` 不会被详情读取覆盖。

## 官方历史引用与按需恢复

采集器只在当前公共模型 surface 上建立可验证引用：

- DSH 日志 V3 的 system section 指向对应 `system/message`，并记录 UTF-16 range；
- 旧格式仅在 `request/header.system` 与实际系统正文完全一致时建立引用；
- context section 指向 DSH system-prompt 生成的官方 `user/message` snapshot 及其具名 source section；
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

## 持久化、兼容读取与容量

`tavern-trace-records.json` 是新 canonical schema 4 存储，以 0600 临时文件原子替换。它只保存
metadata 和官方引用，不保存新的 section/context/system-message/source 正文副本。

升级时，旧 `tavern-traces.json`（v1 元数据）与旧 `tavern-assemblies.json`（schema 3 正文快照）
只读保留，不迁移、不改写，也不会按新容量自动缩减。旧 v1 兼容视图仍保留每 session 最多
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
正文可验证恢复时显示；来源只显示 metadata/hash/counts，不显示历史 `source.text`。无法恢复时显示
具体不可用原因。当前 v1 资源可辅助排查当前配置，但 UI 不把它标为历史原文。

[HTTP 只读示例](examples/trace-reader.mjs) 不 import Tavern；
[官方接口示例](examples/official-prompt-observer.mjs) 不依赖 v3。读取索引或详情不会触发装配。
第三方可以在官方 waterfall 中重排/替换 Tavern `:part:` sections；导入 context 与 RP policy 是
独立贡献。采样建议仍经 `agent/request`，本 API 不仲裁第三方组合顺序。
