# dsh-tavern

为 DeepSeek Harness（DSH）提供 Tavern 风格内容兼容与运行时加载能力的插件。

项目目标不是在 DSH 中复制一套 SillyTavern 前端，而是建立可测试、可扩展的兼容层：理解 SillyTavern 的预设、角色卡和世界书格式，将其归一化，再通过统一加载器映射到 DSH 的 session、system prompt、模型参数与后续消息装配能力。

当前 `0.1.x` 集成分支已经完成 **SillyTavern Chat Completion 预设、角色卡、独立世界书和用户资料**的首个端到端版本。统一 loader 会按 session 组合这些资源，并可在 Tavern Trace 中查看本次资源快照和世界书匹配决策。

角色卡兼容的调研记录与实施方案见：

- [角色卡调研记录](docs/character-card/RESEARCH.md)
- [角色卡实施方案与验收标准](docs/character-card/PLAN.md)

> 本项目中的“预设”指 SillyTavern 风格的采样参数与提示词编排，不是 DSH 用于组合插件的 agent preset。

## 当前能力

- 导入 SillyTavern Chat Completion preset JSON。
- 优先采用 `character_id: 100001` 的 `prompt_order`，并保留未知顶层字段和 prompt 扩展字段，方便后续兼容升级。
- 在插件目录持久化预设，支持创建、选择、修改、删除和重新加载。
- 提供红、黑、白配色的 `DT`（dsh-tavern）悬浮球；可拖拽并记忆位置，展开后显示预设、角色卡、世界书和用户资料的当前标题及红/绿选择状态。侧栏打开后入口仍然保留，可直接切换其他资源面板。
- 编辑预设名称、system prompt 策略、常用采样参数和 prompt 块。
- 直接拖拽 prompt 块排序；拖动来源显示为横杠，落点显示为占位框。
- 将启用且非 marker 的 prompt 编译为 DSH system section，并在请求记录中保留所选预设标识。
- 映射 DSH 当前支持的 `temperature`、`maxTokens`、`reasoningEffort` 和 `stop`。
- 支持默认“追加到 DSH system prompt”与高级“仅使用预设”两种模式。
- 提供 Windows、macOS、Linux 通用的安装/卸载脚本；重复安装会刷新本地 `file:` 快照并暂存、恢复插件数据。
- 角色卡 feature 可解析 V1/V2/V3 JSON 和 PNG `chara`/`ccv3`，保存原件、诊断、per-session binding，并通过稳定资源接口交给 loader/world-book 模块。
- 通过角色卡侧栏导入、查看、选择、导出和删除角色卡，并配置 greeting、卡内 system prompt 与 post-history instructions 的采用策略。
- 将所选角色卡的 description、personality、scenario、example dialogue、system prompt 等字段与 preset marker 统一组合。
- 解析并匹配角色卡内嵌 `character_book` 的常量/普通关键词、secondary key、概率、组和 token budget 基础策略，并把激活条目投影到 before/after 位置；regex key 会被识别和诊断，但因 ReDoS 风险默认不执行。
- 在“世界信息”中按 ST 式条目列表查看和编辑内嵌 Lorebook 的触发条件与内容，包括主/附加关键词、secondary logic、常驻/启用、大小写、全词匹配、位置与排序，并支持新增、删除和保存。
- 提供独立世界书资源库，支持导入、创建、编辑、导出、删除以及 per-session 多选；独立书与角色卡内嵌书使用同一个 parser、matcher 和 loader adapter。
- 提供严格只有名字与描述的用户资料，支持 CRUD 和 per-session 单绑定；名字进入 `{{user}}`，描述通过 `personaDescription`/`{{persona}}` 放置一次，并且不会覆盖 DSH Agent 身份。
- 在 Conversation / Trajectory 同级位置提供 Tavern Trace，按 turn/step 展示资源摘要、世界书关键词接受/拒绝原因和 request/header 对齐信息；不保存完整 prompt、历史或工具 schema，也不向模型消息流添加审计内容。
- 使用统一的 per-session 资源选择；普通 fork 固化父会话快照，delegated subagent 默认不继承 Tavern 资源。

旧版本的全局预设选择继续作为新会话默认值；一旦某个 session 明确选择资源，它与其他会话互不影响。

