# MVU 状态来源

[English](MVU_en.md) · [HTTP API](API.md) · [请求装配](REQUEST_ASSEMBLY.md)

MVU 变量是角色状态，和长期记忆资源类型分开。`tavernMvu`（协议 1）拥有状态、历史、版本、CAS 和幂等记录；可选管理器通过公开服务管理来源。Tavern 不依赖管理器，也不把状态复制到管理器数据库。

## 配置与资源身份

Host 发现已导入卡中的 InitVar/schema 时，将卡片登记为初始模板。`characterMvuId(characterId)` 是模板 ID，不是可编辑的状态资源。实际选择该卡后，来源按模板与可信 DSH session 的 `id + createdAt` 分配独立 `mvu:instance-*` ID；记录包含 `templateId` 与 `instance` 身份。新 branch 和 reply swipe 创建不同 session，也就拥有不同状态 ID、current、CAS revision 与幂等记录。模板不作为 manager 的 current 资源展示。

新发现实例默认 native，由来源处理已完成助手回复中的变量更新，不依赖可选管理器或额外 allow 规则；只有实际选择该卡的会话获访问范围。选择/取消/重选持久记录激活事件边界，不能把旧角色回复重新应用到新角色。切回同一角色恢复该会话原实例；重新选卡和源卡编辑不重置初始化/schema。发现不授予 wildcard 权限，不执行脚本。初始化失败显示 sourceError 并阻止执行。缺失或变化的 durable session 身份拒绝分配与读取。

加载旧账本时，只把自动发现模板的默认模式修正为 native，供后续新实例使用；显式配置的模板保持原模式。所有已有实例（包括自动发现、显式托管、复制与继承实例）的模式、管理操作、变量和历史均保持原样。来源自己的管理 API 不以模板为操作目标。已有 managed 实例仍须通过带 CAS 的 `setManagementMode` 明确切换，不凭缺少管理操作或历史配置版本推断用户没有规则，也不重放已处理的回复。

也可由 Loader 的 `mvu.resources` 显式声明资源，例如：

```js
{
  mvu: {
    resources: [{
      id: 'mvu:campaign',
      sessionIds: ['session-a', 'session-b'],
      initial: { stat_data: { hp: 100 } },
      managementMode: 'native'
    }]
  }
}
```

显式配置默认也是模板；`sessionIds:['*']` 允许各会话创建自己的实例。`initial` 也可为 YAML 字符串。配置 `characterId` 且省略 `initial` 时，读取已导入角色卡的 `[initvar]` 条目和声明式 schema；不会下载或执行普通卡片脚本；提交前命令 Helper 使用下述独立、有界的来源适配器。多个初始化对象按条目顺序合并，多个不同 schema 必须显式解决冲突。解析失败不覆盖已有持久状态。配置变更不是重置命令。

同一状态 ID 始终只有一份 current；scope 不把不同分支内容藏在同一 ID 下。确需跨会话共享的人工逻辑实体必须显式声明 `sharing:'shared'`，其配置 ID 直接作为状态 ID。`copy` 创建新的人工资源，保留访问范围但不作为 branch/swipe 继承操作。多个资源匹配同一气泡时，快照返回 `MVU_AMBIGUOUS`。

正常 fork 在调用官方创建操作前冻结具体来源实例、versionKey、revision 与内容 hash，之后原子安装子实例。子实例继承当时完整 variables/schema 和可验证的只读历史，不重放祖先更新或 schema transform。reply swipe 继承被重生成回复的持久请求前 checkpoint，包含当时开场配置；后续父状态变化不改变种子。首轮 swipe 使用新空会话；后续 swipe 分别绑定历史截断坐标 `prefixEndEventId` 和被替换回复坐标 `atEventId`，保留官方历史前缀，以目标 checkpoint 作为 current，排除之后的编辑。普通 fork 仍继承截断坐标的状态。新实例不继承 manager 策略、grant、capability 或 operationId。来源已托管时子实例保持 managed，包含后来切到托管的显式配置来源；子策略缺失不能自动启用 native 执行。Host 首请求等待初始化及 checkpoint 完成；缺失 seed 或 checkpoint 拒绝继续。

新状态写入 `mvu-instances.json`。旧 `mvu-state.json` 保留原字节，只作为带 `MVU_MIGRATION_REQUIRED` 的只读资源，不能更新、复制、提供给模型或作为继承来源。旧共享账本可能已串写，不按 session 自动拆分。绑定旧状态的会话需显式处理；新会话可独立从模板开始。

