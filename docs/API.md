# HTTP API

状态：2026-08-22。根：`/pmp-dsh-tavern/api`。鉴权仍是本机 TCP peer、Host、Origin、Content-Type（见 loader 安全中间件）。成功响应带 `ok: true`；失败带 `ok: false` 与 `error`。

两栏合同：

- **v2**：给任意扮演前端的稳定面。
- **v1**：给本插件悬浮球 / 侧栏 / Trace 的 bundled UI 合同。外人可以读、可以调，但扮演表面请走 v2；v1 字段随本插件 UI 需求增减。

不要 `/swipe`、`/regenerate`、`/export`、`POST /focus`。

## v2 稳定面

前缀 `/pmp-dsh-tavern/api/v2`。

| 方法 | 路径 | 作用 | 状态 |
| --- | --- | --- | --- |
| GET | `/chrome` | 返回 `{ mode: "native" \| "play", revision }`；`revision` 是服务端权威不透明版本串 | 已实现 |
| GET | `/chrome/events` | Tavern 自有 SSE；连接后发送当前快照，mode 实际变化时发送 `chrome/change` | 已实现 |
| PUT | `/chrome` | 写入全局 chrome。不改 RP 锁、不改 DSH 当前 session；成功响应附带新的 `revision`（同 mode 不产生变更） | 已实现 |
| POST | `/chrome` | 不提供 | 405 |
| GET | `/workspace` | 根路径、是否已选、合同版本、警告 | 已实现 |
| PUT | `/workspace` | 绑定**一棵**已存在的扮演工作区根。首次选择带 `SWIPE_DISK` / 可能的 `SYSTEM_DISK` 警告。不 mkdir 根 | 已实现 |
| POST | `/workspace/dirs` | `{ path }` 相对路径，由 `PlayWorkspaceStore` 在已绑定根目录内的路径监狱中直接创建。兼容 native/browse Host；不依赖全局 `directory-picker` 或 `apiProxy.host.createDirectory`。未绑根 → 409；拒绝绝对路径、`..`、symlink 逃逸和文件冲突；不新注册 DSH 工作区 | 已实现 |
| GET | `/workspace/files?path=` | 读根内 UTF-8 文件。`catalog.json` / `timeline.json` 读出后执行对应 schema/path 校验；第三方 `ext` 原样保留；受管文档响应增加精确 UTF-8 字节的 SHA-256 `revision`（64 位小写 hex） | 已实现 |
| PUT | `/workspace/files?path=` | 普通文件仍使用 `{ content }`；`catalog.json` / `timeline.json` 必须显式带 `expectedRevision`：`null` 仅创建缺失目标，64 位小写 SHA-256 仅在当前字节 hash 相等时替换。校验、CAS、临时写和 rename 在同一目标 guard 内 | 已实现 |
| GET | `/workspace/files?list=` | 列一层前缀 | 已实现 |
| POST | `/sessions` | 新开扮演 session。有角色卡时标题=角色名+时间；无角色卡时走 DSH `session.create` 默认标题，不 409。仅当 body 带 `selectionFromSessionId` 才复制 Tavern 绑定。插入扮演工作区。**不写 timeline** | 已实现 |
| POST | `/sessions/:id/branch` | `{ atEventId }` = 日志 seq。fork 后复制公开 selection；若来源 import claim 已在更早 terminal 结束，则复制不含正文的 pending lineage；不写 timeline、不代发。复制失败显式返回 502 `PLAY_BRANCH_COPY_FAILED`；开放 turn → 409 | 已实现 |
| POST | `/sessions/:id/user-message` | `{ text }` 作为下一条用户正文，`session.prompt` `queue` | 已实现 |
| GET | `/sessions/:id/messages` | `deriveMessages()` + `seq` + `incompleteTurn` + 每条消息的 `origin`。持续读取到 `hasMore: false`，不设插件页数上限；Host 游标空页、非法 seq 或不前进时返回 502 `PLAY_HISTORY_CURSOR_STALLED` | 已实现 |
| GET | `/sessions/:id/import-context` | 返回 `{ binding }`；未绑定为 `null`，绑定含 path/hash/state/数量摘要及（已 claim 时）不含正文的 claim identity/event seq 摘要，不返回记录正文 | 已实现 |
| PUT | `/sessions/:id/import-context` | `{ reference: { path, expectedHash? } }`；为空 session 绑定或换绑已写入工作区的 import-context | 已实现 |
| DELETE | `/sessions/:id/import-context` | 为空 session 解绑；幂等返回 `{ binding: null }` | 已实现 |
| GET | `/playthroughs/:id/focus` | 2.0 稳定合同：经 catalog 解析周目，返回 `{ playthroughId, sessionId, nodeId, variantId }`；空周目使用 `rootSessionId` | 已实现；bundled live client 已迁移 |
| POST | `/playthroughs/:id/relink-character` | `{ characterId }`；只把指定周目及其 root/swipe/branch 后代 session 重新绑定到一张现存角色卡。显式用户选择不受自动归类规则限制 | 已实现 |
| POST | `/playthroughs/:id/detach-session` | `{ sessionId }`；把目标 session 对应 timeline variant 及其后代从该周目移除，保留兄弟分支、DSH session/历史和空 catalog 周目。服务端校验树并以受管文件 revision/CAS 提交 | 已实现 |
| GET | `/focus?path=` | 迁移期低层兼容：按显式 timeline path 派生 `{ sessionId }`；2.0 内置前端不再依赖 | 已实现，迁移兼容面 |
| GET | `/focus`（无 path） | 2.0 不提供默认目标；不再把“最近写入 timeline”当作用户 focus | 已移除默认行为，400 PLAY_FOCUS_PATH_REQUIRED |
| POST | `/focus`、`/playthroughs/:id/focus` | 不提供 | 405 |

