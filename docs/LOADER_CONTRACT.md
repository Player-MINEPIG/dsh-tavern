# Tavern Host 与资源合同

[English](LOADER_CONTRACT_en.md)

Tavern 的 bundle 入口先加载随包标准 Assembler，或复用独立启用的实例，再挂载依赖该服务的业务 loader。两种安装顺序、停用与卸载遵循[接入说明](ASSEMBLER_INTEGRATION.md#与独立-assembler-共存)。

当前合同面向 Tavern **3.0.2**、Assembler **v1.1.0** 与 DSH **0.2.0-rc.2**。保留文件名是因为 `tavern-loader` 模块仍负责资源解析与 Host 接入；本文不再把 loader 描述为最终请求的统一装配器。策略与后端行为见 [Assembler 接入](ASSEMBLER_INTEGRATION.md)、[请求装配](REQUEST_ASSEMBLY.md)和[消息流](DSH_MESSAGE_FLOW.md)。

## 目标与所有权

| 所有者 | 当前职责 |
| --- | --- |
| Tavern / `TavernProfileLoader` | 会话资源选择、归一化 preset/card/user/world-book 模型、激活与资源审计；来源拥有的 MVU、模板和权限校验 |
| 独立 Assembler | 策略库与已应用快照、来源/排列算法注册、来源渲染、模块位置、标准投递与预览 |
| 可选 core addon | 在准备后的 Host 注册协议 1 执行器；进阶请求投影与官方 `request/assembly` 证据 |
| DSH | 持久会话与有效消息面、system/context 事件、工具执行、call preparation 与 Provider 序列化 |

```text
资源库 + SessionSelectionStore + ActivationContext
  → TavernProfileLoader：解析模型 / audit / 权限租约
  → attachTavern + 已注册 Tavern 来源
  → Assembler 策略快照
       ├─ native：官方 sections/context + 接纳的 pre-step 消息
       └─ core：可选协议 1 执行器 → request/assembly
  → DSH prepared call → Provider
```

loader 通过 `attachTavern` 向共享 store/registry/runtime 提供只读资源；Tavern 兼容导出转发到独立包。格式模块与资源模块不得各自注册提示词段落、修改 Agent 或复制会话历史。来源服务继续拥有数据、解析语法与权限。

已应用策略时，`TavernProfileLoader.compile()` 解析资源并返回 `assemblyInput`，不会先渲染另一份 Tavern profile；模块渲染与排列归 Assembler。loader 仍提供导入上下文、可选 `rp:policy`，并在最终装配处复核世界书/MVU 权限。未应用策略时，保留的兼容路径才把 order 10 的 `pmp-dsh-tavern:profile` 锚点展开为 `pmp-dsh-tavern:part:*` sections；`rp:policy` 仍为 order 45。下文单独说明此兼容渲染器。

## Session policy

当前只支持 DSH 0.2.0-rc.2 运行时。Host 等待串行 `agent/created` listener：先冻结或恢复资源选择，从公开 own events 重建 pending input，再初始化 RP 及只读沙箱，之后才允许 Agent 处理请求。初始化失败向注册过程传播，不降为 warning；fork、resume 与委派 agent 使用同一初始化边界。

持久文件为插件 data 目录下的 `session-selections.json`：

```json
{
  "schemaVersion": 2,
  "sessions": {
    "<session-id>": {
      "selection": {
        "presetId": "... or null",
        "characterCardId": "... or null",
        "userId": "... or null",
        "worldBookIds": [],
        "character": {},
        "rp": {
          "active": false,
          "source": null,
          "followSuppressed": false,
          "sandboxBefore": null
        }
      },
      "updatedAt": "2026-08-15T00:00:00.000Z"
    }
  }
}
```

- 旧 `PresetStore.state.selectedId` 继续作为尚未绑定 session 的兼容默认值。
- UI 将预设资源浏览与会话绑定拆分：切换下拉框、导入或创建只改变当前编辑资源，只有明确的绑定/解除按钮才写 session selection。UI/API 带 `sessionId` 后，预设选择只修改该 session，不再污染其他并行会话。
- 预设与角色卡/用户使用同一运行边界：agent 正在执行时拒绝改变绑定；有历史的会话更换预设前提示只影响后续请求。
- 新鲜普通会话在第一次被 Agent 使用时固化当时的默认选择。
- 普通 fork 从 `Session.header.parentSession` 复制父选择，之后父子互不联动。
- `delegationDepth > 0` 的 subagent 同样固化父选择（与「用当前配置新开对话」同一份投影，含 `rp`），之后父子互不联动。委派任务是否收窄由主 agent 的 spawn 提示决定，不在 `rp:policy` 或空选择里编码。
- RP 是 selection 上的会话叠加，不是 DSH agent preset。`selection.rp` 记录是否锁定；可选的 `rp:policy` 正文存在 `rp-policy.json`，默认只说明高风险操作被锁。
- 删除资源时 loader policy 提供 `clearResource(kind, id)` 清除所有悬空选择。
- session id 只作为 JSON key，但仍经过长度/字符集校验，避免原型键和异常输入。
- schema v1 在读取后原地迁移为 v2；角色选项只保留 loader 已知的 greeting/system/PHI 三个字段，资源 id 和单 session 世界书数量同时有界。
- 默认最多 2,048 个 session（实现硬上限 4,096）和 4 MiB 持久状态，超过 8 MiB 的旧文件不进入 `JSON.parse`。写入先在副本上验证并原子落盘，失败不会污染内存状态。
- selections 是不可静默丢弃的用户意图，因此容量满时拒绝新增，不照搬 Trace 的 LRU。`deleteSession(id)` 是可用的显式回收 seam；当前 Host 没有权威 session 删除事件可自动触发它。

### Running-agent mutation boundary

当前的运行态保护是“显式 session binding 写入保护”，不是覆盖所有资源变更的全局事务锁。preset、角色卡、用户和独立世界书的 selection API 在写入 `SessionSelectionStore` 前查询对应 agent；状态为 `running` 时返回 HTTP 409，分别使用 `PRESET_AGENT_RUNNING`、`CHARACTER_AGENT_RUNNING`、`USER_AGENT_RUNNING` 和 `WORLD_BOOK_AGENT_RUNNING`。它防止用户在一次 turn 正在执行时通过正常绑定按钮切换该 session 的四类选择。

以下间接变更入口不受同一保护，因此当前合同不保证“运行中的 Tavern 配置完全不可变”：

- session-template/configuration apply 可以直接用完整 selection 覆盖目标 session；正常 UI 以新建 blank session 为目标，但 API 本身尚未拒绝一个正在运行的既有目标；
- 删除已被引用的 preset、角色卡、用户或独立世界书会调用 `clearResource()` 清理一个或多个 session 的选择，没有逐一检查受影响 agent；
- 修改当前已绑定资源的正文不会改变资源 ID，却会改变后续装配读取到的内容；
- 修改用户、预设或角色卡的独立世界书关系可能同时改变一个或多个 session 的有效世界书集合，目前只验证关系和资源上限，不检查这些 session 是否正在运行。

已经完成的 system assembly 是冻结快照；资源变更不会回写 durable history，也不能被描述为已进入先前请求。assembly 前后的并发修改仍存在时序边界，纯正文编辑与间接关系变化只保证后续重新装配读取当时可见的状态。当前运行态拒绝保证仅适用于上述四类显式 selection 写入。

### Clean-session/template policy

“维持当前设置新开对话”与配置模板只复制上述 selection 投影，不调用普通 fork，也不读取或写入 Session events。DSH 模式通过公开 `uiWorkspace.connectWorkspace(workspaceId)` 得到真实 blank session id。魔丸模式先由同一 preview 取得配置角色，再调用共享周目创建控制器：现有 v2 session/目录/timeline/catalog 原子 API 创建或复用该角色的权威空周目，v1 apply 随后以一次 `SessionSelectionStore.set(targetId, completeSelection)` 提交完整配置，并再次校验 root session 的角色绑定与周目角色一致。两种模式都只在成功后调用公开 `uiWorkspace.openSession(targetId)`；没有角色卡的配置只能创建普通 DSH 会话，不能创建周目。

模板删除资源时不被静默改写：preset、角色/greeting、用户或独立世界书的悬空 id 由 preview/apply 返回结构化诊断并阻止创建。DSH 创建失败发生在 selection 写入之前；原子写失败不发布内存状态且不导航。模板不得包含 durable history、Trace、Inbox、turn/step、运行态或资源正文。RP 状态随 selection 投影一起复制。

角色侧栏的新建周目入口则先创建独立开场草稿，首次发送获接纳后才关联真实 DSH 会话。草稿的资源/策略快照和初始 MVU 与 session selection 分开保存；预览没有原生历史或待发送输入，也不调用模型。已有 root session 的周目保留其原会话。见[开场草稿说明](USAGE_zh-CN.md)。

## Profile safety budget

下述资源 parser/matcher 守卫对两条路径都生效。profile 正文裁减与 `TAVERN_PROFILE_*` 诊断属于兼容渲染器；已应用策略执行请求装配合同中的 Assembler 预算。

请求装配沿用下述 `limits.maxProfileBytes` 限制逻辑新增正文；完整 system 快照展开使用独立的固定 2 MiB 物理上限。每条投影载体的新增序列化字节都计入物理开销，不能通过放宽 profile 限制提高该上限；未修改的原生历史不计入新增开销。实际发送和预览都执行两阶段检查，超限拒绝。详见[请求装配契约](REQUEST_ASSEMBLY.md#系统段落与-dsh-完整快照)。

`TavernProfileLoader` 对自己生成的 Tavern profile 合计正文施加默认 512 KiB UTF-8 上限；`limits.maxProfileBytes` 可以收紧或放宽，但实现硬上限为 2 MiB。世界书 parser/store 在 normalize 之前共用流式结构守卫：每资源最多 10,000 条、深度 32、100,000 节点、单字符串 1 MiB、对象键 1,024 字符；adapter 另对本次请求的独立书与内嵌书合计施加 10,000 条硬上限，超出资源跳过并诊断。合计预算按确定性的组合顺序先到先得：session 显式独立书、用户绑定独立书、预设绑定独立书、角色卡绑定独立书（ID 稳定去重），最后角色卡内嵌书；每个资源整体预留，不能完整放入时整本不扫描。因此前面的独立书占满 10,000 条时，内嵌书会被跳过并产生 `WORLD_BOOK_RUNTIME_TOTAL_LIMIT`，这是有意的安全/确定性策略，不是随机遗漏。在这些前置守卫后，装配器最多考虑排名最前的 4,096 个 lore 候选，并在组合 section 正文前将原始 lore 正文限制为 profile budget 的两倍。世界书自身的 `tokenBudget` 与 `ignoreBudget` 只决定 ST 兼容候选，不能改变任何 Host 硬上限。

角色卡编辑内嵌 `character_book` 时会先执行共享结构守卫和 parser；原始 JSON/PNG 导入只在角色格式层确认 `character_book` 是 object，然后无损保留未知字段，不在落盘前执行同一深度/节点/条目守卫。32 MiB 导入上限限制总输入；loader 首次消费时仍会通过 `parseCharacterBook()` 安全失败并报告 `EMBEDDED_WORLD_BOOK_INVALID`，所以不可运行的内嵌书可能进入资源库，但不能进入匹配放大路径。

若全部内容超限，装配器 用原有候选顺序保留能完整装入的最高排名 lore 条目前缀，并报告 `TAVERN_PROFILE_LORE_LIMITED`。若移除所有 lore 后仍超限，则抛出 `TAVERN_PROFILE_TOO_LARGE`；preset、角色字段或用户描述不会被从中间截断。

### Resource-to-world-book relationships

用户资源继续严格保持 `{ id, name, description }`。“用户绑定世界书”由统一 loader policy 的 `user-world-book-bindings.json` 维护独立关系，不把 world-book id 写入描述正文，也不让 `user` adapter 自己运行 matcher。

预设和角色卡关联独立世界书由 `resource-world-book-bindings.json` 维护，按 `preset` / `character` 两个 owner kind 分区。它不会向 ST preset 或 character card 原文添加 ID；角色卡内嵌 `character_book` 仍保存在卡内并随卡导出，与外部关联是并列而非互斥来源。

loader 在每次装配时依次读取当前 session 显式 `worldBookIds`、当前用户关系、当前 preset 关系和当前 character 关系，按 ID 稳定去重后只把每本独立书交给共享 adapter 一次；角色卡内嵌书最后进入同一 adapter。audit 同时保留原始 `sessionSelection` 以及 `worldBookSelection` 的 explicit/user/preset/character/effective/duplicate ID；每个 world-book resource summary 的 `bindingSources` 保留全部命中来源。active view 的 `selection.worldBookIds` 是实际有效集合，供 launcher 显示真实组合。

解绑或切换任一资源只移除该来源，不会改写其他来源。删除用户、预设或角色卡清理 owner 关系和对应 session 选择；删除独立世界书清理全部关系与 session 显式引用，但不修改任何角色卡内嵌书。关系 store 对 owner 数、每 owner 书数、状态字节和安全读取施加界限，并在副本校验后原子替换。

## Adapter boundary

`TavernProfileLoader` 为角色、用户和世界书分别暴露一个单例 adapter 插槽：

```js
loader.registerCharacterAdapter({
  resolve({ selection, sessionId, agent, conversationText, context }) {
    return { character, diagnostics }
  },
})

loader.registerUserAdapter({
  resolve({ selection, sessionId, agent, conversationText, context }) {
    return { user, diagnostics }
  },
})

loader.registerWorldBookAdapter({
  resolve({ selection, sessionId, agent, conversationText, character, context }) {
    return { loreEntries, resources, diagnostics }
  },
})
```

约束：

- adapter 返回已经归一化的模型，不返回 ST 原始文件作为运行指令；
- adapter 可以只读 `conversationText` 做匹配，不写 session；
- adapter 不拼 DSH system prompt；应用策略后由 Assembler 渲染与排列；仅未应用策略的兼容路径调用 `compileTavernProfile()`；
- 每类只能注册一个 adapter，重复注册直接失败，避免加载顺序决定行为；
- disposer 只撤销自己注册的实例，支持 HMR。

角色卡 adapter 的最小返回模型与角色分支 `CharacterCardModel` 一致，loader 当前消费 `id/name/updatedAt/data`。用户 adapter 只返回 `{ id, name, description }`。世界书 adapter 至少把激活项归一化为 `{ id|uid, content, position: "before"|"after" }`。

### Activation input contract

loader Host 层的唯一 `PendingInputProjection` 从公开 `agent/inbox/spliced` 重建队列和本次 claimed batch，再向 adapter 提供结构化、只读的 `activationContext`：

```js
{
  messages,             // 有界且已按稳定 id 去重的 { id, role, text, source }
  text,                 // 在消息数/字符数上限下生成的 matcher 兼容输入
  metadata,             // 数量、截断状态、claim event seq；不含正文/正文 hash
}
```

`conversationText` 是从 `activationContext.text` 派生的兼容字段，不是第二份状态。adapter 只消费该 value，不订阅 DSH event；pending 队列、claim/cancel 判定、首次 assembly 一次性消费、turn-end 清理和去重均由 loader 独占。默认扫描最近 128 条、64 KiB 字符，硬上限分别为 1,024 条和 1 MiB；队列保留也有独立的消息数/字符数硬上限。Trace 不持久化 ActivationContext 的 `messages` 或 `text`；schema 4 也不保存装配正文或来源正文副本，只记录可验证的官方历史引用与 metadata。

## Composition semantics

已应用策略使用 Assembler v1.1.0 的来源与排列算法。标准后端在原生投递边界内保留或适配角色；进阶后端按其显式合同提供 request-only 投影。详见[请求装配](REQUEST_ASSEMBLY.md)与[后端规则](https://github.com/Player-MINEPIG/dsh-prompt-assembler/blob/v1.1.0/docs/BACKENDS.md)。以下子节**仅描述未应用策略时保留的兼容渲染器**，不是默认 RP 装配策略。

### Preset-only compatibility

没有角色、用户和激活 lore 时，loader 直接调用 `compilePresetForDsh()`。它按原顺序输出启用的非 marker prompt 正文，并保持采样参数映射和宏行为。Tavern 不向模型可见文本添加 preset 名称、ID 或 XML 风格识别包装；作者正文中的同名标签保持原样。若选中资源没有正文，则不生成占位 header。官方 waterfall section 只有 `name` 与 `text`，prompt identifier、请求 role 和资源来源保存在 Tavern Trace metadata 中。

### Marker ownership

兼容渲染器在选择角色或激活 lore 后消费以下 ST marker：

| Marker / prompt | Loader source | Behavior |
| --- | --- | --- |
| `main` | character `systemPrompt` | 可覆盖 preset，支持 `{{original}}`；`forbid_overrides` 时保留 preset |
| `worldInfoBefore` | active before lore | 在该 marker 原位置输出，缺 marker 时稳定 fallback |
| `charDescription` | character description | 输出一次，缺 marker 时 fallback |
| `charPersonality` | character personality | 输出一次，缺 marker 时 fallback |
| `scenario` | character scenario | 输出一次，缺 marker 时 fallback |
| `personaDescription` | user description | 输出一次；`{{persona}}` 可作为显式放置点；缺 marker/宏时诊断并稳定 fallback |
| `worldInfoAfter` | active after lore | 在该 marker 原位置输出，缺 marker时 fallback |
| `dialogueExamples` | character message example | 作为普通近似 system 正文输出；来源关系只记录在 Tavern Trace metadata 中 |
| `chatHistory` | DSH Session | marker 被消费但不输出；DSH durable history 始终是唯一权威 |
| `jailbreak` | character PHI | 可覆盖 preset，支持 `{{original}}`；明确报告位置近似 |

每个角色字段、用户描述和 lore 位置最多消费一次。`{{user}}` 使用当前 session 绑定用户的名字；用户描述内也可使用已有名字/角色宏。用户资源不改变 DSH Agent persona 或身份 section。creator notes 永不进入 profile。关闭角色 system/PHI 开关会真正抑制字段，不会把它移动到 fallback 后意外发送。

### Honest degradation

- greeting 只在首轮生成作为普通 system 正文贡献；首个真实 assistant 回复形成后不再注入，并且从不伪造 assistant 历史；
- PHI 位于 Tavern system profile，不宣称严格位于全部历史之后；
- depth prompt 的 role/depth 字段由角色模块保留；当前 loader 只能把正文放入普通 system fallback，并通过位置降级诊断说明未执行真实 depth/role 语义；
- `user`/`assistant` preset prompt role 保留在 Tavern Trace `sources[].role` metadata 中供审阅；官方 waterfall section 本身只有 `name` 与 `text`，实际贡献仍全部是 system section，不是真实历史消息 role；
- system assembly 扫描持久历史与本步骤 claimed batch，因此单 step 会话的当前输入可在首个请求命中。实现不采用过晚的 `agent/pre-step`，也不读取私有 Inbox。
- Trace 必须描述实际冻结的 assembly。不能在 `agent/pre-step` 或 `request/header` 后拿当前输入重跑 matcher，再把该结果标成已进入本轮 system；因为没有 same-step reassembly seam，claimed batch 必须经 `agent/inbox/spliced` 投影在首次 assembly 前进入 matcher。

## preset 参数准入与降级

preset 采样字段按作者设置保存。Host 在 `agent/request` 合并受支持的 preset 覆盖，并使用公开 `llm.resolveCallConfig` 预检。不支持的 preset reasoning effort 会被省略，交给 adapter 默认，不猜测其他 effort 名称。

明确的 invalid/unsupported 参数拒绝后，`agent/request-error` 仅在尚无输出且未取消时请求原生 DSH 重试。只省略 `temperature`、`maxTokens`、`reasoningEffort`、`stop` 中生效的 preset 覆盖，每字段至多一次，运行期至多四次重试。其他插件的参数及无关的认证、额度、网络错误不进入此降级。不会修改已准备请求，也不重复调用其 middleware continuation。Trace 记录请求/生效参数映射与每次省略；生效值取自 DSH 默认处理后的实际 `llm/stream` 边界。

## Audit boundary

`TavernProfileLoader.compile()` 返回解析后的 `assemblyInput`、宏上下文、资源摘要、诊断与资源选择 audit。应用策略或 `resolveOnly` 预览时，`systemText` 和 profile sections 为空：这是资源解析结果，不是最终请求缺失。未应用策略时，它们才包含兼容 profile。`callConfig` 提议受支持的 preset 采样字段；参数准入/降级可调整最终覆盖值。

Assembler 记录策略与来源/排列 metadata。Tavern Trace 将其与资源决策及已核验的官方历史引用组合，不另存来源正文或消息历史副本。标准实际请求按已记录的原生请求引用恢复；进阶请求引用 DSH 的 `request/assembly`。latest-only actual 端点与当前预览不能恢复旧请求。

V4 的 `system/message` 与 runtime-context `user/message` 拥有标准提示词正文；`request/header` 拥有最终 tools/config。进阶 `request/assembly` 冻结实际发送数组，不替换 durable history。坐标兼容与显式离线升级见[迁移合同](DSH_0.1.7_MIGRATION.md)，当前支持的 Host 仍为 rc.2。

## Adapter integration invariants

1. 资源模块拥有归一化文档与选择意图；每类资源 adapter 只注册一次，返回只读模型。
2. Tavern assembler adapters 通过共享 Assembler 来源注册表接入；渲染与排列遵循已应用策略，不为同一资源增加第二个 Host 装配器。
3. 独立/内嵌世界书共用 parser/matcher 与激活投影，使用前再次复核来源权限与租约。
4. MVU 拥有初始化、schema、状态实例、durable event 提交与卡片权限；来源解析和预览不得提交变量更新。见 [MVU](MVU.md)。
5. 卸载 disposer 只撤销自己的注册、provider 与租约，保留资源和 DSH 会话；旧导出与服务别名转发到共享实现。

## 验证

按[开发验证指南](TESTING.md)运行受影响的资源、loader、标准/进阶装配、MVU 与 Trace 测试及隔离 Host 检查。marker/system fallback 测试只建立兼容渲染器的行为；标准 role 投递与进阶请求投影须分别核对已记录请求证据。