## 安装

要求：

- Node.js 20 或更高版本；
- 已安装并可从 `PATH` 调用的 `dsh`；
- 一个已经初始化的 DSH profile，默认使用 `web`。

克隆仓库后，在仓库根目录执行：

```sh
npm install --cache .npm-cache --legacy-peer-deps
npm run plugin:install
```

安装器会构建浏览器端、安装根插件并提示重启 DSH。更新已有安装前，请先停止目标 `dsh web` 进程，然后重复执行同一安装命令；安装器会保留已经导入或创建的资源，并在 pnpm 登记完成后把声明的包文件物化为独立副本，避免本地 `file:` 硬链接在开发期间形成新旧文件混装。刷新中断时，恢复副本会保存在 `<DSH_HOME>/backups/dsh-tavern/pending-refresh-<profile>/`，下一次运行会自动修复依赖登记并恢复数据。

安装到指定 profile 或隔离的 `DSH_HOME`：

```sh
node scripts/install.mjs --profile web --dsh-home /absolute/dsh-home
```

Windows 示例：

```cmd
node scripts/install.mjs --profile web --dsh-home .\test-envs\review
set DSH_HOME=%CD%\test-envs\review
dsh web --host 127.0.0.1 --port 53101
```

PowerShell 设置环境变量的语法不同：

```powershell
$env:DSH_HOME = (Resolve-Path '.\test-envs\review').Path
dsh web --host 127.0.0.1 --port 53101
```

macOS/Linux：

```sh
export DSH_HOME=/absolute/dsh-home
dsh web --host 127.0.0.1 --port 53101
```

如果同一端口已经有 DSH 运行，会收到 `EADDRINUSE`；请使用现有实例、停止旧进程，或更换端口。

完整参数、重复安装的数据恢复机制和卸载说明见 [`docs/INSTALLATION.md`](docs/INSTALLATION.md)。

### 数据存放与卸载

默认情况下，导入和创建的 Tavern 资源以及 session 选择状态保存在当前 DSH profile 安装的插件目录：

```text
<DSH_HOME>/profiles/<profile>/node_modules/dsh-tavern/data/
  presets/                 preset 标准化文档
  characters/              角色卡标准化文档
  character-artifacts/     导入的角色卡 JSON/PNG 原件
  world-books/             独立世界书标准化文档
  users/                   只有 id/name/description 的用户资料
  tavern-traces.json       有界的最小化请求审计元数据
  state.json               旧版全局 preset 默认选择
  character-state.json     角色选择迁移状态
  session-selections.json  统一的 per-session 资源选择
```

若插件配置显式指定 `storageDir`，以上资源和状态均改存到该外部目录。

- 重复运行安装脚本刷新插件时，会先把整个 `data/` 暂存到 `<DSH_HOME>/backups/dsh-tavern/pending-refresh-<profile>/`，安装成功后恢复，因此不会有意清空已导入资源。
- 普通卸载会先把整个 `data/` 备份到 `<DSH_HOME>/backups/dsh-tavern/<timestamp>/`，然后 DSH/pnpm 会删除安装目录。卸载后资源不会继续生效，但备份仍可手动恢复。
- `--no-backup` 会跳过这份副本；当使用默认插件内存储时，随后删除插件会同时删除资源，通常不可恢复。
- 卸载不会删除最初用于导入的外部 ST 文件，也不会自动删除显式配置在插件目录外的 `storageDir`。

备份或迁移时应复制整个 `data/`，不要只复制 `presets/`，否则可能丢失角色卡原件和 session 绑定。

## 使用

