# 角色卡实现说明

状态：角色卡格式与用例切片已实现，等待合并到统一 loader 后进行安装态端到端验收。

基线：`main` `a38ae9a`；分支：`feature/character-card-compat`。

## 1. 本分支交付什么

本分支把 SillyTavern 角色卡作为一种可管理资源，而不是直接当作 system prompt：

1. 纯格式层识别 V1/V2/V3 JSON，以及包含 `chara`/`ccv3` tEXt chunk 的 PNG；
2. 生成稳定的 `CharacterCardModel`，同时保留完整源 JSON、未知字段和扩展字段；
3. 保存标准化文档和原始导入字节，提供列表、详情、删除、原件导出和 JSON 导出；
4. 用与 loader 相同的 `characterCardId`/`character` 形状保存选择意图、greeting 索引和两个策略开关；
5. 提供独立角色卡管理 UI，并将它和既有 preset UI 组合进同一浏览器 bundle；
6. 为 loader/world-book 模块提供不含 Host 行为的资源接口；
7. 使用纯合成 fixture 自动验证格式、安全边界、持久化、API、UI 状态和包边界。

本分支不注册 `systemPrompt.section()`，不监听 `agent/request`，不修改
`packages/tavern-loader/**`，不伪造 assistant 历史，也不执行 character_book 匹配。

## 2. 依赖与文件边界

```text
packages/tavern-format/src/character.js
packages/tavern-format/src/png-card.js
                 │
                 ▼
packages/character/src/store.js
packages/character/src/server.js
packages/character/src/resource.js
packages/character/src/client.js
                 │
                 ▼
packages/client/src/index.js  ── browser-only composition ── preset client

feature/tavern-loader       ── future consumer, not modified here
feature/world-book-compat   ── future character_book consumer, not modified here
```

公共改动被限制为四个合并点：

- `packages/tavern-format/src/index.js` 导出角色卡纯函数；
- 根 `package.json` 增加 `./character` subpath；
- `build.mjs` 从浏览器组合入口构建 preset 与 character UI；
- `dist/client.js` 是上述构建的受控生成物。

没有修改 preset 或 loader 的源文件。

## 3. CharacterCardModel

`parseSillyTavernCharacterCard(input, options)` 返回：

```js
{
  schemaVersion: 1,
  id,
  name,
  createdAt,
  updatedAt,
  source: {
    format,          // sillytavern-v1 | sillytavern-v2 | character-card-v3
    container,       // json | png
    specVersion,
    importedAt,
    fileName,        // 仅显示，不参与路径
    sha256,
    byteLength,
    pngKeyword,
    raw,             // 完整源 JSON 深拷贝
  },
  data: {
    name, nickname, description, personality, scenario,
    firstMessage, messageExample, creatorNotes,
    systemPrompt, postHistoryInstructions,
    alternateGreetings, groupOnlyGreetings, tags,
    creator, characterVersion,
    characterBook, assets, extensions,
  },
  compatibility: {
    warnings,
    unsupportedFeatures,
    unknownMacroNames,
  },
}
```

规范化只收敛已知字段的类型；所有未识别数据仍在 `source.raw`。V2/V3 已知字段
若类型错误会带字段路径拒绝导入。未来 V3 小版本可以导入，但会生成诊断。

## 4. JSON 与 PNG 解析

### JSON

- 接受 object、JSON 字符串或 UTF-8 字节；
- V3 由 `chara_card_v3`/`3.x` 识别，V2 由 `chara_card_v2`/`2.x` 识别，其余按 V1；
- V2/V3 使用 `data` 为规范字段来源，顶层冲突字段仍原样保留；
- 导出 JSON 来自 `source.raw`，不会由规范字段反向推测并覆盖未知内容。

### PNG

- 校验 PNG signature、首个 13-byte `IHDR`、chunk 边界、chunk 数量和空 `IEND`；
- 只读取标准 tEXt 中的 `chara`、`ccv3`；
- 两者并存时无条件优先 `ccv3` 并产生可见诊断；
- base64 必须满足严格 alphabet/padding，解码结果必须是 UTF-8 JSON object；
- 默认最多 10,000 个 chunk，解码后的卡片元数据最多 2 MiB；编码长度在分配前检查；
- 不解析、执行或自动获取扩展资产。

PNG CRC 目前交给正常 PNG 生产链保证；本解析器的安全目标是边界与资源限制，不是
替代完整图片解码器。原始图片仍由浏览器自身图片解码器展示。

## 5. 存储与无损导出

`CharacterStore(storageDir)` 使用：

