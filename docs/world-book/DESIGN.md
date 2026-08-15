# WorldBookModel 设计与接口契约

状态：2026-08-14 已采用，并由首个公开发布候选版本的共享 parser/matcher/loader adapter 实现。

## 模块边界

新模块位于 `packages/world-book`，只使用 JavaScript 平台能力。它不导入 DSH、Node 文件系统、UI、网络、preset 或 `tavern-loader`。根包只增加 `dsh-tavern/world-book` 子路径导出。

```text
ST world JSON ───────────┐
                        ├─ format.js ─> WorldBookModel ─> ST world JSON
card.data.character_book┘                         └──────> character_book

WorldBookModel + scan text + explicit policy inputs ─> policy.js candidate advice
```

`format.js` 回答“文件表达什么”；`policy.js` 只回答“在给定完整输入时哪些 entry 可作为候选”。session 选择、来源组合、真正 tokenizer、递归状态和 prompt 注入全部留给统一 loader。

## WorldBookModel v1

模型顶层固定包含：

- `schemaVersion: 1`、`kind: "world-book"`；
- `name`、`description`；
- `settings`：书级 scan depth、token budget、recursive scanning 与原扩展对象；
- `entries[]`：统一字段；
- `source`：源格式、原 entry 容器类型和完整原始书对象；
- `diagnostics[]`：结构化诊断。

entry 统一字段覆盖 key、secondary key、启用、strategy、secondary logic、insertion order/position/depth/role、概率、扫描覆盖、分组、递归、时效、过滤、触发器和扩展。每个 entry 的 `source.raw` 保留完整原对象，`source.key` 保留独立 ST 世界书的映射 key。

模型不生成 UUID、时间戳或随机值。同一 JSON 与同一 options 必须得到深度相等的模型。

## 识别和校验

- `entries` 为非数组对象：`sillytavern-world-info`。
- `entries` 为数组：`character-book-v2`。
- 缺少 `entries`、顶层不是对象、entry 不是对象：错误，解析抛出 `WorldBookValidationError`。
- 缺失或类型错误但可以安全降级的 entry 字段：warning，并使用 ST/规范默认值。
- 重复 normalized UID：warning；数组顺序和 source key 仍可区分 entry，不静默删除。

`validateWorldBook()` 不抛出普通格式错误，返回 `{ valid, format, diagnostics }`；`parseWorldBook()` 对错误诊断抛出，并把诊断挂在异常上。

## 稳定导入导出

导出以 `source.raw`/entry `source.raw` 为底稿，再覆盖模型中受支持的语义字段。因此：

- 顶层未知字段、entry 未知字段、book/entry extensions 均保留；
- 可在两种目标格式间转换；
- 再次导入导出达到结构幂等；
- `stableStringify()` 递归排序对象 key，使快照和跨进程输出稳定。

“原始保留”不等于字节级往返：解析后的 JSON 已不保留空白、转义写法或重复对象 key；标准化导出也可能补足默认字段。

## 角色卡模块接口

角色卡模块应只传递值，不形成反向依赖：

```js
const model = parseCharacterBook(card.data.character_book, {
  name: card.data.character_book?.name ?? `${card.data.name} lorebook`,
})

const embedded = exportCharacterBook(model)
nextCard.data.character_book = embedded
```

本模块不接收 PNG、整张 card 或角色 session，也不决定 embedded book 是否启用。角色卡模块负责提取/回填，loader 负责来源优先级与选择。

## Loader 消费契约

统一 loader 可以：

1. 取得已由上层选择的一个或多个 `WorldBookModel`；
2. 用自己的 session/context 组装 scan text 和来源优先级；
3. 可选调用 `computeWorldBookCandidates()` 获取无状态建议；
4. 自己处理 tokenizer、递归、sticky/cooldown/delay、随机概率、group 生命周期和最终 insertion position；
5. 不依赖 `source.raw` 解释已标准化字段。

候选函数返回 accepted/rejected 及原因，绝不直接生成 system prompt。