路径存在、方法不对 → `405 PLAY_METHOD_NOT_ALLOWED`（例如 `POST /chrome`、`POST /focus`、`GET /sessions`）。稳定 focus 中周目 id 不存在返回 404 PLAY_PLAYTHROUGH_NOT_FOUND；catalog 缺失返回 409 PLAY_CATALOG_UNAVAILABLE，catalog 损坏保留 400 PLAY_CATALOG_INVALID；timeline 缺失或损坏统一返回 409 PLAY_FOCUS_UNAVAILABLE。稳定入口不接受客户端 path，不读取 DSH history，也不写文件。旧 /focus?path= 仅保留迁移兼容。

### 消息来源与显示语义

`GET /sessions/:id/messages` 中每条消息同时保留两种互不替代的分类：

- `role` 是送给模型的消息角色，当前主要为 `user`、`assistant`、`system`；DSH 的运行时上下文注入在模型侧仍可能是 `role: "user"`。
- `origin.kind` 是前端来源/显示语义，取值为 `user`、`context`、`steering`、`assistant`、`system`。第三方前端必须用它区分真实用户输入与上下文注入，不得仅凭 `role` 画用户气泡；具体选择隐藏还是单独呈现由前端决定。
- `origin.kind: "context"` 可附带 `producer`、`form`、`summary`。三者是有界的可选显示元数据；消息正文仍在原有 `text` / `content` 字段，不复制进 `origin`。
- 为兼容旧客户端，新增字段是 additive；`role`、`seq`、`text`、`content` 与 `incompleteTurn` 的既有含义不变。旧服务端没有 `origin` 时，客户端只能按 `role` 做保守回退，无法可靠识别上下文注入。

内置魔丸视图完全不渲染 reasoning 与 `origin.kind: "context"`，也不提供展开入口；需要检查运行细节时使用 DSH 原生“对话”视图。回复 swipe 是客户端对 branch/user-message/timeline CAS 的组合，不存在 `/swipe` 动词。点击由 `context` 触发的父输出时，控制器向活动分支前方寻找最近的真实 `user` / `steering`，从其前方重跑整轮，绝不会把 context 报告重新作为人类输入发送；若活动分支没有真实用户消息则显式失败。durable QA 提供复制、左右 swipe、分支新周目、同周目回退和显示层编辑；不再提供屏蔽。显示正则逐段决定 assistant 正文是否可见，但动作归属于 QA：多段输出只出现一组动作，全部正文被清空时仍保留该组动作以及非可视 provenance 与 timeline 指针。

import-context 修改由 session 权威状态锁定：只要存在 DSH user/assistant message、开放 turn，或该绑定已经被 claim，`PUT` / `DELETE` 都返回 `409 PLAY_IMPORT_CONTEXT_LOCKED`；前端隐藏按钮不能替代此检查。`PUT` 会重新读取工作区文件、执行 JSON/schema/hash 校验，然后把绑定置为 `pending`。`GET` 可在任意状态读取摘要；正文仍通过已有 `/workspace/files?path=` 按明确路径读取。首次实际 assembly 必须携带公开 `agent/inbox/spliced` 投影的非负 `claimEventSeqs`；loader 才把绑定持久转为 `claimed`，并在同一 claim identity 的重复 assembly 中重放相同的转义、untrusted、只读上下文。没有 claim 的 view/assembly 不注入，也不会消费 pending；已 claim 的 `turn/end` 才转为 `consumed`，并保存安全整数结束 event seq、turn 与 `reason.kind` 的非正文终态元数据，不写成 DSH 历史。DSH provider 在同一 turn/end 前的 request retry 复用同一 claim；`agent/request-error` 不消费或重置。Tavern swipe 通过公开 branch endpoint，在分叉点早于来源终态时复制 selection 和不含正文的 import lineage；子 session 必须出现新的 public claim 才注入，旧 claim 不直接复用。中断后原 session 的新用户 claim 不再注入。

