# 独立 Prompt Assembler 接入

[English](ASSEMBLER_INTEGRATION_en.md) · [装配行为](REQUEST_ASSEMBLY.md) · [独立插件仓库](https://github.com/Player-MINEPIG/dsh-prompt-assembler)

Tavern 单向依赖 `dsh-prompt-assembler` 的 `v1.1.0`（lockfile 锁定提交 `48481b630e9cfc3be9e55f6b3eb0074ae9a33ad2`）。assembler 自己拥有策略存储、来源注册、请求钩子、安全 API 和设置入口，无 Tavern 或 Memory Manager 包依赖。`adapters/tavern`、`adapters/memory-manager` 位于 assembler 仓库，接收来源公开的只读服务；第三方可 fork 或向该仓库提 PR。来源继续拥有数据、解析语法和权限，DSH durable history 是历史的权威记录。

## 可选 Memory Manager

[dsh-memory-manager v1.0.0](https://github.com/Player-MINEPIG/dsh-memory-manager/releases/tag/v1.0.0) 是独立的可选扩展。Tavern 的包与服务依赖均不要求安装它。安装期间可查看资源、编辑存取规则和观察真实应用记录；卸载撤销管理租约，后续请求恢复来源默认规则，保留 DSH 会话、来源内容与 Manager 的配置文件。重新安装会重新应用保留的规则，不会把这些规则永久写进 Tavern 或 assembler。通用记忆资源来源由 assembler 的 `adapters/memory-manager` 注册；卸载后该来源撤销，原生 MVU 与世界书仍由 Tavern 提供。

停止目标 Host 后，在同一 profile 安装已发布的 v1.0.0，再重启 DSH。在设置或已有会话的「记忆管理」页签中打开：

```sh
dsh plugin --profile web add github:Player-MINEPIG/dsh-memory-manager#v1.0.0
```

该版本适配 DSH `0.2.0-rc.2`。通过管理规则将通用资源提供给模型时，需在 Manager 中配置读取规则，并在 assembler 策略中选择 `memory-manager.resources`；这条路径要求支持 request-assembly 协议 1 的宿主。DSH 原生 Skill 调用和 Tavern 自行执行的世界书、MVU、模板贡献仍使用各自来源路径。详见 v1.0.0 的[安装指南](https://github.com/Player-MINEPIG/dsh-memory-manager/blob/v1.0.0/docs/INSTALLATION.md)、[使用指南](https://github.com/Player-MINEPIG/dsh-memory-manager/blob/v1.0.0/docs/USAGE.md)与[assembler 接入](https://github.com/Player-MINEPIG/dsh-memory-manager/blob/v1.0.0/docs/ASSEMBLER.md)。

## 安装与开发

Tavern 正常依赖标准 `dsh-prompt-assembler`，生产依赖不包含可选 `dsh-prompt-assembler-core`。npm 解析依赖，DSH 启用显式 bundle；目标 profile 需启用标准 assembler 和 Tavern：

```sh
dsh plugin --profile web add github:Player-MINEPIG/dsh-prompt-assembler#v1.1.0
dsh plugin --profile web add github:Player-MINEPIG/dsh-tavern#v3.0.0
```

本地源码也可使用 `scripts/pack-with-assembler.mjs` 产生的两份 tgz，通过隔离 profile 安装流程启用；参见[源码安装](INSTALLATION.md#source-installation)。assembler 的 bundle 提供 `dshPromptAssembler`，Tavern 的 loader 声明该服务依赖，由 Host 管理加载顺序；仅安装 npm 依赖不足以挂载服务。

源码开发可单独 clone assembler 并运行其 `npm ci`、`npm run check`。Tavern 的 `npm ci` 使用锁定的远端提交。需要一起验证本地修改时，可在临时 checkout 使用 `npm install --no-save --package-lock=false /path/to/assembler`，不要提交临时路径。

标准策略通过公开 sections/context/pre-step 在 stock rc.2 执行。进阶策略要求独立打包的 core addon 与准备后的协议 1 核心。旧策略缺 backend 仍是进阶，缺能力明确报错；见[后端规则](https://github.com/Player-MINEPIG/dsh-prompt-assembler/blob/v1.1.0/docs/BACKENDS.md)。

## Tavern 的接入切面

Tavern 共享 assembler store/registry/runtime，通过 attachTavern 提供只读资源、会话租约、两类预设和最终复验。标准后端贡献官方 sections/context 与接受的 pre-step 消息；只有可选 addon 拥有协议 1 请求替换。标准 Trace 核验 durable system/context 与完整原生请求引用，进阶 Trace 每次引用一条 request/assembly。资源编辑、受限 EJS 与 MVU 写入仍归 Tavern。

新界面使用 assembler 自有 `/dsh-prompt-assembler/api/v1/assembly-presets`、安全 fetch 和实际请求只读接口。Tavern 的旧 assembly-presets 路径仍转发同一 store/runtime；Trace 仍可读取 DSH 中的实际请求。当前记录 owner 为 `dsh-prompt-assembler`，旧 `pmp-dsh-tavern` owner 继续可读。迁移仅合并旧存储缺少的项，原文件保留；新应用统一绑定 session ID，优先于旧 play/native scope，不因重新安装 Tavern 恢复旧选择。

“设置 → 提示词装配”独立入口与 Tavern 内嵌面板共享策略库和会话绑定，没有插件优先级；最后一次成功应用决定后续请求的快照。编辑草稿或保存策略不改变已应用快照。两个面板使用 assembler 的刷新事件同步当前应用状态，保留各自未保存的草稿。

卸载 Tavern 时取消其来源和只读 provider，assembler 的入口、策略和 DSH 自定义文本继续工作。依赖已卸载来源的模块有明确诊断，不重建缺失资源，不改写原生历史。Memory Manager adapter 使用公开服务；无需安装 Manager 就能使用 assembler 的原生来源。

## 模块与文本解析器

模块菜单仅列出当前能提供独立内容的来源。分散内容可通过来源的 `parseText(context, rule)` 和 `inputMode:'text'` 解析用户手填文本，两种模式共用位置、深度、角色与快照机制。

Tavern 文本使用一个 `tavern.text` 入口，依次执行受限 EJS、内容引用与 ST 宏；引用正文不会再执行 EJS。DSH `dsh.text` 使用原生变量插值。第三方来源保留自己的 parser/renderer。每个模块说明包含字段、来源、能否编辑和修改入口；资源身份与实际正文通过预览查看。

## GitHub 的依赖表示

依赖图为 Tavern→标准 assembler，addon peer 同一 assembler，Manager 可选，不需要 submodule。源码 manifest 与 lockfile 固定到经过审阅的标准提交。本地打包将暂存依赖改为标准精确版本，需要一起安装生成的包。Host 服务依赖仍需显式启用 bundle。公开插件目录提交、tag、release 与 npm 发布是另外的操作。

[接口索引](API_SURFACES.md) · [Tavern 架构图](assets/architecture/tavern.zh-CN.html) · [组合架构图](assets/architecture/ecosystem.zh-CN.html)。

用 npm run pack:with-assembler 打包标准 assembler 与 Tavern；只有显式追加 -- --with-core 才额外生成进阶 addon。默认 receipt 只含两个标准包，标准 assembler 不含核心准备工具。addon 在准备核心后另行安装，见其[README](https://github.com/Player-MINEPIG/dsh-prompt-assembler/blob/v1.1.0/core-extension/README.md)。

打包命令会先重建两个前端，并让 Tavern 内嵌面板使用本次打包的 assembler 源码（含 `--assembler` 指定的目录），避免安装包中前后端策略格式不一致。运行前需在两份源码目录安装构建依赖。
