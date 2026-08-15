# Tavern integration acceptance

状态：2026-08-14，适用于 `feature/tavern-integration`。本文是合入 `main` 前的 review/验收清单，不是 README。

## 分支来源

| 模块 | 分支 | 已验收提交 |
| --- | --- | --- |
| loader/session policy | `feature/tavern-loader` | `6a65310a41340f6c7e8fe04b0791a61382abe0ce` |
| character card | `feature/character-card-compat` | `8bf6fdad2ede03c8f7f6f6969529063821918db9` |
| world book | `feature/world-book-compat` | `1489e11570a712a882cc2b72461fc70bff8605f1` |

三个模块先在各自 worktree 完成纯逻辑/用例验收，再合到独立 integration branch 接线。`main` 不承担未验收的中间状态。

## 自动验收

- preset-only 输出、原 API 和安装器测试不回归；
- 角色卡 V1/V2/V3 JSON、PNG、原件保留、CRUD/API/UI 及选择意图通过；
- standalone/embedded world-book 解析、round-trip、matcher、排序、概率与预算通过；
- loader 用统一 session selection 组合 preset、角色卡与内嵌世界书；
- synthetic Host 集成测试验证角色描述和关键词命中 lore 同时进入 profile，creator notes 不进入；
- 旧角色卡 session binding 单向迁移，用户之后解绑不会在重启时复活；
- 所有 fixture 均为仓库内自制最小数据，未复制本机第三方作品。

## 手工验收

1. 安装该 worktree 到隔离 `DSH_HOME` 并启动 DSH Web。
2. 确认预设原有导入、编辑、拖拽、选择和发送路径未回归。
3. 导入一张用户有权测试的 ST JSON 或 PNG 角色卡；不得把该文件复制或提交到仓库。
4. 在两个会话选择不同角色或让其中一个不选择，确认侧栏状态和模型请求互不污染。
5. 对含内嵌 Character Book 的卡，在已有会话历史中写入关键词，再发送下一条消息；检查 active view/Trace 的有界诊断显示对应条目命中，并以 DSH request/header 的 system 确认实际 lore 正文已装配。`GET /active` 不返回完整编译提示词。
6. 切换 greeting 与 system/PHI 开关，确认 UI 恢复值正确且 profile 反映选择。
7. 删除正在被某 session 选择的角色，确认悬空选择被清除。

## 不作为本轮通过条件

- 独立 world-book 文件的插件内导入、存储、选择和 UI；
- 同轮用户输入触发 lore（公开 DSH assembly seam 尚不包含该输入）；
- greeting 作为真实 assistant 历史、严格 PHI/depth/absolute role placement；
- recursive、sticky/cooldown/delay、vector 和 outlet 的完整 ST runtime 语义。
