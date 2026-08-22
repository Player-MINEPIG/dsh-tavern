# dsh-tavern package architecture

状态：2026-08-22，安装标识为 `pmp-dsh-tavern`；HTTP 挂载 `/pmp-dsh-tavern/api`，资源走 `/v1`，扮演表面合同走 `/v2`。RP 会话叠加与委派子 agent 固化父选择仍然有效。本文是当前架构决策与发布审查门槛，不是产品 README。

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
| `play` | “扮演表面的元状态存在哪、文件怎么守在根内？” | 全局 chrome、扮演工作区路径监狱、timeline/catalog 校验、`deriveFocus`、session HTTP；Host RPC 由 loader 适配 | DSH 事件改写、RP 锁、内置魔丸 DOM、`archiveSession` |
| `tavern-loader` | “当前资源怎样影响这次 DSH 请求？” | 编译选中预设、映射支持的 call config、append/replace 策略、Host/API 挂载、独占 pending-input 投影、RP 会话叠加 | 重新解释 ST 原始字段、实现具体 UI |
| `tavern-trace` | “这次 loader 为什么得到这个组合？” | turn/step 对齐、资源摘要、世界书接受/拒绝原因、header 摘要引用、有界存储/API/并列 view | 保存正文、替代 request/header、append 会话事件或模型消息 |

角色卡已经在 `tavern-format` 增加 adapter/model，并在 `character` 用例层提供管理与资源入口；用户资源由独立 `user` 用例层提供严格 `{id,name,description}` 文档；世界书格式兼容位于独立纯库 `packages/world-book`。所有资源最终由同一个 `tavern-loader` 组合。角色卡和用户模块都不读取预设排序，也不决定字段插入位置。

统一 loader 把 Host 注册收敛为 `pmp-dsh-tavern:profile` 与可选的 `rp:policy` 两个 section，并引入 loader-owned `SessionSelectionStore`：preset、角色、用户和世界书的文档仍由各自模块管理，但“哪个 session 使用哪些资源”以及 RP 叠加由统一策略持久化。普通 fork 与 delegated subagent 都复制父选择。RP 不是 DSH agent preset。

统一 adapter、session 继承和 marker 契约见 `docs/LOADER_CONTRACT.md`；DSH 原生与插件增强消息流见 `docs/DSH_MESSAGE_FLOW.md`；世界书格式和投影细节见 `docs/world-book/DESIGN.md`。

DSH 原生“新会话”按钮当前默认继承上一个聚焦会话的 preset 等 Tavern 选择/设定；这是 Host 基线。架构和验收不得继续把原生新会话假定为空白配置。

干净会话与配置模板由 `packages/session-template` 保存纯选择投影，loader 注入真实资源库和 `SessionSelectionStore`。DSH 模式下，浏览器组合根只通过公开 `workspaces.connectWorkspace()` 与 `sessions.open()` 创建/导航普通 blank session。魔丸模式下，同一控制面先 preview 配置并取得角色 id，再复用共享周目控制器与现有 v2 原子操作创建/复用该角色周目，最后通过 v1 apply 原子写入完整 selection；不增加“配置周目”专用后端动词。两条路径都不 fork 或伪造历史。完整事务边界见 `docs/LOADER_CONTRACT.md`。

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
- Conversation 显示偏好不混入上述外层 UI 文档。loader 通过独立的 `conversation-settings.json` 和 v1 `/conversation-settings` 保存 `textScale/actionScale`；客户端用独立事件只通知魔丸 chat 与空周目 opening dock。正文缩放通过局部 CSS custom property 进入 RP 文本，按钮缩放只进入 durable QA 动作行，因此不会级联改变 DSH native、输入栏、Tavern 面板、提示词或导出内容。
- 这两项都必须复用现有单插件 API、安全边界、刷新事件和原子持久化模式，不能通过新增第二个可安装插件实现。

## 原生优先的前端适配策略

