# 角色卡兼容调研记录

状态：历史调研记录。方案已实施并集成到首个公开发布候选版本；本文保留实施前证据，不代表当前功能状态。

调研日期：2026-08-14（Australia/Sydney）

## 1. 调研目标与边界

本轮调研回答三个问题：

1. SillyTavern 实际接受哪些角色卡载体和字段，并如何把字段送入模型请求；
2. TauriTavern 是否引入了另一套角色卡语义，还是维持 SillyTavern 的兼容面；
3. DeepSeek Harness（下称 DSH）有哪些公开扩展点可以承载这些语义，哪些语义只能降级。

本轮仅进行了只读源码、类型声明、运行数据结构和公开文档检查。未启动 SillyTavern/TauriTavern，未修改其数据，未读取 `secrets.json` 内容，也未把任何第三方角色卡正文、图片或用户数据复制进本仓库。

## 2. 固定的调研基线

| 对象 | 调研基线 | 证据 |
| --- | --- | --- |
| dsh-tavern 主线 | `main` @ `739cc1297385fe025d97b400e80e2cc24f890c95` | 新角色卡分支的起点 |
| 已验证预设分支 | `feature/prompt-preset-gpt` @ `7ddf0ef` | 独立 worktree，工作树干净 |
| DSH 本地运行包 | `@deepseek-ai/*` `0.1.0-rc.6` | 隔离 DSH profile 中已安装的 package |
| SillyTavern 本地源码 | `staging` @ `380e31e8c58d196969b6a0da74f431ba999c7e0a` | 2026-07-12 提交；仓库含用户自己的未跟踪目录，本轮未触碰 |
| TauriTavern 本地程序 | portable canary，文件/产品版本 `2.2.0`，构建文件名日期 `20260813` | 便携版二进制的文件元数据 |
| TauriTavern 数据 | 2026-08-10 从本地 SillyTavern 做的一次性只读快照 | `README-SillyTavern-migration.md` 与 `sillytavern-import-manifest.json` |

说明：TauriTavern 本地目录是便携程序和运行数据，不是源码 checkout。为核对其架构，另查阅了项目官方 GitHub 仓库；网页是移动的 `main`，因此本地可执行文件版本才是本轮的可复现产品基线。

## 3. SillyTavern 的实现事实

### 3.1 支持的输入载体

本地 `public/script.js` 的导入入口接受：

- JSON；
- PNG；
- YAML/YML；
- CHARX；
- BYAF。

后端路由位于 `src/endpoints/characters.js`：`/api/characters/import` 根据扩展名分派到不同解析器，`/api/characters/export` 支持 PNG 与 JSON 导出。

对 dsh-tavern 首期最有价值且生态覆盖最高的是 JSON + PNG：

- V1 是顶层的 `name`、`description`、`personality`、`scenario`、`first_mes`、`mes_example`；
- V2 使用 `spec: chara_card_v2`、`spec_version: 2.0` 和 `data`；
- V3 使用 `spec: chara_card_v3`、`spec_version: 3.x`，是 V2 的扩展。

### 3.2 PNG 元数据规则

本地 `src/character-card-parser.js` 的行为是：

- 从 PNG `tEXt` chunk 读取 base64 编码的 UTF-8 JSON；
- V2 使用关键字 `chara`；
- V3 使用关键字 `ccv3`；
- 两者同时存在时，`ccv3` 优先；
- 写出时清理旧的 `chara`/`ccv3`，再写入两份兼容数据。