角色侧栏的“新周目”明确创建独立会话和状态，不复用尚无 DSH 对话但已初始化的旧周目。旧周目、旧状态和历史仍保留。
如需恢复其中已确认的数据，可信 Host 调用方可用现有原语：`read({id:旧资源ID,scope:{authority:'local',sessionId:旧会话ID}})` 读取只读记录，创建新周目后 `list`/`read` 确认其独立实例 ID 和当前 revision，再显式选择要恢复的 `stat_data`，以该新 ID、scope、`expectedRevision` 和新 `operationId` 调 `update`。不要把旧完整 envelope 或旧 schema 当作目标内容。
这是经目标 schema 验证的数据恢复；目标 schema 可转换或拒绝内容，CAS 冲突须重新读取并确认。它不迁移旧历史、schema、管理策略、授权或幂等记录，不改变旧账本；新发现实例默认 native，卡片执行与模型装配仍使用各自既有配置。当前不提供自动历史迁移或专用迁移向导。

发现不自动把状态加入模型请求。来源许可和宿主权限不能由卡片脚本自行提升。

## Host 服务

通过 `ctx.get('tavernMvu')` 或可选 `ctx.inject(['tavernMvu'], ...)` 获取服务。包导出 `pmp-dsh-tavern/mvu` 包含服务、安装函数、数据解析器及纯更新函数。

| 方法 | 合同 |
| --- | --- |
| `list({scope,signal})` | 返回作用域可读记录；本机管理读取使用 `{authority:'local'}`（兼容空对象） |
| `read({id,scope,signal})` | 不存在为 null；当前记录包含 `id,name,type,authority,scope,content,revision,currentRevision,historical,versionKey,managementMode`；实例还含 `templateId,instance,inheritedFrom?`，旧记录含 `legacy,sourceError,capabilities` |
| `update({id,content,expectedRevision,operationId,scope,signal})` | 当前内容 CAS 编辑；同 operationId、同请求幂等，异参拒绝；来源 schema 不可被移除或替换，候选只转换一次 |
| `copy({id,newId,scope,signal})` | 显式新资源，拒绝已有 ID |
| `history({id,scope,signal,includeBefore?})` | 返回该会话来源版本及成功/失败证据 |
| `facts({id,scope,signal})` | 返回本会话有界、无正文的来源观察事实；元数据不可用不改变变量状态 |
| `setManagementMode({id,mode,expectedRevision,operationId,scope,signal})` | 持久切换 `native` / `managed`，CAS 与幂等；配置初始 managed 也持久保存 |
| `registerCommandProcessor({id,source})` | 可信 Host 注册单个提交前命令来源；异步返回 `{receipt,dispose}`，不是卡片写 API |
| `registerUsage(handler)` | 注册可信使用决策，返回 disposer；handler 收到 `{on,id,scope,event,variables,managementMode}` |
| `observe(listener)` | 注册提交与请求事实监听，返回 disposer；监听器不能参与状态写事务 |
| `discover({definition,sessionId?})` | 可信 Host 发现接口；稳定模板身份、原生默认及显式会话访问 |
| `validateConfig(config)` | 检查 `type:'mvu-state'`、store/retrieve 触发及支持的策略链 |
| `captureSessionSeed({sessionId,kind,atEventId,prefixEndEventId?,targetSessionId?,signal?})` | 可信创建路径冻结来源，返回 opaque ticket 或无状态时 null；kind 为 fork / reply-swipe，首轮 swipe 必须预先指定目标 session ID，后续 swipe 必须给出 prefixEndEventId |
| `installSessionSeed({ticket,sessionId,signal?})` | 官方创建返回后校验子身份/父来源/继承消息，原子安装；同 ticket 同目标幂等，冲突拒绝 |
| `checkpoint(session,turnStartEvent)` | Host 在 durable turn/start 冻结一次请求前基线；后续 step 不覆盖 |

独立构造 `MvuService` 的可信 Host 必须为实例写入和 seed 操作提供 `captureSessionLease(sessionId)`，返回可同步调用的有效性闭包。官方安装函数通过公开 `resolveAgent` 恢复指定冷会话，再绑定会话服务、live 对象、header、事件代次与摘要；缺少租约拒绝写入/继承。Host 工作屏障在事务入队前等待，最后一次 await 后同步复核租约和 signal，再原子提交。未完成的首轮目标 receipt 持久阻止自动初始化；没有 receipt 的 fork 不能从当前父状态补猜种子。

`scope.authority` 仅允许 local；其他来源应使用自己的服务。会话读取要求配置授权。历史读取传 `messageId` 或 `endEventId`；联合坐标必须一致。历史记录的 `revision` 是该快照版本，`currentRevision` 是当前实体版本。历史 scope 不可编辑；调用者必须显式回到当前 scope 再读、再以 CAS 编辑。

已托管资源缺少管理器决策时拒绝执行，不回退 native。handler 可返回 undefined（没有管理配置），或 `{enabled,configRevision?,strategy?,reason?}`。卸载 handler 时取消尚未提交的处理。支持链为：

- store：`assistant_message_committed`，`parse_mvu_update → validate_update → apply_update`。
- retrieve：`before_model_request`，`read_content → render_state_and_update_instructions → provide_to_model`。