## 公共 API

根包子路径为 `dsh-tavern/world-book`：

- `detectWorldBookFormat(input)`：按 `entries` 外形识别，不抛出 JSON/结构错误；
- `validateWorldBook(input, options)`：返回 format、valid 和结构化 diagnostics；
- `parseWorldBook()`、`parseSillyTavernWorldBook()`、`parseCharacterBook()`：生成模型；
- `exportSillyTavernWorldBook(model)`、`exportCharacterBook(model)`：导出 JSON value；
- `stableStringify(value, space)`：生成递归 key 稳定的 JSON 文本；
- `matchWorldBookKey()`、`evaluateWorldBookEntry()`、`rankWorldBookEntries()`：可单独组合的纯函数；
- `computeWorldBookCandidates(modelOrEntries, options)`：接受显式 text、默认匹配设置、vector match、probability rolls、group rolls、token costs 与 budget，返回 accepted/rejected/budget。它不会自行读取上下文、掷随机数或调用 tokenizer。
- `projectWorldBookForLoader(model, candidates, options)`：把一本已选书的候选结果投影为 `{ loreEntries, resources, diagnostics }`；
- `mergeWorldBookLoaderResults(results)`：合并多本已选书的投影，不增加选择或运行策略。

所有 value 输入与返回值均为普通可结构化克隆数据；模块没有文件读取 API。

## registerWorldBookAdapter 桥接

loader 分支的 `registerWorldBookAdapter().resolve({ selection, sessionId, agent, conversationText, character, context })` 是用例组合点。本模块不注册它；未来管理层 adapter 只需在该回调中读取 `selection.worldBookIds` 对应的已标准化模型，把 loader 已提供的 `conversationText` 交给 matcher，再投影和合并：

```js
loader.registerWorldBookAdapter({
  resolve({ selection, conversationText, character, context }) {
    const results = selection.worldBookIds.map((id) => {
      const model = worldBookStore.get(id)
      const candidates = computeWorldBookCandidates(model, {
        text: conversationText,
        // tokenizer cost、角色来源文本和显式策略值由该用例层补充
      })
      return projectWorldBookForLoader(model, candidates, {
        resource: { id, name: model.name },
      })
    })
    return mergeWorldBookLoaderResults(results)
  },
})
```

角色卡模块解析出的 embedded `character_book` 也得到同一个 `WorldBookModel`，进入同一 matcher/projector，不应复制匹配实现。

当前 loader 已把纯字符串兼容输入升级为结构化 `activationContext`。该变化没有进入本纯模块：管理层 adapter 从 `activationContext.text` 派生兼容的 `conversationText`，并把明确选定的 message frames 转成 matcher `text`；`computeWorldBookCandidates()` 仍不会订阅 `agent/inbox/spliced`、读取 Session 或保存当前输入。pending 队列、claim/cancel 语义、正文生命周期和 history 去重全部由 `tavern-loader` 独占。

首 step 激活的验收必须同时检查 matcher decision、loader snapshot 和同一步 `request/header.system`。只在请求后用当前输入重算一个“命中”结果不属于有效实现。

纯 projector 的位置桥接保持诚实：

| WorldBookModel position | loader lore position | 诊断 |
| --- | --- | --- |
| `before_character_definition` | `before` | 无降级 |
| `after_character_definition` | `after` | 无降级 |
| before example / before author note | `before` | `WORLD_BOOK_POSITION_APPROXIMATED` |
| after example / after author note / at depth | `after` | `WORLD_BOOK_POSITION_APPROXIMATED` |
| outlet | 不返回激活项 | `WORLD_BOOK_OUTLET_SKIPPED` |

每个返回的激活项都是 `{ id, uid, content, position: "before" | "after" }`。`id` 用 `<resourceId>:<uid>` 避免多书 UID 冲突；`uid` 保留书内原标识。空 content 不交给 loader，并给出诊断。projector 不读取 `selection/sessionId/agent/character/context`，这些参数的所有权仍在 adapter/loader。
