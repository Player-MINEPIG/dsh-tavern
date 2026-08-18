# dsh-tavern package architecture

状态：2026-08-19，安装标识为 `pmp-dsh-tavern`；HTTP 挂载 `/pmp-dsh-tavern/api`，资源走 `/v1`。RP 会话叠加与委派子 agent 固化父选择仍然有效。本文是当前架构决策与发布审查门槛，不是产品 README。

## 决策结论

`dsh-tavern` 保持为一个可安装的 DSH 插件，在同一仓库和发布包内拆成单向依赖的内部层。preset、角色卡、用户、独立世界书和 Tavern Trace 均由统一 loader/client 组合；不要求用户安装多个互相配套的 DSH 插件。

```text
SillyTavern JSON
       │
       ▼
packages/tavern-format
解析、校验、归一化、未知字段保留、ST macro
       │
       ▼
packages/preset  packages/character  packages/user  packages/world-book-library
预设用例          角色卡资源/UI        用户资源/UI    独立世界书资源/API/UI
          \              |              |              /
           \             |              |       packages/world-book
            \            |              |       世界书纯格式、匹配与投影
             \           |              |             /
       │
       ▼
packages/play
chrome / 扮演工作区 files / timeline 校验 / focus 派生（纯逻辑+HTTP）
       │
       ▼
packages/tavern-loader ◄── DSH session/event（PendingInputProjection）
DSH 编译策略、session/request 策略、Host hooks、v1+v2 HTTP
       │
       ├── packages/tavern-trace
       │   最小化审计模型、有界插件存储/API、conversation.view
       │
       ▼
DSH system prompt + agent request
```

依赖只能向下：`tavern-loader → play/preset/character/user/world-book-library/world-book/tavern-trace → tavern-format`。格式层和 `world-book` 纯库不能导入 DSH、文件系统或 UI；preset、character、user、world-book-library 和 `play` 用例层不能注册 `systemPrompt`、`agent/request` 等 Host seam；只有 loader 是根 `main` 入口并允许依赖 DSH 运行时。`tavern-trace` 接受 loader 传入的普通 snapshot/session event 数据，但不导入 DSH、不 append Session；它只拥有最小化审计格式、有界插件存储、只读 API 和浏览器 view。浏览器侧由 `packages/client` 组合各用例 UI，它不是 Host loader。

## 各层职责

| 层 | 回答的问题 | 当前内容 | 明确不负责 |
| --- | --- | --- | --- |
| `tavern-format` | “这个 ST 文件表达了什么？” | preset 识别、顺序和启用状态归一化、原字段保留、编辑模型、macro 解释 | session 选择、DSH system 段、模型调用参数、HTTP、磁盘 |
| `preset` | “用户如何管理预设？” | 原子文件存储、导入/创建/修改/删除/选择、API、侧边栏源代码 | 决定提示词如何进入 agent |
| `character` | “用户如何管理角色资源？” | JSON/PNG 导入、创建/编辑、当前文档 JSON/PNG 导出、per-session binding、API、UI、loader/world-book 资源快照 | prompt 放置、assistant 历史、世界书激活 |
| `user` | “用户如何管理自己的 Tavern 身份描述？” | 严格三字段文档、CRUD 持久化、API、UI、loader adapter | 头像、DSH Agent 身份、prompt 放置、Host seam |
| `world-book` | “哪些 lore entries 候选应被激活？” | ST/角色内嵌格式、归一化、纯匹配/排序/预算与 loader 投影 | session 选择、DSH 注入、角色卡存储 |
| `world-book-library` | “用户如何管理独立世界书资源？” | 原子 JSON 存储、CRUD/导出 API、编辑 UI、供 loader 读取的 document | session 选择所有权、matcher 复制、Host seam、角色卡内嵌书修改 |
| `session-template` | “怎样复用 Tavern 配置但创建干净 DSH 会话？” | 有界模板投影/原子存储/API、缺失资源诊断和客户端事务顺序 | DSH 历史、Trace、Session 构造、最终 prompt |
| `play` | “扮演表面的元状态存在哪、文件怎么守在根内？” | 全局 chrome、扮演工作区路径监狱、timeline/catalog 校验与 `deriveFocus`；HTTP 在 loader 挂载 | DSH session 事件、RP 锁、内置魔丸 DOM |
| `tavern-loader` | “当前资源怎样影响这次 DSH 请求？” | 编译选中预设、映射支持的 call config、append/replace 策略、Host/API 挂载、独占 pending-input 投影、RP 会话叠加 | 重新解释 ST 原始字段、实现具体 UI |
| `tavern-trace` | “这次 loader 为什么得到这个组合？” | turn/step 对齐、资源摘要、世界书接受/拒绝原因、header 摘要引用、有界存储/API/并列 view | 保存正文、替代 request/header、append 会话事件或模型消息 |

