# 开发验证

[English](TESTING_en.md)

本文说明如何验证当前实现，不记录某次发布的验收结果。先按改动范围选择检查，再为受影响的 DSH 接口补充集成证据。

<a id="backend-compatibility"></a>
## 2.5.1 兼容范围

Tavern 2.5.1 目标为官方 [DSH 0.2.0-rc.2](https://github.com/deepseek-ai/deepseek-harness/releases/tag/dsh-v0.2.0-rc.2)（`639ed015397290b3745d163aafe02ffee4aa3f84`）。必需运行时 peer 为 Cordis `4.0.4` 与 DSH crypto `0.2.0-rc.2`，准入无需版本例外。其他预发布运行时不自动受支持。

后端范围包括插件准入、公开 Session/Workspace controller、提示词装配与参数回退、V4 历史与旧引用迁移、Trace 及[操作日志合同](OPERATION_LOGS.md)。已有 V4 引用不需再次转换；迁移格式库白名单与运行时支持范围分开，见[迁移说明](DSH_0.1.7_MIGRATION.md)。

设置下文两个 compatibility-root 变量运行官方模块测试，包括 `test/plugin-runtime-compatibility.test.mjs`。在独立临时 DSH_HOME 安装并启动目标 Web Host，检查创建、输入接受、完整历史与 Trace 读取，以及带 queued/steering 原会话输入的历史分支。子会话队列必须为空，分支操作不改变原会话，子会话下一次模型请求不得含旧队列输入。DSH 正常关闭会以持久 canceled splice 取消剩余输入，不应将原生关闭行为误判为 Tavern 分支改写。在真实创建／分支后注入工作区挂接失败，验证 HTTP 409、恰好一个携带新身份的创建检查点与关联终态失败。重启 Host 后检查冷读历史／Trace、journal 记录保留和 runId 更新。源码、运行时及合成提供方证据放在 `.local/`。

前端、后端与操作日志需一并验证：运行显示、富文本与日志面板浏览器夹具，再在整合后的目标 Web／桌面 Host 检查 RP／原生切换、头像与气泡设置、重启后的请求令牌刷新、错误关联与日志查询导出。面板夹具不能独自证明完整 Host UI 验收；真实提供方与第三方覆盖另行记录。

## 环境与命令

Tavern 的独立测试要求 Node.js `>=20`；目标 DSH `0.2.0-rc.2` 要求 Node.js `^22.19.0 || >=24.0.0`。运行真实 DSH 模块或 Host 时必须满足后者，并核实实际解析的核心包版本。CI 的独立测试矩阵不代表所有 DSH 运行时均受支持。

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
| 架构、迁移、安全文档与图 | 核对目标版本、迁移白名单、安全维护线和图源 revision；行为说明仅在对应设计、数据格式或安全边界变化时改写 |
| Git tag 与 GitHub Release | 正式发布时创建对应 tag 和简短发布说明，说明修复、目标 DSH、升级方式及已知限制 |

发布前逐项核对中英文 README 的版本说明与更新内容、安装命令、SECURITY 维护线、迁移工具支持列表、API 影响说明，以及图源与生成页面的版本和源码 revision。旧版本号只应出现在变更历史或仍支持的迁移说明中。推送后从 GitHub 默认分支和目标 tag 重新读取中英文 README，确认其内容与验收提交一致，再发布 Release。

每次验收的日志、截图、测试数量和发布说明草稿放在 Git 忽略的 `.local/`；PR 摘要给出相关证据。`docs/` 保留可复用的方法，不累积逐次发布的验收记录。中英文对应文件在同一变更中同步。

发布前运行 `npm run verify:2.0` 并核对包内容；受影响的 API、Host 和 UI 仍按本页要求验证。后续仅修改文档或版本元数据时，可沿用同一实现和目标 DSH 的运行时证据，注明对应提交，不必重复无关的交互检查。适配新版 DSH 时须重新验证兼容性，不能沿用旧 Host 的结果宣称支持。

## 启用官方模块集成测试

两个变量指向可通过 Node 模块解析找到目标 DSH 依赖的目录，测试以该目录下的 `package.json` 为解析基准；它们不是 `DSH_HOME` 或 RP 工作区。

| 变量 | 所需模块与检查范围 |
| --- | --- |
| `DSH_TAVERN_COMPAT_ROOT` | session format/catalog、迁移包及 session controller；验证真实 codec、临时日志迁移与官方错误映射 |
| `DSH_TAVERN_PROMPT_COMPAT_ROOT` | Cordis、AppBoot、SystemPrompt、Session、AgentLoop、LLM 等 Host 模块；验证官方插件版本准入、装配、请求观察、事件引用和失败归属 |

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
node --test test/trace-v3-host.test.mjs test/trace-failures-host.test.mjs test/preset-fallback-host.test.mjs test/plugin-runtime-compatibility.test.mjs
node --test test/dsh017-host-migration.test.mjs test/dsh017-client-sessions.test.mjs test/resource-capabilities.test.mjs
```

未设置对应变量时，这些测试中的官方模块检查会跳过；设置了错误的解析根则会失败。它们使用临时数据和真实 DSH 模块，AgentLoop 测试使用合成模型适配器，不连接真实提供方，也不验证 Web Remote、浏览器或真实第三方插件。

另外，`DSH_TAVERN_ACCEPTANCE_FIXTURE` 只启用 [特定外部预设夹具检查](../test/acceptance-fixture.test.mjs)，不是任意角色卡的通用验收入口。变量未设置或文件不存在时会跳过；文件内容不符合断言则会失败。平台不允许创建 symlink/junction 时，相关路径检查也可能跳过。阅读测试输出中的跳过原因，不将跳过记为通过。

针对当前兼容边界，还需在隔离 Host 中检查：五类资源各自的创建、导入、导出、编辑；模板未保存时 Esc/切换面板保护；同一时刻保留多个会话，分别切换 RP、原生和 Trace；临时读失败恢复后保持有效绑定。采样测试使用显式参数拒绝、已输出内容、取消、鉴权错误，核对有限重试及 Trace 的 requested/effective/fallbacks。迁移应覆盖 V3 中断插入和 child catalog、旧格式链、备份冲突与重复执行。

## Host 与浏览器检查

使用已获授权的独立测试 profile、工作区副本和目标 DSH 版本，安装步骤见 [安装文档](INSTALLATION.md)。更新运行中 Host 的后端文件后，重启 Host 才会加载新代码。

以下 opt-in smoke 只读取 v2 `GET /chrome` 和 `GET /workspace`，确认运行中 Host 返回的模式与工作区信息；不覆盖写操作、Remote 传输或界面生命周期。将 URL 替换为测试 Host 地址。

```sh
DSH_TAVERN_PLAY_LIVE=1 \
DSH_TAVERN_PLAY_LIVE_URL="http://127.0.0.1:<port>" \
node --test test/play-sessions.test.mjs
```

按受影响的行为选择交互检查：

- **rc.1 升级：** 用 alpha.1、alpha.2、rc.1 官方格式库分别运行离线迁移测试，确认未验证版本被拒绝。在 rc.1 上检查插件安装与启动的版本校验，无需授予版本例外。检查长历史分页、待发送状态、首轮／后续 swipe 流式与中断，以及工具准备、执行、结束期间 RP／原生切换和终态回复去重。保留页面和输入草稿重启测试 Host，确认恢复连接后仍能接收回复。
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

## 持久操作日志回归

`node --test test/operation-contract.test.mjs test/operation-journal.test.mjs test/operation-log-client.test.mjs` 使用临时目录验证字段白名单、轮转容量、游标失效、并发写入、第二写者拒绝、进程退出后的恢复、损坏尾行、符号链接拒绝和日志故障隔离。`node scripts/verify-operation-logs-browser.mjs` 在 headless Chrome 的真实 React 中验证按需读取、文本展示、分页、当前页导出、旧 Host 404、异步响应隔离与降级提示；可用 `CHROME_PATH` 指定浏览器。它不替代完整 Host 页面交互验收。

在临时目标 Host 中先读取 `GET /pmp-dsh-tavern/api/v2/operation-logs`，执行成功与失败的 workspace/session 变更，核对响应 operationId 与日志终态、错误码一致，查询和导出不产生日志，且无测试正文或路径泄漏。正常停止并重启 Host，核对旧记录可查、runId 更换、plugin.stop 保留。再在现有诊断面板中查看、筛选、翻页和导出；关闭面板、切换或改变筛选时，旧请求不得覆盖新视图。检查存储降级不能阻断业务，旧 Host 不支持日志时当前问题诊断仍可用。

事件语义与升级规则见 [操作日志合同](OPERATION_LOGS.md)。合同测试还验证全部已声明变更的统一失败关联、Host 创建后后续失败的资源 ID、分支队列清理失败、创建检查点去重和旧／新事件重启混读。受监控 API 完成只表示处理函数返回；user-message 为 accepted，不证明模型完成或响应已送达客户端。

## 显示功能回归

开场白显示正则运行 `node --test test/play-greeting-render.test.mjs test/play-chat-regex.test.mjs test/play-export.test.mjs` 和 `TAVERN_BROWSER_FIXTURE=./fixtures/greeting-browser.js node scripts/verify-rich-text-browser.mjs`。检查变量折叠、状态面板、全局／预设／角色规则顺序与过滤、深度、备选切换、空结果回退、原文不变，以及 HTML 显示与 JSONL 原文导出的区别。浏览器夹具覆盖 RP 消息组件及 opening dock 使用的富文本组件，完整 Host 中仍需核对原生／RP 切换与真实卡片。

公式回归运行 `node --test test/play-math.test.mjs test/play-rich-text.test.mjs test/play-export.test.mjs`，以及 `TAVERN_BROWSER_FIXTURE=./fixtures/math-browser.js node scripts/verify-rich-text-browser.mjs`。检查四种分隔符、原生 MathML 分数/矩阵布局、金额与转义、强调/表格/折叠混用、HTML 属性和代码保留、样式隔离、宽公式滚动、流式闭合与历史 DOM 保留、错误回退、宏隔离、恶意 TeX/MathML 清洗和离线 HTML 导出。此夹具使用实际消息组件但不替代完整 DSH Host 验收；在目标 Web/桌面 Host 继续核对 RP 正文、开场白、显示编辑与原生切换，旧浏览器的 MathML 支持另行验证。

执行 `node --test test/presentation.test.mjs test/api-fetch.test.mjs test/api-security.test.mjs` 与现有完整检查。有 Chrome 时分别执行 `node scripts/verify-rich-text-browser.mjs` 和 `TAVERN_BROWSER_FIXTURE=./fixtures/presentation-browser.js node scripts/verify-rich-text-browser.mjs`。后者检查真实 DOM 更新、建议消息显式确认、未变化卡片状态、生命周期销毁、流式禁止执行、配额、父页面/网络接口拒绝、净化、头像和气泡。

在隔离的目标 Host 上传并保存用户头像，确认根会话绑定的默认头像，修改单条及本周目全部头像，刷新并对照其他周目和源资源。预览/应用/导入/导出样式并拒绝非法版本。用[计数器示例](examples/interactive-counter.html)检查脚本开关，然后验证原生/RP 切换、流式、分支及桌面写入。官方桌面发行包需单独验收：使用其未改动转发模块的 Electron 验证壳只能建立协议行为证据，不能代表整款应用验收。使用合成资源与模型响应得到可复现结果，真实提供方和角色卡另行验收。运行记录放在被忽略的 `.local/`。

外部渲染与统一设置使用 `node --test test/rendering-sources.test.mjs` 和 `TAVERN_WORKER_FIXTURE=scripts/fixtures/rendering-browser.js node scripts/verify-card-worker-browser.mjs`。合成源码覆盖两种 Helper 格式、无语言 body 围栏、逐内容授权、相对模块、嵌套依赖阻断、撤销/禁用、重复渲染、切换中取消、只读变量作用域与统一设置草稿保护。没有下载或执行未知代码；实际第三方框架兼容性不由这些夹具建立。完整 Host 中继续核对来源绑定与原生/RP切换。

Worker 框架验证使用 `node scripts/verify-card-worker-browser.mjs`，`TAVERN_FRAMEWORK_VENDOR_DIR` 指向本地固定官方库（文件名及必需 SHA-256 见验证器）；测试不下载依赖。隔离临时浏览器通过真实时间 CDP 等待，覆盖 React+JSX/Vue/jQuery 事件、状态、撤销、scope 重挂、传递依赖逐 owner 授权和预算。同一验证器设置 `TAVERN_WORKER_FIXTURE=scripts/fixtures/rendering-browser.js` 可跑统一设置回归。`node --test test/card-worker-lifecycle.test.mjs` 验证构造/传输/定时器失败清理。夹具不代表任意私有卡已兼容，也不建立进程峰值内存上限。
