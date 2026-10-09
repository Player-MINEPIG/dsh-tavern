# 操作日志合同

[English](OPERATION_LOGS_en.md) · [API 索引](API.md)

## 稳定面与所有权

本合同由 Tavern 维护。它定义“做了什么操作、哪些结果已经确认”，不暴露 DSH 内部执行步骤。公开 DSH 扩展点也有版本边界：当前后端兼容目标是 DSH `0.2.0-rc.2`，不能据此承诺未来 DSH 无需适配。

| 层 | 稳定合同 / 所有者 | DSH 升级时的预期影响 |
| --- | --- | --- |
| 请求边界 | Tavern 路由模板、operation 名、关联 ID、终态、HTTP status | 路由语义不变时，日志入口不改；新增受监控操作在路由声明处登记 |
| 业务检查点 | Tavern 已确认的创建、绑定、复制和写入事实 | 内部步骤重排不改事件；业务含义变化才调整合同 |
| Host 兼容层 | `play-host.js` 将公开 DSH controller 结果转换为 Tavern 结果 | 在这里适配服务签名和返回值；日志不再另读 DSH 对象或订阅事件 |
| 事件编码与存储 | Tavern `eventVersion`、`schemaVersion`、白名单、轮转、查询 | 不因 DSH 事件名、日志格式或压缩方式变化而改动 |
| 原生执行与 Prompt Trace | DSH 权威历史；Tavern 既有 Trace 适配 | 按各自合同兼容；操作日志不复制这套适配 |

实现流向：路由声明 → 统一 operation 边界 → 业务调用／已有 Host 适配器提供检查点 → 无正文事件 → Cordis logger 与有界 journal → 查询 API／诊断面板。journal 不导入 HTTP、loader 或 DSH 模块；HTTP 参数校验独立于文件存储。

这不是“所有错误只看 HTTP”方案。HTTP 失败可能发生在部分写入之后；请求接受之后的模型失败也不会倒改 HTTP 终态。先用 operationId 找请求与已确认结果，再回读当前状态；生成、装配、provider 或工具执行的问题继续看 DSH 原生诊断和 Prompt Trace。日志只是证据，不是恢复指令。

Host 适配器也识别官方 `session/workspace-attach-failed` 错误：DSH 可能已经创建或分支出 Session，之后挂接工作区失败。仅将非空的 `details.sessionId` 归一化为已确认的创建检查点，任意错误详情不进入 journal。请求仍以 HTTP 409 `PLAY_WORKSPACE_ATTACH_FAILED` 失败；缺少身份或无关错误不得虚构创建事件。

## 事件语义版本 1

`schemaVersion:1` 表示持久记录外壳；新增可选字段 `eventVersion:1` 表示以下事件语义，两者独立于 DSH Session 格式版本。`event` 是消费者识别语义的字段；`stage` 保留兼容展示，不能再按内部步骤名推断行为。消费者必须容忍新增字段和未知事件／操作／错误码，并对未知版本只作通用展示。

| event | 含义 |
| --- | --- |
| `operation.started` | 已进入声明的变更请求；尚未证明校验或写入成功 |
| `operation.completed` | 处理函数成功返回；API 终态含实际 HTTP status，通常 `result:completed`。`session.user-message` 使用 `result:accepted`，只代表 Host 接受输入 |
| `operation.failed` | 处理函数抛错；不保证撤销已确认的写入。含错误码、HTTP status（适用时）、耗时和已知目标 ID |
| `session.created` | 已获得新会话 ID，可能来自创建或分支；后续工作区插入、队列清理、绑定或复制仍可能失败 |
| `session.selection.copied` | 选择复制调用已成功返回 |
| `session.import-context.bound` / `session.import-context.unbound` | 绑定／解绑调用已成功返回 |
| `session.import-lineage.copied` | lineage 复制调用已成功返回；不保证存在可复制的 lineage |
| `workspace.bound` / `workspace.directory.created` / `workspace.file.written` | 对应绑定、目录创建、文件写入调用已成功返回；不表示整个前端工作流完成 |
| `playthrough.timeline.updated` / `playthrough.catalog.updated` | 对应文件写入已成功返回；另一文件或选择操作仍可能失败 |
| `playthrough.catalog.restored` | relink 的 catalog 补偿写入已成功返回；不宣称跨资源原子回滚 |
| `diagnostic.failed` | 原本被捕获的 RP／Trace 附属诊断失败；operation 为 `rp.policy` 或 `trace.record`，不代表用户请求或 DSH turn 失败 |

每次变更请求最多一个终态；进程中止、存储故障会让记录不完整。`operation.completed` 不保证浏览器已收到响应，也不保证异步生成已完成。客户端断开不自动取消业务；回读状态再决定是否重试。没有终态不等于失败，也不能自动重放。