这与 [Character Card V3 specification](https://github.com/kwaroran/character-card-spec-v3/blob/main/SPEC_V3.md) 的 PNG 规则一致。V2 字段和“未知扩展字段不可破坏”的要求见 [Character Card V2 specification](https://github.com/malfoyslastname/character-card-spec-v2/blob/main/spec_v2.md)。

### 3.3 SillyTavern 内部规范化

`src/endpoints/characters.js` 的 `readFromV2()` 会把 `data` 中的核心字段提升到 SillyTavern 内部对象的顶层，以兼容旧前端；保存时仍保留 V2/V3 `data`。因此不能把 SillyTavern 内部对象的重复顶层字段误当成规范要求。

建议 dsh-tavern 采用单一规范化模型：运行时只读规范化后的 `data`，同时完整保留原始 JSON 和原始导入文件。这样既避免顶层/`data` 不一致，也为以后无损导出留出路径。

### 3.4 字段不是一次性拼接到同一个位置

本地 `public/script.js`、`public/scripts/openai.js` 和 `public/scripts/PromptManager.js` 表明：

- `description`、`personality`、`scenario` 会进入角色定义/故事串或 Chat Completion 的对应 marker；
- `mes_example` 被解析成示例对话；
- `system_prompt` 可以覆盖预设里的主提示，`{{original}}` 表示被覆盖前的原文；
- `post_history_instructions` 可以覆盖 jailbreak/PHI，语义位置在历史之后；
- `extensions.depth_prompt` 以指定 role/depth 注入聊天历史附近；
- `first_mes` 会作为新聊天的第一条 assistant 消息，`alternate_greetings` 是它的 swipe 候选；
- `character_book` 随角色启用，按聊天内容扫描关键词后动态注入；
- `creator_notes` 是给用户看的说明，规范明确要求不能进入提示词。

因此“成功解析 JSON”不是角色卡兼容完成；兼容性还取决于运行时位置、覆盖策略、宏替换、会话选择和历史语义。

### 3.5 真实文件的结构抽样

只对 SillyTavern 自带的 `default_Seraphina.png` 做了结构统计，没有输出字段正文：

- 解析为 `chara_card_v3` / `3.0`；
- 同时带 SillyTavern 内部兼容顶层字段和规范 `data`；
- `data` 含 V2 核心字段、`character_book`、`group_only_greetings`；
- SillyTavern 与 TauriTavern 中这份默认卡的 SHA-256 相同。

这说明本地 TauriTavern 的现有卡至少在持久化层是原样继承，而非转换成私有格式。

## 4. TauriTavern 的实现事实

本地迁移记录明确显示：

- `SillyTavern\data\default-user` 被一次性复制到 `TauriTavern\data\default-user`；
- 角色卡仍位于 `data/default-user/characters/*.png`；
- 配置、预设、世界书和聊天目录布局一并保留；
- 这是只读来源、单向快照，不是双向同步。

TauriTavern 官方仓库说明其前端保留 SillyTavern 体验，数据格式和目录兼容，后端由 Node.js 重写为 Rust，并通过 Tauri ABI 连接。参考：[TauriTavern repository](https://github.com/Darkatse/TauriTavern)。其仓库中的 `src/script.js`、`src/scripts/PromptManager.js`、`src/scripts/openai.js` 延续 SillyTavern 的前端提示装配模型。

对 dsh-tavern 的结论是：

1. 兼容目标应锚定公开 Character Card 规范与 SillyTavern 行为，而不是复制 TauriTavern 的 Rust 存储实现；
2. 同一份 PNG/JSON 应能被 dsh-tavern 导入并保留原件；
3. 无需为 TauriTavern 创建第二套角色卡格式适配器；
4. TauriTavern 的源码为 AGPL-3.0，SillyTavern 同属 AGPL 系列。实现应依据规范和行为测试自行编写，不能直接复制其源码到当前 MIT 项目。

## 5. DSH 可用的公开承载点

### 5.1 每次请求的 system prompt assembly

`@deepseek-ai/dsh-system-prompt` 提供：

- `systemPrompt.section()`：有序 system prompt 片段；
- `systemPrompt.context()`：动态上下文，模型侧表现为带来源的 user-role snapshot；
- `system-prompt/assemble`：请求前的组合 waterfall；
- `AssembleContext.agent`：当前 Agent，`agent.id` 与会话 ID 相同。

因此角色选择可以按 `sessionId` 保存，并在同一个全局 section provider 中根据 `context.agent.id` 解析，而不必创建全局“当前角色”。

### 5.2 会话级身份与分叉

`Agent.id === Session.id`。`Session.header.parentSession` 和 `origin` 可区分普通 fork 与 subagent。建议普通 fork 继承角色选择，subagent 默认不继承，避免把角色扮演约束扩散到工具型子代理。

### 5.3 动态上下文的真实行为

本地 `@deepseek-ai/dsh-agent-loop/lib/index.js` 显示：

- 每一步先 assemble system prompt；
- 若动态上下文与上次不同，会生成一条带插件来源的 user message；
- 该 snapshot 追加在本步已 claim 的用户输入之后；
- 相同 snapshot 不重复追加；清空时会写入明确的 supersede 消息。

这可承载“当前角色卡/世界书状态发生变化”的可追溯快照，但不能严格模拟 SillyTavern 每次都位于完整历史末尾的 PHI，也不能模拟任意 depth 的历史插入。

### 5.4 请求可重建性

DSH 在 `request/header` 事件中记录实际 system prompt、tools 和 call config。角色选择或编译结果改变后，下一次请求应产生 reason 为 `change` 的新 header。因此无需改写旧历史，也能审核模型在每个阶段实际看到的角色提示。

### 5.5 首句的硬限制

DSH 当前没有公开 API 允许第三方插件凭空提交一条“assistant 已说过的话”。直接 append 私有 session event 会绕过 Agent/Session 的公开契约，也会伪造历史来源，不应采用。

首期可行的诚实降级是：

- UI 显示 `first_mes` 与可选 greeting；
- 把选中的 greeting 作为明确标注的“角色开场/风格参考”编入角色上下文；
- 不在对话 UI 中伪造 assistant 消息；
- UI 和文档明确显示此差异。

## 6. 与已验证预设分支的关系

`feature/prompt-preset-gpt` 已建立以下可复用边界：

- `packages/tavern-format`：纯解析、规范化、宏和提示编译；
- `packages/preset`：原子文件存储、HTTP API、DSH Host hook、React 管理界面；
- `/dsh-tavern/api` 路由；
- 右侧 details + root overlay 的可达性方案；
- `systemPrompt.section()` 和 `agent/request` 的 Host 契约测试；
- 外部验收素材只原地读取，禁止进入 Git。

但角色卡不能简单新增第二个互不相干的 section，原因是：

1. 预设的 `replace` 模式当前会只保留预设 section，独立角色 section 会被丢弃；
2. SillyTavern 预设的 marker（`charDescription`、`scenario`、`dialogueExamples` 等）需要由角色卡解析器填充；
3. `system_prompt` / `post_history_instructions` 需要覆盖预设中的 `main` / `jailbreak`，同时尊重 `forbid_overrides`；
4. 右侧 details 是单占位，两个独立管理器会互相覆盖。

因此正确方向是把预设与角色卡合成一个 Tavern profile compiler，并把现有管理器扩展为“预设 / 角色卡”两个页签。

## 7. 兼容性结论

| 能力 | DSH 可实现程度 | 结论 |
| --- | --- | --- |
| V1/V2/V3 JSON | 等价 | 首期支持 |
| V2/V3 PNG `chara`/`ccv3` | 等价 | 首期支持，V3 优先 |
| 原始字段/未知 extensions 保存 | 等价 | 必须保存且不得执行 |
| 角色描述、性格、场景 | 近似等价 | 填充预设 marker；无 marker 时放入有序角色 section |
| `system_prompt` 覆盖 | 近似等价 | 覆盖 `main`，支持 `{{original}}`，受审核开关控制 |
| `mes_example` | 近似等价 | 解析为带 role 标签的示例段，无法成为原生历史消息 |
| `post_history_instructions` | 明确降级 | 可放在 Tavern profile 末端/动态 snapshot，不能保证每步严格位于历史末尾 |
| `depth_prompt` | 明确降级 | 保留 role/depth 元数据，首期作为标注段；不能任意插入旧历史 |
| `first_mes` / greetings | 明确降级 | 展示并作为开场参考；不伪造 assistant 历史 |
| `character_book` | 可实现常用子集 | 关键词/regex/constant/selective/顺序/预算可由会话 surface 扫描实现 |
| CHARX 与嵌入资产 | 可实现但风险较高 | 分阶段，首期不宣称支持 |
| YAML/BYAF/Risu sprites/脚本扩展 | 非核心 | 保留为后续适配，不进入首期验收 |
| 群聊与多角色合并 | 缺少产品承载 | 首期不支持 |

## 8. 主要风险

1. **身份语义污染**：角色卡会改变 Agent 行为，必须按会话选择，不能沿用预设的全局选择模型。
2. **覆盖顺序错误**：若不统一编译 preset + character，`replace` 模式和 marker 会产生静默丢失。
3. **宏与 DSH 严格模板冲突**：未处理的 `{{...}}` 会使 DSH assembly 失败。编译器必须有界解析并对未知宏给出警告。
4. **不可信文件**：PNG/未来 CHARX 可能包含超大数据、路径穿越、压缩炸弹、恶意 URL 或脚本型 extensions；首期不执行、不自动联网、不解压 CHARX。
5. **会话中途换卡**：不能改写旧历史。UI 必须确认，下一请求用新的 `request/header` 留痕。
6. **许可证污染**：只复用规范和可观察行为，不复制 AGPL 实现源码。

## 9. 复核命令留痕

以下命令类别用于本轮调研，均为只读：

```powershell
$stCheckout = '<path-to-sillytavern-checkout>'
$ttPortable = '<path-to-tauritavern-portable-data>'
git log --oneline --decorate --graph --all
git diff --stat main..feature/prompt-preset-gpt
git -c safe.directory=$stCheckout -C $stCheckout log -1
rg -n "chara_card_v3|character_book|first_mes|post_history_instructions" (Join-Path $stCheckout 'src') (Join-Path $stCheckout 'public')
Get-Content (Join-Path $stCheckout 'src/character-card-parser.js')
Get-Content (Join-Path $stCheckout 'src/endpoints/characters.js')
Get-Content (Join-Path $stCheckout 'public/scripts/PromptManager.js')
Get-Content (Join-Path $stCheckout 'public/scripts/openai.js')
Get-Content (Join-Path $ttPortable 'README-SillyTavern-migration.md')
Get-FileHash (Join-Path $stCheckout 'data/default-user/characters/default_Seraphina.png')
Get-FileHash (Join-Path $ttPortable 'data/default-user/characters/default_Seraphina.png')
```

角色卡结构抽样通过本地 SillyTavern 的 parser 读取默认卡，只输出字段名、类型和长度，不输出正文。