策略可以是上述名字数组或 `{operation}` 数组；未支持的参数明确拒绝。来源不实现管理器名单/rule DSL，由管理器决策。store event 含原生消息坐标、`text`、`containsMvuUpdate`；retrieve event 含 `preview,turn,step`。

事实格式为 `{id,eventId,phase,sessionId?,turn?,turnKind?,requestId?,revision?,detail?}`，phase 为 started/triggered/applied/skipped/failed/completed。`state-committed` 的 applied 仅在持久状态实际改变后发出。`dsh-request-observed` 的 applied 要求真实 `request/assembly` 内容与 DSH `llm/stream` 请求一致；它不表示网络发送成功。预览和解析器返回不构成 applied。

## Durable 历史与请求

只有完成的 `turn/end` 中最后一条非中断、非工具调用 assistant 消息参与更新。消息身份含 session、日志格式、创建时间（如有）、message ID/seq、turn/step 和结束事件。多层 fork 使用可信继承边界；继承内容不重放。恢复时核对持久来源，缺失或变动会阻止读取/注入，直至来源历史恢复一致。

命令在私有副本上逐条处理。普通 schema/缺失路径拒绝记录诊断后继续；解释器预算、非法语法或持久化错误是致命失败，不提交前面的候选变化。成功候选最后一次原子保存；失败可保存未变状态的诊断收据。重复已处理消息不再次应用。

预算区分单份状态和历史集合：每份完整 variables（包含派生的 display_data、delta_data、schema 与诊断）仍受 2 MiB 和结构限制约束；历史、checkpoint、分叉种子和事务收据逐份验证状态，不把整个集合套用单状态预算。所有持久状态与历史仍合计受 32 MiB ledger 上限约束，超限拒绝原子保存并保留原文件及 revision，不自动裁剪。Host checkpoint/ingest 只冻结 MVU 消费的会话身份、事件坐标、回合结束原因、用户来源及 assistant 文本/工具/中断标记；请求装配、provider、媒体及用户正文仍保留在 DSH，不复制进这份投影。文本指纹和持久来源审计不变。

装配来源 ID 为 `tavern.mvu/state`。调用者必须在装配策略中显式选择它，使用 `role:'system', lifetime:'request'`。没有选择时不注入。来源输出 stat_data 和更新指令，诊断绑定资源 revision、配置 revision 和策略版本。DSH 原生消息始终权威；卸载不会改写会话。

## Tavern Trace 逐轮表格

每轮 Tavern Trace 的世界书触发区域下直接显示 **MVU 变量与变更**。变量表列出 JSON pointer 路径、实际值、JSON 类型和最近有记录的更新轮次；触发表列出事件/轮次、来源结果、前后值及失败或跳过原因。同一回复的不同执行尝试分开显示，幂等重放不冒充再次提交变量。继承快照明确标注，不视为子会话重新触发。

变量表每页 20 条，筛选路径或切换状态后回到第一页。历史轮默认显示 **本轮最后状态（只读）**：该轮最后记录的确切版本，并非请求前 checkpoint。**助手回复更新** 是该次助手回复提交后保存的版本；跳过、失败或无更新时变量可能不变。缺失历史或前值证据显示为未知，不用当前内容补造。

最新 Trace 项对可编辑来源默认显示 **当前变量**，单独读取当前本机会话记录；读取失败不能编辑，也不会用历史值代替。点每行末尾 **编辑** 后，在实际值单元格输入 JSON，再点原位置的 **保存**，以观察到的 revision 和新 operationId 提交并显示来源校验后的结果。选择任何历史版本后保持只读。CAS 冲突或校验失败保留草稿；可取消、刷新当前状态后重新编辑。历史视图和运行中的回合不能保存。编辑不切换管理模式、不启用模型/store/retrieve 策略。切换会话或卸载组件会取消待处理读取和写入。

受现有认证保护的 v1 HTTP 传输映射来源原语：`GET /mvu/resources`、`/mvu/resource`、`/mvu/history`、`/mvu/facts` 和 `POST /mvu/update`，前缀为 `/pmp-dsh-tavern/api/v1`。读取使用 JSON `scope` 和所需的 `id`；当前 scope 必须为 `{authority:'local',sessionId}`，仅 `/resource` 接纳历史 `messageId/endEventId`。更新 body 为 `{id,scope,content,expectedRevision,operationId}`；旧账本和错误来源拒绝编辑。这些 Host 界面原语不暴露给卡片 VM，不替代卡片执行绑定。

`history({includeBefore:true})` 可增加 `beforeAvailable` 及从版本父项或回合前 checkpoint 校验得到的 `before` stat_data；继承和缺失来源证据保持未知。原有 history 调用保持数组形状。`mvu-facts.json` 全局最多保存 2,048 条触发元数据、总计 1 MiB，不复制变量或聊天正文；状态/版本仍由原 MVU 账本持有。旧记录或已淘汰观察不能证明未触发。可选触发记录保存失败单独显示，不把已成功的状态提交改判为失败。

