# 周目 v2 实现审查记录

审查基线：`codex/v2-lingzhu-mowan-frontend`，最初审查为 `6ede09d`（2026-08-20）；风险关闭与产品实现记录已更新至 `bb10a3b`（2026-08-21）。
原始发现保留作审计证据；每一项当前状态以“已接受的处理决定”和 implementation audit 为准。

## 结论摘要

当前实现已经遵守几项关键边界：`packages/play` 不导入 DSH 私有模块，Host 操作集中在
`packages/tavern-loader/src/play-host.js`；消息读取使用 Host history/`deriveMessages()`，
用户输入走 `session.prompt({ mode: "queue" })`，没有旁路写入 DSH 消息或伪造历史；
timeline 只保存 session/event 范围引用；路径 API 有根目录、相对路径、符号链接检查；默认
视图 adapter 也已经移出 `conversation.view`，不会再注册第二个 `chat`。

## 后续验收状态

以下是审查基线之后的产品验收记录；未人工验收的新实现会明确标为待统一验收：

| 范围 | 当前状态 | 说明 |
| --- | --- | --- |
| 周目生命周期 | 已实现、已验收 | 角色卡侧边栏创建/复用最近空周目、`x周目` 命名、重命名、真实 blank DSH session、空 timeline/catalog 校验。复用检查也考虑 DSH 消息和外部导入 QA。 |
| 空会话 greeting dock | 已实现、已验收 | 在原生 composer dock 展示 greeting；左右切换按钮保持两侧，卡无 greeting 时保留空白 opening 和 footer。 |
| 外部记录绑定 | 已实现、已验收 | 绑定到当前空 root session，不新建 session 或 timeline；支持绑定、换绑、解绑，解绑后恢复 greeting。服务端会重复空会话锁定检查。 |
| 最近三轮 QA | 已实现、已验收 | opening dock 显示导入记录最后三轮 QA；这是显示预览，不是 DSH 历史。 |
| 一次性注入 | 已实现，待统一验收 | 首次 assembly 使用公开 `claimEventSeqs` 建立持久 claim；同一终态前可重放，终态后新 claim 不再注入。Tavern branch/swipe 复制不含正文的 lineage；中断后原 session 新消息不重复注入。 |
| 功能按钮与树状周目分支 | 已实现，待统一验收 | displayOverride、已有 variant 切换、同操作行左右 swipe、新周目分支与同周目回退。屏蔽已移除，旧 hidden 投影不再隐藏正文。context 输出的右 swipe 重跑最近真实用户 turn，不重发 context。timeline 用 parent/head 保存各 swipe 后续；活动 branch anchor session 仍归入原周目。 |
| 显示正则顺序 | 已实现，待统一验收 | 全局、预设、角色卡各自支持与预设 prompt 相同的指针拖拽、收缩线和落点占位动画；保存分别写工作区文档或原生 `regex_scripts` 数组。跨来源禁止拖动，组合顺序固定全局→预设→角色卡。 |
| 子 agent / 上下文注入显示 | 已实现、已验收 | v2 消息保留模型 `role` 并增加 `origin`；魔丸完全隐藏 reasoning/context，不画用户气泡也不提供展开。context 触发输出的 retry 向前定位真实用户 turn，控制器拒绝重发 context；显示正则只控制正文，各段全被清空时仍在 durable QA 末尾保留一组动作。 |

表内“已验收”行为曾在 DSH 0.1.0-rc.8 通过用户验收。P0 加固现已全部进入 `npm run verify:2.0` 分组回归；Windows junction、根内 reparse point 与 rename 前父目录替换在本机实际执行通过，不再因创建 symlink 权限而跳过。真实 rc.8 Host 的 chrome/workspace 权威只读冒烟已通过；写入交互、浏览器双标签页通知、工作区准入视觉、禁用/卸载回退及最终 rc.8 交互仍按人工清单验收。
工作区准入已实现：魔丸在 v2 workspace 未绑定、候选失效或读取失败时阻断 RP 内容，只消费 DSH 公开 workspace 列表；候选必须显式选择，PUT 后回读验证，失败可重试或返回 native，不保存浏览器工作区副本。

下面保留原始发现作为证据；其是否关闭以紧随其后的决策表为准。

## 已接受的处理决定（2026-08-21；状态以各行标注为准）

