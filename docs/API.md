# HTTP API

状态：2026-08-21。根：`/pmp-dsh-tavern/api`。鉴权仍是本机 TCP peer、Host、Origin、Content-Type（见 loader 安全中间件）。成功响应带 `ok: true`；失败带 `ok: false` 与 `error`。

两栏合同：

- **v2**：给任意扮演前端的稳定面。
- **v1**：给本插件悬浮球 / 侧栏 / Trace 的 bundled UI 合同。外人可以读、可以调，但扮演表面请走 v2；v1 字段随本插件 UI 需求增减。

不要 `/swipe`、`/regenerate`、`/export`、`POST /focus`。

## v2 稳定面

前缀 `/pmp-dsh-tavern/api/v2`。

| 方法 | 路径 | 作用 | 状态 |
| --- | --- | --- | --- |
| GET | `/chrome` | 返回 `{ mode: "native" \| "play" }` | 已实现 |
| PUT | `/chrome` | 写入全局 chrome。不改 RP 锁、不改 DSH 当前 session | 已实现 |
| POST | `/chrome` | 不提供 | 405 |
| GET | `/workspace` | 根路径、是否已选、合同版本、警告 | 已实现 |
| PUT | `/workspace` | 绑定**一棵**已存在的扮演工作区根。首次选择带 `SWIPE_DISK` / 可能的 `SYSTEM_DISK` 警告。不 mkdir 根 | 已实现 |
| POST | `/workspace/dirs` | `{ path }` 相对路径，由 `PlayWorkspaceStore` 在已绑定根目录内的路径监狱中直接创建。兼容 native/browse Host；不依赖全局 `directory-picker` 或 `apiProxy.host.createDirectory`。未绑根 → 409；拒绝绝对路径、`..`、symlink 逃逸和文件冲突；不新注册 DSH 工作区 | 已实现 |
| GET | `/workspace/files?path=` | 读根内 UTF-8 文件。`catalog.json` / `timeline.json` 读出后执行对应 schema/path 校验；第三方 `ext` 原样保留；受管文档响应增加精确 UTF-8 字节的 SHA-256 `revision`（64 位小写 hex） | 已实现 |
| PUT | `/workspace/files?path=` | 普通文件仍使用 `{ content }`；`catalog.json` / `timeline.json` 必须显式带 `expectedRevision`：`null` 仅创建缺失目标，64 位小写 SHA-256 仅在当前字节 hash 相等时替换。校验、CAS、临时写和 rename 在同一目标 guard 内 | 已实现 |
| GET | `/workspace/files?list=` | 列一层前缀 | 已实现 |
| POST | `/sessions` | 新开扮演 session。有角色卡时标题=角色名+时间；无角色卡时走 DSH `session.create` 默认标题，不 409。仅当 body 带 `selectionFromSessionId` 才复制 Tavern 绑定。插入扮演工作区。**不写 timeline** | 已实现 |
| POST | `/sessions/:id/branch` | `{ atEventId }` = 日志 seq。fork，不写 timeline、不代发。开放 turn → 409 | 已实现 |
| POST | `/sessions/:id/user-message` | `{ text }` 作为下一条用户正文，`session.prompt` `queue` | 已实现 |
| GET | `/sessions/:id/messages` | `deriveMessages()` + `seq` + `incompleteTurn`。持续读取到 `hasMore: false`，不设插件页数上限；Host 游标空页、非法 seq 或不前进时返回 502 `PLAY_HISTORY_CURSOR_STALLED` | 已实现（`10250a7`） |
| GET | `/sessions/:id/import-context` | 返回 `{ binding }`；未绑定为 `null`，绑定只含 path/hash/state/数量摘要，不返回记录正文 | 已实现 |
| PUT | `/sessions/:id/import-context` | `{ reference: { path, expectedHash? } }`；为空 session 绑定或换绑已写入工作区的 import-context | 已实现 |
| DELETE | `/sessions/:id/import-context` | 为空 session 解绑；幂等返回 `{ binding: null }` | 已实现 |
| GET | `/playthroughs/:id/focus` | 2.0 稳定合同：经 catalog 解析周目，返回 `{ playthroughId, sessionId, nodeId, variantId }`；空周目使用 `rootSessionId` | 待实现 |
| GET | `/focus?path=` | 迁移期低层兼容：按显式 timeline path 派生 `{ sessionId }`；2.0 内置前端不再依赖 | 已实现，待降级为兼容面 |
| GET | `/focus`（无 path） | 2.0 不提供默认目标；不再把“最近写入 timeline”当作用户 focus | 待移除 |
| POST | `/focus`、`/playthroughs/:id/focus` | 不提供 | 405 |

路径存在、方法不对 → `405 PLAY_METHOD_NOT_ALLOWED`（例如 `POST /chrome`、`POST /focus`、`GET /sessions`）。稳定 focus 中周目 id 不存在返回 404；timeline 缺失或损坏返回 409。

