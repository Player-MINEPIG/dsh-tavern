# 角色卡兼容实施方案

状态：**等待审核，不得开始功能实现。**

分支：`feature/character-card-compat`

worktree：`D:\AI\deepseek-harness\character-card-compat`

## 1. 目标

### 1.1 产品目标

在 dsh-tavern 中提供一条可审计的 SillyTavern/TauriTavern 角色卡兼容链路：用户可以导入常见角色卡、查看兼容性诊断、把一张卡绑定到指定 DSH 会话，并让卡的可承载字段稳定进入该会话后续模型请求。

首个可验收版本覆盖：

1. V1/V2/V3 JSON；
2. 带 `chara`/`ccv3` tEXt chunk 的 PNG，二者同时存在时优先 V3；
3. 角色库的导入、列表、详情、原件导出、删除；
4. 每会话选择/取消选择，重启后恢复，普通 fork 继承，subagent 不自动继承；
5. 核心字段、宏、预设 marker 和覆盖规则；
6. 内嵌 `character_book` 的常用匹配语义；
7. 明确展示无法等价承载的 first message、PHI/depth 等降级项；
8. 自动化测试、隔离环境手工验收和完整 review 文档。

### 1.2 工程目标

- 角色格式逻辑保持为纯函数，不依赖 DSH、文件系统或 React；
- 存储、HTTP、Host 注入和 UI 各自有明确边界；
- preset-only 行为不得回归；
- 每次请求实际看到的角色配置由 DSH 自身 `request/header` 留痕；
- 原始输入和未知字段可保留，不执行第三方扩展内容；
- 不把真实第三方角色卡提交进仓库。

## 2. 为什么这样做

### 2.1 为什么不是“解析后拼一段 system prompt”

SillyTavern 的字段分布在 marker、示例消息、历史后指令、depth prompt、开场消息和动态 lorebook 等不同位置。粗暴拼接会让“能导入”看似成功，但模型行为和原平台明显不同，也无法解释差异。

### 2.2 为什么按会话绑定

预设通常是应用级选择，角色身份却是聊天级事实。使用全局当前角色会使两个并行 DSH 会话互相污染，也会让恢复/分叉后的行为不可预测。

### 2.3 为什么必须和预设编译器整合

已验证的预设分支会处理 `replace` 模式和 prompt marker。角色字段必须在 marker 处解析，角色 `system_prompt` 还要覆盖 `main`。两个独立插件 section 无法正确表达这套覆盖关系，UI 也会争夺单占位 details 区域。

### 2.4 为什么首期不做 CHARX/BYAF

CHARX 是 ZIP 容器并带任意资产，BYAF 还包含场景、聊天和图片。它们会显著扩大路径穿越、压缩炸弹、资源生命周期和媒体渲染的安全面。先完成 JSON/PNG 的完整垂直切片，能覆盖本地现有主流卡，又不会用不成熟的资产处理阻塞核心兼容。

### 2.5 为什么不伪造 first message

DSH 没有公开的“插件写入 assistant 历史”API。绕过公开契约直接写 session event 会制造错误来源、破坏事件不变量并增加升级风险。首期将 greeting 标记为参考内容，诚实显示差异。

## 3. 审核前需要确认的决策

建议审核者确认以下默认选择；若无修改意见，实现将以“建议”列为准。

| 决策 | 建议 | 影响 |
| --- | --- | --- |
| 实现基线 | 审核通过后，把当时稳定的 `feature/prompt-preset-gpt` 合并到本分支并记录 commit | 角色卡复用已验证架构，避免复制 |
| 首期格式 | JSON + PNG，V1/V2/V3 | 覆盖常见卡；CHARX/BYAF 延后 |
| 选择粒度 | 每会话 | 并行会话隔离 |
| 普通 fork | 继承父会话选择 | 符合 fork 延续语义 |
| subagent | 不继承 | 避免角色约束污染工具子代理 |
| 卡内 `system_prompt` | 默认优先，但 UI 可关闭 | 靠近 V2 规范；尊重用户控制 |
| 卡内 PHI | 默认启用并显示“近似位置”警告 | 保留内容但不虚假宣称严格 post-history |
| `first_mes` | 作为开场/风格参考，不写 assistant 历史 | 保持 DSH 事件语义正确 |
| 内嵌 lorebook | 首期实现常用子集 | 角色卡行为更完整；增加测试量 |
| 会话中途换卡 | 允许，运行中返回 409，非空会话要求 UI 二次确认 | 不改旧历史，下一请求 header 留痕 |