## 气泡只读桥

`GET /pmp-dsh-tavern/api/v1/mvu/snapshot?scope=<JSON>` 使用现有 Tavern 请求认证。scope 为 Host 绑定的 `{playthroughId,sessionId,nodeId,variantId,endEventId,sessionFormatVersion?}`，必须与持久 timeline 和原生消息相符。浏览器不能传自选 messageId。读快照的 revision 保留历史语义，currentRevision 提供当前 CAS 版本。

客户端 `createMvuCardBinding({client,scope,signal?,pollMs?})` 异步返回 `{getSnapshot(),subscribe(listener),dispose()}`。快照为 `{version:1,status,scope,revision,variables,resourceId?}`；variables 是完整变量对象，包含 stat_data/schema。订阅采用有界轮询；scope 不可变，abort 可取消初次读取，销毁后读取拒绝。渲染模块负责脚本回调和生命周期。普通开场、导入、流式气泡不能冒充 durable scope；当前角色开场使用下述只读 greeting 模式；空会话写入另用 initial 模式。

## 已下载且开启的卡片变量

导入的内嵌脚本遵循保存的启用选择和总开关；总开关未设置时默认开启。外部代码先经导入提示或外观面板下载。内容可用且脚本开启后，受支持的卡片即可读写当前绑定变量；没有源码核对、单独写批准或权限到期步骤。

可信渲染器组装完整执行包，通过现有 `rendering-write-grants` 传输提交 `{source,sourceIdentity,executionId,downloaded:true,enabled:true}`，自动建立内部绑定。Host 重算 `{version:1,sha256,scope}`，仅保留身份和作用域。`tavernRenderingAuthority.resolve({grantId,sourceIdentity})` 与同步 `isCurrent` 验证同一执行仍有效；opaque token 不进入卡片代码。关闭、移除或重建运行时会撤销旧绑定；重建后按持久下载缓存和保存的开关自动建立新绑定，不把变量值或 token 移到另一个 session。Host 重启后，可重新建立仍有效的持久消息绑定。带选择 token 的开场视图须重新读取并重建，旧 token 不会被自动替换或复活。

`POST /pmp-dsh-tavern/api/v1/mvu/card-binding` 接受 `{scope,grantId,sourceIdentity,bindingId?}`，仅绑定当前 timeline 头或经验证的空会话开场。`POST .../card-write` 接受 `{capability,operation:'patch'|'replace',value,expectedRevision,operationId,cause}`；`POST .../card-binding/revoke` 停止绑定。scope、当前选择与成员关系、来源 schema、CAS、幂等、取消及最终同步执行复核仍保留；历史和生成中的消息只读。capability 没有按时间失效的批准门，在执行结束或服务卸载时删除。可信客户端先生成 executionId/bindingId；同一身份同参重放只创建一项，异参拒绝。失联或初次失败仍可用已知身份清理，创建中的撤销在最终 await 后复核；失败清理在当前页面显示并可重试。客户端崩溃或刷新后丢失的内存清理队列不承诺自动回收，Host 卸载清空内存绑定。

`card_variable_update` 是来源执行事实，不是 manager 的 store/retrieve 许可请求。默认或缺失 manager 配置不会挡住已开启卡片的变量操作。manager 继续观察 started/triggered/applied/completed/skipped/failed；只有实际状态变化产生 `applied` 与 `detail:'state-committed'`，此类原生事实使用 `configRevision:null`。模型请求注入和助手更新仍执行既有 manager 策略及 lease。已有卡写策略声明不授予或拒绝原生卡片执行。

可信 dispatcher 从原生事件或 timer 任务取得 cause（`user-interaction`、`interval`、`script`）；卡片只提交 operation/value 和受限 options。Host 信任已认证 UI 的证据，不声称加密证明人类点击。自动传输恢复保留 Worker 实际看到的 revision 和原 operationId，不改用最新 CAS 或新操作 ID。

已观察的签名仍是返回整份变量的 `Mvu.getMvuData(options?)`、`Mvu.updateVariablesWith(JSONPatchArray)` 与 `await Mvu.replaceMvuData(variables,options?)`；不宣称 callback updater 重载。VARIABLE_UPDATE_ENDED 仅在此绑定提交后提供无参回调。跨 scope fallback 仍拒绝；下载代码不会开放网络、父页面 DOM 或 Host 工具。

## 开场的当前只读变量

同一 snapshot API 接受 `{mode:'greeting',playthroughId,sessionId,characterId,sessionFormatVersion?}`，只读取选定角色资源的当前值。Host 核对根会话 membership、角色选择、会话身份与唯一活动资源；不恢复 Agent，不回放事件，不重置状态。该绑定可在用户已经发起回合后继续读取，即使还没有已完成的 assistant 消息。它不是历史消息快照，不跟随其他会话的 focus，也不能创建写 capability。导入或缺失本地会话不能借此伪造绑定。