| 原风险 | 已接受的合同 |
| --- | --- |
| 历史完整性（已实现，`10250a7`） | 已移除 32 页上限，一直分页到 Host `hasMore: false`；Host 空页、非法 oldest `seq` 或 cursor 重复/不前进时返回 502 `PLAY_HISTORY_CURSOR_STALLED`。插件不摘要/切片；模型上下文超限由 DSH 报错，README 明确区分两层。 |
| catalog/timeline 并发 | GET/PUT schema/path 校验、进程内目标锁、临时写/替换复验和服务端 SHA-256 revision/CAS 已实现。受管 PUT 必须带 `expectedRevision`，冲突统一 409 `PLAY_FILE_REVISION_CONFLICT` 且不改文件；跨进程极窄竞态仍由任务 03 的纯 Node 边界覆盖；内置 live client 的 revision 缓存、create-only 与有限冲突重放已由任务 05 完成；任务 06 已完成普通生命周期 caller 迁移。 |
| 半完成资源 | 不增加跨文件事务。已接入的生命周期变更 API 通过 `ctx.logger` 记录 operationId、阶段、结果、错误码和耗时；只记录白名单标识，不记录正文、长度、摘要或未知字段。客户端按完成阶段、回读与稳定错误码恢复。 |
| import-context 请求语义 | 已实现 claim/终态/lineage：无 claim 不注入或消费；同一 terminal 前可重放；`turn/end` 只保存非正文终态元数据；terminal 后新 claim 不注入。Tavern branch/swipe 复制不含正文的 lineage，第三方原生 fork 不在拦截范围。 |
| catalog schema | 已实现：PUT 写前和 GET 读后都校验。id/规范化 path 唯一；id 使用安全段；path 为安全相对路径且以 `/timeline.json` 结尾；校验已知 `ext.pmpDshTavern`，保留第三方 ext。 |
| focus | 已实现任务 07：稳定入口按已校验 catalog 和安全周目 id 解析路径，返回 playthroughId/sessionId/nodeId/variantId；空周目使用 rootSessionId。旧 /focus?path= 仍兼容，无 path 返回 400；普通 timeline PUT 不再更新 deprecated/ignored 的 activeTimelinePath。任务 08 已完成 bundled live client 迁移：只传 URL 编码的 playthrough id，并校验四字段及返回 id 一致。 |
| 路径 TOCTOU | 已实现进程内 per-target guard；路径链逐段 `lstat` 拒绝 symlink/junction，目录逐层创建并 realpath 复核，临时文件排他 `wx`，写入和 rename 前复验父目录。纯 Node 不宣称跨进程或内核级 no-follow 事务；外部本机进程仍可能制造极窄竞态。 |
| 更广日志 | 本轮只支持 Cordis `ctx.logger`。日志保留量、输出目标与轮转由 DSH/Cordis Host 管理；本插件不自行写持久日志文件，也不把 Host 日志承诺成持久审计。浏览器 logger、持久有界 journal 和额外 exporter 进入 backlog，不阻塞本轮实现。 |

## 原始发现：API 与生命周期语义

| 级别 | 位置 | 发现与影响 | 建议 |
| --- | --- | --- | --- |
| P1 数据一致性（已关闭，任务 04–06） | `workspace.js`、`live.js`、`mutations.js` 与 lifecycle callers | 原始实现仅由单客户端队列保护整文档写，跨标签页会丢更新。现在服务端 revision/CAS 与内置 caller 的局部意图重放已实现；session/branch/message 等外部副作用不在 CAS 重放中重复。 | 继续在发布回归验证双标签页冲突；第三方客户端必须携带 expectedRevision 并处理 409。 |
| P1 半完成资源（已接受边界，任务 11–13） | `operation-log.js` 与 workspace/session/import mutation endpoints | session、目录、timeline、catalog 仍是多个原子操作，失败可能留下孤儿资源。当前选择是不增加跨文件大事务，而以各 endpoint 的 content-free `ctx.logger` 阶段、稳定错误码和客户端回读恢复。 | 不宣称原子；发布验收检查失败日志与恢复路径。浏览器日志、持久 journal 和 exporter 暂缓。 |
| P1 历史完整性（已关闭，`10250a7`） | `packages/play/src/sessions.js:62-79` | 原始 32 页上限会在 `hasMore: true` 时静默返回不完整历史。该风险已由无限分页和游标停滞显式失败处理关闭；`GET /sessions/:id/messages` 不返回部分历史假象。 | 已实现：持续分页至 `hasMore !== true`；空页、非法 oldest `seq` 或 cursor 重复/不前进返回 502 `PLAY_HISTORY_CURSOR_STALLED`。插件不摘要/切片。 |
| P1 请求语义（已关闭，任务 09–10） | `import-context-runtime.js`、loader hooks 与 branch host seam | claim identity、终态和 Tavern branch lineage 已实现；retry 在 terminal 前重放，同一 terminal 后的新用户 claim 不再注入；状态只保存非正文元数据。 | 发布回归覆盖正常、请求失败、取消、中断后新消息、同回合 retry 和 swipe 六种场景。 |