## 4. 分支与交付策略

### Gate 0：当前审核门

- 只提交调研和方案文档；
- 不合并预设分支；
- 不新增依赖、运行时代码、构建产物或测试 fixture。

### Gate 1：审核通过后的基线同步

1. 记录预设分支被采用的准确 commit；
2. 合并到 `feature/character-card-compat`；
3. 运行预设分支原有 `npm run check` 与 `npm run pack:check`；
4. 若合并本身导致失败，先单独修复并记录，角色功能不与基线故障混在同一提交。

### Gate 2：按阶段提交

建议拆为可独立 review 的提交：

1. `docs/test: define character compatibility contract`；
2. `feat(format): parse and normalize character cards`；
3. `feat(character): add durable character store and API`；
4. `feat(prompt): compose preset and character semantics`；
5. `feat(client): add character library and session binding UI`；
6. `feat(lorebook): activate embedded character book entries`；
7. `test/docs: complete installed acceptance and limitations`。

## 5. 目标目录结构

```text
packages/
  tavern-format/src/
    character.js          # V1/V2/V3 解析、规范化、宏、诊断
    png-card.js           # PNG chunk 边界与 chara/ccv3 提取
    lorebook.js           # 纯匹配和排序/预算逻辑
    profile.js            # preset + character 的统一编译
  character/src/
    index.js              # DSH Host 接入
    store.js              # 角色库与 session binding
    server.js             # HTTP API
  preset/src/             # 复用并做最小组合改造
dist/client.js            # 生成物
test/
  character-format.test.mjs
  character-png.test.mjs
  character-store.test.mjs
  character-api.test.mjs
  character-host-contract.test.mjs
  character-lorebook.test.mjs
  tavern-profile.test.mjs
docs/character-card/
```

如实现中发现三个 format 文件过度拆分，可合并文件，但纯格式层与 Host/存储层的边界不得取消。

## 6. 规范化数据模型

建议内部文档版本为 `schemaVersion: 1`：

```js
{
  schemaVersion: 1,
  id: "uuid",
  name: "display name",
  createdAt: "ISO timestamp",
  updatedAt: "ISO timestamp",
  source: {
    format: "sillytavern-v1|sillytavern-v2|character-card-v3",
    container: "json|png",
    specVersion: "2.0|3.0|undefined",
    importedAt: "ISO timestamp",
    fileName: "original display-only filename",
    sha256: "hex",
    raw: {} // 深拷贝原始 JSON，不执行
  },
  data: {
    name: "",
    nickname: "",
    description: "",
    personality: "",
    scenario: "",
    firstMessage: "",
    messageExample: "",
    creatorNotes: "",
    systemPrompt: "",
    postHistoryInstructions: "",
    alternateGreetings: [],
    groupOnlyGreetings: [],
    tags: [],
    creator: "",
    characterVersion: "",
    characterBook: null,
    assets: [],
    extensions: {}
  },
  compatibility: {
    warnings: [],
    unsupportedFeatures: [],
    unknownMacroNames: []
  }
}
```

约束：

- 规范化字段只做类型收敛，不覆盖 `source.raw`；
- V1 缺字段按空值补全；
- V2 必须检查核心字段类型，错误要指出字段路径；
- V3 `3.x` 允许未来小版本导入，但给出“newer version”警告；
- 未知顶层字段和 `extensions` 必须保留；
- 导入 ID 不由角色名或文件名决定，文件名只用于显示；
- artifact 文件名只由内部 ID 决定，杜绝路径穿越。

## 7. 存储设计

```text
data/
  character-state.json
  characters/<id>.json
  character-artifacts/<id>/source.json|source.png
```

`character-state.json`：

```js
{
  schemaVersion: 1,
  selectedBySessionId: {
    "session-id": {
      characterId: "uuid",
      greetingIndex: 0,
      preferCharacterSystemPrompt: true,
      preferCharacterPostHistory: true
    }
  }
}
```

持久化要求：

