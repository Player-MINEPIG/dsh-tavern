# 独立 Prompt Assembler 接入

[English](ASSEMBLER_INTEGRATION_en.md) · [装配行为](REQUEST_ASSEMBLY.md) · [独立插件仓库](https://github.com/Player-MINEPIG/dsh-prompt-assembler)

Tavern 4.0.0 需要独立安装并启用标准 Assembler 1.1.3。必需 peer 范围为 `~1.1.3`。Assembler 拥有策略存储、来源注册、请求钩子、安全 API 和独立配置入口，不依赖 Tavern 或 Memory Manager。Tavern 及其他插件消费同一个公共服务，不各自托管副本。

`adapters/tavern` 与 `adapters/memory-manager` 位于 Assembler 仓库，消费来源公开的只读服务。来源继续拥有数据、解析语法和权限，DSH durable history 是历史的权威记录。第三方可 fork 或向该仓库提交适配改动。

进阶扩展冻结在 Assembler `1.1.0` / DSH `0.2.0-rc.2`，不承诺后续适配。当前只分发标准包，不包含新版核心改动。下文进阶语义用于理解旧配置与历史记录。

## 安装与升级

在同一 DSH profile 先安装并启用 Assembler，再安装 Tavern。GUI 的“插件 → 添加插件”可以使用下面两个 Release 附件直链。命令行操作前先停止目标 Host：

```sh
dsh plugin --profile web add https://github.com/Player-MINEPIG/dsh-prompt-assembler/releases/download/v1.1.3/dsh-prompt-assembler-1.1.3.tgz
dsh plugin --profile web add https://github.com/Player-MINEPIG/dsh-tavern/releases/download/v4.0.0/pmp-dsh-tavern-4.0.0.tgz
```

两个预构建包分别安装，不需要发布或下载 npm Assembler 1.1.3。Tavern 不再携带 Assembler，也不会因 peer 缺失而自动安装它。目标 DSH 使用 `autoInstallPeers: false`，包登记与 bundle 启用是不同操作。按 GUI 提示重载或重启，再核对两个组件的启动结果。

从 3.0.5 或内嵌候选升级时，默认 Assembler 存储继续使用 `<DSH_HOME>/dsh-prompt-assembler/`。保留 Tavern 数据、策略和会话选择，不重写历史。旧自定义 `assemblerStorageDir` 要移到独立 Assembler 的 `storageDir` 并从 Tavern 配置删除；4.0.0 拒绝该旧字段。原先转发的安全设置应另复制到 Assembler 的 `security`，Tavern 自身需要的 `security` 保留。完整顺序见[升级步骤](INSTALLATION.md#upgrade-to-4)。

## 共享服务与生命周期

Assembler 的公共 `dshPromptAssembler` 服务提供实际运行版本 `version`、策略库、来源注册表和装配运行时。Tavern 校验实际服务版本和所需能力，再通过 `attachTavern` 提供资源。SDK 导入成功不代表该服务已经启动，也不代表运行服务与 SDK 恰好来自同一个包副本。

Tavern 的 DSH bundle 使用可安全检查依赖的 `packages/tavern-loader/src/host.js`（也导出为 `pmp-dsh-tavern/host`） 入口。根包与 `./loader` 的公共 SDK 导出保留。缺少、停用或不兼容的独立 Assembler 不会触发 Tavern 私有实例。独立服务启用后，Tavern 才能挂载依赖它的运行时；服务停用时相关消费者停止。

移除 Tavern 只撤销 Tavern 来源、资源 provider 和界面。独立 Assembler 的策略、入口、原生 DSH 来源与其他消费者仍可使用。移除 Assembler 前先停用依赖它的插件；Tavern 不恢复旧的随包副本。默认持久目录与策略文件保留，自定义目录由独立 Assembler 的配置决定。

其他插件使用相同公共服务，并在需要导入 SDK 时声明兼容 peer。一个来源插件可以这样管理注册生命周期：

```js
export const inject = ['dshPromptAssembler']
export function apply(ctx) {
	const stop = ctx.dshPromptAssembler.registry.register(source)
	ctx.effect(() => stop)
}
```

不要依赖另一个插件的嵌套 `node_modules` 路径，或用 SDK 类的 `instanceof` 代替服务协议检查。不同物理副本即使版本相同，也可能有不同模块身份。

## Tavern 的接入切面

Tavern 使用共享 Assembler store、registry 和 runtime。`attachTavern` 提供只读资源、会话租约、预设和最终复验。标准后端贡献官方 sections/context 与接纳的 pre-step 消息；只有历史进阶 addon 拥有协议 1 请求替换。标准 Trace 核验 durable system/context 与完整原生请求引用，旧进阶 Trace 每次引用一条 request/assembly。资源编辑、受限 EJS 与 MVU 写入继续归 Tavern。

Tavern 不再创建本地 Assembler fallback。旧 `tavernRequestSources` 名称仍引用共享 registry；公开资源 API、装配转发 API 和根包 SDK 保留。移除来源后，缺少资源的模块返回诊断，不重建资源或改写原生历史。

界面使用 Assembler 的 `/dsh-prompt-assembler/api/v1/assembly-presets`、安全 fetch 与实际请求只读接口。Tavern 旧 assembly-presets 路径继续转发同一 store/runtime。当前记录 owner 为 `dsh-prompt-assembler`，旧 `pmp-dsh-tavern` owner 继续可读。旧策略迁移只合并缺少的条目并保留原文件。新应用绑定 session ID，优先于旧 play/native scope，不因重新安装 Tavern 恢复旧选择。

独立的“插件 → 已安装插件 → dsh-prompt-assembler → 配置当前会话”入口归 Assembler 所有。Tavern 的装配面板继续复用前端 SDK，通过公共 API 编辑同一策略库和会话绑定。Tavern 不启动另一个独立 Assembler 客户端。最后一次成功应用决定后续请求快照；编辑草稿或保存策略不改变已应用快照。两个面板通过 Assembler 刷新事件同步应用状态，各自保留未保存草稿。

## 模块与文本解析器

模块菜单仅列出当前能提供独立内容的来源。分散内容可通过来源的 `parseText(context, rule)` 和 `inputMode:'text'` 解析用户手填文本，两种模式共用位置、深度、角色与快照机制。

Tavern 文本使用一个 `tavern.text` 入口，依次执行受限 EJS、内容引用与 ST 宏。引用正文不会再次执行 EJS。DSH `dsh.text` 使用原生变量插值。第三方来源保留自己的 parser/renderer。每个模块说明字段、来源、能否编辑和修改入口；资源身份与正文可通过预览查看。

## 可选 Memory Manager

[dsh-memory-manager v1.0.0](https://github.com/Player-MINEPIG/dsh-memory-manager/releases/tag/v1.0.0) 是独立的可选扩展。Tavern 的包与服务依赖均不要求安装它。安装期间可查看资源、编辑存取规则和观察真实应用记录；卸载撤销管理租约，后续请求恢复来源默认规则，保留 DSH 会话、来源内容与 Manager 的配置文件。重新安装会重新应用保留的规则，不会把这些规则永久写进 Tavern 或 assembler。通用记忆资源来源由 assembler 的 `adapters/memory-manager` 注册；卸载后该来源撤销，原生 MVU 与世界书仍由 Tavern 提供。

停止目标 Host 后，在同一 profile 安装已发布的 v1.0.0，再重启 DSH。在设置或已有会话的「记忆管理」页签中打开：

```sh
dsh plugin --profile web add github:Player-MINEPIG/dsh-memory-manager#v1.0.0
```

该 Manager 版本仅验证 DSH `0.2.0-rc.2`，不自动支持当前目标。通过管理规则将通用资源提供给模型时，需在 Manager 中配置读取规则，并在 assembler 策略中选择 `memory-manager.resources`；这条路径要求支持 request-assembly 协议 1 的宿主。DSH 原生 Skill 调用和 Tavern 自行执行的世界书、MVU、模板贡献仍使用各自来源路径。详见 v1.0.0 的[安装指南](https://github.com/Player-MINEPIG/dsh-memory-manager/blob/v1.0.0/docs/INSTALLATION.md)、[使用指南](https://github.com/Player-MINEPIG/dsh-memory-manager/blob/v1.0.0/docs/USAGE.md)与[assembler 接入](https://github.com/Player-MINEPIG/dsh-memory-manager/blob/v1.0.0/docs/ASSEMBLER.md)。

## 源码开发与独立打包

生产安装图为独立 Assembler 与 Tavern 两个 profile 直接依赖。Tavern 的 `peerDependencies` 声明兼容要求，不把 GitHub URL 放入普通子依赖，也不声明 `bundleDependencies`。目标 pnpm 默认限制 Git/URL 子依赖；两个独立直接安装不依赖放宽该限制。

开发与构建使用 lockfile 固定的 Assembler 源码归档。`npm ci --legacy-peer-deps` 安装已审查的修订与完整性，不依赖 npm 上存在 1.1.3。单独开发 Assembler 时检出其对应源码，并运行该项目的 `npm ci` 与 `npm run check`。本地联调可在临时 checkout 通过 `npm install --no-save --package-lock=false --legacy-peer-deps /path/to/assembler` 使用本地版本，不提交临时路径。

```sh
npm run pack:release -- --assembler node_modules/dsh-prompt-assembler
```

打包命令重建两个前端，输出独立的 Assembler 与 Tavern tgz。Tavern 编辑器编入本次受检的前端 SDK，但安装包不包含第二份 Assembler 包或 Host。构建前先准备两个源码目录所需的开发依赖。冻结进阶版的安装与回退见 [v1.1.0 文档](https://github.com/Player-MINEPIG/dsh-prompt-assembler/blob/v1.1.0/docs/INSTALLATION.md)。标准后端与旧进阶诊断见 [Assembler 1.1.3 后端规则](https://github.com/Player-MINEPIG/dsh-prompt-assembler/blob/v1.1.3/docs/BACKENDS.md)。

[接口索引](API_SURFACES.md) · [Tavern 架构图](assets/architecture/tavern.zh-CN.html) · [组合架构图](assets/architecture/ecosystem.zh-CN.html)。
