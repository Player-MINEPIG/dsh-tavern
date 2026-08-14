# Tavern Trace acceptance

状态：2026-08-15，feature branch 自动验收记录。本文只使用自制最小 fixture，不包含任何本机第三方 preset、角色卡或世界书。

## 覆盖矩阵

| 验收项 | 自动证据 |
| --- | --- |
| 轮次对应 | `agent/request` 的 `turn/step` 和 retry `attempt` 进入 record；header event seq 单独对齐 |
| exact assembly | session selection 在 assemble 后改变，Trace 与 call config 仍使用已经组装的 snapshot，不把同轮稍后历史重新算成 system |
| 刷新恢复 | 预算裁剪后的 record/state 从 `tavern-traces.json` 等价重建并由 GET API 返回 |
| 数量上限 | 测试配置 2 sessions × 2 records，旧 bucket 和旧 record 被稳定裁剪 |
| 全局字节上限 | 3 个 session 交错写入 18 条自制 record；完整内存 canonical state、实际文件、重载 state、单 session GET 原始 body 均不超过 `maxTotalBytes`，全局最旧记录淘汰而最新记录保留 |
| 配置与单条上限 | 超大配置被钳制到 128 sessions、128 records/session、64 KiB/record、8 MiB total；单条无法连同 state envelope 装入总预算时拒绝，内存与磁盘保持不变 |
| API 容量元数据 | GET `storage` 返回实际 `maxTotalBytes`、`maxRecordBytes` 和 `persistedBytes` |
| GET 极限 envelope | 1 KiB 总预算下，API 先压缩非必要元数据，原始 body 不越界且唯一/最新 record 仍返回 |
| 敏感最小化 | synthetic profile/world-book/header/tool secret markers 均不出现在持久文件 |
| world-book 解释 | accepted/rejected、primary/secondary、概率 roll、budget、requested/applied position 均进入 metadata |
| 不污染模型 | recorder 从不调用 `Session.append()`；mock append 设为抛错，Session events 保持 byte-equivalent |
| 不伪造工具 | client/recorder 不产生 tool call；只读 request/header reference |
| 官方 UI seam | 源码测试确认 additive `conversation.view` registration，且没有私有 DOM/MutationObserver |

## 人工审阅路径

1. 在隔离 DSH profile 安装此 branch，创建只含自制文字的 preset、角色卡和 world-book 条目。
2. 打开一个 conversation，发送可命中与不可命中的自制关键词。
3. 切换 Conversation / Trajectory / Tavern Trace，确认第三个 view 与前两者并列且不会替换聊天。
4. 对照同一 turn/step 的 DSH request/header seq，检查资源摘要、关键词、secondary/probability/budget reason 与插入位置。
5. 刷新页面和重启隔离 Host，确认有界记录恢复；检查 data 文件不含 fixture 正文。
6. 检查 Trace status 显示总预算；对照 API 的 `persistedBytes`、文件实际大小与 `maxTotalBytes`。

人工真实浏览器/安装验收留给主任务最终验收；本 feature branch 不修改 main、不 merge、不 push，也不宣称已集成。

## 自动命令

最终提交前执行：

```powershell
node --test test/tavern-trace.test.mjs test/host-contract.test.mjs test/world-book-policy.test.mjs test/world-book-loader-bridge.test.mjs
npm run check
npm run pack:check
```

最终结果与 test count 在 `docs/CHANGELOG.md` 对应阶段记录。

本次返修最终自动结果：定向 Trace/Host/world-book suite 为 20 passed、0
failed；`npm run check` 为 88 passed、0 failed、1 optional external-fixture
test skipped；`npm run pack:check` 成功并预览 40 个发布文件。