- 沿用 preset store 的原子临时文件 + rename 方案；
- 启动时校验 state 引用，坏引用降级为空并记录 warning，不删除原件；
- 删除角色必须在同一个 store 操作中清除所有 session binding；
- 普通 fork 在 `agent/created` 时仅当子会话无显式 binding 才复制父 binding；
- `header.origin === 'subagent'` 时不继承；
- Agent dispose/应用退出不得删除 binding，因为它需要跨重启恢复；
- `/data` 和任何验收卡继续由 `.gitignore` 排除。

## 8. 导入与导出流程

### 8.1 API 传输

避免把 PNG base64 塞进现有 2 MiB JSON API。建议新增原始字节上传：

```http
POST /dsh-tavern/api/characters/import?filename=<encoded>
Content-Type: application/json | image/png | application/octet-stream
Body: raw file bytes
```

服务端：

1. 流式计数，默认硬限制 32 MiB（可配置，仍有上限）；
2. 根据 magic bytes 判断 PNG，不只信扩展名/MIME；
3. JSON 必须为 UTF-8 object；
4. PNG 校验签名、chunk 长度边界和总解码元数据上限；
5. `ccv3` 优先于 `chara`；
6. base64 和 JSON 错误返回具体、无敏感正文的 400；
7. 先规范化和校验，后原子落盘；
8. 响应返回 summary + compatibility warnings，不回显全部角色正文。

### 8.2 导出

首期不提供编辑，因此：

- `GET /characters/:id/artifact` 返回原始导入文件，可做到字节级无损；
- `GET /characters/:id/json` 返回保存的原始 JSON；PNG 卡返回从优先 chunk 解出的原始 JSON；
- 不声称把修改后的数据重新嵌入 PNG；编辑/再编码属于后续功能。

## 9. API 草案

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| GET | `/dsh-tavern/api/characters` | 角色摘要列表 |
| POST | `/dsh-tavern/api/characters/import` | 原始字节导入 |
| GET | `/dsh-tavern/api/characters/:id` | 详情、诊断、规范化字段 |
| GET | `/dsh-tavern/api/characters/:id/artifact` | 原件导出 |
| GET | `/dsh-tavern/api/characters/:id/json` | JSON 导出 |
| DELETE | `/dsh-tavern/api/characters/:id` | 删除并解除全部 binding |
| GET | `/dsh-tavern/api/character-selection?sessionId=...` | 获取会话选择 |
| POST | `/dsh-tavern/api/character-selection` | 选择/取消、greeting 与覆盖选项 |
| GET | `/dsh-tavern/api/character-active?sessionId=...` | 编译预览和兼容诊断 |

错误契约统一为 `{ ok: false, error: { code, message, field? } }`。运行中的 Agent 修改选择返回 409。未知 session/card 返回 404。路径 ID 必须严格解码并由 store 查找，不能拼接成文件路径。

## 10. Tavern profile 统一编译

### 10.1 单一组合入口

新增纯函数：

```js
compileTavernProfile({ preset, character, selection, conversationText, userName })
```

输出至少包含：

```js
{
  systemText,
  diagnostics,
  activeLoreEntries
}
```

Host 只注册一个 dsh-tavern profile section，避免 `replace` 模式丢角色内容。现有 preset-only 输入必须生成与基线等价的结果。

### 10.2 marker 解析

按预设原顺序遍历 enabled prompts：

| SillyTavern identifier | 角色来源 | DSH 行为 |
| --- | --- | --- |
| `main` | 卡内 `system_prompt` 可覆盖 | 支持 `{{original}}`；`forbid_overrides` 时保留预设 |
| `worldInfoBefore` | 激活的 before-char entries | 生成带来源标签的段 |
| `charDescription` | `description` | 填充 marker |
| `charPersonality` | `personality` | 填充 marker |
| `scenario` | `scenario` | 填充 marker |
| `worldInfoAfter` | 激活的 after-char entries | 生成带来源标签的段 |
| `dialogueExamples` | `mes_example` | 解析并生成 role-labelled examples |
| `chatHistory` | DSH session 自有历史 | marker 本身不输出，禁止复制历史到 system prompt |
| `jailbreak` | 卡内 PHI 可覆盖 | 支持 `{{original}}`，同时生成位置降级诊断 |

若没有选中预设，或预设缺少某个核心 marker，则把未消费的角色字段放入稳定顺序的 fallback section，避免静默丢失。每个字段最多消费一次。

