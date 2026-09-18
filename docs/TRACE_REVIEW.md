# Trace 候选验收

当前候选为 Tavern **2.3.0**，目标 DSH **0.1.5-rc.1**，分支为 `codex/trace-api-v3`。
实现、自行验证与测试环境安装已完成；下方维护者人工清单尚未逐项确认。尚未合并、打 tag 或发布。
[English](TRACE_REVIEW_en.md) · [API 与设计合同](PROMPT_API_V3.md) · [周目验收](PLAY_REVIEW.md)

## 当前交付

| 要求 | 实现 |
| --- | --- |
| 按预设装配并识别来源 | 使用官方具名 sections，保留预设顺序、宏和混合输入关系；自动身份包装不进入模型正文，作者自行写入的标签保留 |
| 最小 v3 元接口 | capabilities、装配索引、单条详情三个只读端点；当前资源和配置仍由 v1 提供，RP 流程由 v2 提供 |
| 按轮次回看装配 | 记录 turn/step/attempt、当时配置、世界书决策、来源及官方事件引用；新 v1/v3 采集共用一条 schema 4 记录 |
| 避免重复保存提示词 | 新记录不存系统消息、段落、context 或来源原文副本；详情冷读官方历史并验证身份、格式、截点、事件、hash 与范围 |
| 明确缺失与兼容 | 官方日志缺失或校验失败时提示 unavailable；旧 v1 元数据和 schema 3 快照只读兼容，不自动清理，也不作新记录的正文兜底 |
| 直观查看与第三方组合 | Trace 默认显示当次配置，世界书和 Loader 详情分别折叠；第三方可以选择 v3 或官方装配/请求接口 |

## 已完成的验证

验证环境为 Node.js 22.23.1，官方 CLI 与实际解析的核心依赖均固定到 `0.1.5-rc.1`。
以下为当前代码的验证结果。

- `npm run check`：617 项、615 通过、0 失败、2 个条件跳过。已启用真实 AgentLoop 和
  官方 codec；跳过项为外部私有卡片 fixture 和 opt-in live v2 测试，后者另在真实 Host 执行。
- `npm run verify:2.0`、构建与 204 文件打包检查通过；真实 Host 的 v2 smoke 16/16 通过。
- 自动回归覆盖交错段落、宏/混合来源、Unicode、重试与多步、重启、官方消息复用/替换、继承前缀、
  格式变化、截断/缺失日志、hash/身份/range 错误、未知来源与 complete 覆盖、容量与损坏文件。
- 存储回归确认大卡正文增长不会按正文长度扩大 Trace 记录；v1/v3 只存一份新采集元数据，
  首次 attempt 为 1，旧 v3 的过时 audit 不覆盖旧 v1 最终状态，旧文件字节不变。
- 新建/导入卡片的空昵称和全空白昵称均回退到卡片名；世界书来源分别保存书内 UID 与完整
  Loader ID，旧来源记录保持原样。路径测试已改用平台原生绝对路径，本次未在 Windows 主机运行。
- 真实 rc.1 AgentLoop 的 7 类失败场景通过：提供方失败、重试成功、LLM 中间件失败、首次装配失败、
  请求准备失败、重试准备失败及下一步装配失败。失败归属对应尝试；索引与落盘无错误正文副本，
  详情通过独立官方事件引用读取，缺失或校验失败时明确不可用，RP 不增加失败消息。
- 独立 Web Host 通过 HTTP 验证正常装配、提供方失败和装配失败；真正停止/重启 Host 后，
  未附着目标 Session/Agent 即可回读相同正文与失败原因。读取没有激活会话或改写 Trace 文件，
  v2 仍只包含成功产生的助手消息。
- 真实 Host + 合成模型验证带预设轮次的 23 个段落和 2 条 Tavern 来源；移除请求 fixture 并重启后，
  未重新装配也可回读同一记录。两条样本记录合计约 34 KiB，仅为样本，不是固定容量估算。
- 浏览器确认配置优先、两组折叠详情、官方正文回读、来源原文未另存及请求 ST role 说明，
  无 warn/error。段落正文按文本展示，不能执行 HTML。实际模型消息中没有自动生成的身份包装。
- 测试环境的安装文件与候选包逐字节匹配；实际解析的核心包版本一致。更新已安装的运行中 Host
  后，需要重启才会加载新后端。