import-context 修改由 session 权威状态锁定：只要存在 DSH user/assistant message、开放 turn，或该绑定已经在一次请求中消费，`PUT` / `DELETE` 都返回 `409 PLAY_IMPORT_CONTEXT_LOCKED`；前端隐藏按钮不能替代此检查。`PUT` 会重新读取工作区文件、执行大小/QA 结构限制并核对可选 `expectedHash`，然后把绑定置为 `pending`。`GET` 可在任意状态读取摘要；正文仍通过已有 `/workspace/files?path=` 按明确路径读取。首次实际请求组装时 loader 把内容标为 untrusted read-only context，正常 `turn/end` 后转为 `consumed`，不会写成 DSH 历史。

当前 `GET` 和 `PUT` 命中 `timeline.json` / `catalog.json` 时都会执行同一 schema/path 校验；PUT 在同一目标 guard 内先比较 `expectedRevision`、再校验内容，GET 在 guard 内读后校验并返回精确 UTF-8 字节的 SHA-256 `revision`。缺字段返回 400 `PLAY_FILE_REVISION_REQUIRED`，格式错误返回 400 `PLAY_FILE_REVISION_INVALID`，目标存在/缺失/hash 不一致统一返回 409 `PLAY_FILE_REVISION_CONFLICT`；冲突不改文件。schema 失败仍返回明确的 `PLAY_TIMELINE_INVALID` 或 `PLAY_CATALOG_INVALID`，不会改写 DSH 事件。catalog 的 id 使用客户端同源安全段规则、id/path 唯一，path 为安全 POSIX 相对路径且严格以 `/timeline.json` 结尾；已知 `ext.pmpDshTavern` 字段校验但未知第三方字段原样保留。timeline 只允许真实 `qa` 节点，greeting 从角色卡与 session selection 派生，不进入 timeline。focus 不存盘；稳定 focus 由 playthrough id、catalog 与 timeline 派生。路径 mutation 已在进程内目标锁中逐段 `lstat` 拒绝 symlink/junction，逐层创建并 realpath 复核；临时文件使用排他 `wx`，写入和 rename 前复验父目录。服务端 CAS 已实现；内置客户端 revision 回读/冲突重放仍待任务 05/06。

### 周目生命周期组合语义

v2 没有把角色卡、周目和 greeting 做成一个不可替换的后端大接口；第三方前端可以用公开
session/workspace/timeline/catalog 积木组合同样的流程。当前 bundled 前端的组合顺序是：

1. 读取角色目录并检查该角色最后一个周目是否仍为空；若为空则复用它，否则调用
   `POST /sessions` 创建真实 blank DSH session；
2. 对已有来源 session，使用 v2 的 `selectionFromSessionId` 复制 Tavern selection；无来源
   session 再通过 v1 绑定角色卡；
3. 在已绑定工作区根内创建角色/周目目录，写入空 `timeline.json`，再写入 catalog，最后重新
   读取并校验；显示名为 `x周目`，可通过 catalog 修改后重新读取确认。

这里的“周目事务”是前端对公开原子操作的组合，不等同于服务端跨文件事务。单个客户端的
controller 会串行同角色创建，但跨标签页或第三方客户端的并发写入仍必须由服务端 CAS
解决。创建中途失败暂不增加跨文件事务：每个变更 API 使用同一 `operationId` 写 `ctx.logger`，
客户端依据已完成阶段、回读结果和稳定错误码恢复；不得把组合流程宣传为原子提交。

### 外部记录导入上下文

空周目的 opening dock 使用当前 root session 绑定外部记录，不另建 session，也不写 greeting
或 timeline 节点。绑定、换绑和解绑分别通过 `PUT` / `DELETE /sessions/:id/import-context`
完成；客户端在同一 footer 中显示操作，绑定后预览最近三轮 QA。绑定状态为 `pending` 时，首次
实际请求才注入完整内容；loader 将其转义并标记为 `untrusted`、只读上下文，不把它写入 DSH
durable history。2.0 发布语义为：首次 assembly 按原用户 turn/event 建立 claim；同一回合的
retry/swipe 可重放，中断后新发用户消息不重复；成功后保留 lineage 供未来 swipe。

请求体为 `{ reference: { path, expectedHash? } }`。文件必须位于已绑定工作区根内，文档为
`schemaVersion: 1` 且含 `qa` 数组；当前实现有 256 KiB 文档和 2,000 个 QA 对限制。普通
SillyTavern JSON/JSONL 与本插件 bundle 可由客户端解析后写入该上下文文件。greeting 仍是
展示投影，不伪造 assistant 历史。

### 已接受的 2.0 发布加固（部分已实现）

