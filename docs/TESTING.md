# 开发验证

[English](TESTING_en.md)

本文说明如何验证当前实现，不记录某次发布的验收结果。先按改动范围选择检查，再为受影响的 DSH 接口补充集成证据。

## 环境与命令

Tavern 的独立测试要求 Node.js `>=20`；目标 DSH `0.1.7-alpha.1` 要求 Node.js `^22.19.0 || >=24.0.0`。运行真实 DSH 模块或 Host 时必须满足后者，并核实实际解析的核心包版本。CI 的独立测试矩阵不代表所有 DSH 运行时均受支持。

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

<a id="patch-release-documents"></a>
## 补丁发布的文档同步

兼容性 bug 修复可使用补丁版本；单纯纠正文档不必升版。准备发布时，应一次性完成最终版本、变更记录、中英文文档和安装示例，交付审核通过即可直接发布的候选。候选文档不保留“准备发布”“未发布”或旧版本安装占位；待审核、待发布状态记录在交接说明及 `.local/`。审核发现问题后再修改或回滚候选。包版本、Git tag、GitHub Release 和固定版本安装示例应一致，已发布的 tag 不得移动或覆盖。每次 push 前均需获得覆盖本次改动的明确授权；创建 tag 和 Release 也需授权。

| 文件或发布内容 | 何时更新 |
| --- | --- |
| 根目录 `package.json`、`package-lock.json` | 发布准备时同步版本；只改文档无需升版 |
| 根目录 [CHANGELOG.md](../CHANGELOG.md) | 候选中记录最终版本、修复、用户影响及兼容边界；不虚构发布日期 |
| 中英文 README、INSTALLATION | 候选中同步最终版本，将安装及源码检出示例切换到目标 tag，注明目标 DSH 与迁移要求 |
| 中英文 API、USAGE | 接口行为、错误码或用户操作结果发生变化时更新；内部修复且合同不变时无需修改 |
| 中英文 TESTING | 新增需要长期保留的回归场景或验证方法时更新 |
| 架构、迁移、安全文档与图 | 对应设计、数据格式或安全边界实际变化时更新，无需因补丁升版重写 |
| Git tag 与 GitHub Release | 正式发布时创建对应 tag 和简短发布说明，说明修复、目标 DSH、升级方式及已知限制 |

每次验收的日志、截图、测试数量和发布说明草稿放在 Git 忽略的 `.local/`；PR 摘要给出相关证据。`docs/` 保留可复用的方法，不累积逐次发布的验收记录。中英文对应文件在同一变更中同步。