前端长期遵循“最小改动、最大兼容”：先在当前 DSH 版本的包 README、根导出类型和公开 slot / service 中寻找等价能力，只有 DSH 没有表达 Tavern 语义的公开接口时才自建。复用的判定标准不是“能从 DSH 源码里 import 到”，而是同时满足：能力在公开文档或根导出中出现、由插件清单显式注入或声明依赖、没有读取 `/src/*` 或 bundle 内部符号、卸载本插件后 Host 数据和原生界面仍可独立工作。

### 当前已经复用的 DSH 机制

| Tavern 能力 | 复用的 DSH 公开机制 | 自定义部分及边界 |
| --- | --- | --- |
| DT 悬浮入口 | `shell.overlay` additive slot、Cordis effect 生命周期 | 球体、菜单内容和全局 chrome 状态是产品 UI；不向 `document.body` 另建失控根节点 |
| 魔丸侧边栏 | `sidebar.workspaces` slot；owner 注入的 `useSessions` / `useWorkspaces`；`ctx.sessions.open()` | 只重组为角色卡 / 周目投影，不改写、不归档、不隐藏 Host session 数据 |
| DSH 外层新会话 | rc.8 sidebar shell 自有；无公开 slot/service | Tavern 不用哈希 class、DOM capture 或源码替换接管；魔丸保留原生按钮并在文档中标为不推荐，普通区 `+` 只引导返回 native |
| 普通会话提示 | `conversation.input.dock` 独立整行 slot、继承的 `--dsh-composer-card-max-width` | 仅显示 Tavern 的 RP 工作区分类结果；提示按 Host composer 宽度居中，不接管原生 composer、不复制固定像素或读取哈希 class |
| 魔丸对话页 | `conversation.view` slot；标准 `useSession` 的 nodes / partial / running | 周目跨 session 聚合是 Tavern 投影；不伪造 DSH 消息，不读取私有 runtime |
| 魔丸默认视图 | `slots.entries("conversation.view")` 暴露的原生 `chat` store 句柄、session 级 `conversation.input.dock` 及其 `actions.setView()` | 新周目尚未选定视图时在无可见内容的 dock entry 中复用同一 store，切到 `rp` 后立即注销；不向视图环注册第二个 `chat`，保留可手动选择的原生“对话” |
| 实时发送和流式显示 | DSH `useSession` 实时节点与 partial | `/v2/messages` 只做持久消息范围对账，不重复封装 DSH 的浏览器实时 API |
| 对话滚动 | Conversation 的 `[data-conversation-scroll]` scrollport、sticky composer 几何和注入的 `chatScroll.save(null)` | 只选择何时调用原生“到底部”语义；不计算固定 composer 高度，不维护第二个滚动容器 |
| 干净新会话 / 配置模板 | DSH 模式复用 `workspaces.connectWorkspace()`；魔丸模式复用周目 v2 `sessions.create` 组合；两者都用 `sessions.open()` 导航 | Tavern 只在目标 session 上原子复制 selection；魔丸额外把配置角色作为周目归属并回读验证，不构造消息、不 fork 历史 |
| 周目 session 操作 | Host `sessions.create/rename/fork/prompt/history`、`workspace.insertSessionBefore`；Host 侧 `Session.deriveMessages()` | v2 把这些原子操作组成第三方前端可用的周目事务，同时保持 DSH session 为权威历史 |
| RP 安全模式 | 官方 `sandbox/mode` Session event、`tools.guard`、Session/agent 生命周期 hook | Tavern 只保存 RP 是否启用及跟随来源；不发明第二种沙箱状态 |
| prompt 与审计 | `systemPrompt.section`、`agent/request`、`request/header`、`Session.deriveMessages()` | loader 只编译选中的 ST 资源；Trace 只记录有界来源元数据 |
| Tavern Trace | additive `conversation.view` | Trace 是 loader snapshot 的解释层，不取代原生 Chat / Trajectory |
| 视觉适配 | DSH `--dsw-*` theme / semantic tokens | 角色卡、周目和资源编辑器的布局仍由 Tavern 拥有 |

