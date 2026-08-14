# dsh-tavern

为 DeepSeek Harness（DSH）提供 Tavern 风格内容兼容与运行时加载能力的插件。

项目目标不是在 DSH 中复制一套 SillyTavern 前端，而是建立可测试、可扩展的兼容层：理解 SillyTavern 的预设、角色卡和世界书格式，将其归一化，再通过统一加载器映射到 DSH 的 session、system prompt、模型参数与后续消息装配能力。

当前 `0.1.x` 集成分支已经完成 **SillyTavern Chat Completion 预设**和**角色卡**的首个端到端版本，并能激活所选角色卡内嵌世界书中的基础关键词条目。独立世界书的格式和匹配核心已完成，但还没有资源库、选择 API 和管理 UI。

角色卡兼容的调研记录与实施方案见：

- [角色卡调研记录](docs/character-card/RESEARCH.md)
- [角色卡实施方案与验收标准](docs/character-card/PLAN.md)

> 本项目中的“预设”指 SillyTavern 风格的采样参数与提示词编排，不是 DSH 用于组合插件的 agent preset。

## 当前能力

- 导入 SillyTavern Chat Completion preset JSON。
- 优先采用 `character_id: 100001` 的 `prompt_order`，并保留未知顶层字段和 prompt 扩展字段，方便后续兼容升级。
- 在插件目录持久化预设，支持创建、选择、修改、删除和重新加载。
- 提供一个可拖拽并记忆位置的 Tavern 悬浮球；点击时由球体展开资源面板，可进入预设、世界信息、角色卡和预留用户面板。侧栏打开后入口仍然保留，可直接切换其他资源面板。
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

安装器会构建浏览器端、安装根插件并提示重启 DSH。更新已有安装前，请先停止目标 `dsh web` 进程，然后重复执行同一安装命令；安装器会保留已经导入或创建的预设。

安装到指定 profile 或隔离的 `DSH_HOME`：

```sh
node scripts/install.mjs --profile web --dsh-home /absolute/dsh-home
```

Windows 示例：

```cmd
node scripts/install.mjs --profile web --dsh-home D:\DSH-Test
set DSH_HOME=D:\DSH-Test
dsh web --host 127.0.0.1 --port 53101
```

PowerShell 设置环境变量的语法不同：

```powershell
$env:DSH_HOME = 'D:\DSH-Test'
dsh web --host 127.0.0.1 --port 53101
```

macOS/Linux：

```sh
export DSH_HOME=/absolute/dsh-home
dsh web --host 127.0.0.1 --port 53101
```

如果同一端口已经有 DSH 运行，会收到 `EADDRINUSE`；请使用现有实例、停止旧进程，或更换端口。

完整参数、重复安装的数据恢复机制和卸载说明见 [`docs/INSTALLATION.md`](docs/INSTALLATION.md)。

## 使用

1. 启动并打开 DSH Web。
2. 拖动 `T` 悬浮球可调整并记忆入口位置；点击球体会展开资源面板。选择“预设”导入或创建 preset，编辑采样参数、system prompt 策略和 prompt 块并选择它。
3. 从同一菜单选择“角色卡”，导入 ST JSON/PNG 角色卡，选择 greeting 和两个覆盖开关后绑定到当前 session。
4. “世界信息”面板会列出当前角色卡内嵌 Lorebook 的全部条目。折叠标题直接显示常驻、禁用或关键词条件；展开可修改触发条件和正文，保存后下一次 loader 组装使用新版本。独立 World Info 导入仍在规划中。
5. 发送消息。loader 会在每次请求时组合当前 session 的 preset、角色卡与命中的内嵌世界书条目；支持的采样参数进入模型调用配置。

切换预设不会改写已有会话历史。旧预设已经影响过的 assistant 回复仍会进入后续上下文，所以需要“干净切换”时，应选择新预设后新建或 fork 会话。

卸载默认会先备份插件数据：

```sh
npm run plugin:uninstall
```

备份位置为 `<DSH_HOME>/backups/dsh-tavern/<timestamp>/`。只有明确不需要数据时才使用 `--no-backup`。

## 安全与信任边界

经功能验收的加固前基线标记为 Git tag `accepted-functional-2026-08-15`。当前版本在此基础上增加了以下默认保护：