当前 `GET` 和 `PUT` 命中 `timeline.json` / `catalog.json` 时都会执行同一 schema/path 校验；PUT 在同一目标 guard 内先比较 `expectedRevision`、再校验内容，GET 在 guard 内读后校验并返回精确 UTF-8 字节的 SHA-256 `revision`。缺字段返回 400 `PLAY_FILE_REVISION_REQUIRED`，格式错误返回 400 `PLAY_FILE_REVISION_INVALID`，目标存在/缺失/hash 不一致统一返回 409 `PLAY_FILE_REVISION_CONFLICT`；冲突不改文件。schema 失败仍返回明确的 `PLAY_TIMELINE_INVALID` 或 `PLAY_CATALOG_INVALID`，不会改写 DSH 事件。catalog 的 id 使用客户端同源安全段规则、id/path 唯一，path 为安全 POSIX 相对路径且严格以 `/timeline.json` 结尾；已知 `ext.pmpDshTavern` 字段校验但未知第三方字段原样保留。

timeline 只允许真实 `qa` 节点，greeting 从角色卡与 session selection 派生，不进入 timeline。QA 节点的产品字段为 `id`、`kind`、`displayOverride`、可选 `parentVariantId`、`adoptedVariantId`、`variants` 和可选 `ext`；未声明的顶层字段会以 `PLAY_TIMELINE_INVALID` 拒绝，第三方元数据应放在 `ext`。v2 不提供隐藏或屏蔽 QA 的字段。树状字段为 additive：节点可带 `parentVariantId: string | null`，指向较早 QA 的 variant；timeline 可带 `head: { sessionId, nodeId, variantId }`。`nodeId/variantId` 必须指向同一 QA，但 `head.sessionId` 可是刚由 DSH branch 创建、尚未产生下一轮 QA 的 continuation session。活动显示路径从 `head.variantId` 沿 `parentVariantId` 反向求祖先；未带树字段的平面文档仍按原节点顺序读取，下一次完成 QA 对账会写入明确 head/parent。树文档的 variant id 必须全局唯一、parent 只能指向较早节点且不得成环。focus 不另存第二份状态；稳定 focus 从 timeline head 派生，空 timeline 才回退 catalog 的 rootSessionId。

bundled live client 只发送 URL 编码后的 playthrough id，并拒绝服务端返回的 id 不匹配或缺失/非法字段。稳定 focus 的 activeTimelinePath 字段仅作为旧 binding 兼容数据保留，已 deprecated/ignored；普通 timeline PUT 不再更新它。路径 mutation 已在进程内目标锁中逐段 `lstat` 拒绝 symlink/junction，逐层创建并 realpath 复核；临时文件使用排他 `wx`，写入和 rename 前复验父目录。服务端 CAS 已实现；内置 live client 已实现受管 revision 缓存、`null` create-only、409 作废陈旧缓存和有限冲突重放（默认最多重试 3 次，可配置 1–5）。内置周目生命周期 caller（rename、create catalog append、node metadata/adopt、swipe/回退 timeline head、turn reconcile）使用 `updateCatalog` / `updateTimeline`；mutator 每次只基于 fresh document 重算本地意图，外部 session/branch/user-message/目录/timeline create-only 副作用不会在 CAS 重放中重复。旧自定义 client 若只有 get/put 会走一次兼容 fallback，不提供并发重放保证。

### 周目生命周期组合语义

v2 没有把角色卡、周目和 greeting 做成一个不可替换的后端大接口；第三方前端可以用公开
session/workspace/timeline/catalog 积木组合同样的流程。当前 bundled 前端的组合顺序是：

1. 读取角色目录并检查该角色最后一个周目是否仍为空；若为空则复用它，否则调用
   `POST /sessions` 创建真实 blank DSH session；
2. 对已有来源 session，使用 v2 的 `selectionFromSessionId` 复制 Tavern selection；无来源
   session 再通过 v1 绑定角色卡；
3. 在已绑定工作区根内创建角色/周目目录，写入空 `timeline.json`，再写入 catalog，最后重新
   读取并校验；显示名为 `x周目`，可通过 catalog 修改后重新读取确认。

角色解绑或换绑是例外：`POST /v1/character-selection` 在写 selection 前检查 session 是否属于角色不一致的周目。若存在冲突，返回 409 `CHARACTER_PLAYTHROUGH_DETACH_REQUIRED`，`error.details.conflicts[]` 含 `playthroughId`、`playthroughTitle`、`sessionId`、`expectedCharacterId`、`requestedCharacterId` 与 `descendantSessionCount`，且本次 selection 不写入。前端取得用户确认后，应逐项调用 `POST /v2/playthroughs/:id/detach-session`，全部成功后重试原 v1 请求。detach 由服务端根据 timeline 树计算，客户端不得自行猜测或重写后代关系。

detach 删除目标 session 的所有 variant 以及以其为父节点的全部后代 variant，不重挂幸存节点；同一节点的兄弟 swipe 和其他分支保留。若 root 被移除，catalog 清除 `rootSessionId` 与旧 import-context 引用，但保留周目行、名称和编号。下次新建同角色周目时，bundled client 为该空周目创建新的 DSH root session 并以 catalog CAS 重新挂入，不创建新目录或新编号。操作不会删除、归档或改名任何 DSH session。