1. 启动并打开 DSH Web。
2. 拖动 `DT` 悬浮球可调整并记忆入口位置；点击球体会展开资源面板。红点表示未选择，发光绿点表示当前 session 已选择资源；它不表示世界书本轮是否命中。
3. 选择“预设”导入或创建 preset，编辑采样参数、system prompt 策略和 prompt 块并选择它。
4. 从同一菜单选择“角色卡”，导入 ST JSON/PNG 角色卡，选择 greeting 和两个覆盖开关后绑定到当前 session。
5. 在“世界书”面板的“独立世界书”区管理资源并为当前 session 多选；勾选变化会显示“尚未应用”，必须点击应用按钮才改变该 session。下方“角色卡绑定的世界书”区单独显示和编辑当前角色卡内嵌 Lorebook。折叠标题显示常驻、禁用或关键词条件，展开后可修改触发条件和正文。
6. 在“用户”面板创建只含名字与描述的资料并绑定到当前 session。
7. 发送消息。loader 会组合当前 session 的 preset、角色卡、用户资料以及独立/内嵌世界书命中条目；支持的采样参数进入模型调用配置。需要解释结果时，在 Conversation / Trajectory 旁打开 Tavern Trace；它保持简洁，只显示激活资源、世界书配置/命中关键词、接受或拒绝原因及 request/header 对齐，不保存资源正文。

切换预设不会改写已有会话历史。旧预设已经影响过的 assistant 回复仍会进入后续上下文，所以需要“干净切换”时，应选择新预设后新建或 fork 会话。

卸载默认会先备份插件数据：

```sh
npm run plugin:uninstall
```

备份位置为 `<DSH_HOME>/backups/dsh-tavern/<timestamp>/`。只有明确不需要数据时才使用 `--no-backup`。

## 安全与信任边界

经功能验收的加固前基线标记为 Git tag `accepted-functional-2026-08-15`。当前版本在此基础上增加了以下默认保护：

- `/dsh-tavern/api/*` 默认同时要求真实 TCP 对端为 loopback，并只接受 `localhost`、`127.0.0.0/8` 或 IPv6 loopback 的 Host；伪造 `Host: 127.0.0.1` 的局域网客户端仍会在 socket 边界被拒绝。所有修改请求还必须来自同一个 DSH Web origin，并使用该路由允许的 `Content-Type`。响应禁止缓存并启用 `nosniff`。
- API 列表不再返回插件数据目录。浏览器仍可按功能需要读取当前 preset、角色卡和编译结果，因此应把 DSH Web 页面视为可访问已导入 Tavern 内容的受信任界面。
- 世界书扫描文本默认限制为最近 64 KiB。ST 的 `/pattern/flags` 原生 JavaScript 正则关键词默认不执行；不安全兼容模式也只接受唯一的 `i/m/s/u/v` flags、限制 pattern 长度。普通关键词和全词匹配不受影响。
- 插件最终生成的 Tavern profile 默认受 512 KiB UTF-8 硬上限约束，配置也不能超过 2 MiB；单次装配还最多考虑 4,096 个 lore 条目，且拼接前的 lore 正文字节有界。`ignoreBudget` 只能绕过 ST 兼容软预算，不能绕过这些硬限制；超限时先按既有排名省略低优先级 lore 条目，preset/角色卡/用户等静态内容本身超限则明确拒绝装配，不做字符串截断。
- 角色卡原始 JSON/PNG artifact 仍可为 32 MiB，但“编辑内嵌世界书”是独立的 4 MiB JSON 边界，并经过共享 Character Book parser、条目数/深度/节点/字符串限制；更新后的角色文档另受 16 MiB 存储上限约束。
- `session-selections.json` 使用带 `updatedAt` 的 schema v2，默认最多 2,048 个 session、最多 4 MiB，启动时拒绝解析超过 8 MiB 的文件。因为绑定是用户状态而非可再生成审计，插件不会静默 LRU 淘汰；达到上限会明确失败，等待 DSH 提供权威 session 删除生命周期后再自动回收。
- Tavern Trace 的完整持久文件、单次 GET 响应和可配置上限默认均受 8 MiB 硬上限约束，单记录最多 64 KiB；跨 session 超限时淘汰最旧记录。当前仍采用同步事务写盘，慢速磁盘或安全软件可能增加请求延迟，可通过 `trace.maxTotalBytes` 进一步收紧。

仍需注意：