角色卡已经在 `tavern-format` 增加 adapter/model，并在 `character` 用例层提供管理与资源入口；用户资源由独立 `user` 用例层提供严格 `{id,name,description}` 文档；世界书格式兼容位于独立纯库 `packages/world-book`。所有资源最终由同一个 `tavern-loader` 组合。角色卡和用户模块都不读取预设排序，也不决定字段插入位置。

统一 loader 把 Host 注册收敛为 `dsh-tavern:profile` 与可选的 `rp:policy` 两个 section，并引入 loader-owned `SessionSelectionStore`：preset、角色、用户和世界书的文档仍由各自模块管理，但“哪个 session 使用哪些资源”以及 RP 叠加由统一策略持久化。普通 fork 与 delegated subagent 都复制父选择。RP 不是 DSH agent preset。

统一 adapter、session 继承和 marker 契约见 `docs/LOADER_CONTRACT.md`；DSH 原生与插件增强消息流见 `docs/DSH_MESSAGE_FLOW.md`；世界书格式和投影细节见 `docs/world-book/DESIGN.md`。

干净会话与配置模板由 `packages/session-template` 保存纯选择投影，loader 注入真实资源库和 `SessionSelectionStore`。浏览器组合根只通过 DSH 公开的 `workspaces.connectWorkspace()` 与 `sessions.open()` 创建/导航；它不 fork 或伪造历史。完整事务边界见 `docs/LOADER_CONTRACT.md`。

## Loader-owned ActivationContext

rc.6 的 `agent/inbox/spliced` 是公开、持久的 Session event；插入、替换、取消和 claim 都先 append 该事件并同步通知 `session/event`，随后实时 Inbox 才改变。loader 在这个边界维护唯一 `PendingInputProjection`，把 durable history 与本次 claimed batch 去重后组合为临时 `ActivationContext`，供 world-book matcher 只读消费。

这个投影属于 Host adapter，不下沉到纯模块：

- `world-book` 继续只接收显式 messages/text/options，不能读取 session 或监听 event；
- `character`、`user` 和 `world-book-library` 不复制 pending 状态，也不改变各自存储模型；
- `tavern-trace` 只接收已编译 snapshot 和无正文来源元数据，不持久化输入；
- `packages/client` 不参与捕获，避免浏览器刷新或多窗口决定运行语义；
- loader 必须处理 cancel/replace/steer、多个 target、异常清理与下一 step 去重。

这项变化只把“当前输入参与激活判断”的位置前移到首次 system assembly；它不改变 DSH durable history、真实 role message 顺序、工具权限、`agent/request` 或 `request/header` 的所有权。

## 控制面扩展