- ✅ history 已实现（`10250a7`）：取消 32 页人为上限并一直分页至 `hasMore: false`；Host 空页、非法 oldest `seq` 或 cursor 重复/不前进时返回 502 `PLAY_HISTORY_CURSOR_STALLED`；插件不摘要/切片。
- import-context 使用按原用户回合的 claim/lineage 语义，覆盖 retry、swipe、取消和中断后新消息。
- ✅ catalog/timeline GET 返回精确 UTF-8 字节 SHA-256 `revision`，PUT 使用显式 `expectedRevision`；缺失/格式错误分别为 400，目标状态或 hash 不一致为 409，冲突不改文件。服务端合同已实现；内置客户端回读/冲突重放待任务 05/06。
- ✅ catalog/timeline 已在 GET 读后与 PUT 写前执行同一 schema/path 校验；未知第三方 `ext` 原样保留。revision/CAS 已在同一目标 guard 中实现；路径锁、逐段 no-follow 检查、临时 `wx` 写和 rename 前复验已实现。
- 路径逐段拒绝 symlink/junction（Node 暴露的链接类型），逐层非 recursive 创建并 realpath 复核，临时文件使用排他 `wx`，写入/rename 前复验父目录；纯 Node 仍无法抵抗外部进程制造的极窄竞态，不引入 native addon。
- 本轮日志只使用后端 `ctx.logger`，记录生命周期变更阶段和 `operationId`，不记录任何资源或聊天正文。浏览器日志、持久 journal 和额外 exporter 暂缓。

除已标记为已实现的 history 分页外，其余加固在完成代码、自动测试和 rc.8 验收前均不得宣称已经实现。具体风险与决策见 [`PLAY_REVIEW.md`](PLAY_REVIEW.md)。

`chrome` 是整个前端的蓝/红球，存在插件 data `chrome.json`，默认 `native`。非法 `mode` → 400。GET 不要求 JSON Content-Type。

客户端入口始终显示 `DT`。左键立即展开/收起菜单，快速重复点击重复同一默认行为，双击没有特殊效果；右键单击切换前端显示模式。菜单按钮使用“切换到自定义前端模式 / 切换到 DSH 原生模式”，当前状态可显示“当前：魔丸 / 当前：DSH 原生”；悬浮提示固定为“切换前端显示模式”。菜单始终挂载，容器展开完成（220ms）后内容再淡入。

`PUT /workspace` 的目录必须事先存在（DSH `workspace.create` 也不 mkdir）。`POST /workspace/dirs` 由 `PlayWorkspaceStore` 在已绑定根目录内直接创建角色卡 / 周目子目录，不依赖全局 `directory-picker` 或 `apiProxy.host.createDirectory`，因此 native/browse Host 都兼容。路径监狱拒绝 `..`、绝对路径、指向根外的符号链接和文件冲突。未选根时 files/dirs 返回 409。不要用 `archiveSession` 收纳会话。`user-message` 的 body 不是完整 prompt。session 元 API 经 Host `apiProxy`：`session.create` / `session.fork({ atSeq })` / `session.prompt({ mode: "queue" })` / `session.history`；`PUT /workspace` 调用 `workspace.create`；开放 turn 的 fork 映射为 HTTP 409。

## v1 bundled UI 合同

前缀 `/pmp-dsh-tavern/api/v1`。旧根 `/dsh-tavern/api` 已废止。

| 当你想 | 路径 |
| --- | --- |
| 管预设、原生正则、看当前装配、导入/选中 | `/presets`、`/presets/:id/regex-scripts`、`/active`、`/import`、`/select` |
| 管角色卡、原生正则、绑定、导出 json/png、内嵌书 | `/characters`、`/characters/:id/regex-scripts`、`/character-selection` |
| 管独立世界书和绑定 | `/world-books`、`/world-book-selection` |
| 管用户、用户-世界书关系 | `/users`、`/user-selection` |
| 界面语言缩放、绑卡跟随 RP | `/ui-settings` |
| RP 开关与告警、rp:policy 正文 | `/rp-mode`、`/rp-alert`、`/rp-policy` |
| 看 Trace | `/traces` |
| 配置模板、按当前绑定开干净会话 | `/session-templates`、`/session-configurations/preview`、`/apply` |

### 资源携带的原生 ST 正则

预设与角色卡使用一致的子资源合同：

| 方法 | 路径 | 请求 | 成功响应 |
| --- | --- | --- | --- |
| GET | `/presets/:id/regex-scripts` | 无 | `{ ok: true, regexScripts: [...] }` |
| PUT | `/presets/:id/regex-scripts` | `{ regexScripts: [...] }` | `{ ok: true, regexScripts: [...] }` |
| GET | `/characters/:id/regex-scripts` | 无 | `{ ok: true, regexScripts: [...] }` |
| PUT | `/characters/:id/regex-scripts` | `{ regexScripts: [...] }` | `{ ok: true, regexScripts: [...] }` |

`PUT` 是完整替换，不是逐字段 merge。数组元素必须是对象；服务端不改写原生 ST 字段，也不丢弃规则内未知扩展字段。适配器优先写回资源已有的 `regex_scripts` 路径；没有现有数组时，预设写入 `extensions.regex_scripts`，V2/V3 角色卡写入 `data.extensions.regex_scripts`，V1 角色卡写入 `extensions.regex_scripts`。资源中的其他字段保持不变，写入仍经过对应 store 的原子保存和总文档体积限制。

这个 v1 子资源只编辑预设或角色卡原文。它不组合全局正则，不计算当前 session 最终生效集合，不修改历史、timeline 或 AI 请求；魔丸显示管线只把保存后的资源数据作为渲染投影读取。失败响应沿用所属资源 API 的既有格式与状态码。