- 这些 HTTP 保护是 TCP peer、Host 和 origin 边界，不是独立的用户鉴权。能在本机发起 HTTP 请求的受信任进程仍可访问 API。请继续让 DSH Web 绑定 `127.0.0.1`，不要直接暴露到局域网或公网。DSH Host 当前也不为此 API 提供 TLS 或账号认证。
- 本机受信任反向代理可用 `security.allowedHosts` 放行它转发的主机名（只写主机名，不含端口），此时插件看到的 TCP 对端仍应是 loopback。只有明确接受远程风险时才同时设置 `security.allowRemoteClients: true`；这两个配置都不会增加认证或加密，反向代理必须另行提供 HTTPS 和认证。插件不信任 `X-Forwarded-For`。
- preset、角色卡和世界书不是惰性文档，其中的文字会成为发给模型的指令，可能包含 prompt injection。只导入可信来源，启用前审阅内容，并保留 DSH 的文件沙箱、工具审批与权限限制。
- 插件不会主动读取 DSH API key 或环境变量，但用户写进 preset/角色卡/世界书的任何秘密都可能随模型请求发送，也可能被本机 API 返回。不要在 Tavern 资源中保存密钥、令牌或隐私数据。
- 为兼容可信旧资源，可显式设置 `worldBook.allowUnsafeRegex: true`；即使同时设置 `maxRegexLength` 和默认扫描上限，JavaScript `RegExp` 仍无超时保证，因此这项模式名副其实是不安全兼容模式。未来应改用 RE2 类受限引擎后再默认兼容正则。

可选配置示例：

```yaml
config:
  security:
    allowedHosts: [dsh.internal.example] # 本机反向代理使用的 Host
    allowRemoteClients: false
  limits:
    maxProfileBytes: 524288
  sessionSelections:
    maxSessions: 2048
    maxStateBytes: 4194304
  worldBook:
    allowUnsafeRegex: false
    maxScanCharacters: 65536
    maxRegexLength: 256
  trace:
    maxTotalBytes: 8388608
```

## 当前兼容边界

“可以导入 ST preset”不等于已经完整复刻 SillyTavern 的消息拓扑。

| SillyTavern 概念 | 当前行为 |
| --- | --- |
| enabled prompt 与顺序 | 按归一化顺序编译进一个 DSH system section |
| `system` / `user` / `assistant` role | 作为 `<st-prompt role="…">` 审阅标签保留，不是真实的交错 role message |
| marker | 填充角色字段、example dialogue 与激活 World Info；`chatHistory` 只由 DSH 原生历史提供 |
| 用户输入与会话历史 | 继续由 DSH 原生 durable messages 管理，不插入 ST `chatHistory` marker |
| greeting | 作为明确标注的 system profile 风格参考，不伪造 assistant 历史消息 |
| PHI / depth / absolute injection | 字段保留并给出降级诊断；当前放入 system profile，不能严格复刻 ST 历史位置 |
| 世界书扫描与编辑 | 角色卡内嵌书可编辑并扫描已有 durable history（最近 64 KiB）；原生 regex key 默认阻断；当前已验收版本尚未把 claimed input 投影给本 step 的 assembly，关键词可能在同一可见回合的下一 agent step（如工具继续）或下一用户回合激活；已确认可在公开 `agent/inbox/spliced` 事件上实现无空转的首 step 匹配，但尚未实现；原始导入 artifact 保持不变，JSON 导出反映编辑后的插件副本 |
| 独立世界书 | 提供存储、导入/创建/编辑/导出/删除、per-session 多选和统一 matcher；未知字段随原始模型保留 |
| 用户资料 | 严格 `{id,name,description}`，按 session 单绑定；`{{user}}` 替换用户名并可按预设出现多次，描述只由 `personaDescription`/`{{persona}}`/fallback 消费一次；不覆盖 DSH Agent 身份 |
| Tavern Trace | 保存有界的资源摘要、世界书配置/命中关键词、匹配决策、哈希和 header 引用；不保存资源正文或完整消息，也不等同于 DSH 原生 request/header |
| ST macro | 支持部分常用变量、随机、骰子与局部变量；不是完整 ST runtime |
| sampler | 未映射的 ST 参数会保存和编辑，但不宣称已经传给模型 adapter |

高级“仅使用预设”模式会移除其他模型可见的 DSH system sections，包括 harness identity、agent persona 和工具文字说明；文件沙箱、工具执行策略和审批机制不会因此关闭，但 Code Mode、结构化输出或工具使用可靠性可能下降。

DSH 原生消息流与插件介入点见 [`docs/DSH_MESSAGE_FLOW.md`](docs/DSH_MESSAGE_FLOW.md)；ST/TT/DSH 差异及安全边界见 [`docs/PROMPT_PIPELINE.md`](docs/PROMPT_PIPELINE.md)，架构决策见 [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)。

