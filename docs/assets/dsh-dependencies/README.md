# DSH 原生依赖与升级影响

[English](README_en.md) · [交互架构图](architecture.zh-CN.html) · [可编辑 JSON](architecture.zh-CN.json) · [总体架构](../../ARCHITECTURE.md)

本图描述 Tavern **2.4.3** checkout 对 DSH **0.1.7-rc.1**、Cordis **4.0.4** 与 `dsh-util-crypto` **0.1.7-rc.1** 的消费端合同，是依赖及语义耦合地图，不代表发布状态或完整运行时验收。图中 SRC 保留已验证的本地源码标签并禁用网络链接；矩阵中的 Tavern 源码使用仓库相对链接。官方依据固定为[目标 tag](https://github.com/deepseek-ai/deepseek-harness/tree/dsh-v0.1.7-rc.1)，尤其是 [Agent loop](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.7-rc.1/packages/core/agent-loop/src/agent.ts) 与 [V3→V4 迁移规范](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.7-rc.1/packages/session/session-format-v3-to-v4/README.md)。不把尚未发布的 Tavern commit 包装成可用 GitHub 链接。

将 HTML 下载后用浏览器打开，可查看源码来源、搜索节点、切换明暗主题和导出。GitHub 文件页不直接运行交互 HTML。图与中英文源文件集中在此目录；现有 `docs/assets` 打包规则会包含它们。

## 如何读图

主路径是 **Tavern 浏览器 → Tavern HTTP/loader → DSH 执行与控制器**。箭头表示标注的调用、复用或读取关系，不表示所有事件流向，也不是完整模块导入图。周目与 Trace 通过 loader/Host port 读取 DSH；图中“经 API 读取投影”并非浏览器直读磁盘。工具与沙箱节点表示 DSH 能力，RP 约束策略仍由 Tavern loader 持有。

节点的高、中、低是维护判断，不是故障概率或代码量百分比。颜色仅区分组件类别，不代表风险。公开接口也可能存在高度时序和数据耦合。

| 级别 | 判断依据 | 升级时的含义 |
| --- | --- | --- |
| 高 | 直接调用 DSH 服务、消费事件/store 结构，或依赖执行顺序、历史坐标与安全语义 | 优先对照上游变化，通常需要适配和真实 Host/browser 检查 |
| 中 | 通过 Tavern port 或普通对象隔离，但仍解释 DSH 消息与坐标 | 接口不变也可能要修改投影、校验或数据迁移 |
| 低 | 自有资源、配置和持久化；DSH 集成由组合根承担 | 通常保留业务模型，只检查适配输入输出 |
| 无直接依赖 | 纯解析、归一化、宏与匹配逻辑，不读取 DSH 运行时 | 可独立回归；端到端效果仍受 loader 输入与装配影响 |

## 依赖矩阵

下表把直接依赖与语义依赖分开；“修改入口”是源码定位，最终修改范围取决于具体上游 diff。

| DSH 原生组件 / 合同 | Tavern 消费方与依赖程度 | 破坏性变化的影响 / 修改入口 |
| --- | --- | --- |
| Cordis 插件、服务注入、effect/provider 释放 | Host/client 组合根：高；安装体系：高 | 服务名、required/optional 注入、卸载顺序变化影响加载、路由、SSE 和 slot 清理。[loader](../../../packages/tavern-loader/src/index.js)、[client](../../../packages/client/src/index.js)、[清单](../../../package.json)、[bundle patch](../../../cordis.patch.yml) |
| `webServer.register()` | loader 的 v1/v2/v3 HTTP 挂载：高；资源 handler 直接依赖低 | Node request/response、route disposal、挂载方式变化影响全部 Tavern API。Host/Origin/loopback 检查由 Tavern 自己实现，不能假定 DSH Remote 鉴权代管。[挂载](../../../packages/tavern-loader/src/index.js)、[安全包装](../../../packages/tavern-loader/src/api-security.js) |
| `systemPrompt.section()`、`system-prompt/assemble`、`system-prompt/change` | loader 装配：高 | `sections/contexts`、中间件 `next()` 时序与后续变换变化，影响 append/replace、具名段落、导入上下文及 Trace 对齐。[装配入口](../../../packages/tavern-loader/src/index.js)、[profile loader](../../../packages/tavern-loader/src/profile-loader.js) |
| Agent hooks、`agent/request`、`llm/stream` | 请求配置、RP 边界与审计捕获：高 | 串行 `agent/created` 在首次使用前初始化选择、pending input 与 RP。`agent/pre-step`、`agent/error`、`agent/request-error` 以及先准备请求、后接纳消息的时序必须核对；公开参数预检与有界重试须保持 attempt 身份。[loader](../../../packages/tavern-loader/src/index.js)、[assembly recorder](../../../packages/tavern-trace/src/assembly-recorder.js) |
| `session/event`、`agent/inbox/spliced`、`ownEvents()`、`deriveMessages()` | `PendingInputProjection` 与 import claim：高 | splice 的 target/start/removedCount/inserted/outcome、先持久后通知的顺序、自有事件与继承前缀边界变化，影响首次世界书激活、去重与导入消费。不能只核对事件名称。[pending projection](../../../packages/tavern-loader/src/pending-input-projection.js)、[import runtime](../../../packages/tavern-loader/src/import-context-runtime.js)、[事件适配](../../../packages/session-events.js) |
| `sessionController`、Agent Inbox | create/fork/prompt/history Host port：高 | `create/rename/fork/resolveAgent/prompt/inspect/page` 的参数、返回、错误、分页与取消合同都要核对。Host adapter 在 fork 后要求新 Agent idle，读取 `inbox.nextTurn/nextStep` 并以公开 `inbox.clear()` 清除继承输入；这是直接依赖，区别于不读 Inbox 的 pending projection。失败可发生在 child 已创建之后。[play-host](../../../packages/tavern-loader/src/play-host.js) |
| Session header、事件 schema、逻辑 `seq`、format version | 周目/导入：中至高；Trace：高语义依赖 | V4 `parentSession`、`snapshotEvents()`、producer-owned source、tool-role message 和迁移重排 seq 决定 fork 截点、swipe、导出与审计；V4 外部坐标必须显式带匹配版本，Trace 正文/错误引用在冷读时验证。没有导入 DSH 包不代表独立。[coordinates](../../../packages/play/src/session-coordinates.js)、[timeline](../../../packages/play/src/timeline.js)、[Trace body reader](../../../packages/tavern-trace/src/body-references.js)、[选择继承](../../../packages/tavern-loader/src/session-policy.js) |
| `workspaceController`、`directoryPickerController` | workspace/目录/session 归属 Host port：高；自有文件模型：中 | `create`、`insertSessionBefore`、`createDirectory` 返回形状和归属行为影响新周目与恢复。Tavern 的路径监狱、catalog/timeline revision/CAS 仍由自身负责。[play-host](../../../packages/tavern-loader/src/play-host.js)、[workspace](../../../packages/play/src/workspace.js)、[paths](../../../packages/play/src/paths.js) |
| `tools.guard()`、`commands.register()`、`sandbox/mode`、`Agent.cancel()` | RP 安全叠加：高 | guard payload、工具名称/参数、`sandbox_permissions`、取消的 `keepInbox`、父会话链与沙箱枚举变化都需重新验证。RP 会通过公开 `Session.append('sandbox/mode', …)` 写原生事件；“不伪造对话历史”不等于“绝不 append”。当前名称集合不能自动覆盖未来新增工具。[rp-mode](../../../packages/tavern-loader/src/rp-mode.js)、[路径限制](../../../packages/tavern-loader/src/rp-secure-path.js) |
| `shell.overlay`、`sidebar.workspaces`、`conversation.view`、`conversation.input.dock`、`conversation.session` | Tavern shell、侧栏、RP、Trace、默认 view adapter：高 | slot owner props、优先级、store handle、注册/释放时机变化影响挂载与切换。RP 从 `slots.entries('conversation.session')` 复用 Conversation store，全局注册逐 session owner 解析；默认选择按 session/工作区/周目 binding 隔离，保留明确的 Chat/Trace。adapter 持续挂载处理 retained owner，缓存按周目与 Session 隔离。[occupancy](../../../packages/client/src/play/occupancy.js)、[view-default](../../../packages/client/src/play/view-default.js) |
| `useChat`、`useSession`、`useSessions`、`useWorkspaces`、`conversationPhase` | 流式 RP/Trace、错误提示、侧栏与诊断：高 | 核对 `legacy.nodes/partial`、`timeline`、running/blank/错误字段、mirror phase/byId/items/archivedSessionIds 与 `retainedBy.mainView`，不读取已移除的 `sessions.current`。Chat、Session、Conversation 各有所有权；Tavern refresh event 不能替代原生订阅。[entry](../../../packages/client/src/entry.js)、[chat](../../../packages/client/src/play/chat.js)、[chat-failure](../../../packages/client/src/play/chat-failure.js)、[sidebar](../../../packages/client/src/play/sidebar.js)、[Trace view](../../../packages/tavern-trace/src/client.js) |
| `uiWorkspace.openSession()`、`uiWorkspace.connectWorkspace()`、原生 composer/scrollport、CSS tokens | 导航/干净会话：高；展示样式：中 | 导航归 `uiWorkspace.openSession()`，主视图选择来自 `retainedBy.mainView`；还需检查普通 blank session 与 composer/滚动容器合同；`--dsw-*`、`--dsh-composer-card-max-width` 变化主要影响显示。未接管原生发送输入框。[client root](../../../packages/client/src/index.js)、[dock](../../../packages/client/src/play/notice.js)、[chat](../../../packages/client/src/play/chat.js) |
| `dsh-util-crypto`、client 包根导出、React 外部模块 | 包解析与浏览器 loader：高；UUID 用途本身低 | 目标依赖为 Cordis 4.0.4 与 crypto 0.1.7-rc.1。清单声明不等于全部都在源码中直接 import；client entry 直接导入 `conversationPhase`，其余大量能力由注入/slot props 获得。构建将 `react` 与 `@deepseek-ai/*` 外部化，不把 Host 实现打入 client bundle。[package](../../../package.json)、[build](../../../build.mjs)、[entry](../../../packages/client/src/entry.js)、[play-host](../../../packages/tavern-loader/src/play-host.js) |
| DSH CLI/profile 布局、`dshHomePath()`、官方格式迁移包 | 安装/迁移运维路径：高；日常资源 CRUD 不直接依赖 codec | 安装脚本依赖 profile 及包目录布局；坐标迁移显式检查格式库 `0.1.7-alpha.1`、`0.1.7-alpha.2` 或 `0.1.7-rc.1`，使用官方 V0→V1→V2→V3→V4 codec/catalog，不是通用未来迁移器。发布要求显式子日志证据、精确后继验证、全部文件先备份与幂等格式标记；V3 之前的 header-body Trace 转换拒绝，不提供回滚工具。[install](../../../scripts/install.mjs)、[shared](../../../scripts/shared.mjs)、[coordinate migration](../../../scripts/migrate-session-coordinates.mjs)、[迁移说明](../../DSH_0.1.7_MIGRATION.md) |

## 哪些部分可以保持稳定

- `tavern-format` 与 `world-book` 的纯解析/匹配层没有直接 DSH 运行时依赖。DSH 输入变化优先在 loader adapter 中消化；不能因此把 Session 或 hooks 下沉到纯库。
- `preset`、`character`、`user`、`world-book-library` 和 `session-template` 的资源模型/存储/API 直接依赖低；它们的浏览器挂载和进入最终请求的方式仍依赖组合根。
- `play` 不导入 DSH，通过注入 port 访问 Host；timeline/session-format 校验仍有语义耦合。Trace recorder 接收普通数据，但消费官方事件结构；正文读取器依赖注入的 `sessionController.inspect()`。
- Tavern 持久目录保存资源、选择、设置、Trace metadata/引用；RP workspace 保存 catalog/timeline、显示元数据和显式导入记录。实际 DSH 对话与 system 历史由 DSH 保存。迁移需同时考虑三方数据及继承链，不能只备份 Tavern 目录。
- 原生 composer、工具执行、模型 provider、Remote transport、DSH 存储引擎实现不由 Tavern 替换。插件经公开服务/store 间接依赖它们；这不保证上游语义变化时完全不受影响。`/v2/chrome/events` 是 Tavern 自有 SSE，并非 DSH Remote 事件。

这些边界由 [architecture tests](../../../test/architecture.test.mjs) 提供部分静态保护；静态检查不能证明运行时兼容。

## 用于破坏性更新的检查顺序

1. **固定两个版本。** 保留此图的 Tavern commit，把候选 DSH 固定到 tag/commit；按清单核对 Cordis、client 包根导出、注入服务、slot owner、store 字段以及 Host controller。不要仅比较 `import` 列表。
2. **先判断数据语义是否变化。** 若事件格式、继承前缀、seq 或 system/message 投影改变，先评估历史引用与迁移，再验证 fork/swipe/Trace；不把旧 seq 当作新 seq，也不推断字节偏移。
3. **核对装配与执行时序。** 覆盖首次 claim、取消/替换/steer、多 step、retry、terminal、fork 和 delegated subagent。比较最终 LLM request 与官方历史；Trace metadata 成功生成不足以证明正文引用正确。
4. **检查安全和失败路径。** 核对新增/改名工具、guard 与取消、RP 进入/退出和沙箱恢复；区分“能力未注册”“增强失败关闭”和“写操作部分完成”。例如 fork 清理失败可能遗留 child，跨文件周目操作并非统一事务。
5. **检查真实界面与卸载回退。** 在目标 Web Host/browser 的 native/play 两种模式验证默认 RP、手动切回原生/Trace、空白开场、partial、错误提示、切会话、切工作区、语言切换与释放；桌面目录选择另做对应环境验收。检查卸载后原生会话仍可读。

| 变化面 | 优先回归入口 | 仍需实际环境确认 |
| --- | --- | --- |
| Inbox / fork / claim | `test/pending-input-projection.test.mjs`、`test/play-branch-input.test.mjs`、`test/play-sessions.test.mjs` | 目标 Host 的真实 fork、继承队列和消息不重发 |
| 装配 / 审计 / 历史 | `test/trace-v3-host.test.mjs`、`test/trace-failures-host.test.mjs`、`test/play-history-pagination.test.mjs` | 最终请求、重启冷读、引用缺失与错误归因 |
| 坐标 / 日志格式 | `test/session-coordinates.test.mjs`、`test/coordinate-migration-integration.test.mjs`、`test/dsh017-host-migration.test.mjs` | 目标官方 codec 与经授权的迁移副本 |
| 前端 slot / store | `test/play-slot-occupancy.test.mjs`、`test/play-view-default.test.mjs`、`test/client-session-contract.test.mjs`、`test/play-chat-failure.test.mjs` | native/play 挂载、交互、流式内容与卸载释放 |
| RP 安全 | `test/rp-mode.test.mjs`、`test/rp-secure-path.test.mjs` | 目标 Host 工具全集、子 agent、取消和 sandbox 恢复 |
| 安装 / 包 / 协议 | `npm run verify:2.0`，以及 [验证指南](../../TESTING.md) | 隔离 profile 的安装、升级、卸载和桌面路径选择 |

测试文件是回归入口，图不替代集成证据。具体执行记录保留在忽略的验收文件中，本图不修改真实 DSH profile；实际环境的配置和证据范围见 [验证指南](../../TESTING.md)。

## 维护图源

中英文 JSON 保持稳定节点/边 ID 与拓扑，分别维护文案。`meta.repository.link_mode: "local-only"` 保留源码标签，避免尚未发布 commit 的失效 GitHub 链接；`revision` 标识本地已审阅代码快照，供确定性校验。更新快照时同步两份 revision，核对该提交的源码路径，并更新矩阵相对链接。只有 revision 确实发布后才切换不可变网络链接。

从仓库根目录运行，`ARCHIFY_ROOT` 指向已安装 skill 目录；两种语言都要验证和交付：

```sh
node "$ARCHIFY_ROOT/bin/archify.mjs" validate architecture docs/assets/dsh-dependencies/architecture.zh-CN.json --quality showcase --repo-root . --json
node "$ARCHIFY_ROOT/bin/archify.mjs" deliver architecture docs/assets/dsh-dependencies/architecture.zh-CN.json docs/assets/dsh-dependencies/architecture.zh-CN.html --quality showcase --repo-root . --json
node "$ARCHIFY_ROOT/bin/archify.mjs" visual-check docs/assets/dsh-dependencies/architecture.zh-CN.html --json
```

英文把文件名中的 `zh-CN` 换成 `en`。`deliver` 的确定性检查、`visual-check` 的浏览器证据与实际看图是三种独立检查。截图、运行回执及验收记录移入 Git-ignored `.local/`，不要作为维护文档或安装内容提交。保留图源和独立 HTML；HTML 不需要加载 archify 或外部脚本才能阅读。