开场渲染将只读 greeting scope 与空会话 initial 写 scope 分开；角色或周目切换会取消旧读取及订阅。缺失变量和初始化错误应显示错误，而非补造默认状态。

显示端可用 `greetingIndex` 固定自己实际读取的选中开场；来源拒绝不匹配的索引。HTTP 只在 `greeting`、`initial` scope 接纳 `greetingIndex/selectionToken`，历史消息 scope 不能附带未验证的选择身份。当前开场快照带 `viewIdentity:{greetingIndex,selectionToken}`，token 绑定来源 Host 实例、会话和选择代次，不是写授权。带索引的 initial 写 scope 还必须带该已观察 token，并纳入原有独立 grant 的完整 scope。切换 A→B、A→B→A、Host 重启或领能力前切换都会拒绝旧视图；不能以懒领取的新能力替换旧显示意图。

隔离 Worker 提供有限的首消息读取：`getChatMessages(0|'0')` 只返回本绑定选中开场的 source 正文（名称宏展开、显示正则之前）。`SillyTavern.getContext().chat[0]` 是同一投影，数组 length 为该根会话的 user/assistant 持久消息数加开场；其余项为 null，未开放其他聊天正文或完整 ST context。`Mvu.getMvuData({type:'message',message_id:0|'0'})` 仅在本 greeting/initial 绑定上作为当前资源别名；`latest` 只有开场是唯一消息时可用。全局 `getVariables` 的严格 scope 规则保留，别名不授予写权限。

只有同一绑定会话读回不同的选中开场索引，才生成一次选择通知。成功启动并完成监听器注册后，Worker 派发 `tavern_events.CHARACTER_FIRST_MESSAGE_SELECTED`（`character_first_message_selected`）的 `{input,output}`，两者均为已选 source 正文；这是已确认选择通知，回调不能改写 Host 开场。随后 `tavern_events.MESSAGE_SWIPED`（`message_swiped`）携带首消息 ID 0。首次挂载、刷新和重启不会伪造选择或 swipe；失败启动未消费通知，同一选择成功投递后不重放。DOM ready 或卡片调用不能生成可信生命周期事件。延迟回调的变量写仍按 script/interval 原因、选择 token、独立 grant、策略、CAS 和来源租约验证。这些是绑定视图的有限适配，未承诺上游的群聊选择中间件、任意消息事件、提示注入或父页面 DOM。

隔离解释器提供有限的 clean-room 显示辅助方法：`_.get`（自身属性的点/简单括号路径）、`_.isEmpty`（JSON 值）、`errorCatched(fn)`（将同步及异步异常交给渲染错误界面），以及 `$` 的 length/ready/text/html/on/val/css/show/hide/addClass/removeClass/empty。它们用于有界的数据显示，不代表完整 Lodash、jQuery 或 Helper 兼容；没有新增 Host、网络或写入权限。

卡片脚本登记监听器后，启动依次向 document 和 window 发送 DOMContentLoaded，再向 window 发送 load；两者在隔离 DOM 中使用独立事件目标。读取变量仍要求 available 绑定快照。依赖 SillyTavern 父页面输入框或生成按钮的脚本不能借此访问 Host DOM。

## 当前空会话的开场绑定

同一 snapshot/card-binding/card-write API 接受独立 scope `{mode:'initial',playthroughId,sessionId,characterId,sessionFormatVersion?}`。不得同时带 nodeId/variantId/endEventId，也不能将普通 session-only 管理接口当作卡片能力。Host 检查根会话 membership、角色选择、空 timeline，以及唯一可访问且活动的角色资源；开场配置只更新绑定会话的状态实例，同一卡模板的其他实例保持独立。

初始绑定必须持有受控 live DSH session；尚未加载时只通过公开 `sessionController.resolveAgent(sessionId)` 恢复指定会话，无法恢复则拒绝。恢复生命周期完成后重新核对角色选择和 membership，再为新绑定取得租约；恢复前的旧能力不会复活。空对话历史仅允许官方 DSH 初始化使用的 `permission/preset`、`sandbox/mode`、`approval/policy` 三种确切配置元数据、官方选模型产生的 `model/selection`（data 仅含非空字符串 `provider`、`model` 及可选非空字符串 `reasoningEffort`），官方显式改标题产生的 `session/title`（data 仅含非空字符串 `title`、空数组 `messageSeqs` 和严格 `{kind:'user'}` 的 `source`），以及官方恢复产生的 `session/end-seed` 且 data 严格为空对象的标记；不按事件前缀放行，`isSeeded:true` 或带 inherited/其他字段的标记仍拒绝。turn、user/assistant message、inbox、未知事件及父会话/继承历史均拒绝。同步租约绑定 session 对象、header、事件代次、membership 和本会话的选择代次。`PlayMembershipService.captureLease(playthroughId)` 使用 `PlayWorkspaceStore.captureReadLease(paths)` 捕获 catalog 与对应 timeline 的进程内写入代次及 workspace 身份。公开写入成功即更新不可复用令牌，即便内容 hash 恢复原值，旧绑定也不会复活；workspace 身份切换后恢复同一路径同样失效。该文件级租约会在任何 catalog 写入后要求新绑定；无关文件写入和失败 CAS 不撤销。进程重启不保留 capability，租约也不作为持久内容版本。选模型和改标题事件仍推进事件代次，旧能力失效后须重新绑定；标题改走再改回也不会恢复旧能力。自动标题来源、非空消息引用或未知标题字段均拒绝；首轮开始或角色切走再切回后旧能力失效；其他会话修改选择不会撤销此能力。渲染宿主在离开、切 session、切角色时必须 abort/dispose 旧 binding，重新进入须创建新绑定，不能把旧气泡转向当前 focus。

