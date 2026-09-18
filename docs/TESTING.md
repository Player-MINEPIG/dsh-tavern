# 开发验证

[English](TESTING_en.md)

本文说明如何验证当前实现，不记录某次发布的验收结果。先按改动范围选择检查，再为受影响的 DSH 接口补充集成证据。

## 环境与命令

Tavern 的独立测试要求 Node.js `>=20`；目标 DSH `0.1.5-rc.1` 要求 Node.js `^22.19.0 || >=24.0.0`。运行真实 DSH 模块或 Host 时必须满足后者，并核实实际解析的核心包版本。CI 的独立测试矩阵不代表所有 DSH 运行时均受支持。

在仓库根目录安装依赖后运行以下命令，定义以 [package.json](../package.json) 为准。

| 改动范围 | 检查 |
| --- | --- |
| 仅文档 | 检查内容、中英文对应、相对链接与 diff，无需构建 |
| 局部逻辑 | `node --test test/<相关文件>.test.mjs` |
| 跨模块行为 | `npm test` |
| 客户端 bundle | 相关测试及 `npm run build`；`dist/client.js` 是生成文件 |
| 完整构建与测试 | `npm run check` |
| 协议、安装、打包或发布准备 | `npm run verify:2.0`，并补充受影响的运行时检查 |

`npm test` 使用 Node 测试运行器发现测试；`check` 先构建再运行测试。`verify:2.0` 是保留名称，运行 [脚本列出的测试组](../scripts/verify-2.0.mjs)，随后构建并执行 `npm pack --dry-run`。它不是完整测试集，也不会自动启动 Web Host 或浏览器。

## 启用官方模块集成测试

两个变量指向可通过 Node 模块解析找到目标 DSH 依赖的目录，测试以该目录下的 `package.json` 为解析基准；它们不是 `DSH_HOME` 或 RP 工作区。

| 变量 | 所需模块与检查范围 |
| --- | --- |
| `DSH_TAVERN_COMPAT_ROOT` | session format/catalog、迁移包及 session controller；验证真实 codec、临时日志迁移与官方错误映射 |
| `DSH_TAVERN_PROMPT_COMPAT_ROOT` | Cordis、SystemPrompt、Session、AgentLoop、LLM 等 Host 模块；验证官方装配、请求观察、事件引用和失败归属 |

安装版 DSH 通常可以使用同一个根。源码检出中，两组依赖可能位于不同目录；测试不会自动搜索 `apps/cli` 或其他工作区。以下为 POSIX shell 示例，将占位路径替换为实际依赖目录；PowerShell 使用 `$env:变量名` 设置同名变量。

```sh
export DSH_TAVERN_COMPAT_ROOT="/path/to/dsh-dependencies"
export DSH_TAVERN_PROMPT_COMPAT_ROOT="/path/to/dsh-host-dependencies"
npm run check
npm run verify:2.0
```

定向检查可运行：

```sh
node --test test/coordinate-migration-integration.test.mjs test/session-coordinates.test.mjs
node --test test/trace-v3-host.test.mjs test/trace-failures-host.test.mjs
```

未设置对应变量时，这些测试中的官方模块检查会跳过；设置了错误的解析根则会失败。它们使用临时数据和真实 DSH 模块，AgentLoop 测试使用合成模型适配器，不连接真实提供方，也不验证 Web Remote、浏览器或真实第三方插件。

另外，`DSH_TAVERN_ACCEPTANCE_FIXTURE` 只启用 [特定外部预设夹具检查](../test/acceptance-fixture.test.mjs)，不是任意角色卡的通用验收入口。变量未设置或文件不存在时会跳过；文件内容不符合断言则会失败。平台不允许创建 symlink/junction 时，相关路径检查也可能跳过。阅读测试输出中的跳过原因，不将跳过记为通过。

## Host 与浏览器检查

使用已获授权的独立测试 profile、工作区副本和目标 DSH 版本，安装步骤见 [安装文档](INSTALLATION.md)。更新运行中 Host 的后端文件后，重启 Host 才会加载新代码。

以下 opt-in smoke 只读取 v2 `GET /chrome` 和 `GET /workspace`，确认运行中 Host 返回的模式与工作区信息；不覆盖写操作、Remote 传输或界面生命周期。将 URL 替换为测试 Host 地址。

```sh
DSH_TAVERN_PLAY_LIVE=1 \
DSH_TAVERN_PLAY_LIVE_URL="http://127.0.0.1:<port>" \
node --test test/play-sessions.test.mjs
```

按受影响的行为选择交互检查：

- **RP 与界面生命周期：** 在原生/RP 模式、工作区和角色间切换，确认消息不串会话；检查开场边界、流式到终态的控件恢复，以及改动涉及的 swipe/分支流程。缺失旧日志应显示问题，不能阻断健康周目或新建周目。
- **Trace：** 对照官方请求核查当次配置、世界书决策、Loader 段落顺序、正文及来源。重启后再读取旧记录；在测试副本中移除官方日志时，正文应明确不可用。失败记录的来源仍是官方事件，RP 不因此新增失败助手消息。接口合同见 [Prompt API v3](PROMPT_API_V3.md)。
- **富文本与诊断：** 检查静态 HTML/CSS 的样式隔离、显示正则和脚本过滤；MVU 与 JavaScript 动态 HTML 不属于已实现能力。检查故障入口、摘要关闭、重新检查及问题恢复的状态一致性。Trace 正文应按文本展示。

涉及写入并发、卸载或坐标迁移时，在测试副本中验证冲突及恢复路径；参阅 [API](API.md) 和 [迁移指南](DSH_0.1.5_MIGRATION.md)。真实提供方的超时/重试、真实第三方联调及平台差异须分别验证，不能从合成故障或其他平台的结果推断。

记录证据时注明源码版本、Node/DSH 版本、启用的检查、跳过项及可复现步骤，并区分自动测试、真实 Host、浏览器和外部联调覆盖。诊断报告与 Trace 元数据也可能包含私密标识和内容，公开问题报告前应检查并删去敏感信息。