```text
<storageDir>/
  character-state.json  # 角色分支独立验收态；最终由 loader SessionSelectionStore 接管
  characters/<internal-id>.json
  character-artifacts/<internal-id>.bin
```

- 导入文件默认上限 32 MiB；
- 文件内容计算 SHA-256；
- artifact 和标准化文档均使用同目录临时文件 + rename；
- 磁盘路径只使用经过白名单验证的内部 ID，不使用原文件名或角色名；
- `/artifact` 字节级返回导入原件；`/json` 返回优先 PNG chunk 解出的源 JSON；
- 删除角色时同步清除全部 session 引用；
- `copySelection(parent, child)` 只在 child 没有显式选择时复制，是否调用由 loader 判断；
- state 使用无原型映射并拒绝 `__proto__` 等特殊 session key；
- selection 形状为 `{ characterCardId, character: { greetingIndex,
  preferCharacterSystemPrompt, preferCharacterPostHistory } }`，与 loader contract 对齐。

格式导入失败不会创建标准化文档。双文件提交不是跨文件系统事务；若第二次 rename
异常，store 会删除本次已写入的两个目标，正常列表也只以标准化文档为索引。

## 6. HTTP 用例契约

`createCharacterApiHandler(store, options)` 提供：

| 方法 | 路径 | 结果 |
| --- | --- | --- |
| GET | `/dsh-tavern/api/characters` | 摘要列表，不返回正文 |
| POST | `/dsh-tavern/api/characters/import?filename=...` | 原始 JSON/PNG 字节导入 |
| GET | `/dsh-tavern/api/characters/:id` | 标准化详情和诊断 |
| GET | `/dsh-tavern/api/characters/:id/artifact` | 原件字节下载 |
| GET | `/dsh-tavern/api/characters/:id/json` | 源 JSON 下载 |
| DELETE | `/dsh-tavern/api/characters/:id` | 删除资源及全部 binding |
| GET | `/dsh-tavern/api/character-selection?sessionId=...` | 当前 session binding |
| POST | `/dsh-tavern/api/character-selection` | 选择、更新或取消 |

错误统一为 `{ ok: false, error: { code, message, field? } }`。loader 应给
`beforeSelectionChange` 注入 session 存在性和 running 状态策略；POST body 使用
`{ sessionId, characterCardId, character }`。角色卡 API 不直接
依赖 DSH agent registry。`onChange(change)` 只报告资源事件，由 loader 决定是否 emit
Host 事件。

角色模块只导出纯 `createCharacterApiHandler()`，不再导出可裸注册的 route installer。
根 loader 把它合入唯一的 `/dsh-tavern/api` dispatcher，再统一套 TCP peer、Host、
same-origin 与 Content-Type 安全包装，避免子模块被集成者无意间绕过保护。

## 7. Loader adapter 消费契约

本分支只读对齐 `feature/tavern-loader/docs/LOADER_CONTRACT.md`。最终集成代码应是：

```js
import { CharacterStore, createCharacterAdapter } from 'dsh-tavern/character'

const characterStore = new CharacterStore(storageDir)
const dispose = loader.registerCharacterAdapter(createCharacterAdapter(characterStore))
```

loader 调用：

```js
adapter.resolve({ selection, sessionId, agent, conversationText, context })
```

`selection` 由统一 `SessionSelectionStore` 提供：

```js
{
  characterCardId: 'card-id or null',
  character: {
    greetingIndex: 0,
    preferCharacterSystemPrompt: true,
    preferCharacterPostHistory: true,
  },
}
```

`createCharacterAdapter(store).resolve()` 精确返回：

```js
{
  character: null | {
    id,
    name,
    updatedAt,
    data,          // 标准化 CharacterCardModel.data 深拷贝
    source,        // 不包含 source.raw
    compatibility,
  },
  diagnostics,
}
```

未选择角色时返回 `{ character: null, diagnostics: [] }`；选择引用不存在时不抛出
运行时错误，而是返回 `character-card-not-found` 诊断。adapter 不读取
`conversationText`、不修改 selection、不编译 prompt。

此外，根包 `./character` 保留以下低层资源快照接口，供 API 预览或独立测试使用，
但统一 loader 应优先使用上面的注册 adapter：