### 10.3 宏

首期支持：

- `{{char}}`：优先 V3 `nickname`，否则 `name`；
- `{{user}}`：插件设置，默认 `User`；
- `{{original}}`：仅用于 override；
- `{{description}}`、`{{personality}}`、`{{scenario}}`、`{{mesExamples}}`；
- 已有预设实现支持的 `setvar/getvar/random/roll/trim`。

解析最多 5 轮，避免递归宏失控。未知完整宏不能原样交给 DSH 的严格 `{{variable}}` 解析器：编译输出中转义为可见文本或移除，并在 UI/API 的 diagnostics 中列出名称。原始字段保持不变。

### 10.4 PHI、depth 和 greeting 的明确降级

- PHI/jailbreak 只放在 Tavern system profile 的末端，不再重复写入 runtime-context snapshot；不宣称它严格位于历史之后。
- depth prompt 保存原 role/depth，首期以标签展示在 system profile 末端；诊断说明 DSH 无任意历史 depth 注入面。
- 选中 greeting 以 `<st-character-greeting-reference>` 标签进入 profile，只作为风格/开场参考；不创建 assistant message。

这些标签是模型可见兼容层，不执行 HTML；所有属性值必须转义。

## 11. 内嵌 character_book

首期实现规范常用子集：

1. 只处理 `enabled !== false`；
2. `constant` 无条件激活；
3. 普通 keys 按 `case_sensitive` 匹配；
4. `selective` 要求 primary 和 secondary 各至少命中一个；
5. V3 `use_regex` 使用安全的内建 RegExp，单 entry/总扫描均有长度和时间预算，非法 regex 只禁用该 entry 并报警；
6. 扫描最近 `scan_depth` 条可见 user/assistant 文本；取不到精确消息条数时采用 DSH surface 的最近消息；
7. 默认不扫描 tool schema、tool result 二进制、角色卡原文或 system prompt，避免自触发；
8. `recursive_scanning` 最多固定轮次，entry 每次最多激活一次；
9. 按 position 分为 before/after，再按 `insertion_order` 稳定排序；
10. `token_budget` 首期用可替换的保守字符预算适配器；若 DSH 后续暴露当前模型 tokenizer，再替换为精确 token 计数；
11. 未实现的 decorators/ST extensions 原样保留并列入 diagnostics。

世界书匹配结果在统一 Tavern system profile 中填充对应 marker。激活集合变化时，DSH 会通过新的 `request/header` 记录实际 system 文本；不会额外生成一条重复的 user-role snapshot。

## 12. Host 集成

### 12.1 system section

全局注册 provider，并从 assembly context 取 session：

```js
text: ({ agent }) => runtime.compileFor(agent?.id).systemText
```

无 Agent 的诊断 assemble 返回空角色内容。选卡、取消、删除、选 greeting 后 emit `system-prompt/change`。

### 12.2 runtime context

首期不使用 `systemPrompt.context()` 承载 PHI 或 lorebook，避免它们同时出现在 system profile 与 user-role snapshot 中。该扩展点保留给以后确有“可替换运行态事实”需求的功能；若启用，仍必须按 `agent.id` 解析。此项明确属于后续独立设计，不在本方案的实现授权范围内。

### 12.3 preset replace 模式

现有 `system-prompt/assemble` replace waterfall 改为保留统一 Tavern profile，而不是只保留 preset 文本。必须继续保留 assembly 的 tools、contexts、variables 和结构化输出能力。

### 12.4 选择生命周期

- API 修改前用 `ctx.agents.get(sessionId)` 验证会话和运行状态；
- 非空会话换卡由前端二次确认；
- 变更只影响下一次 assembly；
- 不重写历史；
- 下一请求的 `request/header` 由 DSH 自动记录 `change`；
- fork 继承逻辑在 `agent/created` 同步完成，避免首次请求竞态。

## 13. UI 方案

沿用已验证的 root overlay + session details 可达性方案，把面板改为两个页签：

- **预设**：保持现有功能；
- **角色卡**：角色库、导入、详情、诊断和当前会话绑定。

角色卡页签至少包含：