这里的“周目事务”是前端对公开原子操作的组合，不等同于服务端跨文件事务。单个客户端的
controller 会串行同角色创建；内置 caller 使用服务端 CAS 的有限重放保护跨标签页并发写入，但跨文件的 session/目录/timeline/catalog 组合仍不是事务。创建中途失败暂不增加跨文件事务：workspace bind、目录创建、普通文件与 catalog/timeline 写入、周目 detach，以及 session create/branch/user-message 和 import-context PUT/DELETE 都各自在单次变更请求内使用一个 `operationId` 写 `ctx.logger`；客户端依据已完成阶段、回读结果和稳定错误码恢复。不同 API 请求不共享 operationId，chrome、GET 和浏览器前端操作仍保持安静；不得把组合流程宣传为原子提交。

### 外部记录导入上下文

空周目的 opening dock 使用当前 root session 绑定外部记录，不另建 session，也不写 greeting
或 timeline 节点。绑定、换绑和解绑分别通过 `PUT` / `DELETE /sessions/:id/import-context`
完成；客户端在同一 footer 中显示操作，绑定后预览最近三轮 QA。绑定状态为 `pending` 时，首次
实际请求才注入完整内容；loader 使用同一 profile snapshot 的 user/character 名称展开 greeting 与 QA 中的 Tavern 宏，再将其转义并标记为 `untrusted`、只读上下文，避免 ST 占位符进入 DSH prompt variable 解析；它不把内容写入 DSH
durable history。当前已实现的基础语义是：首次 assembly 必须按原用户 turn/event 的公开 `claimEventSeqs` 建立持久 claim；同一 claim identity 可重复 assembly，未 claim 的 pending 不会因 view 或无关 turn/end 被消费。retry/swipe lineage 与取消/中断终态已实现：终态只保存 event seq、turn、reason.kind 等非正文元数据；同一请求在 terminal 前可重复 assembly，terminal 后新 claim 不再注入；Tavern swipe 仅通过公开 branch 接缝复制 selection/lineage，不宣称拦截所有第三方原生 fork。

请求体为 `{ reference: { path, expectedHash? } }`。文件必须位于已绑定工作区根内，文档为
`schemaVersion: 1` 且含 `qa` 数组。import parser 不做 256 KiB 或 QA 数量的人为上下文截断，也不做 summary/切片；模型上下文是否超限交给 DSH/provider。通用 `/workspace/files` 仍有 1 MiB 文件层读写上限。普通 SillyTavern JSON/JSONL 可由客户端解析后写入该上下文文件。2.0 不再公开 portable bundle 格式；ST JSONL 只表达当前活动线性历史，不能保存完整周目树拓扑。greeting 仍是展示投影，不伪造 assistant 历史。

### 2.0 发布加固（已实现并纳入分组自动回归）

- ✅ history 已实现（`10250a7`）：取消 32 页人为上限并一直分页至 `hasMore: false`；Host 空页、非法 oldest `seq` 或 cursor 重复/不前进时返回 502 `PLAY_HISTORY_CURSOR_STALLED`；插件不摘要/切片。
- import-context claim/终态/lineage 已实现：公开 `claimEventSeqs` 驱动 pending → claimed；terminal 前同一 identity 可重放，`turn/end` 保存 event seq、turn、reason.kind 等非正文元数据并转 consumed；terminal 后新 claim 不注入。Tavern swipe 通过公开 branch 复制 selection 与不含正文的 pending lineage，旧 claim 不直接复用；第三方原生 fork 不在插件拦截范围。
- ✅ catalog/timeline GET 返回精确 UTF-8 字节 SHA-256 `revision`，PUT 使用显式 `expectedRevision`；缺失/格式错误分别为 400，目标状态或 hash 不一致为 409，冲突不改文件。服务端合同、内置 live client 的 revision 缓存/有限重放原语，以及内置生命周期 caller 的 CAS 迁移均已实现。
- ✅ catalog/timeline 已在 GET 读后与 PUT 写前执行同一 schema/path 校验；未知第三方 `ext` 原样保留。revision/CAS 已在同一目标 guard 中实现；路径锁、逐段 no-follow 检查、临时 `wx` 写和 rename 前复验已实现。
- 路径逐段拒绝 symlink/junction（Node 暴露的链接类型），逐层非 recursive 创建并 realpath 复核，临时文件使用排他 `wx`，写入/rename 前复验父目录；纯 Node 仍无法抵抗外部进程制造的极窄竞态，不引入 native addon。
- 本轮已接入后端 `ctx.logger` 的 operation log：`PUT /workspace`（bind）、`POST /workspace/dirs`、`PUT /workspace/files?path=`（普通文件及 catalog/timeline）、`POST /playthroughs/:id/detach-session`、`POST /playthroughs/:id/relink-character`，以及 session create/branch/user-message 和 import-context PUT/DELETE。每次变更请求记录同一 `operationId` 的 start、request.validated、Host/prepare/bind/copy 或 timeline/catalog 变更阶段、success 或 failure；不记录资源/聊天正文。user-message 只记录 Host prompt accepted 阶段，不记录正文、长度或摘要。GET/list、session/messages/focus/import-context、chrome 及浏览器日志、持久 journal、额外 exporter 暂缓。