`route` 只写固定模板，如 `/sessions/:id/branch`，不含查询串或实际 URL。operation 名保持：`workspace.bind`、`workspace.dir.create`、`workspace.file.write`、`session.create`、`session.branch`、`session.user-message`、`session.import-context.bind`、`session.import-context.unbind`、`playthrough.session.detach`、`playthrough.character.relink`。不承诺覆盖所有 v1/v3 API。检查点更新后续记录的 sessionId/playthroughId；分支的 sessionId 在创建检查点后指向子会话。查完整链条用 operationId，不能只靠 sessionId 筛选得到开始记录。

插件启动和正常停止也使用同一事件语义：`plugin.start` 为 started → completed (`ready`)，`plugin.stop` 为 completed (`disposed`)；异常退出不伪造停止记录。RP／Trace 只保留既有业务处理处捕获的失败，不新增 DSH agent 生命周期或模型执行日志监听。

旧记录没有 `eventVersion`，仍按原样读取与导出，不能解释为新版本事件。不重写存量文件，不迁移 DSH 历史。底层 `createOperationContext` 仍支持旧的 start/stage/success/failure 调用和 `dsh-tavern.operation ` 前缀；新生产代码通过事件合同封装接入，旧自定义 stage 不自动升级。已有事件或字段含义、类型改变时必须提升事件版本并提供兼容策略，不能静默复用旧名字；仅增加可选字段或新事件不需改记录外壳版本。

## 升级与扩展检查

1. 先确认 Tavern 路由、操作语义和错误映射是否改变，再核对目标 DSH 的公开服务。仅 DSH 签名／返回值变化时修改已有 Host 适配器，不在 journal、查询或 UI 里加版本判断。
2. 新增受监控变更在同一路由声明中登记 operation；无需手写 start/success/failure。只在“部分完成会影响排查”的边界加白名单检查点，不记录校验、读取、函数名、hook 名或原始对象。
3. 跑事件合同、部分成功、错误关联、隐私、旧记录混读与 journal 测试；再跑受影响 Host 行为、`npm test` 和 `npm run verify:2.0`。维护者仍需审查业务含义，测试不能保证未来 DSH 不改变语义。
4. 升级若改变事件语义，同步更新本页双语合同；若只适配 DSH，预期日志存储、查询和面板无需变化。

## 查询、存储与前端

现有 v1 资源、v2 工作区和 v3 Trace API 均不能查询操作生命周期，因此增加一个只读原语：`GET /pmp-dsh-tavern/api/v2/operation-logs`。它沿用 Tavern API 的 Host 安全边界，不提供写入、浏览器日志上报、清空或修复接口。调用方自行组合筛选与分页。

- 查询参数：`operationId`、`sessionId`、`playthroughId` 精确匹配；`level=info|warn`；`limit=1..1000`（默认 200）；`before=<record id>` 读取更早记录；`format=json|jsonl`（默认 JSON）。空值、重复或未知参数返回 400 `LOG_QUERY_INVALID`。
- JSON 返回 `{ok:true,schemaVersion:1,records,nextCursor,storage,limits}`，按写入顺序倒序。继续沿用同一筛选条件和 `nextCursor` 分页；游标已轮转或不可用时返回 409 `LOG_CURSOR_EXPIRED`，刷新查询即可。分页不是跨请求快照。
- `storage` 包含 `available`、`code`、本次实例丢弃数 `dropped`、本次查询跳过的损坏记录数 `skippedRecords`。`LOG_DISABLED`、`LOG_WRITER_BUSY`、`LOG_STORAGE_UNAVAILABLE`、`LOG_LOCK_RECOVERY_REQUIRED`、`LOG_CLOSED` 表示降级；200 与空 `records` 本身不代表日志健康。可读的旧记录仍可返回。磁盘错误后该实例停止写入，修复后重启 Host。
- `format=jsonl` 下载同一页，首行为 `{type:"metadata",...}`（保留状态、容量与下一页游标），后续每行一条记录，响应使用 `no-store`。它不是全量历史导出；需要更多记录时逐页请求。导出不包含 Trace 或当前问题报告。
- 记录外壳为 `schemaVersion:1`、`id`、进程内本次插件实例的 `runId`、UTC `timestamp`、`level`。允许的事件字段只有 `eventVersion`、`event`、`route`、`operationId`、`operation`、`stage`、`result`、`errorCode`、`status`、`durationMs`、`method`、`sessionId`、`playthroughId`。`id` 为 `<runId>:<sequence>`，不依赖时钟排序。持久化／导出排除 path，读取再次应用白名单；新合同生产者也不向 Cordis 输出 path。标识和 route 最多 128 字符；operation/event/stage/result/errorCode 最多 96；method 最多 32；控制字符替换，单条最多 4096 字节。旧底层 utility 的 path 能力保留，但不进入 journal。
- 已接入的 v2 变更请求在响应头返回 `X-Tavern-Operation-Id`，失败 JSON 另含 `operationId`；关联的是一次请求，不是跨请求事务。业务 `code` 与失败记录 `errorCode` 对应（无稳定 code 时 `UNKNOWN_ERROR`）。路由拒绝、安全检查拒绝或尚未开始 operation 的请求可以没有该 ID。`createLivePlayClient` 将 ID 保留在抛出的 `error.operationId`，提供 `getOperationLogs(filters)`；旧 Host 返回 404，前端应隐藏/禁用日志能力而保留原有问题诊断。

