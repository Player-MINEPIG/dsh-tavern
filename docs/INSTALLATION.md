# 跨平台安装与卸载

[English](INSTALLATION_en.md)

状态：对应 2026-09-05 的 `2.1.0-rc.1` 候选代码，目标 DSH 为完整版本 `0.1.2-rc.1`。根目录默认 [README](../README.md) 为中文；英文落地页是 [README_en.md](../README_en.md)（无截图）。本文是安装生命周期、验收与恢复合同。

脚本以 Node.js 为统一入口，并规范化 Windows、macOS 和 Linux 路径。macOS/Linux 直接执行 `dsh`。Windows 会安全定位 npm 的 `dsh.ps1` shim，再通过系统 PowerShell 以参数数组调用，因此路径不会被拼回 shell 命令文本。请在 `dsh-tavern` 检出目录中运行脚本，并准备 Node.js 20 或更高版本，以及位于 `PATH` 上的 DSH `0.1.2-rc.1`。

只安装仓库根包。`packages/tavern-format`、`packages/preset` 和 `packages/tavern-loader` 是随同一插件发布的内部边界，不要单独把它们加进 dsh。格式层可通过根包导出作为 JavaScript 库使用，但它本身故意没有把内容发给 agent 的效果。

## 安装

普通用户可直接从 GitHub 把插件装进默认 `web` profile：

```text
dsh plugin --profile web add github:Player-MINEPIG/dsh-tavern
```

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

## 验收 2.0 发布

打包或安装 2.0 发布前，运行：

```text
npm run verify:2.0
```

该命令会跑五组具名回归：完整 history 与游标守卫；受管文档校验 / CAS / focus / 路径加固；import claim/lineage 与不含正文的生命周期日志；chrome transport / slot 所有权与工作区准入；以及本地化 / 安装器边界。随后构建已跟踪的浏览器 bundle，并执行 `npm pack --dry-run`。

这条命令不能替代真实浏览器审查。多标签页通知、首次选择工作区、以及针对目标 DSH rc 的禁用/卸载回退，请使用内部发布验收清单。

## 卸载

```text
npm run plugin:uninstall
```

在调用 `dsh plugin ... remove` 之前，卸载器会把默认持久目录复制到：

```text
<DSH_HOME>/backups/pmp-dsh-tavern/<timestamp>/
```

默认源目录是 `<DSH_HOME>/pmp-dsh-tavern/`。它包含预设、归一化角色卡、从 PNG 导入时留在 `character-artifacts/` 的封面图、`world-books/` 下的独立世界书、`users/` 下的三字段用户资源、`tavern-traces.json` 中的有界 Trace 元数据，以及 per-session 资源选择。备份时复制整个目录；只复制 `presets/` 会丢失其他资源、审计元数据和绑定。同一棵树里还有 `state.json`、`character-state.json`、`user-world-book-bindings.json`、`resource-world-book-bindings.json`、`session-templates.json`、`chrome.json`、`play-workspace.json`、`import-context-bindings.json`、`ui-settings.json`（语言、外层 UI 缩放、绑卡跟随 RP）、`conversation-settings.json`（魔丸 RP 正文与消息动作缩放），以及可选的 `rp-policy.json`。

`play-workspace.json` 只是指针。所选 DSH RP 工作区才拥有真正的 `catalog.json`、各周目 `timeline.json`、显示正则文档和导入上下文文件。若周目必须可恢复，请同时备份该工作区；ST JSONL 导出只保留当前选中的线性对话和已知 swipe，不能保存完整的 Tavern 分支拓扑。

选择其他备份目录，或明确跳过备份：

```text
node scripts/uninstall.mjs --backup-dir /absolute/backup/path
node scripts/uninstall.mjs --storage-dir /absolute/custom/storage
node scripts/uninstall.mjs --no-backup
```

`--storage-dir` 让卸载器为显式配置的自定义存储目录创建快照。`--no-backup` 只跳过这次快照；普通卸载仍保留默认或自定义持久目录，也不删除当初用于导入的外部 ST 源文件。若用户明确要清除数据，应在确认备份后单独删除持久目录，而不是把“卸载软件包”与“清空用户内容”合并为一个隐式动作。

卸载同样支持这些常用参数：`--profile`、`--dsh-home`、`--store-dir`、`--storage-dir` 和 `--dry-run`。完整命令摘要见 `--help`。