```js
const store = new CharacterStore(storageDir)

const resource = selectedCharacterCardResource(store, sessionId)
// null，或：
{
  kind: 'character-card',
  resourceVersion: 1,
  characterId, // 资源内部显示字段，不是 SessionSelectionStore key
  displayName,
  characterName,
  selection: {
    greetingIndex,
    preferCharacterSystemPrompt,
    preferCharacterPostHistory,
  },
  greeting: { index, kind, text },
  fields: {
    name, nickname, description, personality, scenario,
    messageExample, systemPrompt, postHistoryInstructions,
    groupOnlyGreetings, creatorNotes,
  },
  embeddedCharacterBook, // null 或下面第 8 节的资源
  extensions,            // 惰性数据；不得默认执行
  assets,                // 惰性数据；不得默认远程获取
  source: { format, container, specVersion, sha256 },
  compatibility,
}
```

loader 不应读取 `characters/*.json`、`character-state.json` 或 `source.raw`。它应通过
`registerCharacterAdapter(createCharacterAdapter(store))` 消费模型，定义 preset
marker、宏、greeting、PHI/depth 以及 fork/subagent 的运行策略。角色分支未提供
system 文本，因而不会和 loader 的组合顺序产生第二事实来源。

session 生命周期契约：

- loader 的 `SessionSelectionStore` 是最终 selection 权威，并负责准确 session ID、
  fork/subagent 和 `clearResource('character', id)`；
- 当前 `CharacterStore.copySelection()` 只用于角色分支独立测试，最终集成不得与 loader
  各保存一份 session selection；
- loader 在绑定修改前通过 `beforeSelectionChange` 返回 404/409；
- loader 收到 `onChange` 后决定 request/header 刷新与审计方式。

### 7.1 最终集成必须桥接的差异

角色分支为独立验收 API/UI，当前把同形 selection 暂存于
`character-state.json`；loader contract 的最终权威文件是
`session-selections.json`。合并阶段必须：

1. 让 selection API 的读写委托给 `SessionSelectionStore`，而不是形成双写；
2. 若发现已有 `character-state.json`，一次性迁移其中的 `characterCardId/character`
   后停止写旧文件；
3. 删除角色时调用 loader `clearResource(kind, id)`；
4. 由 loader 实施普通 fork 复制和 subagent 空选择；
5. 保留 CharacterStore 对角色文档/artifact 的唯一所有权。

这是有意保留的集成 seam；本分支没有复制 loader store 或改写 loader 文件。

## 8. world-book 消费契约

纯函数 `embeddedCharacterBookResource(character)` 返回：

```js
{
  kind: 'embedded-character-book',
  ownerCharacterId,
  ownerCharacterName,
  sourceFormat,
  book, // character_book 的无损深拷贝
}
```

`createCharacterCardResource()` 将它放在 `embeddedCharacterBook`；注册 adapter 的
`character.data.characterBook` 也保留同一份标准化深拷贝。角色卡模块不修改 entry、
不计算关键词、不做递归、不排序、不估算 token。world-book 模块应以
`ownerCharacterId` 形成稳定来源标识，并把其匹配结果交给 loader 组合。

## 9. 浏览器 UI

角色卡 UI 位于独立 `shell.overlay`，活动会话通过 header 的“角色卡”按钮打开，空白
会话通过浮动入口打开。它支持：

- JSON/PNG 原始字节上传；
- 库列表、格式/版本/tag、PNG 卡面、安全文本详情；
- 兼容诊断、未知宏、内嵌 character_book 保存状态；
- session binding、greeting 和两个 loader 策略开关；
- 原件/JSON 下载和删除。

所有正文使用 React 文本节点或 `textContent`，没有 `dangerouslySetInnerHTML`。V3
remote asset URI 只保留在数据中，UI 不请求；唯一图片请求是同源 artifact endpoint。

浏览器组合入口只负责调用 preset client 与 character client 的注册函数。角色卡没有
抢占 preset 使用的单一 `details` slot，因此两个并行 feature 合并时只需协调 bundle
入口，不需改 preset 组件。

## 10. 已知限制与后续工作

- 根 loader 尚未创建 CharacterStore、挂载 API 或调用
  `registerCharacterAdapter()`；单独安装本分支时，角色 UI 请求会等待
  `feature/tavern-loader` 的集成提交。这是并行边界，不是由角色分支越权修改 loader；
- 独立验收态 `character-state.json` 仍需迁移/桥接到 loader 的
  `session-selections.json`，不得在最终版本双写；
- 没有将角色内容写入对话、system prompt 或 request/header；
- 没有 first message assistant event、preset marker、macro 或 PHI/depth 放置策略；
- 没有 character_book 激活、递归、排序或预算；
- 不支持 CHARX、BYAF、JPEG/WebP 卡或编辑后重新写入 PNG；
- 没有使用本机第三方角色作品作为 fixture，安装态 UI/loader 联调必须在合并分支完成。