- `/dsh-tavern/api/*` 默认只接受 `localhost`、`127.0.0.1` 和 IPv6 loopback 的 Host；所有修改请求必须来自同一个 DSH Web origin，并使用该路由允许的 `Content-Type`。响应禁止缓存并启用 `nosniff`。
- API 列表不再返回插件数据目录。浏览器仍可按功能需要读取当前 preset、角色卡和编译结果，因此应把 DSH Web 页面视为可访问已导入 Tavern 内容的受信任界面。
- 世界书扫描文本默认限制为最近 64 KiB。ST 的 `/pattern/flags` 原生 JavaScript 正则关键词默认不执行，避免恶意或意外的灾难性回溯阻塞 DSH 主进程；普通关键词和全词匹配不受影响。

仍需注意：

- 这些 HTTP 保护是 Host/origin 边界，不是独立的用户鉴权。能在本机发起 HTTP 请求的受信任进程仍可访问 API。请保持 DSH Web 绑定 `127.0.0.1`，不要直接暴露到局域网或公网。DSH Host 当前也不为此 API 提供 TLS 或账号认证。
- 若确需通过反向代理或局域网主机名访问，可在插件配置中设置 `security.allowedHosts`（只写主机名，不含端口）。这只放行 Host，不会增加认证或加密；应由受信任反向代理另行提供 HTTPS 和认证。
- preset、角色卡和世界书不是惰性文档，其中的文字会成为发给模型的指令，可能包含 prompt injection。只导入可信来源，启用前审阅内容，并保留 DSH 的文件沙箱、工具审批与权限限制。
- 插件不会主动读取 DSH API key 或环境变量，但用户写进 preset/角色卡/世界书的任何秘密都可能随模型请求发送，也可能被本机 API 返回。不要在 Tavern 资源中保存密钥、令牌或隐私数据。
- 为兼容可信旧资源，可显式设置 `worldBook.allowUnsafeRegex: true`；即使同时设置 `maxRegexLength` 和默认扫描上限，JavaScript `RegExp` 仍无超时保证，因此这项模式名副其实是不安全兼容模式。未来应改用 RE2 类受限引擎后再默认兼容正则。

可选配置示例：

```yaml
config:
  security:
    allowedHosts: [dsh.internal.example]
  worldBook:
    allowUnsafeRegex: false
    maxScanCharacters: 65536
    maxRegexLength: 256
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
| 世界书扫描与编辑 | 角色卡内嵌书可编辑并扫描已有 durable history（最近 64 KiB）；原生 regex key 默认阻断；当前轮尚未公开给 assembly，关键词可能下一轮才激活；原始导入 artifact 保持不变，JSON 导出反映编辑后的插件副本 |
| 独立世界书 | 解析、导出和 matcher 核心可作为 library 使用；尚无插件内存储、选择 API 或 UI |
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
  └─ packages/world-book ───────┘
```

- `tavern-format` 不依赖 DSH、文件系统或 UI。
- `preset` 与 `character` 管理各自的导入、持久化、API 和浏览器用例，不决定如何影响 agent。
- `world-book` 保持 parser、matcher 和 loader projection 为纯逻辑。
- `tavern-loader` 是唯一 DSH Host 入口，负责 session policy、组合编译、参数投影和运行策略。

这些目录是内部模块，不是三个需要分别安装的插件。纯格式解析层可以作为 JavaScript library 复用，但单独安装不会影响 agent。

## 计划开发

- 独立世界书资源库、导入/管理 UI、per-session 多选及与角色卡内嵌书的统一启用策略。
- 世界书递归扫描、sticky/cooldown/delay、vector、outlet 与严格 depth/role insertion。
- 将 greeting 作为显式开场消息的安全工作流，而不污染既有 durable history。
- 在 DSH 提供合适 seam 后支持真实 role message、example dialogue 和 absolute/depth injection，而不是用 system 标签模拟。
- per-session 选择/继承策略，以及“选择资源并新建干净会话”等显式操作。
- 更完整的 ST macro、导入诊断、兼容性报告和稳定的 round-trip/export。
- 扩展 request/header 审计与组合结果快照测试。

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