- 文件拖放/选择（JSON、PNG）；
- 卡片摘要：头像（PNG 原图的安全 object URL）、名称、spec、版本、tags；
- 详情：creator notes、核心字段折叠预览、原始格式、兼容警告；
- 当前会话选择器和“无角色”选项；
- greeting 选择；
- 卡内 system prompt / PHI 开关；
- 编译预览，显示 system 文本、激活的 lore entries 与兼容诊断；
- 原件/JSON 导出、删除；
- 无活动会话时允许管理库，但禁用绑定操作并解释原因；
- Agent running 时禁用切换并解释“本轮结束后再切换”。

React 默认文本转义；creator notes、描述、扩展字段不得用 `dangerouslySetInnerHTML` 渲染。远程 asset URL 首期只显示为文本，不自动请求。

## 14. 安全与隐私要求

1. 默认单文件上限 32 MiB，元数据解码后另设 2 MiB 上限；
2. PNG chunk 长度逐项边界检查，总 chunk 数设上限；
3. 原始文件名只显示，不参与路径；
4. 不执行 `extensions`、脚本、HTML、data URI 或远程 URL；
5. 不支持 CHARX 时必须明确拒绝，不能当 JSON/PNG 猜测；
6. 日志只记内部 ID、格式、尺寸、hash 前缀和错误码，不记角色正文；
7. API 错误不回显原始文件内容；
8. 保存使用原子写；
9. 所有导入内容保持在 `/data`；
10. 测试使用合成 fixture；真实本地卡只做手工验收，禁止复制到 Git、snapshot、bundle 或日志；
11. 新依赖在加入前记录 license、维护状态和压缩/解析安全性；
12. 不复制 SillyTavern/TauriTavern 的 AGPL 源码。

## 15. 测试计划

### 15.1 格式单元测试

- V1 缺省值；
- 合法/非法 V2；
- V3 `3.0` 与未来 `3.x` warning；
- 顶层与 data 冲突时以规范 data 为准；
- 未知字段/extension 保存；
- PNG `chara`；
- PNG `ccv3`；
- 两 chunk 时 V3 优先；
- 非 PNG、截断 chunk、越界长度、坏 base64、坏 JSON、元数据超限；
- 宏、`{{original}}`、未知宏诊断；
- examples role 解析。

### 15.2 lorebook 单元测试

- constant、primary、selective secondary；
- case-sensitive/insensitive；
- regex 与非法 regex；
- scan depth；
- recursive 上限；
- position/order；
- budget 截断和稳定性；
- 不扫描自身/工具噪音。

### 15.3 store/API 测试

- 原子保存和进程重载；
- 路径穿越文件名；
- 同名不同卡；
- body/meta 大小限制；
- 导入失败不留半成品；
- 原件字节级导出；
- 删除时 binding 清理；
- session 404、card 404、running 409；
- 多会话选择隔离；
- fork/subagent 继承规则。

### 15.4 Host 契约测试

- `AssembleContext.agent.id` 选择正确角色；
- 无 Agent 时不注入；
- preset-only 输出不回归；
- marker 消费顺序正确且不复制 chat history；
- `replace` 保留统一 profile 与 tools/contexts/variables；
- 选卡/换卡/删卡 emit change；
- system/context 在两个并行 Agent 间隔离；
- 角色变化后请求 header 文本变化；
- 不产生伪造 assistant event。

### 15.5 客户端与构建测试

- client bundle smoke；
- details/root overlay 可达；
- 无会话、空白会话、已有对话、running 四种状态；
- JSON/PNG 导入错误可读；
- 大字段折叠，不冻结 UI；
- creator notes 和恶意 HTML 被当成文本；
- `npm run check`；
- `npm run pack:check`。

## 16. 验收标准

以下全部满足，首期才可标记完成：

### A. 格式兼容

- [ ] 合成 V1、V2、V3 JSON 全部导入成功，规范化字段与预期一致；
- [ ] 合成 PNG 的 `chara`、`ccv3` 和双 chunk 三种情况通过，双 chunk 使用 V3；
- [ ] 非法/超限输入明确失败且不留文件；
- [ ] 原始 JSON 未知字段与 extensions 完整保留；
- [ ] 原始 artifact 导出 SHA-256 与导入一致。

### B. 会话隔离与持久化