发布前运行 `npm run verify:2.0` 并核对包内容；受影响的 API、Host 和 UI 仍按本页要求验证。后续仅修改文档或版本元数据时，可沿用同一实现和目标 DSH 的运行时证据，注明对应提交，不必重复无关的交互检查。适配新版 DSH 时须重新验证兼容性，不能沿用旧 Host 的结果宣称支持。

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
node --test test/trace-v3-host.test.mjs test/trace-failures-host.test.mjs test/preset-fallback-host.test.mjs
node --test test/dsh017-host-migration.test.mjs test/dsh017-client-sessions.test.mjs test/resource-capabilities.test.mjs
node --test test/standalone-client-boundary.test.mjs
```

未设置对应变量时，这些测试中的官方模块检查会跳过；设置了错误的解析根则会失败。它们使用临时数据和真实 DSH 模块，AgentLoop 测试使用合成模型适配器，不连接真实提供方，也不验证 Web Remote、浏览器或真实第三方插件。

另外，`DSH_TAVERN_ACCEPTANCE_FIXTURE` 只启用 [特定外部预设夹具检查](../test/acceptance-fixture.test.mjs)，不是任意角色卡的通用验收入口。变量未设置或文件不存在时会跳过；文件内容不符合断言则会失败。平台不允许创建 symlink/junction 时，相关路径检查也可能跳过。阅读测试输出中的跳过原因，不将跳过记为通过。

针对当前兼容边界，还需在隔离 Host 中检查：五类资源各自的创建、导入、导出、编辑；模板未保存时 Esc/切换面板保护；同一时刻保留多个会话，分别切换 RP、原生和 Trace；临时读失败恢复后保持有效绑定。采样测试使用显式参数拒绝、已输出内容、取消、鉴权错误，核对有限重试及 Trace 的 requested/effective/fallbacks。迁移应覆盖 V3 中断插入和 child catalog、旧格式链、备份冲突与重复执行。独立前端边界测试只证明资源组件可脱离 DSH bootstrap 打包和初始化，不代表完整独立会话 UI 已实现。

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
- **生成期间的历史操作：** 普通生成与非首轮 swipe 期间，检查所有历史回复的变体切换、swipe、分支和回退禁用及提示；复制、显示文本保存与恢复仍可用，修改即时出现在等待中的 RP 上下文，终态提交不覆盖修改。切换到另一周目应可操作；完成、失败及中断后路径按钮恢复。
- **Swipe 等待与中断：** 用合成慢流分别覆盖首轮和非首轮 swipe；创建新 session 后立刻检查 RP/原生“对话”指向同一会话，再次点击周目仍应回到该会话。验证此前上下文不重复、新回复逐段出现、原生停止按钮可用；分别在首个片段前和输出片段后中断，检查错误返回入口或真实持久变体收敛，原有变体不丢失。
- **历史分叉与待处理输入：** 在临时 Host 中完成两轮，用公开 inbox 命令加入 queued/steering 输入而不唤醒 Agent。原生 fork 可作为对照；通过 Tavern branch API、同周目回退、新周目分支和非首轮 swipe 分别创建子会话。核对实际模型请求不含旧输入、swipe 不重复发送用户消息、子 inbox 为空、原会话队列与继承历史不变；重启后再次发送也不能恢复旧队列。队列清理失败必须返回明确错误，不能继续复制上下文或提交 timeline。
- **周目归档：** 归档后确认默认列表隐藏该周目，其成员不会变成游离或普通会话；刷新及重启后状态应保持。从归档箱查看不会自动恢复，恢复后编号、名称、分支与绑定应保留。归档最新空周目后新建应使用下一个编号；与活跃周目共享的会话仍应可见。对照归档前后的时间线、选择记录和 DSH 日志，确认归档操作仅修改 catalog 中的归档标记。
- **Trace：** 对照官方请求核查当次配置、世界书决策、Loader 段落顺序、正文及来源。重启后再读取旧记录；在测试副本中移除官方日志时，正文应明确不可用。失败记录的来源仍是官方事件，RP 不因此新增失败助手消息。接口合同见 [Prompt API v3](PROMPT_API_V3.md)。
- **流式交互：** 在有多条富文本历史消息的 RP 会话中，生成期间展开、关闭和拖动悬浮球；历史消息不应随每个片段重新解析或清洗，已展开的历史折叠块应保持状态。`node scripts/verify-rich-text-browser.mjs` 用真实 React 挂载验证连续更新仅清洗变化的消息、样式隔离和终态替换；合成检查不代表真实模型流式链路已验收。
- **富文本与诊断：** 检查静态 HTML/CSS 的样式隔离、显示正则和脚本过滤；MVU 与 JavaScript 动态 HTML 不属于已实现能力。检查故障入口、摘要关闭、重新检查及问题恢复的状态一致性。Trace 正文应按文本展示。

涉及写入并发、卸载或坐标迁移时，在测试副本中验证冲突及恢复路径；参阅 [API](API.md) 和 [迁移指南](DSH_0.1.7_MIGRATION.md)。真实提供方的超时/重试、真实第三方联调及平台差异须分别验证，不能从合成故障或其他平台的结果推断。

记录证据时注明源码版本、Node/DSH 版本、启用的检查、跳过项及可复现步骤，并区分自动测试、真实 Host、浏览器和外部联调覆盖。诊断报告与 Trace 元数据也可能包含私密标识和内容，公开问题报告前应检查并删去敏感信息。
