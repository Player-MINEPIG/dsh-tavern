# 提示词模板与可管理来源

[English](PROMPT_TEMPLATE_en.md)

Tavern 的 Prompt Template 是独立的、受限的只读请求装配来源，不是 Session Template，也不安装或执行 SillyTavern 扩展。模板资源的 `content` 始终保存作者原文；展开结果进入统一装配器并记录到 DSH `request/assembly`，不会覆盖原文或原生历史。模板只在显式选择该来源的请求装配策略中运行。

## 上游范围与支持矩阵

对照的官方扩展为 [zonde306/ST-Prompt-Template](https://github.com/zonde306/ST-Prompt-Template/tree/d6f520d149aba146305b0b781ddd691d449c28d2)，该版本 [manifest](https://github.com/zonde306/ST-Prompt-Template/blob/d6f520d149aba146305b0b781ddd691d449c28d2/manifest.json) 为 1.17.9，[许可证](https://github.com/zonde306/ST-Prompt-Template/blob/d6f520d149aba146305b0b781ddd691d449c28d2/LICENSE) 为 AGPL-3.0。本实现没有复制或链接该扩展的代码，使用独立标签编译器和项目现有 QuickJS 依赖。支持 EJS 风格语法不代表完整扩展兼容。

| 能力 | 当前行为 |
| --- | --- |
| `<% code %>`、`<%- expression %>`、`<%= expression %>` | 支持 JS 条件、循环、局部函数、Promise/await；后者转义 HTML |
| `<%# … %>`、`-%>`、`_%>`、`<%% … %>` | 注释、换行/空白裁剪、字面标签 |
| `print(...values)` | 有界文本输出；不修改来源 |
| `variables`、`getvar(path, {defaults, clone, scope})` | 冻结 JSON 快照；支持点/数字或带引号下标路径，scope 仅 cache；clone 参数不提供可写状态 |
| `getwi(book, title)` / `getwi(title)` | 按 ID/名称及条目 UID/标题匹配当前所选独立或内嵌世界书；经该书的实际使用授权后，只返回本次已激活条目的原文，不递归求值 |
| `getpreset(name)` | 当前预设中按 identifier/name 读取原文 |
| `getchar(name?)` | 只读取当前角色的 description；不实现上游完整角色定义默认格式、自定义模板或任意角色检索 |
| `getWorldInfo`、`getPresetPrompt`、`getChara` | 上述函数的别名 |
| `setvar`、`execute`、其他写入/命令接口 | 拒绝；无变量持久化、副作用或 Host 命令执行 |
| preload、消息生成后/render 生命周期、`@INJECT`、脚本库、递归模板数据参数 | 不支持，不显示为可执行事件/策略 |

上游[功能说明](https://github.com/zonde306/ST-Prompt-Template/blob/d6f520d149aba146305b0b781ddd691d449c28d2/docs/features.md)和[API 参考](https://github.com/zonde306/ST-Prompt-Template/blob/d6f520d149aba146305b0b781ddd691d449c28d2/docs/reference.md)还包含多作用域变量、生成/渲染注入和写入行为；这些不由当前适配建立兼容性。读取到的 EJS 原文不会自动执行。

`inspectTemplateMetadata({name,content})` 识别明确标题标签与正文首行起连续的 `@@` 装饰器：`[GENERATE:BEFORE]`、`[GENERATE:AFTER]` 提议 `before_model_request`，并要求调用方明确装配位置；不会自动等同于 ST 的前后注入顺序。`PRELOAD`、`RENDER`、`InitialVariables`、带索引/正则的 `GENERATE`、`@INJECT` 均返回不支持诊断。官方装饰器（包括 preload/render、generate、initial_variables、if、activate、private、iframe、preprocessing）目前均识别但不执行；未知装饰器也明确拒绝。带这些未实现语义的资源不能启用；`@@@` 为字面转义，不声明装饰器。任意 JS 的分支不会被拆成外层 rule。识别函数本身不导入、不启用资源。

## 资源配置

首次启动可用插件配置 `promptTemplates.resources` 初始化资源；随后以 storageDir 内 `prompt-templates.json` 为准。手工更改该文件须停止/重启 Host，既有文件不会被启动参数覆盖。编辑器只改 `content`；启用、会话绑定、变量来源由资源配置文件控制，复制件默认禁用。

```json
{
  "promptTemplates": {
    "resources": [{
      "id": "prompt-template:scene",
      "name": "Scene prompt",
      "content": "地点：<%- getvar('scene.location', { defaults: '未设定' }) %>",
      "enabled": true,
      "sessionIds": ["example-session"],
      "variables": { "scene": { "location": "旅馆" } }
    }]
  }
}
```

`sessionIds` 必须显式指定；`["*"]` 表示所有会话。无 sessionId 的预览不运行模板。`variableResourceId: "mvu:example"` 可代替静态 variables，在模板实际访问 `getvar` 或 `variables` 时调用 `tavernMvu.resolvePromptDependency`，取得该 MVU 本次模型使用的内容快照及有效租约；服务缺少此能力、资源不可访问或规则拒绝时终止装配。未访问变量不读取 MVU。它不是 ST global/local/message 变量映射，也不会选择一个模糊的 MVU 资源。历史查看使用已记录结果，不重新求值。配置编辑器的 raw read 不能作为提示词使用许可；没有 raw read 回退。

然后在装配策略 JSON 的 `rules` 中显式加入：

```json
{"id":"scene-template","kind":"pmp-dsh-tavern/prompt-template","enabled":true,"role":"system","lifetime":"request","depth":null,"text":"","name":"Scene template"}
```

将该规则放在所需位置并应用策略。现有内置策略不会隐式增加模板来源；已保存的应用快照也不被修改。该来源只支持 request 保留方式。

## manager 公共合同

Host 服务 `tavernMemorySources` 暴露 `{protocolVersion:1, adapters:[...]}`。资源适配器与请求来源目录相互独立：

| 资源适配器 | 稳定资源 ID | 装配来源 | 策略链 |
| --- | --- | --- | --- |
| `tavern.prompt-templates` | `prompt-template:<id>` | `pmp-dsh-tavern/prompt-template` | `prompt_template.expand` → `prompt_template.emit` |
| `tavern.world-books` | `world-book:<库 ID>` | `worldbook` | `worldbook.activate` → `worldbook.emit` |

两者提供 `list/read/validateConfig/setManagementMode/registerUsage/observe`，`authority: 'local'`、`strategyOwner: 'source'`。模板另提供 `update/copy`；世界书正文仍用既有世界书资源 API 编辑，manager 不声明正文写入能力。`read` 返回 `content/revision/managementMode/execution`。模板的 content 是字符串，世界书 content 是资源文档。内嵌书使用 `world-book:character:<角色 ID>:embedded-world-book`，`origin.kind` 为 `embedded-character-book`，包含所属角色身份。此 ID 与原生激活的 `character:<角色 ID>:embedded-world-book` 对齐。

`optionCatalog` 为 JSON：`version/types/events/strategies/presets/modes`。只有 retrieve 的 `before_model_request` 和上述完整固定链可选；store 明确不支持。预设 ID 是 `builtin:prompt-template-retrieve`、`builtin:worldbook-retrieve`，不含身份、白名单或隐式权限。使用方可以自由组合其 scope/rule；新增执行能力仍由受信插件注册，不通过配置文件注入 Host JS。

```json
{
  "id": "prompt-template:scene",
  "adapterId": "tavern.prompt-templates",
  "type": "prompt-template",
  "whitelist": [{"sessionId":"example-session"}],
  "blacklist": [],
  "retrieve": {
    "on": "before_model_request",
    "rule": {"all":[true,{"not":false}]},
    "strategy": [{"operation":"prompt_template.expand"},{"operation":"prompt_template.emit"}]
  }
}
```

实际管理方由可信 Host 当前注册决定：无 manager 为来源 native，manager 注册后为 managed，卸载恢复来源默认。保存的旧偏好通过 `storedManagementMode` 保留；CAS `setManagementMode` 不代表当前委托。内容编辑与配置覆盖互不替代。

`registerUsage(handler,{providerId:'dsh-memory-manager'})` 请求为 `{id,on,scope,event,managementMode}`。managed 需要返回 `{enabled:true,configRevision,strategy,checkCurrent}`；无决策、拒绝、错误、来源变化或过期租约阻断相应输出。来源在最后 await 后及全部来源解析完毕后同步复核；注册表可选 `validateResolved(context)` 钩子必须同步且只读。manager 必须跳过 `strategyOwner:'source'` 的通用执行，否则会重复输出。这里的来源策略名称仅为声明，不注册 manager 通用操作。通用来源 handler 无此标记，不改变实际管理方；它的显式拒绝仍有效。`getManagementDefaults({id,scope?})` 公开固定来源链及 source-bound 同步租约，配置只含 type/retrieve。

世界书来源可在当前无会话开场预览的默认配置快照上附加 `previewScope: {characterId?,presetId?,userId?}`。这是仅限 Host 的已选资源绑定证明；`checkCurrent()` 同时校验草稿版本、选项、资源版本和来源生命周期。Manager 仅在来源回调的 `event.preview === true` 且没有 sessionId 时使用此范围，不创建虚假会话、不持久化通配许可；本地/预设白名单、黑名单、禁用与 retrieve 规则仍生效。普通资源库查询不提供此证明。旧版 Manager 不识别该可选字段时仍可能拒绝开场预览，需同步更新 Manager。

实际 `llm/stream` 请求必须与 durable `request/assembly` 内容相符、且包含对应来源节点，才发 `applied` 观察。预览不发 applied；该状态不代表提供方网络送达。原文放在模板节点的 `children` 中，展开文本在节点 `text` 中。

## 世界书管理权

native 沿既有绑定、关键词、概率、预算与位置规则激活；managed 仍只处理已绑定的资源，由 Tavern 激活一次，并在异步来源阶段检查 manager 的外层条件与租约。聚合来源名称不被伪装成单一资源。内嵌世界书也逐书列出，实际管理方遵循同一注册生命周期；只有当前选中角色的内嵌书参与请求，条目仍使用原生激活一次。manager 不编辑角色内嵌正文，既有角色世界书 API 继续拥有编辑能力。

原生路径和新装配均在一次激活后使用同一异步策略过滤。managed 世界书必须使用 request 保留方式，已保留的 native snapshot 不能绕过当前撤销。来源默认不绑定未选资源、不添加装配规则；现有递归扫描、vector 和位置限制仍然有效。

## 模板依赖使用合同

依赖使用由可信 Host 根据实际 helper 读取发起，不能由模板声明权限。目标来源收到 `{id,on:"before_model_request",scope,event,managementMode}`；`event.usage` 为 `prompt-template-dependency`，`event.consumer` 记录真实模板 `{adapterId,id}`。consumer 只用于条件上下文，不继承其白名单或许可；目标资源仍验证自身管理模式、配置、scope、rule 与固定策略。managed 依赖检索被禁用、被拒或缺少已注册管理器许可时失败，不回退 native 或 raw read；卸载使旧租约失效，新的读取恢复来源默认。native 依赖在无监听器时保留来源许可；已注册监听器必须逐个提供明确 native 许可及可撤销租约，不能用 undefined 代替。此许可不应用 managed 配置、不转移管理权；普通 native 装配行为不变。

来源的 `resolvePromptDependency` 返回 Host 内部 `{id,adapterId,content,revision,configRevision,checkCurrent}`，不把租约暴露给 VM。MVU 使用自身只读请求策略；世界书复用本次原生激活记录并检查正文版本，只提供已激活条目，不另执行概率抽签。因此 `getwi` 不能读取被激活规则排除的条目，与上游任意导入行为存在明确差异。

模板收集实际使用来源的租约；每次 await 后、模板完成后以及所有装配来源完成后同步检查模板自身及所有依赖的版本/策略/选中状态。VM 内捕获读取错误或伪造输出不能跳过外部授权。装配诊断 `TAVERN_MEMORY_DEPENDENCY_VERSION` 记录消费模板与依赖版本；世界书实际使用观察关联最终模板节点。raw 配置编辑读取与提示词求值上下文隔离。

## 隔离与验证

模板在独立 QuickJS WASM 实例中运行，无原生模块、文件、网络、定时器或 Agent 句柄。同步 lookup 桥只记录请求或返回已授权 JSON，不做 I/O；新依赖在 VM 外由可信来源决策，然后用新 VM 重放当前只读模板。正文输入分离并冻结；不预载角色/预设原始文档、世界书正文或 MVU raw 快照。限制模板 128 Ki 字符、输入快照 2 MiB、输出 512 KiB、VM 内存 16 MiB、栈 256 KiB、向前扫描的有界标签编译、累计约 75 ms 编译与 VM 执行预算、每轮最多 1,000 次 pending-job 步进、最多 32 次新 lookup 和 512 次桥调用。递归模板求值仍不支持；循环读取及反复构造依赖受预算限制。错误使装配失败，原文不被覆盖；同步 VM 预算到期会中断，已取消 signal 在执行边界拒绝。

```sh
node --test test/prompt-template.test.mjs
DSH_TAVERN_ASSEMBLY_CORE_ROOT=/path/to/extended-runtime node --test test/request-assembly-host.test.mjs
npm test
npm run verify:2.0
```

完整 Host 验收应显式指定隔离 documentsDirectory，用自写模板和合成 provider 验证 native/managed 各一次、规则拒绝、原文/历史分离、来源 revision、manager 卸载使旧许可失效并恢复来源默认，以及 Tavern 卸载后原生会话继续。真实卡片脚本、模型提供方、ST 完整生命周期与 manager UI 需各自授权和独立证据；上述测试不能代表这些场景。运行记录放在 Git 忽略的 `.local/`。
