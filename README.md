# dsh-tavern

为 DeepSeek Harness（DSH）提供 Tavern 风格内容兼容、会话绑定与运行时加载能力的插件。

> 当前 README 为 `1.0.0` 中文版；英文版计划后续补充。

## 目录

- [项目简介](#项目简介)
- [安装](#安装)
  - [脚本安装（推荐）](#脚本安装推荐)
  - [手动安装](#手动安装)
  - [让 Agent 安装](#让-agent-安装)
  - [更新、卸载与数据位置](#更新卸载与数据位置)
- [使用](#使用)
  - [DT 悬浮球与界面设置](#dt-悬浮球与界面设置)
  - [预设](#预设)
  - [角色卡](#角色卡)
  - [世界书](#世界书)
  - [用户](#用户)
  - [新会话与配置模板](#新会话与配置模板)
  - [Tavern Trace](#tavern-trace)
- [特点](#特点)
- [文档](#文档)
- [安全风险](#安全风险)
- [参考](#参考)

## 项目简介

`dsh-tavern` 的目标不是在 DSH 中复制一套 SillyTavern 前端，而是建立一个可测试、可审计、可扩展的兼容层：读取 SillyTavern 风格的预设、角色卡和世界书，将它们归一化，再通过统一 loader 按 DSH session 组合为实际模型请求。

当前版本已经提供一个完整的 DSH 插件，包含：

- SillyTavern Chat Completion 预设；
- V1/V2/V3 JSON 与 PNG 角色卡（可创建、导入后编辑，导出当前 JSON/PNG）；
- 独立世界书、角色卡内嵌世界书及用户绑定世界书；
- 只有名字和描述的用户资料；
- per-session 资源绑定、干净新会话与配置模板；
- 简体中文/English、Tavern UI 缩放与可拖拽 `DT` 悬浮入口；
- 与 Conversation、Trajectory 并列的 Tavern Trace。

插件不会复制 DSH 的会话历史。DSH 仍然拥有 durable history、工具、权限和最终 `request/header`；dsh-tavern 只在公开扩展点装配 Tavern profile、映射受支持的模型参数，并记录不含正文的最小化审计信息。

本项目当前版本为 `1.0.0`。现有框架与核心工作流已达到首个稳定发布范围；真实 role message、严格 depth/absolute injection、完整 ST macro，以及 recursive、sticky/cooldown/delay、vector、outlet 等高级世界书语义仍受当前 DSH seam 或实现范围限制。详细兼容表见 [Prompt pipeline](docs/PROMPT_PIPELINE.md)。

> 本项目中的“预设”指 SillyTavern 风格的采样参数与提示词编排，不是 DSH 用于组合插件的 agent preset。

## 安装

### 环境要求

- Node.js 20 或更高版本；
- 已安装并能从 `PATH` 调用 `dsh`；
- 一个已经初始化的 DSH profile，默认名称为 `web`；
- DSH Web 建议只监听 `127.0.0.1`。

先取得源码：

```sh
git clone https://github.com/Player-MINEPIG/dsh-tavern.git
cd dsh-tavern
```

### 脚本安装（推荐）

不传参数时，安装脚本会：

1. 使用当前终端的默认 DSH 根目录；如果已经设置 `DSH_HOME`，则使用该目录；
2. 安装到默认的 `web` profile；
3. 先构建浏览器 bundle，再调用 DSH 安装根插件；
4. 首次运行执行全新安装；发现已有安装时先暂存 `data/`，刷新插件文件后再恢复数据；
5. 安装完成后提示你重启 DSH，但不会替你启动或停止 `dsh web`。

默认安装命令：

```sh
npm install --cache .npm-cache --legacy-peer-deps
npm run plugin:install
```

更新已有安装前应先停止目标 `dsh web`。Windows 下安装器会安全调用 npm 的 PowerShell shim，避免路径和 shell 参数问题。

需要安装到其他位置时，直接给脚本传入不同参数：

- `--profile <name>`：目标 DSH profile，默认是 `web`；
- `--dsh-home <path>`：目标 DSH 根目录，也就是该次安装使用的 `DSH_HOME`；
- 两者可以单独使用，也可以组合使用。

```sh
node scripts/install.mjs --profile <profile-name> --dsh-home /absolute/dsh-home
```

`--dsh-home` 只影响安装脚本启动的子进程，不会永久修改当前终端。安装完成后若要从同一根目录启动 DSH，仍需在当前 shell 设置 `DSH_HOME`。

PowerShell：安装到独立根目录，然后启动该目录中的 `web` profile：

```powershell
node scripts/install.mjs --profile web --dsh-home 'D:\DSH\review'
$env:DSH_HOME = 'D:\DSH\review'
dsh web --host 127.0.0.1 --port 53101
```

Windows CMD：

```bat
node scripts/install.mjs --profile web --dsh-home C:\DSH\review
set DSH_HOME=C:\DSH\review
dsh web --host 127.0.0.1 --port 53101
```

macOS：先安装到独立根目录，再从该目录启动 DSH：

```sh
node scripts/install.mjs --profile web --dsh-home /Users/you/dsh-review
export DSH_HOME=/Users/you/dsh-review
dsh web --host 127.0.0.1 --port 53101
```

Linux：

```sh
node scripts/install.mjs --profile web --dsh-home /home/you/dsh-review
export DSH_HOME=/home/you/dsh-review
dsh web --host 127.0.0.1 --port 53101
```

如果出现 `EADDRINUSE`，说明端口已被其他 DSH 进程占用；停止旧进程或换一个端口。

### 手动安装

脚本是推荐路径。如果需要手动安装：

```sh
npm install --cache .npm-cache --legacy-peer-deps
npm run build
dsh plugin --profile web add "file:/absolute/path/to/dsh-tavern"
```

Windows 的本地包规范同样使用正斜杠，例如：

```powershell
dsh plugin --profile web add "file:D:/Projects/dsh-tavern"
```

手动更新前应停止目标 `dsh web`，备份安装目录下的 `data/`，执行 `dsh plugin --profile web remove dsh-tavern` 后再重新 add。直接调用 DSH 不包含本项目安装器的 pending-recovery、pnpm store 复用和独立文件物化保护，因此更新已有安装时更建议使用脚本。

### 让 Agent 安装

可以把下面的指令交给拥有本机终端权限的编码 Agent，并把路径替换成自己的值：

```text
请从 https://github.com/Player-MINEPIG/dsh-tavern.git 获取源码，阅读 README 和
docs/INSTALLATION.md。确认 Node.js >= 20、dsh 可从 PATH 调用，并把插件安装到
profile web、DSH_HOME=<我的绝对路径>。若目标 dsh web 正在运行，先提醒我停止；
不要删除或覆盖已有 Tavern data，不要使用 --no-backup。运行 npm install 后使用
node scripts/install.mjs --profile web --dsh-home <我的绝对路径>，报告执行命令、
安装结果和需要我手动完成的 DSH 重启步骤。
```

请只授权你信任的 Agent 操作本机终端，并在执行前确认仓库地址、目标 `DSH_HOME` 和 profile。安装插件等同于允许其代码在 DSH Host 与浏览器上下文中运行。

### 更新、卸载与数据位置

更新前停止目标 DSH，然后在新源码目录重复运行安装脚本。安装器会暂存并恢复插件内数据；中断恢复副本位于：

```text
<DSH_HOME>/backups/dsh-tavern/pending-refresh-<profile>/
```

默认资源与状态位于：

```text
<DSH_HOME>/profiles/<profile>/node_modules/dsh-tavern/data/
```

这里保存预设、角色卡文档（PNG 导入另存封面图）、独立世界书、用户、用户—世界书关系、session 选择、配置模板、UI 设置和有界 Trace。若配置了外部 `storageDir`，数据改存该目录。

卸载：

```sh
npm run plugin:uninstall
```

卸载器默认先把整个 `data/` 备份到 `<DSH_HOME>/backups/dsh-tavern/<timestamp>/`。`--no-backup` 会跳过备份；在默认插件内存储模式下，这通常意味着资源随卸载一起永久删除。

完整安装参数、刷新恢复机制和数据说明见 [安装与卸载文档](docs/INSTALLATION.md)。

## 使用

### DT 悬浮球与界面设置

安装并重启 DSH Web 后，点击红、黑、白配色的 `DT` 悬浮球展开菜单。球体可以拖动并记忆位置；侧栏打开时球体仍会保留，可直接切换模块。

资源旁的发光绿点表示当前 session 已启用，红点表示未启用；世界书绿点表示存在有效来源，不代表本轮已经命中关键词。“界面设置”可以即时切换简体中文/English，并在 75%–150% 之间缩放 Tavern UI。

<p align="center">
  <img src="docs/assets/dt-launcher.png" alt="DT 悬浮球展开后的资源状态菜单" width="420">
</p>

<p align="center">
  <img src="docs/assets/ui-settings.png" alt="Tavern 界面语言与缩放设置" width="520">
</p>

### 预设

导入或创建 Chat Completion 预设，编辑 prompt、顺序、采样参数和 append/replace 策略。目录下拉框只用于浏览；必须点击蓝色绑定/更新按钮才会应用到当前 session。导入和创建不会自动绑定。

<p align="center">
  <img src="docs/assets/preset.png" alt="Tavern 预设管理与编辑侧栏" width="520">
</p>

### 角色卡

导入 ST JSON/PNG 角色卡，或创建空白卡。导入后可编辑名称、描述、性格、场景、开场白（含备选）、示例对话、创作者备注、system prompt、post-history instructions 和标签等字段；保存与绑定分开，目录下拉只用于浏览。内嵌世界书仍在世界书面板编辑。

绑定到当前 session 时可选择 greeting，以及是否采用卡内 system prompt / post-history instructions。导出 JSON / PNG 都是当前内容，没有「导出原件」；PNG 导入只保留封面图，没有封面时使用占位图。角色字段由统一 loader 与预设 marker、用户资料和世界书组合；greeting 不会伪造成既有 assistant 历史。

<p align="center">
  <img src="docs/assets/character-card.png" alt="Tavern 角色卡导入、编辑与会话绑定侧栏" width="520">
</p>

### 世界书

导入、创建、编辑、导出和删除独立世界书，并为当前 session 多选。面板分别展示 session 独立书、用户绑定书和角色卡内嵌书；条目可查看并编辑关键词、secondary logic、常驻、概率、位置、顺序和正文。当前 claimed 输入会在首次 assembly 前参与匹配，因此新会话第一条消息也能在同一轮激活普通关键词。

<p align="center">
  <img src="docs/assets/world-book.png" alt="独立、用户绑定与角色卡内嵌世界书侧栏" width="520">
</p>

### 用户

创建只含名字与描述的用户资料。名字用于 `{{user}}`，描述通过 `personaDescription`、`{{persona}}` 或稳定 fallback 放置一次；用户还可以绑定零本或多本独立世界书。用户资料不会覆盖 DSH Agent 身份。

<p align="center">
  <img src="docs/assets/user.png" alt="Tavern 用户资料与世界书绑定侧栏" width="520">
</p>

### 新会话与配置模板

“维持当前设置新开对话”会把当前 Tavern 选择复制到真实 blank DSH session，不复制旧历史、Inbox 或 Trace。也可以保存配置模板、查看模板内容，并从模板创建干净会话。它适合在切换角色或预设时避免旧 assistant 回复造成上下文残留。

<p align="center">
  <img src="docs/assets/new-session.png" alt="新会话与 Tavern 配置模板侧栏" width="520">
</p>

### Tavern Trace

在 Conversation、Trajectory 旁打开 Tavern Trace，可查看每个 turn/step 采用的资源摘要、世界书配置和命中关键词、接受/拒绝原因、预算及 `request/header` 对齐信息。Trace 不保存完整 prompt、消息或资源正文；最终模型输入仍以 DSH `request/header` 为准。

更详细的逐模块操作、数据和兼容边界见 [中文使用指南](docs/USAGE.zh-CN.md)。

## 特点

- **一个插件、统一加载器**：格式解析、资源管理和 DSH 运行时分层，但只安装一个根插件，不产生多个插件之间的版本与加载顺序问题。
- **按 session 隔离**：preset、角色卡、用户和独立世界书都由统一 selection 管理；普通 fork 固化父选择，delegated subagent 默认不继承 Tavern 内容。
- **兼容数据优先**：识别 ST 常用格式和 marker，保留未知字段；角色卡只存一份当前文档，不为导入原件另存第二份卡数据。
- **当前轮世界书识别**：通过 DSH 公开的 `agent/inbox/spliced` 建立有界临时投影，不增加空转 step、不伪造消息，也不读取私有 Inbox。
- **可解释而不过度记录**：Tavern Trace 展示资源和匹配决策，但不持久化完整 prompt、输入正文或工具 schema。
- **安全默认值**：loopback peer/Host/origin 检查、原子持久化、请求/文件/结构/profile/Trace 上限，以及默认禁用原生 JavaScript regex。
- **可恢复安装**：跨 Windows、macOS、Linux 的脚本支持隔离 `DSH_HOME`、重复安装数据恢复和卸载前备份。
- **可扩展 i18n**：全部 Tavern UI 使用语义 key 与显式 raw-data 边界；增加语言只需注册 locale、增加独立 catalog 和测试，无需修改各业务组件。
- **诚实降级**：不把 system 标签宣传成真实 role message，不把 greeting 伪造成历史，也不把 Trace 当作最终请求权威。

## 文档

- [中文使用指南](docs/USAGE.zh-CN.md)：逐模块操作、数据和兼容边界
- [安装与卸载](docs/INSTALLATION.md)：跨平台参数、刷新恢复与备份
- [架构说明](docs/ARCHITECTURE.md)：单插件分层与发布边界
- [Loader contract](docs/LOADER_CONTRACT.md)：session 选择、profile 与安全预算
- [DSH 消息流](docs/DSH_MESSAGE_FLOW.md)：DSH 原生流程以及本插件的介入点
- [Prompt pipeline](docs/PROMPT_PIPELINE.md)：ST / TauriTavern / 本仓库的兼容对照
- [世界书设计](docs/world-book/DESIGN.md)：World Info 格式、匹配与投影契约
- [CHANGELOG](docs/CHANGELOG.md)：公开发布演进

## 安全风险

`dsh-tavern` 会处理并发送可执行为模型指令的第三方内容。使用前请理解以下边界：

- **没有独立账号鉴权**：`/dsh-tavern/api/*` 使用真实 TCP peer、Host、Origin 和 Content-Type 防护，但本机受信任进程仍可能访问。请让 DSH Web 绑定 `127.0.0.1`，不要直接暴露到局域网或公网；如需反向代理，应自行提供 HTTPS 和认证。
- **Prompt injection**：preset、角色卡、用户描述和世界书正文都会影响模型。只导入可信来源，启用前审阅内容，并保留 DSH 的沙箱、工具审批与权限限制。
- **秘密泄露**：插件不会主动读取 API key，但写入 Tavern 资源的密钥、令牌或隐私内容可能随模型请求发送，也可能通过本机资源 API 返回。不要用资源文件保存秘密。
- **不安全正则为显式兼容模式**：ST `/pattern/flags` 默认不执行。开启 `worldBook.allowUnsafeRegex` 后，JavaScript `RegExp` 仍没有超时保证，即使已有长度和扫描上限也存在 ReDoS 风险。
- **replace 模式会移除模型可见的 DSH system 说明**：它不会关闭执行层安全机制，但可能降低 Code Mode、结构化输出和工具使用可靠性。
- **运行中保护并非全局事务锁**：显式切换 preset、角色卡、用户和世界书时会拒绝运行中的 agent；模板 API 应用到既有目标、删除/编辑已引用资源，以及修改用户—世界书关系等间接变更尚未统一锁定。已冻结请求不会被回写，但并发修改存在 assembly 时序边界。
- **角色卡内嵌书的导入期诊断仍可加强**：角色卡导入有 32 MiB 上限；编辑和运行时解析有完整结构守卫，但导入时不会提前拒绝所有最终不可运行的超复杂内嵌书。
- **兼容不等于完整复刻 ST**：真实 role/depth 拓扑、greeting 历史和部分高级世界书状态尚未实现。请以 Tavern Trace 与 DSH `request/header` 验证实际行为。

更完整的安全预算、运行态变更缺口和数据边界见 [Loader contract](docs/LOADER_CONTRACT.md)。

## 参考

- [SillyTavern](https://github.com/SillyTavern/SillyTavern)：兼容格式与 prompt 语义的主要来源。
- [SillyTavern Prompt 文档](https://github.com/SillyTavern/SillyTavern-Docs/blob/main/Usage/Prompts/index.md)：preset、角色信息、World Info、历史和用户输入的组装说明。
- [SillyTavern World Info 文档](https://docs.sillytavern.app/usage/core-concepts/worldinfo/)：World Info / Lorebook 的用户语义。
- [Character Card V2 规范](https://github.com/malfoyslastname/character-card-spec-v2)：角色卡与内嵌 `character_book` 格式参考。
- [TauriTavern](https://github.com/Darkatse/TauriTavern)：SillyTavern 的 Tauri/Rust 原生宿主实现。
- [TauriTavern 文档](https://tauritavern.github.io/) 与 [Agent API](https://tauritavern.github.io/en/api/agent.html)：宿主边界和 Agent prompt snapshot 的设计参考。

`dsh-tavern` 与 SillyTavern、TauriTavern 均无官方隶属关系。本仓库不内置或分发第三方 preset、角色卡或世界书，也不复制用户导入内容。请分别遵守上游项目及所导入内容的许可证和版权要求。

本项目代码使用 [MIT License](LICENSE)，Copyright © 2026 Zhu Bohan。