- 用户与独立世界书的关联已由统一 loader policy 的独立原子文件持有；`UserModel` 仍只有 `id/name/description`，`world-book-library` 文档也不反向保存用户 id。用户 UI 可以编辑关系，但最终以 session 显式来源优先、用户来源随后稳定去重，且只有 loader 的共享 adapter 运行 matcher。
- UI 缩放、语言与绑卡跟随 RP 已由 `packages/client` 的单一设置入口、共享 locale contract 和逐语言语义 catalog 实现。业务组件只引用语义 key，动态资源值通过显式 raw boundary 插值；运行时不再扫描或替换中文原文。loader 根 API 只持久化有界的全局显示文档（含 `rpFollowCharacter`），资源 JSON、profile 编译和 session selection 不读取显示语言/缩放。可选的 `rp:policy` 正文是另一份有界文件 `rp-policy.json`。
- 这两项都必须复用现有单插件 API、安全边界、刷新事件和原子持久化模式，不能通过新增第二个可安装插件实现。

## 为什么不是两个 DSH 插件

格式解析器有独立价值，但其合适形态是纯库，不是一个可单独安装的 DSH 插件：

- 可被浏览器导入预览、服务端导入、迁移 CLI、快照测试和未来角色卡/世界书工具复用；
- 可在没有 DSH、session、文件系统的测试环境中验证格式兼容；
- 能把“ST 文件解析错误”和“DSH 加载策略错误”分开定位。

理论上可以给 `tavern-format` 增加自己的 package manifest 并单独发布为 npm library，但当前没有必要。它没有 Host entry、bundle patch 或独立用户功能，不能单独把内容发送给 agent。把它包装成第二个 DSH 插件会产生以下问题：

- 用户看到“安装成功”却没有对话效果，形成半安装状态；
- loader 与 parser 版本必须额外协商；
- 两个插件都可能争用 API、存储或 UI 生命周期；
- 安装、卸载、备份和故障排查成本翻倍。

因此发布与安装单位固定为根包 `pmp-dsh-tavern`（产品名仍是 dsh-tavern），内部包边界用于代码复用和测试隔离。浏览器与 Host 共用 `packages/identity.js` 的 `PLUGIN_ID`、`API_ROOT`、`API_V1`、`API_V2`。HTTP 挂载前缀是 `/pmp-dsh-tavern/api`；现有资源走 `/v1`，扮演元 API 走 `/v2`（chrome 与 workspace files 已挂；sessions 随后续模块补齐）。旧根 `/dsh-tavern/api` 已废止。`packages/play` 不导入 DSH；只有 loader 把 v2 handler 挂到现有 `secureTavernApi`。`package.json` 的 `./format`、`./preset`、`./character`、`./user`、`./world-book`、`./world-book-library`、`./trace`、`./loader` exports 是程序接口，不代表可分别安装的插件。

## 当前发布门槛

早期 preset、角色卡、世界书、用户与 Phase 3 worktree 已完成分层开发并统一接入当前 loader；具体提交过程保留在 `docs/CHANGELOG.md`，不再作为尚待执行的合并步骤。正式合入 `main` 前必须：

1. 运行格式兼容验收，证明 ST 解析、未知字段保留和归一化结果稳定；
2. 运行加载验收，证明 per-session 选择、system profile、call config、当前输入激活、API 与 Trace 不回归；
3. 运行 `npm run check` 与 `npm run pack:check`，确认生成 bundle 稳定且发布包不包含 docs、测试、运行数据或外部 fixture；
4. 用隔离 `DSH_HOME` 安装根插件并启动真实 DSH，至少完成 launcher、资源绑定、新会话和一次 request/header/Trace 对齐检查；
5. 扫描跟踪文件和 npm 包清单，确认没有本机绝对路径、API key、私有 fixture 或第三方导入内容；
6. README、使用指南、安全风险、验收记录和 changelog 与实现同步后再合并、打标签和推送。

## 两组长期验收

格式兼容验收关注：输入识别、诊断、prompt order、启用状态、未知字段保留、稳定归一化，以及外部版权 fixture 只读且不进入仓库。

运行加载验收关注：当前选择、session 隔离、append/replace、资源组合顺序、call config、最终 request/header、API 审计与安装入口。以后更换加载策略时，不应使格式解析测试一起失效。

当前架构测试会检查关键依赖方向；它不能替代代码评审，但会阻止最明显的 DSH Host 逻辑回流到格式层。
