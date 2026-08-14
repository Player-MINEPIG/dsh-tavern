# Unified Tavern loader contract

状态：2026-08-14，三个并行 feature 已在 `feature/tavern-integration` 完成首轮接线。本文是角色卡、世界书与加载器的运行契约，不是 README。

## 目标与所有权

加载器是唯一允许决定“当前资源怎样进入一次 DSH 请求”的层。格式模块只解释文件，用例模块只管理资源；它们不得自行注册 `systemPrompt`、修改 Agent、复制会话历史或写模型请求。

```text
PresetModel ─────────────┐
CharacterCardModel ──────┼─> TavernProfileLoader ─> one Tavern profile section
UserModel ────────────────┤             │
WorldBookModel + matches ┘             │
                                       ├─> agent/request call config
SessionSelectionStore ─────────────────┘
```

当前根插件只注册一个 `dsh-tavern:profile` system section。这样 preset 的 `replace` 模式保留完整 Tavern profile，不会只留下 preset、静默丢失角色或世界书。

## Session policy

持久文件为插件 data 目录下的 `session-selections.json`：

```json
{
  "schemaVersion": 1,
  "sessions": {
    "<session-id>": {
      "presetId": "... or null",
      "characterCardId": "... or null",
      "userId": "... or null",
      "worldBookIds": [],
      "character": {}
    }
  }
}
```

- 旧 `PresetStore.state.selectedId` 继续作为尚未绑定 session 的兼容默认值。
- UI/API 带 `sessionId` 后，预设选择只修改该 session，不再污染其他并行会话。
- 新鲜普通会话在第一次被 Agent 使用时固化当时的默认选择。
- 普通 fork 从 `Session.header.parentSession` 复制父选择，之后父子互不联动。
- `delegationDepth > 0` 的 subagent 固化为空选择，不继承 Tavern 内容。
- 删除资源时 loader policy 提供 `clearResource(kind, id)` 清除所有悬空选择。
- session id 只作为 JSON key，但仍经过长度/字符集校验，避免原型键和异常输入。

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
- adapter 不拼 DSH system prompt；最终位置、覆盖、去重和降级诊断由 `compileTavernProfile()` 决定；
- 每类只能注册一个 adapter，重复注册直接失败，避免加载顺序决定行为；
- disposer 只撤销自己注册的实例，支持 HMR。

角色卡 adapter 的最小返回模型与角色分支 `CharacterCardModel` 一致，loader 当前消费 `id/name/updatedAt/data`。用户 adapter 只返回 `{ id, name, description }`。世界书 adapter 至少把激活项归一化为 `{ id|uid, content, position: "before"|"after" }`。

## Composition semantics

### Preset-only compatibility

没有角色、用户和激活 lore 时，loader 直接调用已验收的 `compilePresetForDsh()`。输出形状、采样参数映射和宏行为保持原样，避免统一化本身造成 preset 回归。

### Marker ownership

选择角色或激活 lore 后，统一编译器消费以下 ST marker：

| Marker / prompt | Loader source | Behavior |
| --- | --- | --- |
| `main` | character `systemPrompt` | 可覆盖 preset，支持 `{{original}}`；`forbid_overrides` 时保留 preset |
| `worldInfoBefore` | active before lore | 在该 marker 原位置输出，缺 marker 时稳定 fallback |
| `charDescription` | character description | 输出一次，缺 marker 时 fallback |
| `charPersonality` | character personality | 输出一次，缺 marker 时 fallback |
| `scenario` | character scenario | 输出一次，缺 marker 时 fallback |
| `personaDescription` | user description | 输出一次；`{{persona}}` 可作为显式放置点；缺 marker/宏时诊断并稳定 fallback |
| `worldInfoAfter` | active after lore | 在该 marker 原位置输出，缺 marker时 fallback |
| `dialogueExamples` | character message example | 以带来源标签的近似 system 内容输出 |
| `chatHistory` | DSH Session | marker 被消费但不输出；DSH durable history 始终是唯一权威 |
| `jailbreak` | character PHI | 可覆盖 preset，支持 `{{original}}`；明确报告位置近似 |

每个角色字段、用户描述和 lore 位置最多消费一次。`{{user}}` 使用当前 session 绑定用户的名字；用户描述内也可使用已有名字/角色宏。用户资源不改变 DSH Agent persona 或身份 section。creator notes 永不进入 profile。关闭角色 system/PHI 开关会真正抑制字段，不会把它移动到 fallback 后意外发送。

