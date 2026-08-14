# dsh-tavern

为 DeepSeek Harness（DSH）提供 Tavern 风格内容兼容与运行时加载能力的插件。

项目目标不是在 DSH 中复制一套 SillyTavern 前端，而是建立可测试、可扩展的兼容层：理解 SillyTavern 的预设、角色卡和世界书格式，将其归一化，再通过统一加载器映射到 DSH 的 session、system prompt、模型参数与后续消息装配能力。

当前 `0.1.x` 阶段已经完成 **SillyTavern Chat Completion 预设**的首个端到端版本。角色卡 feature 已完成格式与管理用例切片，正在等待统一 loader 集成；世界书运行策略仍在独立开发。

角色卡兼容的调研记录与实施方案见：

- [角色卡调研记录](docs/character-card/RESEARCH.md)
- [角色卡实施方案与验收标准](docs/character-card/PLAN.md)

> 本项目中的“预设”指 SillyTavern 风格的采样参数与提示词编排，不是 DSH 用于组合插件的 agent preset。

## 当前能力

- 导入 SillyTavern Chat Completion preset JSON。
- 优先采用 `character_id: 100001` 的 `prompt_order`，并保留未知顶层字段和 prompt 扩展字段，方便后续兼容升级。
- 在插件目录持久化预设，支持创建、选择、修改、删除和重新加载。
- 在空白会话提供浮动入口；会话建立后使用右侧原生详情栏和对话标题栏入口。
- 编辑预设名称、system prompt 策略、常用采样参数和 prompt 块。
- 直接拖拽 prompt 块排序；拖动来源显示为横杠，落点显示为占位框。
- 将启用且非 marker 的 prompt 编译为 DSH system section，并在请求记录中保留所选预设标识。
- 映射 DSH 当前支持的 `temperature`、`maxTokens`、`reasoningEffort` 和 `stop`。
- 支持默认“追加到 DSH system prompt”与高级“仅使用预设”两种模式。
- 提供 Windows、macOS、Linux 通用的安装/卸载脚本；重复安装会刷新本地 `file:` 快照并暂存、恢复插件数据。
- 角色卡 feature 可解析 V1/V2/V3 JSON 和 PNG `chara`/`ccv3`，保存原件、诊断、per-session binding，并通过稳定资源接口交给 loader/world-book 模块。

预设选择目前是**每个插件安装实例全局共享**的，而不是每个 session 独立选择。

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
2. 在空白会话点击浮动的“预设”按钮；已有消息的会话则点击标题栏“预设”按钮打开右侧栏。
3. 点击“导入”选择 ST preset JSON，或点击“创建”建立空白预设。
4. 编辑名称、采样参数、system prompt 策略和 prompt 块；使用左侧拖拽柄调整顺序。
5. 保存并选择目标预设。
6. 发送消息。当前选择会在每次请求组装时编译进 DSH system prompt，支持的采样参数会进入模型调用配置。

切换预设不会改写已有会话历史。旧预设已经影响过的 assistant 回复仍会进入后续上下文，所以需要“干净切换”时，应选择新预设后新建或 fork 会话。

卸载默认会先备份插件数据：

```sh
npm run plugin:uninstall
```

备份位置为 `<DSH_HOME>/backups/dsh-tavern/<timestamp>/`。只有明确不需要数据时才使用 `--no-backup`。

## 当前兼容边界

“可以导入 ST preset”不等于已经完整复刻 SillyTavern 的消息拓扑。

| SillyTavern 概念 | 当前行为 |
| --- | --- |
| enabled prompt 与顺序 | 按归一化顺序编译进一个 DSH system section |
| `system` / `user` / `assistant` role | 作为 `<st-prompt role="…">` 审阅标签保留，不是真实的交错 role message |
| marker | 保存但不发送 marker 自身文本；尚无 World Info、example dialogue、chat history 填充器 |
| 用户输入与会话历史 | 继续由 DSH 原生 durable messages 管理，不插入 ST `chatHistory` marker |
| absolute/depth injection | 字段保留，尚未执行 |
| ST macro | 支持部分常用变量、随机、骰子与局部变量；不是完整 ST runtime |
| sampler | 未映射的 ST 参数会保存和编辑，但不宣称已经传给模型 adapter |

高级“仅使用预设”模式会移除其他模型可见的 DSH system sections，包括 harness identity、agent persona 和工具文字说明；文件沙箱、工具执行策略和审批机制不会因此关闭，但 Code Mode、结构化输出或工具使用可靠性可能下降。

详细的数据流、ST/TT/DSH 差异及安全边界见 [`docs/PROMPT_PIPELINE.md`](docs/PROMPT_PIPELINE.md)，架构决策见 [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)。

## 架构

本仓库发布为一个 `dsh-tavern` 插件，内部采用单向依赖：

```text
packages/tavern-loader  →  packages/preset  →  packages/tavern-format
DSH Runtime Adapter        存储/API/UI用例      ST格式解析与归一化
```

- `tavern-format` 不依赖 DSH、文件系统或 UI。
- `preset` 管理导入、持久化、CRUD、API 和浏览器用例，不决定如何影响 agent。
- `tavern-loader` 是唯一 DSH Host 入口，负责 prompt 编译、参数投影和运行策略。

这些目录是内部模块，不是三个需要分别安装的插件。纯格式解析层可以作为 JavaScript library 复用，但单独安装不会影响 agent。

## 计划开发

- 角色卡格式 adapter、标准模型、导入/管理 UI，以及 greeting、persona、example dialogue 的运行策略。
- 世界书/lorebook 解析、关键词扫描、before/after anchor、递归与预算策略。
- 统一 profile compiler，在 preset、角色卡、世界书和 DSH agent system prompt 之间定义稳定的组合顺序与覆盖规则。
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