### 可以进一步复用，但尚未迁移

以下是升级候选，不代表当前轮次已经授权修改：

- 用户与 assistant 正文不直接迁移到 `MessageText` / `MarkdownText`。未覆盖消息从 DSH 权威 content 按“宏替换 → ST 显示正则（全局 → 预设 → 角色卡，各来源保持数组顺序）→ Showdown 2.1.0 → DOMPurify”执行浏览器显示管线；因此自定义/XML 包裹标签不会阻断其内部 Markdown，嵌套标签和 ST 的宽松引用代码围栏语义也能保留。规则页只允许同来源拖拽，保存后全局写工作区文档，资源规则写回原生 `regex_scripts` 数组。DSH `MarkdownText` 会省略 raw HTML，不能作为 ST HTML 兼容渲染器；以后升级 Showdown、清理策略或复用 DSH 低层能力，必须分别对照 ST 输出与恶意 HTML 用例，证明不会改变 Tavern 显示语义或越过 sanitizer 后再单独验收。
- 魔丸不渲染 reasoning 或 runtime context，也不提供展开入口；公开 `DisclosureRow` / Think icon 因此不再是该视图的迁移目标。用户需要运行细节时回到 DSH 原生“对话”。操作按钮仍可逐步采用公开图标与 `Tooltip`；DSH bundle 内未公开的 `ReasoningRow`、`MessageIconActions` 不属于可依赖接口。
- DSH 的模型消息 `role` 与界面来源不是同一维度：公开 ConversationNode 已把运行时注入表示为 `kind: "context"`，但持久 history 投影仍可能给它 `role: "user"`。v2 因此在不改变 `role` 的前提下增加 additive `origin.kind`，并保留 `producer` / `form` / `summary` 等可选来源元数据。RP 前端必须按 `origin` 投影气泡、隐藏/单独呈现上下文和计算动作能力，不能靠文本、位置或“是否最后一段输出”猜测。
- timeline 以 `parentVariantId` 与活动 `head` 表示树状分支；显示、focus 和新 QA 对账只沿 head 的祖先路径工作。head 的 session 可以是刚 branch、尚无新 QA 的 continuation anchor，因此侧栏归类也必须把 head session 视为周目成员。旧平面 timeline 继续可读，下一次对账进入树结构。
- 内置动作行归属于 durable QA，而不是某一段可见 assistant 正文。真实 user/steering 输出直接重试自身；context 触发的父输出向前寻找最近真实用户 turn 并重跑整轮，控制器绝不把 `origin=context` 当用户提示重发。分支新周目与同周目回退复用同一 DSH branch/继承区间校验，区别仅是创建 catalog 副本还是移动原 timeline head。屏蔽动作和 hidden 投影已移除；显示正则只决定各段正文是否渲染，一次 QA 无论包含多少段 assistant 输出、甚至全部被清空，都只在 QA 末尾保留一组动作；timeline 引用和 provenance 始终保留。
- DSH message surface replacement 可反复遮蔽当前节点，原始 append-only 事件仍可读取，但当前公开语义只有“连续区间 → 一个 message”，没有 `unreplace`、原子多 message 恢复或 per-request history projection。它适合原生 compaction/checkpoint，不适合承载 RP 分支树。DT 因此用多个公开 branch session 保存各条 continuation，让 DSH 历史、role/tool 配对、原生对话视图和卸载回退保持有效；timeline 只把这些 session 指针组合成活动周目路径。完整取舍见 `DSH_MESSAGE_FLOW.md` §1.1。
- `displayOverride` 由 conversation 内的多行编辑器修改；保存、取消/Esc 均留在当前回复位置，不使用浏览器 `window.prompt`。覆盖值定义为最终显示文本，跳过后续宏与显示正则，仍进入 Showdown/DOMPurify。空字符串也是有效覆盖并保留恢复按钮；恢复为 `null` 后重新从 DSH 原文执行当前显示管线。保存继续通过既有 node controller 与 timeline CAS 写显示元数据，不改 DSH 原文或模型上下文。
- **已批准为待办：** 周目导入/导出、资源选择等锚定菜单采用公开 `Menu`（含 portal、滚动/resize 重定位、紧凑模式），减少窄侧栏裁切和自维护定位 CSS；编辑、删除确认逐步采用公开 `Modal` / `Button` / `Input`，复制采用 `writeClipboard`。迁移仍按功能拆分提交和验收。
- 已移除曾注册在 `conversation.input.left` 的重复导入/导出 `+`；周目 IO 只保留在侧边栏 `PlayIoMenu`，不会占用或改写原生 composer 左侧动作。
- 早期为消息滚动写过本地锚点、遮挡量与 composer 高度补偿；已改回 DSH scrollport 的 `scrollTop = scrollHeight` 语义。以后先确认 Host 的滚动所有权，不再用固定像素模拟 sticky composer。

