# 2.3.0 Trace 候选验收

状态：实现候选，尚未人工验收、合并、打 tag 或发布。
分支 `codex/trace-api-v3` 从 main 创建；未合入旧 composer v3 分支。
[English](TRACE_REVIEW_en.md) · [完整 API / 设计](PROMPT_API_V3.md)

## 新增需求和实现对应

| 需求 | 交付 |
|---|---|
| 区分预设、角色、世界书及混合来源，保持原有装配顺序 | 在装配中收集来源，将已有块映射为官方 `{name,text}` 段落；不从最终字符串逆推 |
| 获取当前绑卡、开场序号、字段原文及字数 | `GET /sessions/:id/sources`，完整文档、绑定、有效开场、三种计数与 revision |
| 按轮次查看真实装配，不用当前资源重算旧轮次 | 运行期采集、turn/step/attempt、持久历史索引和详情、请求层核对 |
| 其他开发者保有组合权 | 四个只读 v3 端点；也可只使用官方装配/请求接口，没有 owner 或 composer 注册表 |
| Trace 可用于外部开发者调试 | 内置页面只用公开 v3，按需加载正文、轮次刷新、未知来源和不一致标志 |
| 缺少记录、失败、超限和重启时不伪造结果 | 明确状态、旧 v1 元数据适配、有界存储、异常脱敏 |

Issue #5 Agent preset 和 #6 周目删除继续作为独立需求处理。本次解决来源可见性与历史观察，
不增加独占接管模式，不替代第三方提示词管理器，也不改变世界书深度/PHI 的现有近似语义。
v1/v2 原有组合接口继续有效。v3 的定位与 v2 一致：提供元能力，流程由调用者选择。

## 已完成的自行验收

验证环境：Node.js 22.23.1，官方 DSH CLI 与实际解析的核心依赖均固定到
`0.1.5-rc.1`；不会把 CLI rc.1 + 核心包 rc.2 的混装结果作为目标版本证据。

- 全套 `npm test`：554 项，552 通过、0 失败、2 跳过。两个跳过项分别是外部私有卡片
  fixture 和 opt-in live v2 HTTP smoke；真实 AgentLoop 与官方迁移 codec 测试已启用。
- 真实官方 AgentLoop + 本地合成 LLM：官方 observer 看得到 Tavern 细分段落；普通
  装配与实际系统消息一致；第三方重排与改写生效，改写后来源为 unknown；
  `complete` 覆盖显示不一致；DSH 留下真实 system/message；卸载 Tavern 后原生装配正常。
- 单元/合同覆盖：交错与重复 original、原有宏/兜底/世界书预算、Unicode、重试与多步、
  持久化重载、当前编辑不影响旧记录、重复全文不猜位置、超限/淘汰/损坏 JSON、失败状态、
  旧记录适配、只读路由与输入检查、异常脱敏。现有 v1/v2 回归同时通过。
- 隔离的真实 Web Host + 本地合成回复：从浏览器发送第二轮后 Trace 自动出现新轮次；
  展开官方段落、预设来源和原文；脚本标签按纯文本显示；无浏览器 warn/error。
  该测试不访问付费模型，不借用用户真实卡片或对话。
- 本地默认 `dsh --version` 为 `0.1.5-rc.1`；默认 web profile 的帮助入口加载成功，
  旧安装保留。此项不代表默认 profile 中所有第三方插件已完成模型请求联调。

以下命令用于复验。两个 ROOT 指向可正确解析目标官方模块的 CLI 依赖目录
（包含 `package.json`）；先用 Node `createRequire` 核对实际解析的包版本。

```sh
DSH_TAVERN_COMPAT_ROOT="$DSH_RUNTIME_ROOT" \
DSH_TAVERN_PROMPT_COMPAT_ROOT="$DSH_RUNTIME_ROOT" npm test
DSH_TAVERN_COMPAT_ROOT="$DSH_RUNTIME_ROOT" \
DSH_TAVERN_PROMPT_COMPAT_ROOT="$DSH_RUNTIME_ROOT" npm run verify:2.0
```

默认不设置这两个变量时，相关真实运行时测试会明确跳过，不能把跳过当作通过。
Web fixture 使用官方 Session controller/Agent/LLM adapter，仅存在于隔离临时环境。
本仓库可复现的完整 AgentLoop 路径见 `test/trace-v3-host.test.mjs`。

## 最终打包与重启证据

`npm run verify:2.0` 通过，含构建与打包检查。202 个已安装包内文件与候选逐一一致，公开链接和包边界检查通过。另行启用的 live v2 HTTP smoke 为 16/16 通过。真实 Host 重启后，浏览器成功展开重启前的记录。独立 v3 HTTP 示例读取 capabilities/sources/index/detail；编辑当前合成预设后 revision 改变，旧记录逐字节不变。

## 待维护者人工验收

1. **真实角色与预设。** 在测试 profile 中选用你的复杂预设、卡片、用户和世界书，
   至少运行两轮。检查 preset marker 处的角色/世界书交错、main/jailbreak 的 original、
   开场仅首轮引用、字数口径、世界书命中及来源可读性；对照官方系统提示词正文。
2. **实际第三方插件联调。** 请对方分别试用 v3 HTTP reader 和官方 observer 示例。
   官方路径应能直接操作有名称的段落；混合来源细节使用 v3。一起确认插件顺序、
   重排/替换及采样配置；本次不代替两个第三方之间的策略协调。
3. **真实模型与失败过程。** 用你已配置的模型运行多步工具、取消、超时和重试。
   `request-observed` 仅证明已到 LLM 层；核对它与官方轨迹的关系，不能理解为模型成功。
4. **历史与页面切换。** 发送一轮后修改资源，再打开旧轮次；重启后再次读取。快速切换
   两个会话、开关 Trace，检查没有串会话、卡住加载或旧响应覆盖新页面。
5. **个人界面配置。** 检查你常用的窗口宽度、亮/暗主题、缩放、中英文与魔丸/native
   切换下的可读性。合成环境已经检查主路径，但未替代你的真实插件组合和主题。
6. **迁移与本机插件组合。** 默认 CLI 已升级；已有周目的 DSH V3 坐标迁移仍按
   [原迁移指南](DSH_0.1.5_MIGRATION.md)执行，不会因为升级 CLI 而自动修改 Tavern
   timeline。检查默认 profile 的第三方插件、已有会话与实际模型连接后再用于日常工作。

## 发布前已知边界

v3 正文快照含敏感提示词，默认有界保存，不上传；容量淘汰不删除 DSH 历史。
段落来源是输入关系，不是逐字符 source map。contexts 仅为装配阶段快照。
历史 index/detail 可离线读取，sources 是当前状态。一个 Host 写一个存储目录；
不承诺多个进程并发写同一文件。较旧 DSH 路径保留，新 Trace 的运行时证据只覆盖
0.1.5-rc.1。人工验收完成后再决定合并和发布。
