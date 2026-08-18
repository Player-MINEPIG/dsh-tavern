# HTTP API

状态：2026-08-19。根：`/pmp-dsh-tavern/api`。鉴权仍是本机 TCP peer、Host、Origin、Content-Type（见 loader 安全中间件）。成功响应带 `ok: true`；失败带 `ok: false` 与 `error`。

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
| POST | `/chrome` | 不提供 | 404 |
| GET | `/workspace` | 根路径、是否已选、合同版本、警告 | 已实现 |
| PUT | `/workspace` | 绑定**一棵**已存在的扮演工作区根。首次选择带 `SWIPE_DISK` / 可能的 `SYSTEM_DISK` 警告。不 mkdir 根 | 已实现 |
| POST | `/workspace/dirs` | `{ path }` 相对路径 mkdir。未绑根 → 409。不新注册 DSH 工作区 | 已实现 |
| GET | `/workspace/files?path=` | 读根内 UTF-8 文件 | 已实现 |
| PUT | `/workspace/files?path=` | `{ content }` 写根内 UTF-8 文件。`..`、绝对路径、symlink 逃逸 → 400/403 | 已实现 |
| GET | `/workspace/files?list=` | 列一层前缀 | 已实现 |
| POST | `/sessions` | 新开扮演 session。必须已有角色卡，否则 `409 PLAY_CHARACTER_REQUIRED`。标题=角色名+时间；可选复制绑定；插入扮演工作区。**不写 timeline** | 已实现 |
| POST | `/sessions/:id/branch` | `{ atEventId }` = 日志 seq。fork，不写 timeline、不代发。开放 turn → 409 | 已实现 |
| POST | `/sessions/:id/user-message` | `{ text }` 作为下一条用户正文，`session.prompt` `queue` | 已实现 |
| GET | `/sessions/:id/messages` | `deriveMessages()` + `seq` + `incompleteTurn` | 已实现 |
| GET | `/focus` | 只读派生 `{ sessionId }`。前端再 `sessions.open` | 已实现 |
| POST | `/focus` | 不提供 | 404 |

`PUT` 命中 `timeline.json` / `catalog.json` 时先做 schema 校验，失败不落盘。`focusSessionId` 禁止写入。focus 是派生值：仍在渲染（未 `hidden`）的最后一轮 **qa** 的 adopted variant 的 `sessionId`。greeting-only 没有 focus session。校验不读、不改 DSH 事件。

`chrome` 是整个前端的蓝/红球，存在插件 data `chrome.json`，默认 `native`。非法 `mode` → 400。GET 不要求 JSON Content-Type。

`PUT /workspace` 的目录必须事先存在（DSH `workspace.create` 也不 mkdir）。角色卡 / 局子目录只落盘。路径监狱拒绝 `..`、绝对路径和指向根外的符号链接。未选根时 files/dirs 返回 409。不要用 `archiveSession` 收纳会话。`user-message` 的 body 不是完整 prompt。session 元 API 经 Host `apiProxy`：`session.create` / `session.fork({ atSeq })` / `session.prompt({ mode: "queue" })` / `session.history`；`PUT /workspace` 调用 `workspace.create`；开放 turn 的 fork 映射为 HTTP 409。

## v1 bundled UI 合同

前缀 `/pmp-dsh-tavern/api/v1`。旧根 `/dsh-tavern/api` 已废止。

| 当你想 | 路径 |
| --- | --- |
| 管预设、看当前装配、导入/选中 | `/presets`、`/active`、`/import`、`/select` |
| 管角色卡、绑定、导出 json/png、内嵌书 | `/characters`、`/character-selection` |
| 管独立世界书和绑定 | `/world-books`、`/world-book-selection` |
| 管用户、用户-世界书关系 | `/users`、`/user-selection` |
| 界面语言缩放、绑卡跟随 RP | `/ui-settings` |
| RP 开关与告警、rp:policy 正文 | `/rp-mode`、`/rp-alert`、`/rp-policy` |
| 看 Trace | `/traces` |
| 配置模板、按当前绑定开干净会话 | `/session-templates`、`/session-configurations/preview`、`/apply` |