引入 primitives 时必须把 `@deepseek-ai/dsh-client-ui-primitives` 作为明确、同版本族的 client 依赖/注入项；不得借用 DSH 安装目录中的传递依赖。迁移必须逐项验收，不能为了统一外观一次替换所有控件。

### 必须保留的 Tavern 自定义层

DSH 当前没有角色卡、周目、greeting、跨 session adopted variant、ST 显示正则或 Tavern selection 的原生数据模型。因此 `catalog.json` / `timeline.json`、角色卡→周目侧栏投影、跨 session 回复切换、greeting 纯展示、正则资源管理与 v2 周目协议继续由 Tavern 拥有；它们通过事件范围指向 DSH 权威消息，不复制正文。RP 工作区内子目录还必须经过 Tavern 路径监狱：DSH 的 native/browse directory flow 是选择或注册 Workspace 的 UI seam，不提供“在已绑定根内让第三方 v2 前端安全创建任意周目子目录”的统一 Host 能力。

周目名称和 DSH session 名称刻意分离：Tavern 在每张角色卡内按已分配的单调序号显示 `N周目`，并把序号保存在 catalog 扩展数据；用户重命名也只修改这一投影。DSH 原始 session 继续由 Host 按“角色卡名 + 时间”命名，便于退出魔丸或卸载插件后辨认权威数据。旧 catalog 没有序号时按该角色卡既有顺序补入计算，但不为兼容而重写旧条目。

新建动作只检查该角色卡最高序号周目：timeline 已有 QA、导入上下文已有 QA、DSH 权威消息已有 user/assistant，或存在未完成回合时都不得复用；纯 greeting 不算 durable history。四者均为空才直接打开原 root session，不产生目录、session 或 catalog 写入。读取失败不允许猜测为空，以免权威状态不确定时继续膨胀或覆盖生命周期。

角色 selection 变更增加前置 membership guard：v1 只报告“需要脱离”及结构化冲突，不在未确认时写 selection；确认后的 v2 detach 在服务端按 `parentVariantId`（旧平面 timeline 按前一 adopted variant）计算目标及后代，以 timeline/catalog 各自 revision 做 CAS。它不删除 DSH session、不重挂兄弟分支；root 脱离后 catalog 保留空周目，下一次同角色创建为其连接新的 blank root session。这个显式生命周期动词避免第三方前端各自实现树裁剪算法。

