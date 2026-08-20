# 周目 v2 实现审查记录

审查基线：`codex/v2-lingzhu-mowan-frontend`，`6ede09d`（2026-08-20）。后续已验收实现延伸至
`83be2ba..1f248e4`（2026-08-21）。
本记录是只读代码审查；本次没有修改源码、测试、构建产物或配置。

## 结论摘要

当前实现已经遵守几项关键边界：`packages/play` 不导入 DSH 私有模块，Host 操作集中在
`packages/tavern-loader/src/play-host.js`；消息读取使用 Host history/`deriveMessages()`，
用户输入走 `session.prompt({ mode: "queue" })`，没有旁路写入 DSH 消息或伪造历史；
timeline 只保存 session/event 范围引用；路径 API 有根目录、相对路径、符号链接检查；默认
视图 adapter 也已经移出 `conversation.view`，不会再注册第二个 `chat`。

## 后续验收状态

以下是审查基线之后、但不改变下方风险结论的产品验收记录：

| 范围 | 当前状态 | 说明 |
| --- | --- | --- |
| 周目生命周期 | 已实现、已验收 | 角色卡侧边栏创建/复用最近空周目、`x周目` 命名、重命名、真实 blank DSH session、空 timeline/catalog 校验。复用检查也考虑 DSH 消息和外部导入 QA。 |
| 空会话 greeting dock | 已实现、已验收 | 在原生 composer dock 展示 greeting；左右切换按钮保持两侧，卡无 greeting 时保留空白 opening 和 footer。 |
| 外部记录绑定 | 已实现、已验收 | 绑定到当前空 root session，不新建 session 或 timeline；支持绑定、换绑、解绑，解绑后恢复 greeting。服务端会重复空会话锁定检查。 |
| 最近三轮 QA | 已实现、已验收 | opening dock 显示导入记录最后三轮 QA；这是显示预览，不是 DSH 历史。 |
| 一次性注入 | 正常路径已实现；加固待实现 | 首次实际 assembly 注入转义、`untrusted`、只读上下文；request error、取消、断线、retry 与 swipe 的新 claim/lineage 语义已经接受，尚待实现。 |

上述行为在 DSH 0.1.0-rc.8 上通过用户验收；生产构建与 347 个测试通过、2 个测试跳过。
“已验收”只表示当前产品路径，不表示下方并发、事务或失败恢复风险已关闭。

但 v2 作为“第三方可基于协议开发前端”的稳定面，仍有以下发布前风险。2026-08-21 已完成
协议决策，下面保留原始发现作为证据；新的完成合同以紧随其后的决策表为准。

## 已接受的处理决定（2026-08-21；状态以各行标注为准）

| 原风险 | 已接受的合同 |
| --- | --- |
| 历史完整性（已实现，`10250a7`） | 已移除 32 页上限，一直分页到 Host `hasMore: false`；Host 空页、非法 oldest `seq` 或 cursor 重复/不前进时返回 502 `PLAY_HISTORY_CURSOR_STALLED`。插件不摘要/切片；模型上下文超限由 DSH 报错，README 明确区分两层。 |
| catalog/timeline 并发 | GET/PUT schema/path 校验已实现；revision/CAS、目标锁、临时写/替换一致性仍未实现。当前多客户端整份 PUT 仍可能互相覆盖，后续任务负责显式冲突合同。 |
| 半完成资源 | 不增加跨文件事务。每个生命周期变更 API 使用同一 `operationId` 通过 `ctx.logger` 记录阶段/结果/错误码/耗时；客户端回读并恢复。只记录标识和摘要，不记录正文。 |
| import-context 请求语义 | 首次 assembly 按原用户 turn/event claim；同一回合 retry/swipe 可重放；中断后新用户消息不重复；成功后保留 lineage 供未来 swipe。 |
| catalog schema | 已实现：PUT 写前和 GET 读后都校验。id/规范化 path 唯一；id 使用安全段；path 为安全相对路径且以 `/timeline.json` 结尾；校验已知 `ext.pmpDshTavern`，保留第三方 ext。 |
| focus | 稳定入口改为 `GET /playthroughs/:id/focus`，由已校验 catalog 解析路径，返回 playthroughId/sessionId/nodeId/variantId；空周目使用 rootSessionId。移除无参数默认行为和 timeline PUT 的隐式 active 写入。 |
| 路径 TOCTOU | 目标锁内逐段 `lstat` 拒绝 symlink/junction/reparse point，逐层创建并 realpath 复核，临时文件排他 `wx`，写/rename 前复验父目录。承认外部本机进程仍可制造极窄竞态，本轮不引入 native addon。 |
| 更广日志 | 本轮只支持 Cordis `ctx.logger`。其默认是进程内最近 1000 条记录的 ring buffer，未发现本插件自行写持久日志。浏览器 logger、持久有界 journal 和额外 exporter 进入 backlog，不阻塞本轮实现。 |

## 原始发现：API 与生命周期语义