上述加固均已实现并纳入 `npm run verify:2.0`；该命令验证 history、schema/CAS/focus/路径防护、claim/lineage、无正文 operation log、chrome service/slot、工作区准入、本地化与发布包边界。设置 `DSH_TAVERN_PLAY_LIVE=1` 与 `DSH_TAVERN_PLAY_LIVE_URL` 后还会对运行中的 DSH Host 实际读取 chrome/workspace 权威状态；真实写入、浏览器双标签页通知和最终 rc.8 交互仍在发布验收清单中。具体风险与决策见 [`PLAY_REVIEW.md`](PLAY_REVIEW.md)。

`chrome` 是整个前端的蓝/红球，存在插件 data `chrome.json`，默认 `native`。非法 `mode` → 400。GET 不要求 JSON Content-Type。
`GET /chrome/events` 是 Tavern 自有的 SSE 变更面，不是 DSH Host API。连接后立即发送 `event: chrome/change` 当前快照；成功的 `PUT /chrome` 在实际 mode 变化后广播一次同名事件，事件 data 只含 `{ mode, revision }`。SSE 使用 `text/event-stream`、禁止缓存并在连接关闭时清理订阅；非 GET → 405。旧客户端只读取 `mode` 仍兼容，无法使用 SSE 的客户端应回退 GET/focus 刷新或短轮询。直接编辑 `chrome.json`、其他进程写入以及 DSH 私有 transport 不在该事件合同内。

客户端入口始终显示 `DT`。左键立即展开/收起菜单，快速重复点击重复同一默认行为，双击没有特殊效果；右键单击切换前端显示模式。菜单按钮使用“切换到自定义前端模式 / 切换到 DSH 原生模式”，当前状态可显示“当前：魔丸 / 当前：DSH 原生”；悬浮提示固定为“切换前端显示模式”。菜单始终挂载，容器展开完成（220ms）后内容再淡入。

`PUT /workspace` 的目录必须事先存在（DSH `workspace.create` 也不 mkdir）。`POST /workspace/dirs` 由 `PlayWorkspaceStore` 在已绑定根目录内直接创建角色卡 / 周目子目录，不依赖全局 `directory-picker` 或 `apiProxy.host.createDirectory`，因此 native/browse Host 都兼容。路径监狱拒绝 `..`、绝对路径、指向根外的符号链接和文件冲突。未选根时 files/dirs 返回 409。不要用 `archiveSession` 收纳会话。`user-message` 的 body 不是完整 prompt。session 元 API 经 Host `apiProxy`：`session.create` / `session.fork({ atSeq })` / `session.prompt({ mode: "queue" })` / `session.history`；`PUT /workspace` 调用 `workspace.create`；开放 turn 的 fork 映射为 HTTP 409。

## v1 bundled UI 合同

前缀 `/pmp-dsh-tavern/api/v1`。旧根 `/dsh-tavern/api` 已废止。

| 当你想 | 路径 |
| --- | --- |
| 管预设、导出 ST JSON、原生正则、独立世界书关系、看当前装配、导入/选中 | `/presets`、`/presets/:id/export`、`/presets/:id/regex-scripts`、`/presets/:id/world-books`、`/active`、`/import`、`/select` |
| 管角色卡、侧边栏顺序、缺失卡重关联、原生正则、独立世界书关系、绑定、导出 json/png、内嵌书 | `/characters`、`/characters/order`、`/characters/relink`、`/characters/:id/regex-scripts`、`/characters/:id/world-books`、`/characters/:id/world-book`、`/character-selection` |
| 管独立世界书和绑定 | `/world-books`、`/world-book-selection` |
| 管用户、用户-世界书关系 | `/users`、`/user-selection` |
| 界面语言缩放、绑卡跟随 RP | `/ui-settings` |
| 魔丸 conversation 正文与动作按钮缩放 | `/conversation-settings` |
| RP 开关与告警、rp:policy 正文 | `/rp-mode`、`/rp-alert`、`/rp-policy` |
| 看 Trace | `/traces` |
| 配置模板、按当前绑定开干净会话 | `/session-templates`、`/session-configurations/preview`、`/apply` |

### 角色卡侧边栏顺序

角色卡列表明确区分三种排序模式：`updated` 按 `updatedAt` 降序（同一时间再按名称、ID），`name` 按名称 A→Z（中文使用 `zh-CN` 排序），`custom` 按用户拖拽顺序。拖拽只写资源库状态，不修改角色卡原文或 `updatedAt`；切换到其他模式也不会清除已保存的自定义顺序。

