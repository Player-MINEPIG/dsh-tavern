# 跨平台安装与卸载

[English](INSTALLATION_en.md)

Tavern 3.1.5 需要独立安装并启用 Assembler 1.1.3。两个组件分别交付，Tavern 不内嵌 Assembler，不自动下载或启动它。必需 peer 范围为 `~1.1.3`。服务分工与可选 Memory Manager 见[接入说明](ASSEMBLER_INTEGRATION.md)。

装配规则的 CRUD、应用、预览、实际请求引用与旧进阶配置读取见[请求装配器](REQUEST_ASSEMBLY.md)。当前支持 DSH **0.2.1-rc.2 / 0.2.1-rc.3**，要求 Node `^22.19.0 || >=24.0.0`。Tavern 前端嵌入 DSH Web 与桌面端，不提供额外独立 Web UI。

Host 与 DSH crypto peer 范围均为 `>=0.2.1-rc.2 <0.2.2-0`。范围内后续版本按策略准入，不代表逐版运行验收。旧完整说明保留在对应 Git tag。

## 安装两个独立组件

先初始化目标 DSH profile。在 GUI 的“插件 → 添加插件”中，按以下顺序粘贴附件直链，分别安装并启用：

1. Assembler 1.1.3。

   ```text
   https://github.com/Player-MINEPIG/dsh-prompt-assembler/releases/download/v1.1.3/dsh-prompt-assembler-1.1.3.tgz
   ```

2. Tavern 3.1.5。

   ```text
   https://github.com/Player-MINEPIG/dsh-tavern/releases/download/v3.1.5/pmp-dsh-tavern-4.0.0.tgz
   ```

按 GUI 提示重载或重启 Host。已安装独立 Assembler 时，先核对版本和启用状态。仅将包登记到 profile 不代表其 bundle 已启用。

命令行安装或更新前，停止目标 Host。将目标 DSH 放在 `PATH`，在同一 profile 依次运行：

```sh
dsh plugin --profile web add https://github.com/Player-MINEPIG/dsh-prompt-assembler/releases/download/v1.1.3/dsh-prompt-assembler-1.1.3.tgz
dsh plugin --profile web add https://github.com/Player-MINEPIG/dsh-tavern/releases/download/v3.1.5/pmp-dsh-tavern-4.0.0.tgz
```

这里安装的是预构建 Release 附件，不要求从 npm 下载 Assembler 1.1.3。DSH 的其他运行依赖与 Tavern 的普通依赖仍按各自的安装机制提供。

Market 的“已安装，重启后生效”表示软件包已登记，不证明插件已成功启动。重启后确认独立 Assembler 与 Tavern 均运行，分别打开装配配置和 DT 面板。若显示缺少或不兼容的 Assembler，先安装并启用符合范围的独立组件，再按 Host 提示重载或重启。不要用版本例外代替缺失依赖。

新版仅支持 stock core 标准策略。进阶扩展冻结在 Assembler 1.1.0 / DSH 0.2.0-rc.2，不承诺后续适配。插件安装不会修改 DSH 核心。

<a id="upgrade-to-3-1-5"></a>
## 从内嵌 Assembler 的版本升级到 3.1.5

1. 停止目标 Host。备份 Tavern 持久目录、Assembler 持久目录、RP 工作区和对应 DSH 数据。
2. 在同一 profile 安装独立 Assembler 1.1.3，并将其 bundle 设为启用。
3. 默认 Assembler 存储继续使用 `<DSH_HOME>/dsh-prompt-assembler/`。不要删除该目录或复制一份空目录覆盖它。
4. 若旧 Tavern 配置含 `assemblerStorageDir`，将原值移到独立 Assembler 的 `storageDir`，再删除旧 Tavern 字段。Tavern 3.1.5 拒绝该旧字段，不会忽略它后打开另一份策略库。保留 Tavern 自己的 `storageDir`。
5. 旧 Tavern `security` 曾同时转发给 Assembler。将需要继续作用于装配 API 的设置复制到独立 Assembler 的 `security`。保留 Tavern `security` 中适用于 Tavern 自身 API 的设置。
6. 卸载旧 Tavern 软件包，保留数据目录。GUI 使用“卸载 pmp-dsh-tavern”；CLI 使用 `dsh plugin --profile web remove pmp-dsh-tavern`。不要清除 Tavern、Assembler 或 DSH 的数据。
7. 使用上面的 3.1.5 附件直链重新安装 Tavern，确认两个 bundle 均启用后启动 Host。核对角色卡、策略、会话选择与 Trace，再执行[运行时验证](TESTING.md)。