| 级别 | 位置 | 发现与影响 | 建议 |
| --- | --- | --- | --- |
| P1 数据一致性 | `packages/client/src/play/create.js:91-100`、`import.js:68-80`；`packages/client/src/play/nodes.js:48-52,72-77,112-127`；`turns.js:77-80` | catalog/timeline 都是“GET → 本地修改 → PUT 整份文档”。controller 只在同一个 JS 实例内串行；两个标签页、两个插件前端或第三方客户端同时操作时，后写者会覆盖前一个 playthrough、variant、隐藏状态或显示覆盖。v2 没有版本号、ETag、条件写入或冲突响应，违反第三方稳定协议和“卸载后一切如常”所需的持久一致性。 | 在 v2 重新确定 CAS 合同：文档带 generation/ETag，`PUT` 必须带 `If-Match` 并在冲突时返回 409；或增加服务端原子命令（append/adopt/update catalog）。客户端控制器只能作为 UX 优化，不能是唯一并发保护。 |
| P1 半完成资源 | `packages/play/src/sessions.js:116-136`、`packages/tavern-loader/src/play-host.js:52-69,116-136`；客户端 `create.js:91-96`、`import.js:68-79` | Host session 已创建后，绑定导入上下文、复制 selection、创建目录、写 timeline 或写 catalog 任一步失败，都会留下没有 catalog/timeline 的 DSH session；标题重命名失败也被静默忽略。导入上下文还可能已经写入且处于 pending。当前响应只能报错，不能告诉第三方前端哪些步骤已提交。 | 讨论“周目创建事务”的边界：优先提供 Host/loader 侧可回滚或可补偿的 create transaction；否则返回结构化 `sessionId`、已完成阶段和恢复操作，并让 catalog 采用可恢复状态，而不是声称一次操作原子完成。 |
| P1 历史完整性（已关闭，`10250a7`） | `packages/play/src/sessions.js:62-79` | 原始 32 页上限会在 `hasMore: true` 时静默返回不完整历史。该风险已由无限分页和游标停滞显式失败处理关闭；`GET /sessions/:id/messages` 不返回部分历史假象。 | 已实现：持续分页至 `hasMore !== true`；空页、非法 oldest `seq` 或 cursor 重复/不前进返回 502 `PLAY_HISTORY_CURSOR_STALLED`。插件不摘要/切片。 |
| P1 请求语义 | `packages/tavern-loader/src/import-context-runtime.js:132-159`、`packages/tavern-loader/src/index.js:385-402` | 导入上下文状态只有在 `session/event` 的 `turn/end` 才从 `pending` 变为 `consumed`。request error、取消、断线或 Host 未发出 `turn/end` 时，binding 会一直 pending；下一次请求会再次注入同一份导入历史。即使正常情况下同一 turn 发生多次 assembly，`contextFor()` 也没有 request/turn token 去保证只消费一次。 | 重新确定 one-shot 的所有权和重试语义：在首次实际 assembly 前建立带 turn/request id 的 claim，处理 request-error/cancel/agent abort/启动恢复；若允许失败后重试，需显式记录 retry 次数，不能依靠“等 turn/end”。补充 Host 终态事件或 loader 的清理接口。 |

## 原始发现：安全与 schema

| 级别 | 位置 | 发现与影响 | 建议 |
| --- | --- | --- | --- |
| P2 安全 | `packages/play/src/workspace.js:208-226`、`packages/play/src/paths.js:50-91` | 路径先经过 `resolvePlayPath()` 的 realpath 检查，随后 `writeFile()` 才 `mkdirSync()` 和写入；目录创建与写入之间存在 TOCTOU。若同机进程在检查后把未存在的父级替换为根外符号链接，递归 mkdir/临时文件路径可能越过已检查的根。现有测试覆盖静态符号链接逃逸，不覆盖并发替换。 | 采用目录句柄/`open` 的 no-follow 语义，或对每一级父目录做不可跟随的创建与再次 realpath 校验；至少把“路径监狱防止静态逃逸”与“不能抵抗并发文件系统攻击”区分写入安全合同。 |
| P2 schema/兼容（已关闭，任务 02） | `packages/play/src/timeline.js`、`workspace.js` | catalog/timeline 已在 GET/PUT 两侧统一校验；危险 path、重复 id/path、已知 `pmpDshTavern` 字段坏值均显式返回 `PLAY_CATALOG_INVALID` / `PLAY_TIMELINE_INVALID`，第三方 ext 保留。 | revision/CAS 与 TOCTOU 仍由后续任务处理。 |
| P2 focus 语义 | `packages/play/src/workspace.js:226`、`packages/play/src/sessions.js:85-102` | 任意文件写入只要 basename 是 `timeline.json` 就更新 `activeTimelinePath`。第三方导入、后台 reconcile 或写入非当前周目时，会改变无 `path` 参数的 `/focus` 默认目标；“active” 实际表示最近写过，不是用户最近打开。 | 明确 active 的写入者：由显式 open/activate endpoint 更新，普通 `PUT timeline` 不应隐式切换；或者把当前“最近写入”改名并从 API 文档中移除默认 focus 的歧义。 |

## 不应在后续实现中倒退的边界

- 不把 greeting、导入 QA 或 timeline 节点写成 DSH `user/message` / `assistant/message`；
  当前导入通过受限、转义且标明 untrusted 的 profile context 投影，方向正确。
- 不让 client 直接访问 DSH session 私有字段、bundle 路径或 DOM；继续通过 v2 Host RPC、
  公开 session projection 和根目录路径监狱。
- 不用本地 controller 的串行队列冒充跨客户端事务；它仍需要配合服务端版本/冲突合同。
- 修复上述问题时仍应保持 native view、原生 Chat、Host session 历史和卸载回退可独立工作。

## 更新后的验收顺序

1. 完整 history 已由 `10250a7` 实现并有超过 32 页自动测试；其余逐 commit 实现 catalog/timeline CAS、`ctx.logger` 阶段日志、claim/lineage、
   playthrough-id focus 和路径 TOCTOU 加固；
2. history 超过 32 页的自动覆盖已完成；继续验收请求失败/取消/中断/重试后的导入上下文、两个标签页并发写同一
   catalog/timeline、损坏文件和 symlink/junction 替换做协议验收；
3. 最后统一验收功能按钮，因为 swipe、adopt、hide、display override 和 restore 都依赖
   同一份 timeline、focus 与 import lineage 一致性语义。
