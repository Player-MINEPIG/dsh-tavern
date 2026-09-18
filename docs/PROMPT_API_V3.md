# 提示词装配 Trace 与 v3 元 API

状态：2.3.0 候选，未发布；更新于 2026-09-18。目标 DSH **0.1.5-rc.1**。
[English](PROMPT_API_V3_en.md) · [API 总览与范围核对](API.md#api-scope) · [验收](TRACE_REVIEW.md)

## 定位和兼容

**范围核对：** 已删除与 v1 当前配置重叠的 `/sessions/:id/sources` 聚合接口，GET 返回 404。
历史 `sections[].sources` 的来源关系继续保留。Tavern Trace 只调用装配索引和详情。
当前配置与完整资源通过 v1 读取，详见 [逐项重叠核对](API.md#api-scope)。

v3 提供逐次装配记录与来源追踪（运行中及历史），第三方自行选择组合流程。Tavern Trace
使用同一组 HTTP 接口。第三方也可以使用 DSH 官方 `system-prompt/assemble`
观察、调整和贡献段落，使用 `llm/stream` 观察完整请求；无需导入 Tavern 代码。
没有 composer 注册表、唯一 owner、强制回调格式或远程回调。

这份合同取代未发布的 `prompt-composition-api-v3` 候选。
旧候选 `prompt-sources` 和当前资源聚合 `sources` 均不提供；`prompt-mode`、`registerComposer`、
`pmpDshTavernPrompt` 不在本次合同中。正式发布的 v1/v2 路由继续存在；
v1 `/traces` 仍是原来的有界元数据审计，世界书 `decisions` 字段保持兼容。
API v3、Tavern 2.3.0、DSH 日志格式 V3 是三个独立版本号。

## 最小 HTTP 接口

根路径 `/pmp-dsh-tavern/api/v3`。所有接口只读，沿用现有 Host/Origin/TCP peer
访问控制，不放宽跨域；响应 `Cache-Control: no-store`。显式 sessionId 必须 URL 编码。

| 方法 | 路径 | 作用 | 状态 |
| --- | --- | --- | --- |
| GET | `/capabilities` | `{ok,apiVersion,contract,...}`；能力与容量限制 | 候选已实现 |
| GET | `/sessions/:sessionId/assemblies` | `{ok,sessionId,records,storage}`；不含段落正文的历史索引 | 候选已实现 |
| GET | `/sessions/:sessionId/assemblies/:recordId` | `{ok,record}`；单次历史快照 | 候选已实现 |

`recordId` 是不透明 ID。404 表示记录不存在或已被容量策略淘汰，不能当成“该轮未注入”。
旧 v1 记录通过 v3 以 `legacy-metadata-only` 提供；没有历史正文时不会重新装配补造。
无效输入 400，非 GET 405；内部读取错误返回脱敏的 500 `TRACE_READ_FAILED`。
历史查询不要求 Agent 在线，也不激活 Agent。capabilities 不再包含 `currentSources` 或
`maxSourceBytes`；`storage` 仅描述装配记录的容量限制。

### 请求与响应示例

在已通过 Host 访问认证的同源页面，先读索引，再按返回的不透明 ID 读取详情。
这一过程不运行装配，也不要求 Agent 活跃。

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
const record = latest
  ? (await read(`${sessionPath}/assemblies/${encodeURIComponent(latest.id)}`)).record
  : null;
```

空索引成功示例（HTTP 200）：

```json
{
  "ok": true,
  "sessionId": "example-session",
  "records": [],
  "storage": {
    "kind": "bounded-assembly-snapshots",
    "maxRecords": 256,
    "maxRecordBytes": 2097152,
    "maxTotalBytes": 16777216
  }
}
```

空索引只表示没有可返回的保留记录，不证明会话从未运行。索引与详情两次读取之间
记录也可能被淘汰，此时详情返回 404。

### 历史 record

`sessionId/turn/step/attempt` 关联请求位置，一轮可有多个 step 和重试。
`step` 来自 DSH：同一轮内继续处理工具结果等情况会进入下一步。`attempt` 是 Tavern
在同一 session/turn/step 下监听 `agent/request` 的采集序号。DSH 上层重试会再次触发该事件，
此时可复用已有装配结果，因此增加 `attempt` 不等于重新装配。Tavern 只监听，不主动重试。
它不是所有底层网络重试的计数，也不是官方 `assistant/attempt` 事件的逐条编号；
未重新触发 `agent/request` 的传输重试不会新增它。

`recordedAt` 是采集时间；索引和详情使用相同 ID。attempt 根据仍保留的记录递增；
淘汰后不能用 attempt 代替不透明 recordId 作为持久身份。

新 v1 审计另有唯一 `captureId`；v3 索引通过可选的 `legacyCaptureId` 关联同一次采集，
正文超限时也保留此关联。两套存储可独立淘汰，因此不按 turn/step/attempt 或旧 v1 id
去重。缺少唯一采集关联的旧记录保守保留，可能同时显示旧元数据和装配快照；不会猜测
两者属于同一次请求而隐藏历史。

| 字段 | 类型 | 定义及使用边界 |
| --- | --- | --- |
| `sections / contexts` | array | 装配返回点的渲染段落，包含 name/index/text、characters/utf16Units/utf8Bytes、hash/provenance/sources；缺少正文时可不存在 |
| `selection` | object | 当时绑定，不随当前资源修改更新；不完整/旧记录可能没有 |
| `audit` | object | 当时 v1 兼容的资源/世界书决策摘要；与旧审计重叠 |
| `systemMessages` | string[] | LLM 层观察到的系统消息；未观察到请求时不存在 |
| `delivery` | object | 观察请求时的 provider/model、工具名、哈希、可用的日志版本/截点；未观察时不存在 |
| `delivery.assemblyVerified` | boolean | 候选 system 全文唯一匹配一个完整系统消息时为 true；否则一致性未获证明 |
| `delivery.systemMessageIndex` | integer / null | 仅在核对成功时为系统消息数组序号；不是全部聊天消息序号 |

状态：`assembled`（尚未观察到请求）、`request-observed`（到达 LLM 层，**不代表远端
模型成功响应**）、`request-unconfirmed`、`request-failed-before-observation`、
`assembly-or-preparation-failed`、`superseded-unconfirmed`、`unloaded-unconfirmed`。
失败记录不保存异常正文。运行期未确认的记录重启后仍保持未确认，不能凭重启推断成功。
`contentStatus` 为 `available`、`assembly-unavailable`、`omitted-size-limit` 或旧记录状态。

contexts 是装配阶段的上下文，不以 system 全文核对来宣称它们已经进入实际 user 消息。
历史快照不会回读当前卡片重算。DSH 历史仍是权威，Trace 是可淘汰的派生审计数据。

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
可能已 trim；完整当前资源通过 v1 详情接口读取，其中 `source.raw`（如有）保留导入原文。
世界书来源额外含 `entryId`，其资源身份来自 matcher 的明确资源元数据。
外部段落没有 Tavern 来源时标为 `unknown`；段落同名但正文被改写也不会继承旧来源。

官方装配对象不保留注册时的数字 order；v3 使用 `index` 表示实际数组排列。
`offsetUtf16` 是候选 system 文本内的起点，包含段间两个换行。
它仅在 `delivery.assemblyVerified` 为 true 时，可定位到对应实际系统消息中。
字符数 `characters` 是 Unicode 码点；另有 UTF-16 单元与 UTF-8 字节，均不是 token 数。

## 持久化与容量

v3 独立保存 `tavern-assemblies.json`，原有 `tavern-traces.json` 不迁移、不扩大正文范围。
为使历史查看不依赖活跃 Host/角色文件，快照保存渲染段、来源输入及观察到的系统正文。
这会含敏感提示词，应和 DSH 本地会话数据同等保护；文件以 0600 原子写入。
不保存凭据配置、完整普通聊天历史、工具参数或结果，不写入 DSH 日志。

同一存储目录内的所有会话共享默认最多 256 条记录、总计 16 MiB；单条 2 MiB。可用 `traceAssemblies.maxRecordBytes`
和 `maxTotalBytes` 配置，上限分别 4 MiB / 32 MiB；条数上限固定。最早保留记录优先淘汰。
一次对话轮次可有多条记录，因此不保证固定轮数。此处是近期有界审计，不是永久归档；
快照淘汰后，不能仅从聊天历史完整恢复当时的来源关系。
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

## Tavern Trace 默认布局

展开某次记录后，首先展示该次保存的预设、角色、用户、世界书、提示词模式、请求模型和
Tavern 采样配置摘要；可用时显示保存的开场序号。名称与配置均来自当时快照，不查询当前资源。
缺失字段显示“未记录”，不把缺失等同于“未使用”。采样配置是 Tavern 提交的配置，不宣称是
其他插件处理后的最终模型参数。

下方“世界书触发情况”和“Loader 装配情况”默认收起。前者展开命中、拒绝、关键词与预算；
后者展开段落、来源输入、动态上下文、实际系统消息、原始绑定和诊断。旧记录仍可显示已有的
配置与世界书审计；没有历史装配正文时明确提示，不能补造。首次采集仅显示轮次和步骤；
同一步骤存在后续采集时增加“请求记录 N”。页面提供这些术语的说明，HTTP 合同不变。