插件默认在 Tavern 存储目录的 `operation-logs/` 写入最多 4 个 JSONL 文件，每个最多 1 MiB，达到上限淘汰最旧文件；不是按天归档，不保证最短留存期。固定文件界限约束磁盘与查询读入量，无无限写入队列。新目录／文件使用 0700／0600（以平台支持为准）。`operationLogs: { enabled: false }` 关闭本存储及查询中的历史读取，保留 Cordis logger；禁用不删除现有文件。该目录不参与迁移、会话回放或恢复决策，可在 Host 停止后删除。

同一 Host 的并发请求通过同步、有界文件写入串行化。一个存储目录只允许一个 journal 写者；第二个实例只读旧日志并报告 `LOG_WRITER_BUSY`。正常卸载释放 owner，进程死亡后下次启动检查 PID 并回收 owner，去掉未完成的末行。启动 guard 遗留、PID 被复用或无法确认所有者死亡时保持关闭；停止所有使用该目录的 Host、确认无写者后才可移除 `.guard`／`.owner` 并重启。该机制面向本机文件系统，不支持多机共享写入。写入没有 fsync 事务保证；崩溃、轮转中断或容量淘汰可缺失记录，不能把缺失终态解读为业务失败或成功。

日志覆盖上表定义的操作与插件生命周期，不截获全部 Cordis 输出。日志或 logger 故障不改变业务结果；错误 message、stack、cause、正文、正文长度与摘要不进入 journal。

浏览器不采集 console、网络正文、输入或点击流水，不写 localStorage 日志，也没有后台轮询。当前工作区问题反映当前读取状态；operation journal 解释后端步骤；Prompt Trace 解释模型装配及官方引用。三者互不替代，日志不能成为 DSH 历史、资源或未来 MVU 状态的权威存储。

内置诊断面板展开时读取最近一页，无需预先知道 operationId。默认按时间显示动作、记录结果与会话／周目编号；不额外读取资源名称。开始、已确认检查点、输入已接受、请求完成与附属诊断失败分开解释，旧记录和未知事件版本保持通用展示。详情可复制后端自动生成的一次请求编号 operationId，用于高级精确筛选；它不是会话编号或跨请求事务 ID。刷新、更早页和当前页 JSONL 导出均由用户主动操作。导出保留当前页原始字段及存储／分页元数据，不额外匿名化会话 ID、周目 ID、操作 ID、插件实例 runId 或记录 id；这些是可关联活动的标识，不是登录凭据。白名单不含正文、路径、密码或 API 密钥字段，分享前仍需检查。

操作日志默认每页 5 条；更早一页沿用同一筛选及游标，导出仍只包含当前已加载页和元数据。详情中的“复制排障定位信息”仅复制已有编号、时间、操作与错误码等白名单字段，将 journal 的 runId 明确标为 pluginInstanceId，并在有 sessionId 时给出既有 v3 Trace 索引 API 相对路径；不读取 Trace 正文，不推导 DSH run/turn/attempt，也不自动配对模型请求。

例如 `session.user-message` 的 `accepted` 只确认 Host 已接受输入，不证明后续装配、适配器编码或模型调用成功。`UNSUPPORTED_CONTENT` 等后续错误可能只出现在官方执行记录及可用的 Trace 失败引用中；原生 DSH 发送也可能没有 Tavern operationId。切回 DSH 原生界面，打开对应会话并选择顶部 Tavern Trace，按时间核对轮次／步骤／尝试、已记录的实际装配和失败引用，再对照原生执行记录。`request-observed` 不证明适配器或 provider 接受；Trace 或失败记录缺失也不证明成功。操作日志仍用于定位后端请求与已确认写入，不收集 DSH 的所有错误或最终 LLM 消息正文。
