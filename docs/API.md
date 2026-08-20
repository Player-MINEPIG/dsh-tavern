# HTTP API

状态：2026-08-20。根：`/pmp-dsh-tavern/api`。鉴权仍是本机 TCP peer、Host、Origin、Content-Type（见 loader 安全中间件）。成功响应带 `ok: true`；失败带 `ok: false` 与 `error`。

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
| GET | `/workspace/files?path=` | 读根内 UTF-8 文件 | 已实现 |
| PUT | `/workspace/files?path=` | `{ content }` 写根内 UTF-8 文件。`..`、绝对路径、symlink 逃逸 → 400/403 | 已实现 |
| GET | `/workspace/files?list=` | 列一层前缀 | 已实现 |
| POST | `/sessions` | 新开扮演 session。有角色卡时标题=角色名+时间；无角色卡时走 DSH `session.create` 默认标题，不 409。仅当 body 带 `selectionFromSessionId` 才复制 Tavern 绑定。插入扮演工作区。**不写 timeline** | 已实现 |
| POST | `/sessions/:id/branch` | `{ atEventId }` = 日志 seq。fork，不写 timeline、不代发。开放 turn → 409 | 已实现 |
| POST | `/sessions/:id/user-message` | `{ text }` 作为下一条用户正文，`session.prompt` `queue` | 已实现 |
| GET | `/sessions/:id/messages` | `deriveMessages()` + `seq` + `incompleteTurn` | 已实现 |
| GET | `/focus` | 只读派生 `{ sessionId }`。前端再 `sessions.open` | 已实现 |
| POST | `/focus` | 不提供 | 405 |

路径存在、方法不对 → `405 PLAY_METHOD_NOT_ALLOWED`（例如 `POST /chrome`、`POST /focus`、`GET /sessions`）。`404` 只用于路径本身不存在。

`PUT` 命中 `timeline.json` / `catalog.json` 时先做 schema 校验，失败不落盘。timeline 只允许真实 `qa` 节点，greeting 从角色卡与 session selection 派生，不进入 timeline。`focusSessionId` 禁止写入。focus 是派生值：仍在渲染（未 `hidden`）的最后一轮 `qa` 的 adopted variant 的 `sessionId`。`GET /focus` 只返回 `{ ok, sessionId }`，不含 path / nodeId。空 timeline 的 `sessionId` 为 `null`。校验不读、不改 DSH 事件。

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