| 方法 | 路径 | 请求 | 成功响应 |
| --- | --- | --- | --- |
| PUT | `/characters/order` | `{ mode, characterIds? }` | `{ ok: true, characters: [...], sorting: { mode } }` |

`mode` 必须是 `updated`、`name`、`custom` 之一。`custom` 不带 `characterIds` 表示切回并恢复已保存的自定义顺序；若尚无保存序列，则以当前资源顺序初始化，并把切出期间新增的卡追加到末尾。只有真正重排时才传 `characterIds`，它必须恰好包含当前存储中的全部角色卡 ID，每个 ID 只出现一次，最多 4096 项；未知、重复或遗漏均返回 400，失败时原状态不变。其它模式拒绝 `characterIds`。成功模式和自定义顺序分别保存在 `character-state.json` 的 `characterSortMode`、`characterOrder`。自定义模式中新建或导入的角色卡追加到末尾，删除角色卡同步清理其顺序项。`GET /characters` 同时返回 `sorting: { mode }`。

### 缺失角色卡与重新关联

删除角色卡时，资源正文和封面仍会删除，session 的失效选择仍会清理；角色卡库另外保留一条有界 tombstone（原 ID、显示名称、可用时的源文件 SHA-256），使 catalog 中仍引用该卡的周目可以显示在人类可读的“缺失角色卡”区域。新建周目同时在 `ext.pmpDshTavern` 快照 `characterId`、`characterName`、可用时的 `characterSha256`，不会把角色卡正文复制到 timeline。

重新导入角色卡后，先用唯一 SHA-256 匹配 tombstone；没有散列匹配时，仅在缺失名称和现存名称双方都唯一时使用规范化同名匹配。唯一匹配会自动重关联；多个同名候选不自动猜测，由侧边栏选择目标卡。

| 方法 | 路径 | 请求 | 成功响应 |
| --- | --- | --- | --- |
| POST | `/characters/relink` | `{ previousCharacterId, characterId }` | `{ ok: true, relinkedPlaythroughCount, relinkedSessionCount }` |

v1 `/characters/relink` 是缺失资源恢复面：它以 catalog revision 作 CAS，把所有引用旧 ID 的周目归属改为目标卡，并在同一批 session selection 写入中更新 root、swipe、branch 后代会话。v2 `/playthroughs/:id/relink-character` 是周目生命周期面：只迁移指定周目和它的全部后代 session。内置前端会按“唯一 SHA-256，其次双方唯一同名”的自动归类规则评估目标；不匹配时显示警告，但用户仍可明确确认，后端不会用启发式规则否决显式选择。

两种重新关联都会拒绝覆盖与待迁移周目原归属无关的第三张角色卡绑定。session 批量写入失败时会以刚写入的 revision 尝试回滚 catalog。v1 恢复成功后才清除 tombstone；工作区未绑定时自动恢复会延后而不会静默丢弃 tombstone。关键开始、成功与延后原因写入 `ctx.logger`。

### Conversation 显示设置

`/conversation-settings` 是 v1 bundled UI 合同，与 `/ui-settings` 分离。它只持久化魔丸 RP conversation 的显示偏好，不进入 profile、提示词、timeline、DSH history 或导出正文。

| 方法 | 路径 | 请求 | 成功响应 |
| --- | --- | --- | --- |
| GET | `/conversation-settings` | 无 | `{ ok: true, settings: { schemaVersion: 1, textScale, actionScale } }` |
| PUT | `/conversation-settings` | `{ textScale, actionScale }` | 同 GET |
| DELETE | `/conversation-settings` | 无 | 恢复两个字段为 `1` |

两个 scale 均为 `0.75`–`1.5` 的有限数值，步进 `0.05`；PUT 是完整替换并拒绝未知字段。`textScale` 作用于魔丸用户/助手正文与 greeting（含空周目 opening dock），`actionScale` 只作用于 durable QA 末尾的复制、swipe、分支、回退和编辑操作行。

### 预设导出

`GET /presets/:id/export` 返回 `application/json` 附件。服务端以保存的 ST 原文为底稿，保留未知顶层字段、prompt 字段、其它 `prompt_order` 和扩展；同时用 Tavern 当前规范化状态覆盖名称、采样参数、prompt 内容/顺序/开关以及当前 Chat Completion order。因此导出反映当前编辑结果，不等同于直接下载导入时的 `source.raw`。

导出的正文是可重新传给 `POST /import` 或导入 SillyTavern 的 Chat Completion preset JSON。Tavern 专属的 `systemPromptMode` 没有对应 ST 字段，不写入导出文件；资源携带的原生正则仍位于其原有 ST 路径。该 GET 不改变选择、session、资源或 operation log。

