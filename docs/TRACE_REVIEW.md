# 2.3.0 Trace 候选验收

状态：实现候选，尚未人工验收、合并、打 tag 或发布。
分支 `codex/trace-api-v3` 从 main 创建；未合入旧 composer v3 分支。
[English](TRACE_REVIEW_en.md) · [完整 API / 设计](PROMPT_API_V3.md)

## 新增需求和实现对应

| 需求 | 交付 |
|---|---|
| 区分预设、角色、世界书及混合来源，保持原有装配顺序 | 在装配中收集来源，将已有块映射为官方 `{name,text}` 段落；不从最终字符串逆推 |
| 获取当前绑卡、开场序号和完整字段 | 使用 v1 配置预览与资源详情；当前字段计数由调用者计算，v3 保留历史段落和来源的三种计数 |
| 按轮次查看真实装配，不用当前资源重算旧轮次 | 运行期采集、turn/step/attempt、持久历史索引和详情、请求层核对 |
| 其他开发者保有组合权 | 三个只读 v3 端点；也可只使用官方装配/请求接口，没有 owner 或 composer 注册表 |
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

2026-09-18 删除当前 `/sources` 聚合后，全套测试仍为 554 项、552 通过、0 失败、2 跳过；
`npm run verify:2.0` 通过，含构建与打包检查。回归明确验证删除的端点返回 404、
capabilities 不含 `currentSources/maxSourceBytes`、重载后的历史来源原文与 Unicode 计数保留。

之前已完成真实浏览器重启与历史读取、16/16 live v2 HTTP smoke；这些证据属于删除前的候选。
本次未改 Trace 前端。当前资源聚合的旧示例不再属于合同，独立 HTTP reader 仅提供
capabilities/index/detail。

本次隔离的真实 DSH 0.1.5-rc.1 Host 已验证：新 capabilities 正常，旧 `/sources` 返回
404；三条重启前的记录可读，含 Tavern 来源的详情保留原文。v1 配置预览与预设详情
读取成功，预览前后历史索引及所选详情完全一致，没有新增装配记录。

## 旧工作区缺失会话回归（2026-09-18）

新增回归后 `npm run check` 为 563 项、561 通过、0 失败、2 个原有条件跳过。
真实 0.1.5-rc.1 Host 重现了旧空周目阻断新建的问题；修复后新建成功，旧 catalog 条目及
原 timeline 字节不变，重复新建复用有效空周目。浏览器显示缺失日志的说明并可进入新周目。
缺失历史仍需要原 DSH_HOME 或备份，修复不会生成替代历史。坐标迁移、权限及其他读取错误仍拒绝。

## 待维护者人工验收

请使用测试 profile 和测试资源副本，按以下顺序执行。每项记录通过/失败；若失败，附上
会话 ID、turn/step/attempt、recordId、插件顺序及预期/实际结果，避免提交私密提示词正文。

1. **准备候选环境。** 检出 `codex/trace-api-v3` 的最新提交，按
   [安装文档](INSTALLATION.md)安装到测试 profile 并重启 Host；确认 Tavern 为 2.3.0
   候选、`dsh --version` 为 `0.1.5-rc.1`。CLI 已升级不代表测试 profile 已装入最新候选。
   先确认原生会话能正常打开，第三方插件正常加载。
2. **检查 API 边界。** 在已认证的 Host 同源页面打开开发者工具，调用下面的只读检查。
   预期 capabilities 为 200 且没有 `currentSources/maxSourceBytes`；旧 `/sources` 为
   404 `NOT_FOUND`；装配索引为 200（无新请求时允许空数组）。需要当前绑定时调用 v1
   `POST /session-configurations/preview`，正文为
   `{ "source": { "mode": "current", "sessionId": "实际会话ID" } }`，再按返回 ID
   读取资源详情。预期不会新增装配记录，不消费开场；不要用 `/active` 验证“不运行装配”。
3. **真实预设和卡片，至少两轮。** 复制常用复杂预设、卡片、用户和世界书；在预设前后段、
   角色描述和世界书条目放入不同的易识别文字，并包含中文与 emoji。将角色 marker 放在
   两个预设条目之间，选一个备选开场；发送触发世界书关键词的首轮，再发送第二轮。
   打开与 Conversation、Trajectory 同级的 Tavern Trace，逐轮展开段落和来源。
   预期顺序服从预设，角色/世界书可交错；main/jailbreak 的 `{{original}}` 混合输入可识别；
   开场符合首轮语义；字数按码点而非 token。对照官方系统提示词，核对正文和段间换行。
   未被其他插件改写时应显示核对成功；不要把段落输入关系当作逐字符映射。
4. **历史不受当前编辑影响。** 保存第一轮 recordId 和详情响应，修改卡片或预设再发一轮。
   预期新轮使用新内容，旧 recordId 仍返回原正文、原绑定及原来源；重启 Host，尚未激活
   该会话时再次查询，旧详情仍相同。快速切换两个会话、开关 Trace，预期无串会话或过期响应覆盖。
5. **与对方插件联调。** 请开发者分别使用 [v3 reader](examples/trace-reader.mjs) 和
   [官方 observer](examples/official-prompt-observer.mjs)。先只观察，再用官方装配接口
   重排/替换一个具名段落、贡献一个新段落。预期只用官方接口也能操作段落；v3 能查看
   详细来源。改写的原段落和无 Tavern 元数据的新段落标为 unknown，不继承错误来源。
   共同确认加载顺序和采样设置；如使用 `complete` 覆盖，Trace 应明确显示装配核对不通过。
6. **真实模型与失败过程。** 使用已配置模型测试普通回复、多步工具、取消、超时及重试。
   对照官方轨迹核对 turn/step/attempt，预期各次请求独立记录，不覆盖上一条；
   `request-observed` 只表示到达 LLM 层，不能当作模型成功；未观察请求、失败或缺失正文
   均应显示相应状态，不拼造正文。多步和重试是否发生以官方轨迹为准。
7. **日常界面与升级回归。** 检查常用窗口宽度、亮暗主题、缩放、中英文、魔丸/native
   切换，以及现有会话、插件和模型连接。旧周目的坐标迁移按
   [迁移指南](DSH_0.1.5_MIGRATION.md)执行，CLI 升级不会自动改写 Tavern timeline。
   如验证卸载，请只在测试 profile 操作：移除 Tavern 后原生会话和历史仍应可用。

同源页面控制台检查（替换会话 ID，不填写访问令牌）：

```js
const sessionId = '实际会话ID';
const base = '/pmp-dsh-tavern/api/v3';
for (const path of [
  '/capabilities',
  `/sessions/${encodeURIComponent(sessionId)}/sources`,
  `/sessions/${encodeURIComponent(sessionId)}/assemblies`,
]) {
  const response = await fetch(base + path, { credentials: 'same-origin', cache: 'no-store' });
  console.log(path, response.status, await response.json());
}
```

## 发布前已知边界

v3 正文快照含敏感提示词，默认有界保存，不上传；容量淘汰不删除 DSH 历史。
段落来源是输入关系，不是逐字符 source map。contexts 仅为装配阶段快照。
历史 index/detail 可在 Agent 离线时读取；当前资源与配置通过 v1 读取。一个 Host 写一个存储目录；
不承诺多个进程并发写同一文件。较旧 DSH 路径保留，新 Trace 的运行时证据只覆盖
0.1.5-rc.1。人工验收完成后再决定合并和发布。