导入记录仍是不可变的 `import-context.json`，既不伪造 DSH message，也不复制进 timeline。空 session 通过 `/sessions/:id/import-context` GET/PUT/DELETE 管理 loader 的权威绑定；换绑写新文件后替换 pending 引用，解绑只清除引用，保留工作区文件供恢复/审计。存在 DSH 对话、开放 turn 或绑定已消费后，后端锁定修改。公开导出按“导入 greeting/QA → 后续 timeline 指针解析出的 DSH 原文”组合。静态 HTML 输出当前可见开场白与 RP 渲染；SillyTavern JSONL 输出开场白、当前活动路径和每组 QA 的 `swipes` / `swipe_id`。ST JSONL 无法表达完整周目树拓扑，本插件重新导入 ST 记录时也只绑定每行 `mes` 所代表的已选线性历史。未发布且不能完整往返的 portable bundle 已从 2.0 公开面移除。前端还需同步 catalog/timeline 的显示引用并回读校验；当前 v2 没有跨 import binding、文件和 catalog/timeline 的统一事务，因此校验只能暴露半完成状态，不能声称原子提交。
当前周目生命周期是这些原子能力的前端组合：角色卡侧边栏创建或复用最近的空 root session，写入角色/周目目录、空 timeline 和 catalog 元数据，再重新读取校验；`x周目` 重命名只改 catalog。空会话的 greeting 与外部记录预览挂在 session 级 `conversation.input.dock`，不注册第二个 conversation view。外部记录绑定到现有空 root session 的 import-context 文件，opening footer 提供绑定、换绑、解绑和最近三轮 QA 预览；真实消息、开放 turn 或消费后由 Host API 锁定。

已验收的实现边界是：greeting、导入 QA 和 timeline 均不伪造 DSH durable message；首次实际 assembly 必须读取同一 profile snapshot 的公开 `claimEventSeqs`，成功后才把 pending binding 持久转为 `claimed`，并通过 loader 注入转义且标明 `untrusted` 的只读上下文；无 claim 的 view/assembly 不注入也不消费，已 claim 的同一 identity 可重放。history 完整分页已由 `10250a7` 实现：一直读取至 Host `hasMore: false`，空页、非法 oldest `seq` 或 cursor 重复/不前进返回 502 `PLAY_HISTORY_CURSOR_STALLED`，不摘要/切片。2026-08-21 已接受的发布加固中，catalog/timeline GET 在同一目标 guard 内读后校验并返回精确 UTF-8 字节 SHA-256 `revision`，PUT 在同一 guard 内比较显式 `expectedRevision`、校验、临时写和 rename；缺字段/格式错误/冲突分别返回 400 `PLAY_FILE_REVISION_REQUIRED`、400 `PLAY_FILE_REVISION_INVALID`、409 `PLAY_FILE_REVISION_CONFLICT`，冲突不改文件。id/path 唯一、安全相对路径、已知 `pmpDshTavern` 字段均受检，第三方 ext 保留；内置 live client 已实现受管 revision 回读/缓存、`null` create-only 和有限冲突重放原语；任务 06 已将内置生命周期 caller 迁移到这些原语，CAS 重放只重新执行纯本地 mutator，旧 get/put 自定义 client 保留一次兼容 fallback 且不保证并发重放；import claim、终态元数据与 Tavern branch retry/swipe lineage 已实现；同一 terminal 前的 provider retry 可重放，terminal 后新 claim 不注入；第三方原生 fork 不在插件拦截范围；稳定 focus 已由任务 07 按 playthrough id 派生；任务 08 已将 bundled live client 与内置 sidebar/node/swipe caller 迁移到按 id 的稳定入口，旧 explicit-path client route 仅保留兼容；目标锁内的逐段路径与 TOCTOU 实用加固已实现。这个流程仍不构成跨文件周目创建事务；workspace bind、目录创建、catalog/timeline/普通文件写入，以及 session create/branch/user-message/import-context PUT/DELETE 已使用同一请求内的 `operationId` 写后端 `ctx.logger`，由客户端根据已完成阶段、回读结果和稳定错误码恢复。user-message 只记录 Host 接受阶段，不记录正文、长度或摘要；GET 与 focus、chrome 读取不产 operation 日志。日志不宣称跨 API 共享 operationId 或跨文件事务。浏览器日志与持久化有界 journal 暂缓。上述项目在实现和验收完成前不得对第三方宣称已经解决，公开证据与合同见 `PLAY_REVIEW.md` 和 `API.md`。

