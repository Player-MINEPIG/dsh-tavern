# 跨平台安装与卸载

[English](INSTALLATION_en.md)

状态：对应 2026-08-22 的 `2.0.0` 发布。根目录默认 [README](../README.md) 为中文；英文落地页是 [README_en.md](../README_en.md)（无截图）。本文是安装生命周期、验收与恢复合同。

脚本以 Node.js 为统一入口，并规范化 Windows、macOS 和 Linux 路径。macOS/Linux 直接执行 `dsh`。Windows 会安全定位 npm 的 `dsh.ps1` shim，再通过系统 PowerShell 以参数数组调用，因此路径不会被拼回 shell 命令文本。请在 `dsh-tavern` 检出目录中运行脚本，并准备 Node.js 20 或更高版本，以及位于 `PATH` 上的 `dsh`。

只安装仓库根包。`packages/tavern-format`、`packages/preset` 和 `packages/tavern-loader` 是随同一插件发布的内部边界，不要单独把它们加进 dsh。格式层可通过根包导出作为 JavaScript 库使用，但它本身故意没有把内容发给 agent 的效果。

## 安装

先安装一次依赖，再把插件装进默认 `web` profile：

```text
npm install --cache .npm-cache --legacy-peer-deps
npm run plugin:install
```

安装器会构建 `dist/client.js`，不经过 shell 调用 `dsh plugin ... add`，并打印重启提醒。审查前请重启当前正在运行的 `dsh web`。

更新已有安装前，先停止目标 `dsh web`。重复安装受支持：脚本会保留已安装的 `data/`，移除过期的本地 `file:` 包，再次加入当前 worktree，然后恢复数据。这是必要的，因为 pnpm 可能报告 `Already up to date`，却让较早本地目录快照里新加入的源文件仍然缺失。它也可能硬链接源文件：编辑一个 inode 再替换另一个时，否则可能得到入口文件是新的、某个被导入模块仍是旧的包。因此每次 add 之后，安装器会把该包声明的 `files` 条目替换为当前 worktree 的独立副本。它不触碰已安装的 `data/`，也不触碰 pnpm 管理的嵌套 `node_modules`，并在删除任何过期包目录前校验解析到的包目标仍位于所选 profile 内。待恢复数据保存在 `<DSH_HOME>/backups/pmp-dsh-tavern/pending-refresh-<profile>/`；刷新成功后删除。若 remove/add 失败，错误信息会打印保留路径；下一次运行安装器会修复中断的依赖注册并自动恢复该数据。恢复尚未完成时，不要删除这个 pending 目录。省略 `--store-dir` 时，更新器读取该 profile 的 `node_modules/.modules.yaml` 中已记录的 store，以避免对使用不同 store 根创建的 profile 触发 pnpm 的 `ERR_PNPM_UNEXPECTED_STORE`。

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

在调用 `dsh plugin ... remove` 之前，卸载器会把已安装的 `data/` 目录复制到：

```text
<DSH_HOME>/backups/pmp-dsh-tavern/<timestamp>/
```

这一点很重要，因为 dsh/pnpm 会删除已安装的插件目录，而当前版本的完整插件本地 `data/` 树也在那里：预设、归一化角色卡、从 PNG 导入时留在 `character-artifacts/` 的封面图、`world-books/` 下的独立世界书、`users/` 下的三字段用户资源、`tavern-traces.json` 中的有界 Trace 元数据，以及 per-session 资源选择。备份时复制整个目录；只复制 `presets/` 会丢失其他资源、审计元数据和绑定。同一棵树里还有 `state.json`、`character-state.json`、`user-world-book-bindings.json`、`resource-world-book-bindings.json`、`session-templates.json`、`chrome.json`、`play-workspace.json`、`import-context-bindings.json`、`ui-settings.json`（语言、外层 UI 缩放、绑卡跟随 RP）、`conversation-settings.json`（魔丸 RP 正文与消息动作缩放），以及可选的 `rp-policy.json`。

`play-workspace.json` 只是指针。所选 DSH RP 工作区才拥有真正的 `catalog.json`、各周目 `timeline.json`、显示正则文档和导入上下文文件。若周目必须可恢复，请同时备份该工作区；ST JSONL 导出只保留当前选中的线性对话和已知 swipe，不能保存完整的 Tavern 分支拓扑。

选择其他备份目录，或明确跳过备份：

```text
node scripts/uninstall.mjs --backup-dir /absolute/backup/path
node scripts/uninstall.mjs --no-backup
```

`--no-backup` 会在 dsh 移除软件包时永久丢弃全部插件本地 Tavern 资源和 session 绑定。它不会删除当初用于导入的外部 ST 源文件。明确配置在安装包之外的 `storageDir` 也不会被本脚本删除。

卸载同样支持这些常用参数：`--profile`、`--dsh-home`、`--store-dir` 和 `--dry-run`。完整命令摘要见 `--help`。