initial 写入仍经过独立 grant、使用策略租约、CAS、幂等与 schema 校验。账本使用 `source.initial:true` 标记用户开局配置，不伪造 assistant message；首个正式回复继承已提交当前值。initial 模式是当前内容视图，首轮后该模式不可再读取或写入，持久初始记录仍可由来源管理接口查看。

## 显式内置适配器的 schema 确认

可信渲染 adapter 可读取 available snapshot 的 `variables.mvu_schema:{mvuSchema:1,interpreterVersion:1|2,source}`，严格比较 source 与准备替代的完整原始声明脚本。匹配表示后端解释器已处理该声明，整段声明不再在 VM 执行，不重复初始化或 transform。缺描述符、版本未知、源码不同均拒绝；不能用空的 registerMvuSchema 函数伪装成功。此合同不提供动态 Zod 对象注册或 schema 热迁移。

新声明编译为解释器版本 2；持久保存的 v1 描述符继续原解析、根对象模式和命令语义，读取、重启或选择卡片不会转换已有实例，完整声明 source 保持原文。对于静态核验的 `https://testingcf.jsdelivr.net/gh/StageDog/tavern_resource/dist/util/mvu_zod.js` 注册入口（SHA-256 `78c40f52d81022d9d769a923a49e673b8babb562656051a7d0410b6b19f45184`），v2 按固定 helper 从 shape 把直接注册的根 ZodObject 重建为 loose 对象；包含仍保持 ZodObject 类型的对象 refinement，重建不保留根 strict 模式及对象自身检查。嵌套 schema 保持各自规则，transform、default/prefault、nullable/optional、union、record 和 array 根不冒认为直接对象。普通声明和其他 import URL 不自动转换根对象，不获取或执行上游 import。

v2 DSL 支持 `z.looseObject(shape)` 和 `z.strictObject(shape)`：普通 `z.object` 剥除未知键，loose/passthrough 保留，strict 拒绝；字符串键 record 可以增加字典成员并验证每个值，枚举键 record 仍限制键集合。根对象 loose 不递归允许嵌套未知字段。

v2 Zod 命令可在私有候选中通过 set/insert 创建缺失路径。insert 先尝试对象候选，schema 验证拒绝后再尝试数组，仅保留成功解析的候选；对象插入为浅赋值。set 的数字转换由 Zod schema 决定，add 仍要求已有数字。路径创建保留 JSON/prototype、稠密数组和原大小/结构限制；原生元数据及 v1 命令维持原路径规则。CAS、事务收据、来源 schema 所有权、grant 与 usage 策略继续由已有 API 核验。本修复不改变 schema 校验的事件时机，也不提供关闭校验的选项。


远程模块标识/hash、默认关闭的替代模式和界面诊断由渲染 adapter 独立核验。上述确切 mvu_zod URL 接纳静态核验的两组 SHA-256：`78c40f52d81022d9d769a923a49e673b8babb562656051a7d0410b6b19f45184` 和 `e540ab99589ad83de1495056a84693bda00af92f8848926bcb9a53b9263a0302`，均映射到同一后端 schema 登记适配器。未知字节或 URL 仍拒绝；这不代表支持上游其他运行回调。后端 descriptor 的解释器版本不能当作上游 bundle 字节身份，也不证明原 bundle 运行过。

## 兼容边界与验证