插件自有资源变化继续使用有界的 Tavern refresh event；Session / Workspace / live Chat 变化必须订阅 DSH store，不能用该自定义事件替代 Host 状态管理。

### DSH 升级审查

每次升级 DSH 版本先做只读差异审计：核对插件清单的 inject、公开包根导出、slot owner props、store 字段、Host RPC 和 README 合同；然后运行 native/play 双模式及卸载回退验收。若公开 seam 消失，优先让对应增强失败关闭并保留原生表面，再讨论协议调整；禁止临时改为 DOM 查询、内部 bundle 符号或私有 runtime。新增前端功能的设计记录必须明确写出“复用的原生机制 / 自定义原因 / 官方升级观察点”。

rc.8 的默认视图仍由 DSH chat store 持有，`conversation.view` owner 不会自动把另一条目的 store 注入插件视图。因此默认 RP adapter 必须显式复用原生 `chat` 条目在公开 slot 快照中的同一 store 句柄，不能自建第二个 store。DSH 按 store handle × session scope 复用实例，所以 adapter 挂在不产生视图按钮的 session 级 `conversation.input.dock`，返回 `null`，只处理 `view` 尚未选定的状态并在执行后注销；不得再用同名 `conversation.view` 条目取得 actions。找不到公开句柄或组件拿不到 store 时失败关闭并清除临时占用。升级时应回归：新周目首条消息后默认进入 RP、原生“对话”仍可手动选择、顶栏从首帧起只有一个 `chat`、切回 native/卸载插件不改变 DSH 原组件。

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

因此发布与安装单位固定为根包 `pmp-dsh-tavern`（产品名仍是 dsh-tavern），内部包边界用于代码复用和测试隔离。浏览器与 Host 共用 `packages/identity.js` 的 `PLUGIN_ID`、`API_ROOT`、`API_V1`、`API_V2`。HTTP 挂载前缀是 `/pmp-dsh-tavern/api`；现有资源走 `/v1`，扮演元 API 走 `/v2`。旧根 `/dsh-tavern/api` 已废止。`packages/play` 不导入 DSH；loader 通过 `ctx.get('apiProxy')`（有则用之）把 v2 session/workspace 接到 Host 公开 RPC，并挂到现有 `secureTavernApi`。`package.json` 的 `./format`、`./preset`、`./character`、`./user`、`./world-book`、`./world-book-library`、`./trace`、`./loader` exports 是程序接口，不代表可分别安装的插件。

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

### Tavern chrome revision 与事件边界

全局蓝/红前端状态由 `packages/play` 自有 `ChromeStore` 持有，`chrome.json` 保存 `mode` 与不透明 `revision`。`GET/PUT /v2/chrome` 保留旧的 `ok/mode` 字段并附加 `revision`；只有 atomic write 成功且 mode 实际变化时才发布一次变更。`GET /v2/chrome/events` 是同一 API 前缀下的 Tavern 自有 SSE：首次连接发送当前快照，随后发送 `chrome/change`，只暴露 `mode/revision`，并在连接关闭时释放订阅。它不改 DSH Host 的 store、transport 或 view；外部直接改文件和其他进程写入不在事件合同内，客户端必须以 GET/focus 刷新作为降级校验。

### 浏览器模式服务与消费者边界

client组合根创建 transport-independent mode core，以 `ctx.provide('pmpDshTavernChrome', face)` 注册在稳定插件fiber；SSE/focus/轮询只通过内部adapter提交服务端快照。TavernShell、悬浮球controller和 `playSlots.setMode()` 都是该服务的普通消费者，不再各自维护GET、focus或BroadcastChannel状态机。

该服务的 `when(mode, setup)` 只表达模式生命周期，不授予surface所有权。多个插件可以同时订阅并注册各自的DSH公开slot；同一slot的占用冲突仍由对应公开slot合同处理。provider卸载时先停止transport、清理effect，再由Cordis撤销服务并驱动required consumer卸载。native模式仍不修改DSH原生表面。