pnpm 覆盖安装可能保留旧包内嵌的 Assembler 文件，导致解析到 1.1.2。此次从内嵌版本升级必须先卸载旧 Tavern 软件包再重新安装；单独覆盖更新不保证清除旧副本。

默认配置不含旧自定义字段时，无需手工修改存储路径。Tavern 启动后仍将旧策略存储中缺少的条目合并到独立 Assembler，保留旧文件。安装与本次升级不重写 DSH 会话历史。旧外部引用另按[坐标迁移指南](DSH_0.1.7_MIGRATION.md)处理；已有 V4 引用无需再次转换，不提供回退工具。

数学公式默认启用，不需要另装 KaTeX、字体或渲染插件。显示和离线 HTML 导出需要支持 MathML 的现代浏览器。旧版浏览器可能只显示公式符号而无法正确排版，见[使用说明](USAGE_zh-CN.md#markdownhtml-与模板样式)。

### 安装入口与地址格式

DSH 的 CLI、Web 与桌面插件管理共用 `pnpm add` 安装路径。GUI 的“添加插件”接受 npm 包名、GitHub 仓库地址、本地绝对目录和 `.tgz` / `.tar.gz` 安装包地址，经 `pluginManager.installBundle` 执行安装与启用。参见 [GUI 调用](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.3/packages/client/ui-plugin-manager/src/client/manager-store.ts)、[地址解析](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.3/packages/boot/plugin-manager/src/install-spec.ts)与[共享安装实现](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.3/packages/boot/plugin-manager/src/index.ts)。

- 仓库地址可以带 `#tag` 或 `#commit`。它安装该 Git 提交中的包，不会寻找 GitHub Release 附件。
- `releases/download/标签/包名.tgz` 是预构建附件直链，可以作为安装地址。
- `releases/tag/标签` 是 Release 网页，不能作为安装地址。
- GitHub 自动生成的源码 `.tar.gz` 可被识别为归档，但不等于预构建安装包。当前 GUI 不接受源码 `.zip`。

自定义 Market 根据索引选择 `包名@版本` 或固定 commit 的 Git URL，不会自动选择 Release 附件，见 [Market 实现](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.3/packages/util/plugin-market-index/src/index.ts)。

Tavern 通过 `peerDependencies` 声明共享 Assembler。DSH profile 使用 `nodeLinker: hoisted` 和 `autoInstallPeers: false`，因此 peer 声明不会自动安装 Assembler。将它作为 profile 的直接依赖独立安装，不把 GitHub 地址放入 Tavern 的普通子依赖。源码与预构建 Tavern 包均不声明 `bundleDependencies`，包内没有第二份 Assembler。其他依赖 Assembler 的插件也应复用公共服务，并声明自己的兼容范围。

### DSH 提供官方运行依赖

`@deepseek-ai/dsh-util-crypto` 与 `@deepseek-ai/cordis` 是 DSH 提供的必需 peers，避免安装第二份。前者范围为 `>=0.2.1-rc.2 <0.2.2-0`，后者为 `4.0.5`。浏览器合同由 `dsh.client.inject` 声明并由 DSH 提供。

静态 `pnpm peers check` 不识别 DSH 的运行时解析机制，可能报告这些官方 peers 缺失。Assembler 则是用户必须独立安装的第三方组件，不能把它的缺失也当成可忽略警告。应核实 Host 实际解析的组件版本并检查启动结果。不要依赖 profile 顶层是否存在同名目录，也不要把普通 Node 进程的包查找结果作为唯一依据。

重启后仍出现 `ERR_MODULE_NOT_FOUND` 时，核对目标 DSH、安装完整性与实际解析路径。不要为消除警告把必需 peer 标成 optional。DSH 准入依据 `engines.dsh`，未声明时才依据 DSH peers；版本准入不等于运行时验收。

<a id="source-candidate"></a>
<a id="source-installation"></a>
### 从源码安装和打包

使用目标 DSH 初始化的独立测试 profile。先在该 profile 安装并启用独立 Assembler。Tavern 开发依赖由 lockfile 固定到经过审查的 GitHub 源码归档和完整性，不依赖 Assembler 1.1.3 已发布到 npm。

```sh
git clone --branch v3.1.5 https://github.com/Player-MINEPIG/dsh-tavern.git
cd dsh-tavern
npm ci --legacy-peer-deps
node scripts/install.mjs --dsh-home /absolute/path/to/test-home --profile web
```

用同一个 `DSH_HOME` 启动 DSH，再按[开发验证指南](TESTING.md)检查，并记录验收源码 revision。只升级 CLI 不会更新 profile 中的插件。脚本规范化 macOS、Linux 与 Windows 路径；Windows 通过 npm PowerShell shim 以参数数组调用。只安装仓库根包，不分别安装内部 packages；不需要兼容性例外。

生成两个独立预构建安装包：

```sh
npm run pack:release -- --assembler node_modules/dsh-prompt-assembler
```

命令重建两个前端并输出独立的 Tavern 与 Assembler tgz。Tavern 的编辑器会编入复用的前端 SDK，但不会加载另一个 Assembler Host 或独立客户端实例。输出 Tavern 包不得含 `node_modules/dsh-prompt-assembler`。安装验收必须使用最终 tgz 或实际发布附件，不能用源码目录的依赖替代。

### 数据与源码安装器

Tavern 首次启动自动创建 `<DSH_HOME>/pmp-dsh-tavern/`。普通 `dsh plugin remove` 保留该目录，但不创建卸载前快照。需要快照时，按上文检出仓库后使用下文卸载脚本。

项目安装器只更新 Tavern。它构建 `dist/client.js`，以参数数组调用 `dsh plugin ... add`，再提示重启。运行前必须在目标 profile 独立安装并启用 Assembler。开发依赖安装使用 `npm ci --legacy-peer-deps`。

刷新会将 worktree 声明的 `files` 物化为独立副本，避免 pnpm 旧快照或硬链接混合版本。更新器不会触碰 pnpm 管理的嵌套 `node_modules`，并确认替换目标位于所选 profile。未指定 `--store-dir` 时，它沿用 `.modules.yaml` 记录的 store。

从包内旧 `data/` 升级时，先停止 Host。安装器在 remove/add 前暂存旧目录到 `<DSH_HOME>/backups/pmp-dsh-tavern/pending-refresh-<profile>/`，成功后恢复到新包。新 Host 首次启动时，若外部目录为空，将旧数据复制到同目录临时副本后原子发布，保留旧副本。已有外部目录绝不覆盖。失败时按安装器输出修复中断恢复；未完成前不要删除 pending 目录。

常用参数：

```text
node scripts/install.mjs --profile web
node scripts/install.mjs --skip-build
node scripts/install.mjs --dsh-home /absolute/test/home
node scripts/install.mjs --store-dir /absolute/pnpm/store
node scripts/install.mjs --dry-run
```

传参数时使用直接 `node` 形式，避免 npm 与 PowerShell 的参数转发差异。Windows 路径可以按本机写法传入，例如 `node scripts/install.mjs --dsh-home .\test-envs\review`。

## 发布验收

打包或安装当前源码前，运行发布验证命令（命令名仍为 `verify:2.0`）：

```text
npm run verify:2.0
```

该命令覆盖 Trace v3 与真实 AgentLoop、session 坐标 codec、history/游标守卫、受管文档与 CAS、import claim/lineage、chrome/slot 所有权、本地化和安装边界，随后构建已跟踪的浏览器 bundle 并执行 `npm pack --dry-run`。

将 `DSH_TAVERN_COMPAT_ROOT` 和 `DSH_TAVERN_PROMPT_COMPAT_ROOT` 指向目标 DSH 安装的依赖根目录才能启用真实运行时检查；未设置时对应测试明确跳过。另运行 `npm run check` 覆盖全套测试。
这些命令不能替代 [目标 Host 与浏览器的运行时验证](TESTING.md)。

## 卸载

卸载 Tavern 保留独立 Assembler 及其数据。其他消费者可继续使用该服务。卸载 Assembler 前，先停用依赖它的插件；Tavern 不会补建私有实例。

不建议在 RP 工作区内通过 DSH 原生“新建会话”创建普通对话；请使用单独的工作区。DSH 可能复用同工作区中尚未开始对话的空会话，即使它已配置 Tavern 角色卡或标题。卸载 Tavern 不会自动清除会话标题、per-session 资源选择或工作区内的周目记录，因此重装后可能重新显示旧角色绑定与归类。

若仍要将 RP 工作区中的会话用于普通对话，请在卸载前，先在角色卡面板解绑并确认从原周目脱离，解绑该会话的预设、用户设定和显式世界书，关闭 RP，再检查独立装配器中已应用的来源与自定义文本。解绑只影响后续请求，不删除资源或已有消息；旧标题需要在 DSH 原生会话菜单中手动重命名。Tavern 卸载后无法通过其面板解绑；必要时先重装处理。

```text
npm run plugin:uninstall
```

在调用 `dsh plugin ... remove` 之前，卸载器会把默认持久目录复制到：

```text
<DSH_HOME>/backups/pmp-dsh-tavern/<timestamp>/
```

默认源目录是 `<DSH_HOME>/pmp-dsh-tavern/`。它包含预设、归一化角色卡、从 PNG 导入时留在 `character-artifacts/` 的封面图、`world-books/` 下的独立世界书、`users/` 下的三字段用户资源、`tavern-trace-records.json` 中的 schema 4 Trace metadata/官方历史引用，以及 per-session 资源选择。升级目录还可能保留只读的旧 `tavern-traces.json` 元数据与旧 `tavern-assemblies.json` schema 3 正文快照；后者可能含敏感提示词。备份时复制整个目录；只复制 `presets/` 会丢失其他资源、审计 metadata 和绑定。同一棵树里还有 `state.json`、`character-state.json`、`user-world-book-bindings.json`、`resource-world-book-bindings.json`、`session-templates.json`、`chrome.json`、`play-workspace.json`、`import-context-bindings.json`、`ui-settings.json`（语言、外层 UI 缩放、绑卡跟随 RP）、`conversation-settings.json`（魔丸 RP 正文与消息动作缩放），以及可选的 `rp-policy.json`。

`play-workspace.json` 只是指针。所选 DSH RP 工作区才拥有真正的 `catalog.json`、各周目 `timeline.json`、显示正则文档和导入上下文文件；timeline 引用的会话正文与分支历史仍在对应 `DSH_HOME` 的官方 session 日志中。若周目必须可恢复，请同时备份 Tavern 持久目录、RP 工作区和对应 DSH 数据（包括会话日志及继承依赖）；ST JSONL 导出只保留当前选中的线性对话和已知 swipe，不能保存完整的 Tavern 分支拓扑。

选择其他备份目录，或明确跳过备份：

```text
node scripts/uninstall.mjs --backup-dir /absolute/backup/path
node scripts/uninstall.mjs --storage-dir /absolute/custom/storage
node scripts/uninstall.mjs --no-backup
```

`--storage-dir` 让卸载器为显式配置的自定义存储目录创建快照。`--no-backup` 只跳过这次快照；普通卸载仍保留默认或自定义持久目录，也不删除当初用于导入的外部 ST 源文件。若用户明确要清除数据，应在确认备份后单独删除持久目录，而不是把“卸载软件包”与“清空用户内容”合并为一个隐式动作。

卸载同样支持这些常用参数：`--profile`、`--dsh-home`、`--store-dir`、`--storage-dir` 和 `--dry-run`。完整命令摘要见 `--help`。

标准版及历史进阶边界见[assembler 接入](ASSEMBLER_INTEGRATION.md)。标准 user context/pre-step 会进入 DSH 历史，与进阶 request-only 路径不同。