核心参考固定为 [MagVarUpdate 183d8ade](https://github.com/MagicalAstrogy/MagVarUpdate/tree/183d8ade3b9a3369e824a55cb13b4ddf91aada50)（MIT）；少量原始文字解析 fixture 附带许可。mvu_zod 仅作语义参考，没有复制其执行代码或 Helper 的 PolyForm Noncommercial 代码。声明解释器使用 Acorn AST，不 eval、Function、import 或获取远程模块。

| 能力 | 实现与边界 |
| --- | --- |
| 初始化 | 有界 YAML/JSON5、拒绝 tag/alias、顺序合并；支持显式配置与卡源自动发现，原生默认不授予跨会话访问 |
| 命令 | set/add/insert/assign/remove/unset/delete；JSONPatch replace/delta/insert/add/remove/move；安全 dot/bracket/JSON pointer 路径 |
| 原生元数据 | extensible/recursiveExtensible/required、对象/数组模板、arrayMeta、扩展标记；按值/索引删除；严格/兼容 VWD 设置 |
| schema 声明 | object/array/record/enum/literal/union、number/string/boolean/any/unknown、coerce、default/prefault/optional/nullable、min/max/int、strict/passthrough/strip、transform、custom superRefine、有限 regex |
| 声明函数 | 同步箭头或 function 表达式、标识符及默认参数、只读词法捕获、可选成员链；注册包装可使用单一调用的表达式或语句块 |
| 纯表达式 | 算术、比较、条件、对象 spread、常量/局部变量、输入字段赋值、clamp、有限 Math 函数；静态节点白名单与执行预算 |
| 隔离 | 私有能力标记；schema 以声明源和 interpreterVersion 保存，每次隔离构建；数组 length 写入、对象隐式数字/属性转换、动态原型路径拒绝 |
| 尚未等价实现 | 完整 mathjs（矩阵/单位等）、Date 构造及日期加法、上游路径修正、全部容错解析、旧 display_data/delta_data 文本格式、除上述实际调用形状外的 Helper 写 API/可变事件 hook、MVU 额外模型调用 |

支持所列声明不等于任意 Zod JavaScript 兼容，方法组合也须经过测试；对象型 coerce 明确拒绝。当前 display_data 为结果值副本，delta_data 为内部变化记录。不能将这些字段宣称为旧 UI 的完整格式兼容。默认指令只要求 literal JSONPatch，复杂生成策略须有独立公开扩展合同。

有效 schema 中保留的 `superRefine` 在验证后的冻结 JSON 副本上运行，仅允许 `ctx.addIssue({code:'custom',path?,message?})`；任何 issue 拒绝候选，不提交状态。`Object.prototype.hasOwnProperty.call(data,key)` 是显式 own-property 检查原语，不开放 Object 或原型。声明可用 `for (const item of array)` 遍历最多 1000 个数组项，和函数/约束共享计算预算；其余循环、this、arguments、异步/生成器、rest/解构参数、外部能力仍拒绝。这些是受限的 [Zod 语义适配](https://zod.dev/api#superrefine)，不会执行原声明脚本。

字符串 `regex` 仅接受无 flags、`^...$` 全锚定的有限模式：字面字符、`\d`、字符范围、分组内选择、`?` 和 `{m,n}`（最大 64 次）。模式最多 256 字符、16 层分组及 2048 个自动机状态；建图、声明图冻结和匹配均消耗共享计算预算，不能通过循环复制模式绕过总量限制。匹配使用状态集合，不调用原生 RegExp 匹配。无界重复、通配点、回溯引用、环视均拒绝。解释器函数、schema、参数绑定和 AST 保持不透明，不能作为 JSON 内容读写。原始完整声明仍保存在 schema 描述符中；兼容扩展不重置已有资源、不更换 ID、不自动启用 managed 策略。

`node --test test/mvu-state-instances.test.mjs` 验证独立身份、fork/swipe checkpoint、只读旧账本、重启、取消和提交竞态。以 `DSH_TAVERN_ASSEMBLY_CORE_ROOT` 指向具备请求装配扩展的官方 runtime，运行 `node --test test/mvu-instance-host.test.mjs`，可验证公开 SessionController 的创建/fork、真实 AgentLoop 请求与失败轮次重生成；它只使用临时数据和合成 provider。

`test/mvu-*.test.mjs` 覆盖合成卡结构、固定上游文字 fixture、CAS、fork、历史、故障恢复、预算反例、管理卸载和桥接取消。真实 Host 测试通过 `DSH_TAVERN_PROMPT_COMPAT_ROOT` 指向具备请求装配扩展的 DSH runtime，运行 `node --test test/mvu-host.test.mjs`；它使用临时目录及合成 provider，不操作真实 profile。完整卡片、渲染依赖与管理器最终联测需要另行验证，不能用解释器 fixture 代替。 `test/mvu-history-budget.test.mjs` 另覆盖跨单状态预算的历史集合、保存超限的原子拒绝、冻结种子与冷恢复；设置上述 runtime 后还验证官方 AgentLoop 八轮请求及 detached Session 恢复。


## Prompt Template 依赖读取

可信 Host 可调用 `tavernMvu.resolvePromptDependency({id,scope:{authority:'local',sessionId},event:{preview,turn?,step?,usage:'prompt-template-dependency',consumer:{adapterId:'tavern.prompt-templates',id}},signal?})`。consumer.id 必须是实际选定模板 ID；VM 不能自行选择来源、scope 或 consumer。类型定义见 `packages/mvu-adapter/src/prompt-dependency.d.ts`。

来源缺失、不可用或策略拒绝时返回 `null`，允许时返回 `{id,adapterId:'tavern.mvu',content,revision,configRevision,checkCurrent}`；无效 scope、取消与配置错误抛出异常。content 是包含 stat_data 的完整变量对象副本，不是历史快照。读取经过 MVU 自己的 `before_model_request` 策略和固定 read/render/provide 链；managed 来源必须获得明确许可；对这个依赖接口，每个已注册策略 handler（包括原生来源上的 handler）都必须返回带同步租约的允许决策，`undefined` 弃权会拒绝释放内容。没有策略 handler 的 native 来源保持原生许可，旧 `resolveRequest` 语义不变。管理接口 `read` 成功不等于允许模型检索。

仅供 Host 保存的同步 `checkCurrent()` 会在来源 revision、角色选择、catalog/timeline 成员关系 ABA、manager reload/卸载、取消或来源卸载后拒绝旧结果。Host 必须能够核实会话选择和成员关系，无法核实时拒绝。`PlayMembershipService.captureContextLease()` 使用 `PlayWorkspaceStore.captureMutationLease()` 核实全部公开文件写入、目录创建及工作区身份变更，包含缺失 catalog、未绑定工作区和成员关系 ABA；因此无需为原生会话创建 catalog。该保守租约也会因无关文件写入失效，调用方需重新读取。调用方应在模板实际读取变量时才调用，将租约留在 VM 外，并在最终装配处无间隔 await 地再次检查。取得依赖不会产生 applied 事实或声称已提供给模型；此接口不增加 HTTP 路由或写权限。


## 来源提交前命令 Helper

已启用角色卡中的单个完整 inline 声明若注册 `global_Mvu_initialized` 和 `Mvu.events.COMMAND_PARSED`，来源可在独立 QuickJS VM 中执行它。来源按状态实例持有一个有效处理器，重复读取复用初始化 promise 与注册回执；显示 VM 的数量、隐藏或卸载不决定来源处理器生命周期。卡文件的 enabled/disabled 控制此来源声明；渲染端本地显示开关只控制显示执行。冲突声明拒绝，关闭来源声明或卸载服务会使旧注册失效。可信 Host 也可用 `registerCommandProcessor` 替换注册；旧 disposer 不能删除新注册。未新增 HTTP 注册端点。

适配器提供真实初始化事件、`eventOn`、`eventMakeLast` 和 `COMMAND_PARSED` 的有序同步回调，回调收到 `(variables,commands,messageContent)`。命令视图为 `{type,args,full_match,reason}`，路径和 literal 参数保留原始命令顺序与 JSON Pointer 转义。只允许过滤原命令和恢复单个严格 JSONPatch 的缺失 value 分隔符，或单个 UpdateVariable JSON 数组；恢复后的 factory 参数及 full_match 必须匹配原始操作。任意新写入、改值、重排、未知语法或不安全路径都拒绝。变量是私有基线副本，回调不能修改基线；输出仍由原来的 path、schema、原子 apply 校验。此有限适配器不承诺上游所有事件或动态插件 API。

用户操作 gate 仅从同一 durable turn 的用户文本读取，最大 64 Ki 个 UTF-16 code units；超限文本不截断，也不授予 gate 条件。单个操作块限 30,000 code units，须包含执行边界和操作项。gate 是额外过滤条件，不是管理策略、卡片 grant 或新的权限。处理器没有 DOM、模块导入、网络、文件、Host 函数或写变量 API，代码限 64 Ki code units、内存 32 MiB，每次解释器入口有 250 ms/中断预算；异步脚本回调拒绝。异步 Host 初始化和调度后，在同一次保存前同步复核策略 checkCurrent、注册代次、源内容租约、selection/membership、session 和捕获的 revision；正常及错误出口都遵守撤销，失效不会保存失败回执来消耗该回复。原生无策略 handler 的原路径保留。

记录及绑定快照可含 `commandProcessor:{protocolVersion:1,registered:true,registrationId,source,sha256,listenerCount}`。渲染端严格比较完整 source，收到真实回执后才替代该 Helper；原脚本不再在每个显示 VM 中重复执行。回执仅证明处理器已注册，不证明状态变更。只有原子保存之后的 applied/completed 才证明提交；已提交 source key 的重放在调用处理器前结束。

事件顺序与命令参数以固定版本的 [MVU 更新流程](https://github.com/MagicalAstrogy/MagVarUpdate/blob/438f9ffcba95e6c54497fa8d4223f0f48506d35a/src/function/update_variables.ts) 和 [事件类型](https://github.com/MagicalAstrogy/MagVarUpdate/blob/438f9ffcba95e6c54497fa8d4223f0f48506d35a/src/variable_def.ts) 为依据；该实现是受限的独立适配器，不复制外部 Helper 实现。
