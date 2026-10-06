# 独立 Prompt Assembler 接入

[English](ASSEMBLER_INTEGRATION_en.md) · [装配行为](REQUEST_ASSEMBLY.md) · [独立插件仓库](https://github.com/Player-MINEPIG/dsh-prompt-assembler)

Tavern 单向依赖 `dsh-prompt-assembler` 0.2.0。assembler 自己拥有策略存储、来源注册、请求钩子、安全 API 和侧栏入口，无 Tavern 或 Memory Manager 包依赖。`adapters/tavern`、`adapters/memory-manager` 位于 assembler 仓库，接收来源公开的只读服务；第三方可 fork 或向该仓库提 PR。来源继续拥有数据、解析语法和权限，DSH durable history 是历史的权威记录。

## 安装与开发

Tavern 的 manifest 与 lockfile 将 assembler 固定到私有 GitHub 仓库的提交。安装需要该仓库的 GitHub 访问权限；没有发布同名 npm 版本。npm 会拉取依赖，但 DSH 只启用明确安装的插件 bundle，因此 assembler 和 Tavern 都需要在目标 profile 启用：

```sh
dsh plugin --profile web add github:Player-MINEPIG/dsh-prompt-assembler#main
dsh plugin --profile web add github:Player-MINEPIG/dsh-tavern#codex/assembler-extraction
```

第二条仅在对应 Tavern 分支已推送时可用；本地候选可使用 `scripts/pack-with-assembler.mjs` 产生的两份 tgz 通过已有测试 profile 安装流程启用。本次 assembler 仓库发布不表示 Tavern 分支已经发布。assembler 的 bundle 提供 `dshPromptAssembler`，Tavern 的 loader 声明该服务依赖，由 Host 管理加载顺序；仅安装 npm 依赖不足以挂载服务。

源码开发可单独 clone assembler 并运行其 `npm ci`、`npm run check`。Tavern 的 `npm ci` 使用锁定的远端提交。需要一起验证本地修改时，可在临时 checkout 使用 `npm install --no-save --package-lock=false /path/to/assembler`，不要提交临时路径。

真实请求仍需显式准备协议 1 核心；stock DSH rc.2 缺少钩子时可编辑和预览，但应用非空策略返回 409。插件安装不会修改核心。参见 assembler 的[安装合同](https://github.com/Player-MINEPIG/dsh-prompt-assembler/blob/main/docs/INSTALLATION.md)。

## Tavern 的接入切面

Tavern 使用共享 `dshPromptAssembler` 的 store、registry、runtime。它注册来源并用 `attachTavern` 提供资源编译、只读会话租约、模式默认值及装配后策略校验。assembler 是请求装配的唯一执行者，每次请求只记录一次 `request/assembly`；Tavern 保留资源、受限 EJS、MVU 提交路径与 Trace 展示。旧 `tavernRequestSources` 和包入口继续兼容转发。

新界面使用 assembler 自有 `/dsh-prompt-assembler/api/v1/assembly-presets`、安全 fetch 和实际请求只读接口。Tavern 的旧 assembly-presets 路径仍转发同一 store/runtime；Trace 仍可读取 DSH 中的实际请求。当前记录 owner 为 `dsh-prompt-assembler`，旧 `pmp-dsh-tavern` owner 继续可读。迁移仅合并旧存储缺少的项，原文件保留；新应用统一绑定 session ID，优先于旧 play/native scope，不因重新安装 Tavern 恢复旧选择。

卸载 Tavern 时取消其来源和只读 provider，assembler 的入口、策略和 DSH 自定义文本继续工作。依赖已卸载来源的模块有明确诊断，不重建缺失资源，不改写原生历史。Memory Manager adapter 使用公开服务；无需安装 Manager 就能使用 assembler 的原生来源。

## 模块与文本解析器

模块菜单仅列出当前能提供独立内容的来源。分散内容可通过来源的 `parseText(context, rule)` 和 `inputMode:'text'` 解析用户手填文本，两种模式共用位置、深度、角色与快照机制。

Tavern 文本使用一个 `tavern.text` 入口，依次执行受限 EJS、内容引用与 ST 宏；引用正文不会再执行 EJS。DSH `dsh.text` 使用原生变量插值。第三方来源保留自己的 parser/renderer。每个模块说明包含字段、来源、能否编辑和修改入口；资源身份与实际正文通过预览查看。

## GitHub 的依赖表示

独立仓库链接与 manifest/lockfile 表示 `Tavern → assembler`，不需要 submodule。当前使用私有 Git 提交固定版本，安装需要访问权限；将来公开 npm 分发时可改用精确包版本。Host 的服务依赖和显式 bundle 启用说明补足 npm 依赖图无法表达的运行时关系。公开目录提交、仓库公开、tag、release 和 npm 发布需要另行授权。