## 架构

本仓库发布为一个 `dsh-tavern` 插件，内部采用单向依赖：

```text
packages/tavern-loader
  ├─ packages/preset ───────────┐
  ├─ packages/character ────────┼─ packages/tavern-format
  ├─ packages/user ─────────────┤
  ├─ packages/world-book-library ─ packages/world-book
  └─ packages/tavern-trace
```

- `tavern-format` 不依赖 DSH、文件系统或 UI。
- `preset`、`character`、`user` 与 `world-book-library` 管理各自的持久化、API 和浏览器用例，不决定如何影响 agent。
- `world-book` 保持 parser、matcher 和 loader projection 为纯逻辑。
- `tavern-loader` 是唯一 DSH Host 入口，负责 session policy、组合编译、参数投影和运行策略。

这些目录是内部模块，不是需要分别安装的插件。纯格式解析层可以作为 JavaScript library 复用，但单独安装不会影响 agent。

## 计划开发

- 在 loader 内实现唯一的 `PendingInputProjection`：从公开 `agent/inbox/spliced` 重建待处理/claimed 输入，形成结构化 `ActivationContext`，使单 step 回合也能在 `step 1` 触发世界书。不得增加空转模型请求、私读 Inbox、提前写入消息或在 Trace 中保存输入正文。
- 用户资源绑定零本或多本独立世界书，并由统一 session policy/loader 组合；关系存入选择策略，不塞进用户描述正文。用户解绑或删除时清理关联，不影响同一本书的显式 session 绑定。
- 增加插件设置界面，首批支持 UI 缩放和界面语言；设置应全局持久化、即时刷新、具有恢复默认值，且不改变资源内容或 session 绑定。当前版本仅提高了默认正文与控件字号。
- 增加“维持当前设置新开对话”按钮：继承当前会话已选择的 preset、角色卡、用户和世界书等 Tavern 配置，同时创建不携带既有对话历史的干净会话。
- 世界书递归扫描、sticky/cooldown/delay、vector、outlet 与严格 depth/role insertion。
- 将 greeting 作为显式开场消息的安全工作流，而不污染既有 durable history。
- 在 DSH 提供合适 seam 后支持真实 role message、example dialogue 和 absolute/depth injection，而不是用 system 标签模拟。
- 扩展现有 per-session 选择/继承策略，增加“选择资源并新建干净会话”等显式操作。
- 更完整的 ST macro、导入诊断、兼容性报告和稳定的 round-trip/export。
- 在 DSH 提供安全的插件事件 seam 后，将当前独立 Tavern Trace 进一步接入原生 Trajectory。

## 上游项目与引用

- [SillyTavern](https://github.com/SillyTavern/SillyTavern)：本项目兼容格式和 prompt 语义的主要来源。其官方 [Prompt 文档](https://github.com/SillyTavern/SillyTavern-Docs/blob/main/Usage/Prompts/index.md) 说明了 preset、角色信息、World Info、历史和用户输入如何共同构成请求。
- [TauriTavern](https://github.com/Darkatse/TauriTavern)：SillyTavern 的 Tauri/Rust 原生宿主实现。本项目将其前端宿主边界和 Agent prompt snapshot 设计作为兼容研究参考；参见其 [官方文档](https://tauritavern.github.io/) 与 [Agent API](https://tauritavern.github.io/en/api/agent.html)。

`dsh-tavern` 与 SillyTavern、TauriTavern 均无官方隶属关系。上游名称和格式仅用于说明兼容目标；本仓库不内置或分发第三方 preset、角色卡、世界书，也不复制用户导入内容。请分别遵守上游项目及所导入内容的许可证和版权要求。

## 开发与验证

```sh
npm run check
npm run pack:check
```

自动测试覆盖格式解析、宏处理、持久化/API、Host 请求 seam、前端状态策略、安装/卸载和内部依赖边界。验收记录、阶段 changelog 与 review 路径位于 [`docs/`](docs/)；测试只会原地读取外部验收文件，不会把第三方内容复制进仓库或发布包。

## License

[MIT](LICENSE) © 2026 Zhu Bohan
