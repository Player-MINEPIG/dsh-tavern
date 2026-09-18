# 周目功能与验收

本文描述 Tavern `2.3.0` 的 RP 周目行为与验收要求，目标 Host 为 DSH `0.1.5-rc.1`。
呈现审核已完成；当前验证结果、剩余检查与内容审核状态见 [Trace 验收](TRACE_REVIEW.md)。
[English](PLAY_REVIEW_en.md)

## 当前行为

| 范围 | 合同 |
| --- | --- |
| 历史与输入 | DSH durable history 是权威；Host 操作集中在 Tavern 的公开 controller adapter。输入经 `session.prompt({ mode: "queue" })`，timeline 只保存会话/事件范围引用。 |
| 周目生命周期 | 按角色创建周目，满足空会话条件时复用最近空周目；自动标题随语言变化，自定义标题保留原文。缺少 DSH 日志的旧周目保留并显示错误，不阻断新建，也不作为空周目复用。 |
| 开场白 | 空周目使用原生 composer dock 展示开场。跳过空白备选但保留卡片原序号；无下一条或上一条时对应按钮禁用，已有空白选择可恢复到有效开场。 |
| 外部记录 | 绑定、换绑或解绑当前空 root session；服务端重复验证空会话条件。最近三轮 QA 是显示预览，不是 DSH 历史。解绑恢复开场。 |
| 一次性上下文 | 装配必须有公开 `claimEventSeqs` 才注入并持久记录 claim；同一终态前可以重放，终态后的新 claim 不再次注入。Tavern swipe/branch 保留不含正文的 lineage。 |
| 回复与分支 | 支持显示编辑、已有 variant 切换、新 swipe、分支和回退；parent/head 保存不同 swipe 的后续。context 触发输出的重试定位最近真实用户 turn，不把 context 重发为用户消息。 |
| 显示正则 | 顺序为全局→预设→角色卡；各来源内部可重排，不能跨来源拖动。规则作用于 RP 显示，不改 DSH 原文。隐藏变量更新块不要求变量运行时；变量运行时本身未实现。 |
| 富文本 | 支持 Markdown、嵌套 details、HTML 和隔离 CSS；闭合的无语言/html 围栏中的完整 HTML 文档按静态模板显示并单独隔离，普通代码片段保留源码。模板 JavaScript、危险事件及危险链接受过滤；MVU 等变量 API 未实现。静态 HTML 导出使用相同渲染边界。 |
| 视图与错误 | RP 消费官方 Chat 的消息投影，隐藏 reasoning/context；Conversation 管理阶段和视图选择。原生 Chat 保留详细诊断，RP 显示本地化终态错误提示。 |
| 工作区诊断 | DT → 诊断与侧栏共享当前读取结果，提供原因、恢复建议、重新检查和报告复制。文件错误及无可用会话的周目均显示警告；会话可用性只在官方 mirrors 就绪后判断，空 timeline 也需检查。摘要关闭不删除问题，刷新和模式切换不重复提醒同一问题；问题解决后自动消失。 |
| 工作区准入 | 未绑定、候选失效或读取失败时阻断 RP 工作区内容；只使用 DSH 公开工作区列表，选择后回读验证。可重试或返回 native，不保存浏览器工作区副本。 |

## 数据一致性与安全边界

- history 在固定的官方截点持续分页到 `hasMore: false`；空页、非法 oldest seq 或游标不前进
  返回 `502 PLAY_HISTORY_CURSOR_STALLED`，不伪装成完整历史。模型上下文限制由 DSH 处理。
- catalog/timeline 读写都校验 schema、ID/path 唯一性、安全相对路径及已知扩展，保留第三方扩展。
  受管 PUT 必须带 `expectedRevision`；SHA-256 revision/CAS 冲突返回
  `409 PLAY_FILE_REVISION_CONFLICT`，不改文件。客户端仅重放纯本地修改，不重复 Host 外部副作用。
- 稳定 focus 按经过校验的 playthrough ID 定位；空周目使用 rootSessionId。旧显式 path 路由
  仅作兼容；`activeTimelinePath` 不承担当前焦点权威。
- 目标锁、逐段路径检查、排他临时写与 rename 前复核提供实用路径防护；纯 Node 不承诺
  跨进程或内核级 no-follow 事务。多个资源文件的生命周期也不是跨文件事务。
- 生命周期写操作通过 Cordis `ctx.logger` 记录单请求 operationId、阶段、错误码和耗时，
  不记录正文；客户端依据已完成阶段、回读及稳定错误码恢复。日志不是持久审计。
- 工作区诊断只投影当前问题，不新增后端日志或 API。`sessionStorage` 只保存有界的摘要关闭身份，
  不保存错误正文或资源；复制报告包含工作区路径、周目/会话标识与错误详情。
- 导入 context 标明不可信输入；greeting、导入 QA、displayOverride 和 timeline 不伪造
  DSH 消息。卸载 Tavern 后原生会话与官方历史仍独立可用。

接口细节见 [API](API.md)，渲染用法见 [使用说明](USAGE_zh-CN.md)，威胁边界见
[安全说明](../SECURITY.md)。旧日志与范围迁移见 [迁移指南](DSH_0.1.5_MIGRATION.md)。

## 验收方法

1. **自动检查。** `npm run verify:2.0` 覆盖 history、schema/CAS/focus、路径防护、claim/lineage、
   operation log、服务/slot 生命周期、本地化和打包。需要官方 codec 时设置
   `DSH_TAVERN_COMPAT_ROOT`；条件跳过不等于通过。
2. **真实 Host 读取。** 设置 `DSH_TAVERN_PLAY_LIVE=1` 与 `DSH_TAVERN_PLAY_LIVE_URL`，
   执行 `node --test test/play-sessions.test.mjs`。这只证明 chrome/workspace 读取，不替代写入或浏览器验收。
3. **浏览器生命周期。** 使用测试副本验证工作区准入、新建/复用/重命名、开场边界、首轮发送、
   流式/完成态、显示正则与富文本、swipe 后续、分支/回退、导入换绑与导出。
   在有缺失日志的工作区刷新有效分支，确认 RP 视图仍可进入，新周目仍可创建。
   检查读取失败和空 timeline 但无可用会话的周目均有警告，健康周目不误报；关闭摘要后，
   逐周目入口及 DT 诊断仍可用，重新检查、模式切换和刷新保持关闭。验证报告复制与问题恢复消失。
4. **并发与失败。** 双标签页检查 focus/SSE/poll 收敛和 CAS 冲突；验证取消、失败重试、
   导入 claim 的终态语义及部分完成后的回读恢复。真实第三方插件需单独联调。
5. **卸载与恢复。** 仅在测试 profile 卸载并重装，确认原生会话可用且 Tavern 外部数据保留。
   `--no-backup` 只跳过卸载前备份，不是删除资源。

以上是复验方法，无需为已完成的呈现审核重复执行。后续行为变更按影响范围补充验证；
旧版本的验收结论不能替代当前版本的证据，过去的验收记录从相应 Git tag 查阅。