复验时将两个环境变量指向可解析目标 DSH 模块的依赖目录（包含 `package.json`）。
安装版 CLI 通常可以共用一个根；源码检出中 format 包和 Host 包可能位于不同目录，
两个变量可以分别设置。`DSH_TAVERN_COMPAT_ROOT` 需要解析 session format/catalog/迁移包及
session controller；`DSH_TAVERN_PROMPT_COMPAT_ROOT` 需要解析 Cordis、SystemPrompt、AgentLoop
等 Host 包。测试按指定根解析模块，不自动搜索 `apps/cli` 或其他工作区目录。

```sh
DSH_TAVERN_COMPAT_ROOT="$DSH_RUNTIME_ROOT" \
DSH_TAVERN_PROMPT_COMPAT_ROOT="$DSH_RUNTIME_ROOT" npm run check
DSH_TAVERN_COMPAT_ROOT="$DSH_RUNTIME_ROOT" \
DSH_TAVERN_PROMPT_COMPAT_ROOT="$DSH_RUNTIME_ROOT" npm run verify:2.0
```

未设置变量时相应集成测试会跳过，不能把跳过当成验收通过。仓库内可复现的真实 AgentLoop
路径见 `test/trace-v3-host.test.mjs` 和 `test/trace-failures-host.test.mjs`；合成模型和夹具不证明
真实模型、真实卡片或对方插件已经验收。

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
   不应再出现 Tavern 自动生成的 `<st-prompt>` 或卡片 ID 包装（作者自己写入的标签保留）。
   来源展开应显示身份、摘要和字数，并提示原文未另存；不要期待历史 source.text。
   未被其他插件改写时应显示核对成功；不要把段落输入关系当作逐字符映射。
   使用空昵称卡片确认 `{{char}}` 展开为卡片名；新世界书来源的 `entryId` 为书内 UID，
   `qualifiedEntryId` 为完整 Loader ID。与 v1 审计关联时同时核对 `resourceId`，并遵守 API
   文档中的裁剪和重复 UID 限制。
4. **历史不受当前编辑影响。** 保存第一轮 recordId 和详情响应，修改卡片或预设再发一轮。
   预期新轮使用新内容，官方日志保留且可验证时，旧 recordId 仍返回原正文、原绑定及原来源元数据；重启 Host，尚未激活
   该会话时再次查询，旧详情仍相同。在测试副本中移走日志后，正文应明确不可用、元数据仍可读；恢复日志后可重新读取。快速切换两个会话、开关 Trace，预期无串会话或过期响应覆盖。
5. **与对方插件联调。** 请开发者分别使用 [v3 reader](examples/trace-reader.mjs) 和
   [官方 observer](examples/official-prompt-observer.mjs)。先只观察，再用官方装配接口
   重排/替换一个具名段落、贡献一个新段落。预期只用官方接口也能操作段落；v3 能查看
   详细来源。改写的原段落和无 Tavern 元数据的新段落标为 unknown，不继承错误来源。
   共同确认加载顺序和采样设置；如使用 `complete` 覆盖，Trace 应明确显示装配核对不通过。
6. **真实模型与失败过程。** 使用已配置模型测试普通回复、多步工具、取消、超时及重试。
   对照官方轨迹核对 turn/step/attempt，预期各次请求独立记录，不覆盖上一条；
   `request-observed` 只表示到达 LLM 层，不能当作模型成功；未观察请求、失败或缺失正文
   均应显示相应状态，不拼造正文。多步和重试是否发生以官方轨迹为准。
   当官方日志包含失败信息时，v3 详情应返回 `failureStatus: "available"` 与 `failure.code/message`；
   重试成功后仍能读到失败尝试的原因。RP 对话不增加失败助手消息，不能靠 RP 消息判断是否发生过失败。
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

## 当前限制

Trace 是有界的近期追踪：所有会话共享默认 256 条、总计 16 MiB、单条 2 MiB 的新记录容量。
元数据和来源关系被淘汰后不能只凭官方消息完整重建；淘汰不删除 DSH 历史。
正文能否显示依赖官方日志保留且校验通过；元数据中的名称、关键词等仍可能敏感。
来源是段落输入关系，不是逐字符 source map。请求的 ST role 是元数据，当前贡献仍为 system sections；
不支持任意消息深度、独占接管或永久归档。来源原文不另存；当前资源通过 v1 查询。

一个 Host 写一个存储目录，不承诺多进程并发写入。冷 inspect 使用逻辑事件坐标，不提供压缩日志的
O(1) 随机读取。保留的较旧 DSH 路径不扩大本次目标运行时的验证范围。合并和发布等待维护者验收。