| 方法 | 路径 | 请求 | 成功响应 |
| --- | --- | --- | --- |
| GET | `/presets/:id/export` | 无 | ST JSON 附件；`Content-Disposition: attachment` |


### 资源携带的原生 ST 正则

预设与角色卡使用一致的子资源合同：

| 方法 | 路径 | 请求 | 成功响应 |
| --- | --- | --- | --- |
| GET | `/presets/:id/regex-scripts` | 无 | `{ ok: true, regexScripts: [...] }` |
| PUT | `/presets/:id/regex-scripts` | `{ regexScripts: [...] }` | `{ ok: true, regexScripts: [...] }` |
| GET | `/characters/:id/regex-scripts` | 无 | `{ ok: true, regexScripts: [...] }` |
| PUT | `/characters/:id/regex-scripts` | `{ regexScripts: [...] }` | `{ ok: true, regexScripts: [...] }` |

`PUT` 是有序数组的完整替换，不是逐字段 merge；数组顺序就是同一资源内的执行顺序。数组元素必须是对象；服务端不改写原生 ST 字段，也不丢弃规则内未知扩展字段。适配器优先写回资源已有的 `regex_scripts` 路径；没有现有数组时，预设写入 `extensions.regex_scripts`，V2/V3 角色卡写入 `data.extensions.regex_scripts`，V1 角色卡写入 `extensions.regex_scripts`。资源中的其他字段保持不变，写入仍经过对应 store 的原子保存和总文档体积限制。

这个 v1 子资源只编辑预设或角色卡原文。它不组合全局正则，不计算当前 session 最终生效集合，不修改历史、timeline 或 AI 请求；魔丸显示管线只把保存后的资源数据作为渲染投影读取。失败响应沿用所属资源 API 的既有格式与状态码。

魔丸正则页的“预设绑定/角色卡绑定”新增、导入、编辑和删除均使用上述原生子资源，而不是把规则保存在工作区全局 `ui/regex.json` 后仅附加 resource scope。旧版本已经这样保存的本地 scoped rule 会在对应资源再次成为当前绑定时进入待迁移状态；用户点击保存后，规则写入资源原文并从全局文档移除。迁移按 rule id 与已有原生规则去重，不会仅因打开面板就改写资源。

### 预设/角色卡关联独立世界书

预设与角色卡可以关联零本或多本已经存在的独立世界书：

| 方法 | 路径 | 请求 | 成功响应 |
| --- | --- | --- | --- |
| GET | `/presets/:id/world-books` | 无 | `{ ok: true, binding: { presetId, worldBookIds } }` |
| PUT | `/presets/:id/world-books` | `{ worldBookIds: [...] }` | 同 GET |
| GET | `/characters/:id/world-books` | 无 | `{ ok: true, binding: { characterCardId, worldBookIds } }` |
| PUT | `/characters/:id/world-books` | `{ worldBookIds: [...] }` | 同 GET |

`PUT` 完整替换该资源的有序关系，重复 ID 稳定去重；资源或世界书不存在时拒绝写入。每个预设或角色卡最多关联 100 本。关系由 loader-owned 的 `resource-world-book-bindings.json` 原子保存，不向 ST 预设或角色卡原文写入 Tavern 私有字段。因此：

- 预设导出、角色卡 JSON/PNG 导出不会夹带这些 Tavern 本地关联；卸载插件后原资源仍可按 ST 原生语义使用；
- `DELETE /presets/:id` 或 `DELETE /characters/:id` 清理该资源拥有的关系；删除独立世界书会从会话、用户、预设和角色卡关系中清理对应 ID；
- 角色卡复数路径 `/world-books` 表示关联独立资源；单数路径 `/world-book` 仍表示编辑角色卡自身的 `character_book`。两者可以同时存在。

loader 的独立书合成顺序固定为：会话显式绑定、用户关系、预设关系、角色卡关系；相同 ID 只执行一次，但 audit/resource summary 保留全部 `bindingSources`。角色卡内嵌 `character_book` 在上述独立书之后进入同一个 matcher。`GET /active` 的 `worldBookSelection` 公开 `explicitIds`、`userBoundIds`、`presetBoundIds`、`characterBoundIds`、`effectiveIds`、`duplicateIds` 和 `order`。

世界书面板直接陈列这些来源。当前角色卡没有 `character_book` 时，前端可以先建立 `{ name, entries: [] }` 草稿，再由现有 `PATCH /characters/:id/world-book` 保存；这是创建可随卡导出的内嵌书，不等同于绑定独立书。

### Tavern 周目分支组合

内置 RP 视图不覆盖 DSH 原生 fork。它在目标 adopted assistant 的 `endEventId` 调用公开 `POST /sessions/:id/branch`，先用 `/messages` 验证子 session 继承了该 durable user/assistant 区间，再创建新周目目录和截至该 QA 的 timeline 副本。副本只把目标 adopted variant 的 `sessionId` 重定向到子 session，随后用 catalog CAS 追加新周目并通过按 id 的 focus 校验。这样新周目保留 DSH 权威上下文，再次从侧边栏进入时也会打开可继续对话的 branch session；源 timeline、源 variant 和 DSH 原始消息不变。

