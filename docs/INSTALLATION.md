# 跨平台安装与卸载

当前目标 DSH 为 `0.1.5-rc.1`；从较早 DSH 坐标格式迁移现有周目时，先按 [升级指南](DSH_0.1.5_MIGRATION.md) 操作。该 DSH 版本要求 Node `^22.19.0 || >=24.0.0`，不能只依据 Tavern 的 Node 20 声明。

[English](INSTALLATION_en.md)

本文面向 Tavern `2.3.0`，运行时验收目标是 DSH `0.1.5-rc.1`。根目录默认 [README](../README.md) 为中文；英文落地页是 [README_en.md](../README_en.md)（无截图）。本文是当前安装生命周期、验收与恢复合同。其他版本请切换到对应 tag，并阅读该 tag 内的安装说明。

脚本以 Node.js 为统一入口，并规范化 Windows、macOS 和 Linux 路径。macOS/Linux 直接执行 `dsh`。Windows 会安全定位 npm 的 `dsh.ps1` shim，再通过系统 PowerShell 以参数数组调用，因此路径不会被拼回 shell 命令文本。请在 `dsh-tavern` 检出目录中运行脚本，并准备 Node.js 20 或更高版本，以及位于 `PATH` 上的目标 DSH `0.1.5-rc.1`；启动 Host 时需满足上面的 Node 要求。

只安装仓库根包。`packages/tavern-format`、`packages/preset` 和 `packages/tavern-loader` 是随同一插件发布的内部边界，不要单独把它们加进 dsh。格式层可通过根包导出作为 JavaScript 库使用，但它本身故意没有把内容发给 agent 的效果。

## 安装 2.3.0

呈现审核已完成，内容审核后再合并到 `main`，目前尚未发布。审核期间从 GitHub 安装到默认 `web` profile，请指定当前分支：

```text
dsh plugin --profile web add github:Player-MINEPIG/dsh-tavern#codex/trace-api-v3
```

<a id="source-candidate"></a>
<a id="source-installation"></a>
### 从源码安装和验收

使用独立测试 profile/home，安装前停止该 Host。`2.3.0` 尚无发布 tag；请明确检出当前分支再从源码安装：

```sh
git clone --branch codex/trace-api-v3 https://github.com/Player-MINEPIG/dsh-tavern.git
cd dsh-tavern
npm ci --legacy-peer-deps
node scripts/install.mjs --dsh-home /absolute/path/to/test-home --profile web
```

用同一个 `DSH_HOME` 启动 DSH `0.1.5-rc.1`，再按 [Trace 验收步骤](TRACE_REVIEW.md)检查。
只升级 CLI 不会更新 profile 中的插件。用 `git rev-parse HEAD` 记录所验收构建。

### DSH 提供官方运行依赖

`package.json` 当前把 `@deepseek-ai/dsh-util-crypto` 的 `0.1.2-rc.1 || 0.1.5-rc.1` 与 `@deepseek-ai/cordis` 的 `4.0.2` 声明为必需 `peerDependencies`，由 DSH 运行时提供，避免插件安装第二份。源码构建和测试使用 `devDependencies` 中固定的 `0.1.2-rc.1` crypto 包。浏览器合同由 `dsh.client.inject` 声明并由 DSH 提供，不随 Tavern 打包。

DSH profile 使用 `nodeLinker: hoisted` 和 `autoInstallPeers: false` 时，会在启动期通过 `<DSH_HOME>/profiles/node_modules` 提供自身安装所携带的包，供插件按 Node 的父目录规则解析。因此 `dsh plugin add` 或 `pnpm peers check` 可能报告这两个包缺失：该静态检查不识别 DSH 的启动期依赖提供机制。运行时仍必须能从 DSH 安装目录解析这两个包。

若重启后仍出现 `ERR_MODULE_NOT_FOUND`，则不是可忽略的安装警告；请检查 `PATH` 中的 DSH 是否为目标 `0.1.5-rc.1`、安装是否完整及实际模块解析路径。不要为消除警告把必需 peer 标成 optional。精确 peer 声明约束的是对应包，不是自动检查整个 DSH 版本的启动门禁。

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
这些命令不能替代 [Trace 运行时与人工验收](TRACE_REVIEW.md)。

## 卸载

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
