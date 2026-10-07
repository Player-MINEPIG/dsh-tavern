# 跨平台安装与卸载

[English](INSTALLATION_en.md)

下文 `v2.5.1` 命令用于已发布稳定版。独立 assembler 0.2.0 已提供私有仓库安装；本地 Tavern 候选源码的组合安装见[独立 assembler 接入](ASSEMBLER_INTEGRATION.md)，所需核心扩展见[核心扩展和安装边界](REQUEST_ASSEMBLY.md#核心扩展和安装边界)。稳定版 tag 不包含该组合接入。

装配规则的 CRUD、应用、预览、实际请求引用与所需核心扩展见[请求装配器](REQUEST_ASSEMBLY.md)。

Tavern **2.5.1** 支持 DSH **0.2.0-rc.2**，要求 Node `^22.19.0 || >=24.0.0`。前后端以同一个插件嵌入 DSH Web／桌面端，不提供额外独立 Web UI。较早版本请阅读对应 tag 的文档。

保留备份；旧外部引用按[坐标迁移指南](DSH_0.1.7_MIGRATION.md)处理，已完成迁移的 V4 引用无需再次转换，不提供回退工具。安装前将目标 DSH 放在 `PATH` 并初始化所需 profile。

## 安装 2.5.1

从 Tavern 2.5.0 升级只需更新插件并重启 Host，继续使用 DSH `0.2.0-rc.2`；无需迁移会话、timeline、Trace 或设置。数学公式默认启用，不需要另装 KaTeX、字体或渲染插件；显示和离线 HTML 导出需要支持 MathML 的现代浏览器。旧版浏览器可能只显示公式符号而无法正确排版。语法与 HTML 混用边界见[使用说明](USAGE_zh-CN.md#markdownhtml-与模板样式)。

停止目标 Host 后，使用固定版本标签安装：

```sh
dsh plugin --profile web add github:Player-MINEPIG/dsh-tavern#v2.5.1
```

<a id="source-candidate"></a>
<a id="source-installation"></a>
### 从源码安装和验收

使用目标 DSH 初始化的独立测试 profile/home：

```sh
git clone --branch v2.5.1 https://github.com/Player-MINEPIG/dsh-tavern.git
cd dsh-tavern
npm ci --legacy-peer-deps
node scripts/install.mjs --dsh-home /absolute/path/to/test-home --profile web
```

用同一个 `DSH_HOME` 启动 DSH，再按[开发验证指南](TESTING.md)检查。只升级 CLI 不会更新 profile 中的插件，请记录验收源码 revision。脚本规范化 macOS/Linux/Windows 路径，Windows 通过 npm PowerShell shim 以参数数组调用。只安装仓库根包，不单独安装内部 packages。安装／启动的 peer 准入无需版本例外。

### DSH 提供官方运行依赖

当前 `package.json` 把 `@deepseek-ai/dsh-util-crypto` 的 `0.2.0-rc.2` 与 `@deepseek-ai/cordis` 的 `4.0.4` 声明为必需 `peerDependencies`，由 DSH 运行时提供，避免插件安装第二份。源码构建和测试使用 `devDependencies` 中固定的 `0.2.0-rc.2` crypto 包。浏览器合同由 `dsh.client.inject` 声明并由 DSH 提供，不随 Tavern 打包。

DSH profile 使用 `nodeLinker: hoisted` 和 `autoInstallPeers: false`；启动时由 DSH 的 profile 包解析层提供安装目录中的官方依赖。因此 `dsh plugin add` 或 `pnpm peers check` 可能报告这两个包缺失：该静态检查不识别 DSH 的运行时解析机制。不要依赖 `<DSH_HOME>/profiles/node_modules` 链接是否存在，也不要用未启动 DSH 的独立 Node 进程作为唯一判断依据；应核实 Host 实际解析的版本并检查插件能否启动。

若重启后仍出现 `ERR_MODULE_NOT_FOUND`，则不是可忽略的安装警告；请检查 `PATH` 中的 DSH 是否为目标 `0.2.0-rc.2`、安装是否完整及实际模块解析路径。不要为消除警告把必需 peer 标成 optional。DSH 的安装与启动检查依据插件声明的 DSH peer 版本；通过该检查不等于所有 Host 行为均已验证，仍需核对目标版本和运行时验收结果。

### 数据与源码安装

首次启动时，Tavern 会在 `<DSH_HOME>/pmp-dsh-tavern/` 自动创建持久目录，不要求用户选择内部存储位置。普通 `dsh plugin remove` 只移除 profile 中的软件包，保留该目录，但不会调用项目的备份逻辑或创建卸载前快照；需要快照时请按下文检出仓库并使用 `npm run plugin:uninstall`。

从源码开发、从旧版包内 `data/` 安全迁移，或准备使用下文的备份卸载流程时，先检出仓库并安装一次依赖：

```text
npm install --cache .npm-cache
npm run plugin:install
```

安装器会构建 `dist/client.js`，不经过 shell 调用 `dsh plugin ... add`，并打印重启提醒。审查前请重启当前正在运行的 `dsh web`。

更新已有安装前，先停止目标 `dsh web`。持久目录位于软件包之外，重复安装不会触碰它。为支持仍使用旧版包内 `data/` 的安装，脚本还会在 remove/add 前把该旧目录暂存到 `<DSH_HOME>/backups/pmp-dsh-tavern/pending-refresh-<profile>/`，add 成功后恢复到新包；新 Host 首次启动时，若外部目录为空，就通过同目录临时副本把旧数据原子发布到 `<DSH_HOME>/pmp-dsh-tavern/`，写入迁移标记并保留旧副本。若外部目录已有数据则绝不覆盖，只记录告警。若 remove/add 失败，错误信息会打印 pending 路径；下一次运行安装器会修复中断的依赖注册并继续恢复。恢复尚未完成时，不要删除该目录。

刷新仍会把当前 worktree 声明的 `files` 条目物化为独立副本，以规避 pnpm 的旧目录快照和硬链接混合版本问题；它不触碰 pnpm 管理的嵌套 `node_modules`，并在替换文件前确认安装目标仍位于所选 profile。省略 `--store-dir` 时，更新器读取该 profile 的 `node_modules/.modules.yaml` 中已记录的 store，以避免 `ERR_PNPM_UNEXPECTED_STORE`。

常用参数：

```text
node scripts/install.mjs --profile web
node scripts/install.mjs --skip-build
node scripts/install.mjs --dsh-home /absolute/test/home
node scripts/install.mjs --store-dir /absolute/pnpm/store
node scripts/install.mjs --dry-run
```

传参数时请直接用 `node` 形式，以免不同 npm 版本和 PowerShell 在 `npm run` 之后转发参数不一致。

Windows 路径可按本机写法传入，例如：

```text
node scripts/install.mjs --dsh-home .\test-envs\review
```

## 发布验收

打包或安装当前源码前，运行发布验证命令（命令名仍为 `verify:2.0`）：

```text
npm run verify:2.0
```

该命令覆盖 Trace v3 与真实 AgentLoop、session 坐标 codec、history/游标守卫、受管文档与 CAS、import claim/lineage、chrome/slot 所有权、本地化和安装边界，随后构建已跟踪的浏览器 bundle 并执行 `npm pack --dry-run`。

将 `DSH_TAVERN_COMPAT_ROOT` 和 `DSH_TAVERN_PROMPT_COMPAT_ROOT` 指向目标 DSH 安装的依赖根目录才能启用真实运行时检查；未设置时对应测试明确跳过。另运行 `npm run check` 覆盖全套测试。
这些命令不能替代 [目标 Host 与浏览器的运行时验证](TESTING.md)。

## 卸载

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