这仍是现有原子 API 的客户端组合，不是跨 session、目录、timeline、catalog 的大事务。branch 已成功而后续文件写入失败时可能留下未归档的 DSH 子 session 或工作区孤儿文件；每一步由现有 `ctx.logger` operation 记录，客户端不通过删除原始历史来伪造回滚。

“在本周目从这里继续”复用相同的 DSH branch 与 inherited durable range 校验，但不创建目录、timeline 副本或 catalog 条目。客户端仅以 timeline CAS 把 `head` 移到 `{ continuationSessionId, targetNodeId, targetVariantId }`；旧后续节点仍保存在树中，但不属于当前活动路径。下一条真实消息完成后以目标 variant 为 parent 追加新 QA。它不是删除/改写 DSH 历史，也不伪造用户或 assistant 消息。

### 后端 operation log utility

`packages/play/src/operation-log.js` 导出 `createOperationContext` 和
`operationLogConstants`，供 workspace/catalog/timeline 及 session/import
mutation 接入。当前已接入以下写操作：

- `PUT /workspace`（bind）、`POST /workspace/dirs`、`PUT /workspace/files?path=`；
- `POST /sessions`、`POST /sessions/:id/branch`、`POST /sessions/:id/user-message`；
- `PUT /sessions/:id/import-context` 和 `DELETE /sessions/:id/import-context`。

只读的 GET 不产 operation 日志。它只接受 Cordis `ctx.logger`（或其 callable
logger service），以 `dsh-tavern.operation ` 前缀输出单行日志；前缀后的部分是稳定
JSON。一次 operation 在 context 创建时保存 operation 名和开始时刻，并可记录
`start`、多个 `stage`、一次 `success` 或一次 `failure`。成功和失败终态包含
`result` 与非负 `durationMs`；失败只记录稳定 `error.code`（缺失时为
`UNKNOWN_ERROR`）和可选 HTTP status，使用 `warn` 级别。

日志 payload 的白名单只有 `operationId`、`operation`、`stage`、`result`、
`errorCode`、`status`、`durationMs`、`method`、`sessionId`、`playthroughId`、
`path`。标识和路径会做类型、长度和控制字符归一化；prompt、QA、角色卡、
preset、正则、资源正文、请求 body、message text 及未知字段均不会输出，也不做
正文摘要。logger 缺失、方法缺失或 logger 自身抛错时 fail-soft。terminal 之后的
stage 或 terminal 调用无效且不会重复写终态。

本节声明 utility 及上述 workspace/session/import endpoint 接入；当前不能据此声称
所有生命周期静默失败都已被日志覆盖。默认 Cordis logger 仍由其自身管理，插件不写
持久日志文件、浏览器日志或 exporter。

## 浏览器端 Chrome 模式服务

Tavern client 通过 rc.8 公开 Cordis `ctx.provide` 注册稳定服务名 `pmpDshTavernChrome`。这是 Tavern v2 自有合同，不是 DSH Host API；它只提供 `native|play` 生命周期，不拥有或仲裁任何 slot、view 或第三方插件 UI。

公开 face：

- `getMode()`、`getSnapshot()`：同步返回冻结的 `{ mode, revision }`；旧服务端的 revision 可为 `null`。
- `subscribe(listener)`：注册后立即同步通知当前快照，返回幂等 disposer。
- `refresh()`：通过 `GET /v2/chrome` 回读并提交权威快照。
- `setMode(mode)`、`switchMode()`：串行写入；只有 `PUT /v2/chrome` 成功返回后才更新本地状态。
- `when(mode, setup)`：进入目标模式时 setup，离开、取消注册或服务卸载时 dispose；异步 setup 迟到也会立即清理。

必需依赖的插件可声明 `inject: ['pmpDshTavernChrome']` 后读取 `ctx.pmpDshTavernChrome`；兼容性可选插件应使用 `ctx.get('pmpDshTavernChrome')` 并在缺失时保持自己的 native/fallback 行为。第三方不得重新 provide 同名服务，也不得依赖 Tavern 内部的 React state、`playSlots`、EventSource 或 timer。

内部 transport 使用 `GET /v2/chrome/events`；不支持 EventSource、连接失败或断线时降级为初始 GET、window focus 回读和1秒轮询，SSE恢复后停止轮询。BroadcastChannel 不属于合同。服务卸载会停止transport并清理所有 `when` effect；多个第三方插件的注册互相独立，各自只清理自己拥有的slot/UI。

第三方 DSH 插件、独立 Web 客户端、surface 所有权、原子动作组合与卸载降级的完整说明见 [FRONTEND_INTEGRATION.zh-CN.md](FRONTEND_INTEGRATION.zh-CN.md)。当前没有配置文件一键替换魔丸、frontend provider registry 或动态 bundle loader。
