# 世界书提前识别：实现与验收

状态：2026-08-15，已集成到首个公开发布候选版本。本文保留 Phase 3 世界书提前识别的实施与验收契约。

## 目标与结果

当前轮用户输入现在能在首个 agent step 的 `dsh-tavern:profile` 编译前参与世界书匹配。实现没有增加 agent step、模型请求或 durable message，也不读取 Agent 私有 Inbox。DSH 的 `Session.deriveMessages()` 仍是最终模型历史的唯一权威来源。

## 实现边界

唯一投影位于 `packages/tavern-loader/src/pending-input-projection.js`。它只消费公开的 `agent/inbox/spliced` Session event：

1. 在 `agent/session-start` 从 seed 之后的公开 Session events 重放 `next-turn`/`next-step` 队列。
2. 按 `target/start/removedCount/inserted/outcome` 应用插入、替换与取消；只有无 `canceled` outcome 的纯删除被识别为 agent-loop claim。
3. next-step 与 next-turn 的连续 claim 删除合并为同一次待 assembly batch。
4. 首次 `TavernProfileLoader.forAssembleContext()` 编译时生成 `ActivationContext`，再立刻一次性清除 claimed batch；同一 assembly context 的 WeakMap cache 保证 section 与 waterfall 复用 exact snapshot。
5. durable 与 pending 使用 DSH 稳定 message id 去重。下一 step 中已经进入 durable history 的消息不会再次作为 pending 附加。
6. `turn/end` 额外清理未消费 claim；投影按 Session object 使用 WeakMap 隔离，不建立跨 session 正文表。

`world-book` 纯格式/matcher 层没有订阅 Host event。loader adapter 只接收显式的 `activationContext.messages/text`，继续执行每本书自己的 scan depth、关键词、概率、组和 token budget 策略。

## 上限与数据边界

- 默认扫描最近 128 条、64 KiB 字符；硬上限 1,024 条、1 MiB 字符。
- 每个 pending target 默认最多保留 256 条消息文本（硬上限 1,024 条），两个 target 合计默认最多保留 256 KiB 字符（硬上限 1 MiB）。超出部分保留数量占位，激活 metadata 标记 `truncated`，不无界保留正文。
- profile 仍受默认 512 KiB、硬 2 MiB UTF-8 上限和最多 4,096 个 lore 条目约束。
- Trace 只保存 durable/pending/实际扫描消息数、实际扫描字符数、截断状态、去重数、无效事件数和最多四个 claim event seq。它不保存输入正文、正文 hash、消息 content、资源正文或完整 system/header。
- 投影是内存态，不新增文件、写 API 或持久 schema；现有资源写接口的统一安全包装、结构/字节上限和原子写入不变。

## 自动化验收覆盖

`test/pending-input-projection.test.mjs` 覆盖：

- insert → replace/cancel → claim 的精确语义；取消内容不会误当成本轮输入；
- claimed batch 只消费一次；
- stable message id 对 durable/pending 去重；
- message/character 扫描上限和 truncation metadata；
- 两个 session 同时排队/claim 时互不泄漏；
- 空历史、单 step 新会话中，当前消息关键词在 step 1 的 profile 中激活 lore；
- Trace 记录同一 turn/step 的 pending metadata，序列化记录不含测试输入正文；
- Session events 中没有插件伪造的 `user/message`。

相关回归集还覆盖 Host exact-assembly cache、独立/内嵌世界书组合、旧 durable-history 截断诊断、Trace header 对齐和纯模块架构约束。

自动化结果：`npm run check` 重建浏览器 bundle，137 个测试中 136 通过、0 失败、1 个 opt-in 外部私有 fixture 跳过；`npm run pack:check` 的 50 文件清单包含 `pending-input-projection.js`，不包含测试、阶段文档、本地契约或运行数据。提交 SHA 由交付报告补充。

人工验收应在隔离 DSH profile 中执行：绑定含唯一关键词的世界书，新建空会话后只发送一条包含该关键词的消息，确认首个 `request/header.system` 已含 lore；随后检查 Tavern Trace 为同一 turn/step、pending count 为 1，刷新后记录仍不出现输入正文；再发送不含关键词的下一轮，确认没有延迟重复激活（除非 durable 历史按书的 scan depth 仍合法命中旧关键词）。

## 已知风险

- 该实现依赖 DSH rc.6 公开 splice 语义：claim 是 `outcome` 缺失的纯删除，用户取消/替换删除带 `outcome: "canceled"`。若未来 DSH 改变公开 event schema，需要进行兼容适配。
- 世界书默认扫描历史，因此旧用户消息中的关键词在后续步骤继续命中是配置语义，不属于 pending 重复。验收“无延迟重复”应通过 Trace 的 pending metadata 和 scan depth 区分。
- pending 正文只在进程内暂存到首次 assembly；极端超限队列会诚实截断并可能漏掉被省略部分的关键词，而不会突破内存边界。