- [ ] 两个并行 DSH 会话可选择不同角色，互不串卡；
- [ ] 重启后恢复选择；
- [ ] 普通 fork 继承，subagent 不继承；
- [ ] 删除角色清理所有 binding；
- [ ] 运行中的会话切换返回 409，当前请求不受影响；
- [ ] 非空会话换卡经过确认，只影响后续请求且产生新的 request header。

### C. 提示语义

- [ ] description/personality/scenario/examples 按 marker 或 fallback 稳定输出；
- [ ] card system prompt 能覆盖 main、支持 `{{original}}`、尊重 `forbid_overrides` 与用户关闭选项；
- [ ] PHI/depth/greeting 内容不静默丢失，同时 UI 显示位置降级；
- [ ] creator notes 永不进入模型提示；
- [ ] 未知宏不会导致 DSH 严格模板失败，且 diagnostics 可见；
- [ ] chat history marker 不复制 DSH 历史；
- [ ] preset `append`/`replace` 和 preset-only 既有测试全部通过。

### D. character_book

- [ ] constant、关键词、selective、case、regex、scan depth、order、position 的合成用例通过；
- [ ] 激活集合变化时 system/profile 与 request header 相应变化，且不生成重复 user-role snapshot；
- [ ] 非法 regex/不支持扩展只产生诊断，不中断主请求；
- [ ] 预算处理结果稳定且可预览。

### E. UI 与安全

- [ ] 空白会话首条消息前可导入并选卡；
- [ ] 无会话时库管理可用、绑定禁用；
- [ ] 所有角色正文按文本渲染，无 HTML 执行；
- [ ] 远程资产不自动请求，extensions 不执行；
- [ ] 大小限制、路径安全、原子写和无正文日志均有测试；
- [ ] `npm run check` 与 `npm run pack:check` 通过。

### F. 手工交叉验收

在隔离 DSH profile 中，使用用户指定但不复制入仓库的本地 JSON/PNG：

1. 导入并记录 spec、warning 和 hash；
2. 在空白会话选择角色，检查首个 request header 的实际 system 文本；
3. 发送至少两轮，触发一个 lorebook entry；
4. 检查 lorebook 激活后 system/profile 和 request header 变化，且没有额外重复 user-role snapshot；
5. 非空会话换卡，确认旧历史不变、新 header 出现；
6. 重启 DSH，确认绑定恢复；
7. 导出原件并核对 hash；
8. 把同一原件的 JSON 结构与本地 SillyTavern parser 结果做字段级对照；
9. 验收记录只保存字段名、类型、长度、hash 和 pass/fail，不保存正文。

## 17. 明确的首期非目标

- CHARX 资产解压和重打包；
- BYAF、YAML、Pygmalion/Risu 专有导入；
- 角色卡编辑后重新编码 PNG；
- 群聊、多角色合并和 group-only greetings；
- 表情、背景、音频、Live2D 等资产运行；
- 第三方脚本/MVU/正则扩展执行；
- 精确复刻 SillyTavern 的任意 depth 插入；
- 在 DSH 历史中伪造 `first_mes` assistant 消息；
- 自动下载远程 assets/source；
- 在此分支直接修改 SillyTavern 或 TauriTavern。

非目标必须出现在 UI compatibility diagnostics 与最终用户文档中，不能只藏在开发文档里。

## 18. 回滚方案

- 功能保持在独立 `feature/character-card-compat` 分支；
- 每个阶段提交可单独 revert；
- 角色模块未配置/加载时，统一编译器对 `character: null` 必须退化为既有 preset-only 输出；
- 存储 schema 首期只新增文件，不迁移/改写 preset 数据；
- 卸载脚本默认保留用户 `/data`，若未来提供数据删除必须是独立显式命令；
- 若 Host API 在 rc 版本变化，以 host-contract 测试失败为阻断，不做静默私有 API fallback。

## 19. 审核通过的启动条件

只有在审核者明确同意本方案（或给出修订意见并完成文档更新）后，才进入 Gate 1。建议审核回复至少确认：

1. JSON + PNG 是否足够作为首期格式；
2. 是否接受 first message / PHI / depth 的明确降级；
3. 是否要求 character_book 常用子集进入首期；
4. 是否同意每会话绑定、fork 继承、subagent 不继承；
5. 是否同意默认优先卡内 system prompt；
6. 采用哪个 `feature/prompt-preset-gpt` commit 作为实现基线。