## 原始发现：安全与 schema

| 级别 | 位置 | 发现与影响 | 建议 |
| --- | --- | --- | --- |
| P2 安全（已关闭，任务 03） | `packages/play/src/workspace.js`、`packages/play/src/paths.js` | 已实现实用路径加固：目标锁、逐段 no-follow 检查、逐层创建、realpath 复核、排他临时写和 rename 前父目录复验。 | 纯 Node 不宣称跨进程或内核级 no-follow 事务；外部进程极窄竞态和 revision/CAS 仍单独处理。 |
| P2 schema/兼容（已关闭，任务 02） | `packages/play/src/timeline.js`、`workspace.js` | catalog/timeline 已在 GET/PUT 两侧统一校验；危险 path、重复 id/path、已知 `pmpDshTavern` 字段坏值均显式返回 `PLAY_CATALOG_INVALID` / `PLAY_TIMELINE_INVALID`，第三方 ext 保留。服务端 revision/CAS 已在同一目标 guard 内完成；TOCTOU 路径加固已完成。 | 内置 live client 原语与普通生命周期 caller 迁移均已完成。 |
| P2 focus 语义（已关闭，任务 07/08） | `sessions.js`、`live.js` 与 focus callers | 稳定 focus 不再依赖最近写入或 lastOpenedAt；activeTimelinePath 仅为兼容字段保留并 deprecated/ignored，普通 timeline PUT 不再更新。bundled live client 只按 URL 编码的 playthrough id 调用稳定入口，并验证 playthroughId/sessionId/nodeId/variantId。 | 旧 `/focus?path=` 仅保留迁移兼容；custom client 可继续显式传 path。 |

## 不应在后续实现中倒退的边界

- 不把 greeting、导入 QA 或 timeline 节点写成 DSH `user/message` / `assistant/message`；
  当前导入通过受限、转义且标明 untrusted 的 profile context 投影，方向正确。
- 不让 client 直接访问 DSH session 私有字段、bundle 路径或 DOM；继续通过 v2 Host RPC、
  公开 session projection 和根目录路径监狱。
- 不用本地 controller 的串行队列冒充跨客户端事务；所有受管 catalog/timeline caller 继续配合服务端 revision/CAS。
- 修复上述问题时仍应保持 native view、原生 Chat、Host session 历史和卸载回退可独立工作。

## 更新后的验收顺序

1. 自动证据：运行 `npm run verify:2.0`。完整 history、六种 import claim/lineage、schema/CAS、损坏文件、按 id focus、operation log、Windows junction/reparse/rename 前父目录替换以及 mode service dispose 均由确定性测试验证。
2. 真实 Host/浏览器：先以 `DSH_TAVERN_PLAY_LIVE=1` 和 `DSH_TAVERN_PLAY_LIVE_URL` 运行只读 Host 冒烟；再用双标签页观察 chrome SSE/focus/poll 收敛与 CAS 冲突，在全新数据中验证工作区准入的无候选/单候选/多候选/失效候选/失败恢复；正常与中断回复只做一轮代表性 UI 回归。
3. 兼容回退：禁用或卸载 Tavern 后确认 DSH native 与其它插件仍可用，再恢复插件数据；不要用这一步验证会删除资源的 `--no-backup`。
4. 发布门：`npm run verify:2.0` 已包含 build 与 pack dry-run；再核对实际 rc.8 安装副本 hash、正式文档和版本号后才打 2.0 tag。