### Honest degradation

- greeting 只成为 `<st-character-field name="greeting-reference">`，不伪造 assistant 历史；
- PHI 位于 Tavern system profile，不宣称严格位于全部历史之后；
- depth prompt 保存 role/depth 的格式职责归角色模块，loader 首期只能放入明确标注的 system fallback；
- `user`/`assistant` preset prompt role 仍是可审阅标签，不是真实历史消息 role；
- 当前用户输入在 system assembly 前已从 inbox claim、但尚未出现在公开 assembly context。世界书首阶段可扫描持久历史；若要同轮匹配当前输入，需要另行设计 `agent/pre-step` 的可重建注入协议，不能偷偷读取私有 inbox。

## Audit boundary

`TavernProfileLoader.compile()` 返回：

- `systemText`：真正进入 `request/header.system` 的 Tavern profile；
- `callConfig`：真正经 `agent/request` 提议的支持字段；
- `resources`：本次解析到的 preset、character、user 与 world-book 摘要；
- `diagnostics`：缺资源及位置降级；
- `audit`：session selection、资源、激活 lore ID 和 SHA-256 fingerprint。

DSH 自己的 `request/header` 仍是模型实际输入的最终权威。loader audit 用于 UI/API 解释“为何得到这个输入”，不能替代 DSH header，也不新增私有 session event。

## Integration checklist

角色卡分支合并前必须：

1. store/API/UI 只维护角色文档与选择意图；
2. 把 session 选择迁移或桥接到 `SessionSelectionStore.characterCardId/character`；
3. 通过 `registerCharacterAdapter()` 提供模型；
4. 删除该分支自己的 Host system section/profile compiler；
5. 用 marker、replace、双 session、fork、subagent 和 request header 测试验证。

世界书分支合并前必须：

1. 保持 parser/matcher 为纯逻辑；
2. 通过 `registerWorldBookAdapter()` 返回激活 entries 和诊断；
3. 角色卡内嵌 `characterBook` 与独立 WorldBookModel 进入同一 matcher，不重复实现；
4. 不自行注册 system context/section；
5. 对扫描窗口、regex、递归与预算给出确定性测试。

用户资源分支合并前必须：

1. store 文档严格只有 `id/name/description`，拒绝头像和未知字段；
2. `SessionSelectionStore.userId` 是唯一会话绑定所有者；
3. 通过 `registerUserAdapter()` 交给统一 loader，不注册 Host seam；
4. marker、宏、fallback 和描述去重由 `compileTavernProfile()` 统一执行；
5. 验证双 session、即时切换、重启、解绑、删除清理和最终 profile 单份输出。

## 当前验收

- preset-only 输出和模型参数不回归；
- 两个 session 可选不同 preset，也可显式选择“无 preset”；
- 普通 fork 继承快照，subagent 不继承；
- marker 填充、角色 override、`{{original}}`、lore before/after 与 chatHistory 不复制均有单测；
- `replace` 只移除宿主 system sections，保留 tools、contexts、variables 和完整 Tavern profile；
- API active view 暴露 selection/resources/diagnostics/audit；
- 角色卡 API 使用统一 session policy；旧 `character-state.json` binding 单向迁移后清除，避免解绑后重启复活；
- V1/V2/V3 JSON 与 PNG 角色卡可由 adapter 进入 profile，creator notes 不发送；
- 角色卡内嵌 `character_book` 使用共享世界书 parser/matcher，命中项进入同一 profile；
- 独立世界书由 `world-book-library` 用例层提供 document store、CRUD/导出 API 与管理 UI；每 session 的零/一/多本绑定仍写入 loader-owned `SessionSelectionStore.worldBookIds`；
- 选中的独立书与角色卡内嵌 `characterBook` 由同一个 world-book adapter 调用同一 parser、matcher、排序、概率与预算契约，再合并进入 profile；
- 删除独立书通过 `clearResource("world-book", id)` 清理所有 session 的悬空 id，不读取、修改或解绑角色卡及其内嵌书；
- 用户 CRUD/API/UI、per-session 单绑定、`{{user}}`/`{{persona}}`、`personaDescription` marker 和诊断 fallback 已接线；
- 未拷贝任何本机第三方 preset、角色卡或世界书 fixture。
