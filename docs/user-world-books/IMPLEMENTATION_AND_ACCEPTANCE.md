# User-bound world books: implementation and acceptance

状态：2026-08-15，已集成到首个公开发布候选版本。本文保留原 feature 的实施与验收细节，不是 README。

## 运行语义

每个用户资源可关联零本或多本独立世界书。关系不进入用户文档，也不反写世界书文档：用户资源仍严格为 `{id,name,description}`，关系由 loader-owned `UserWorldBookBindingStore` 保存到插件 data 目录的 `user-world-book-bindings.json`。

一次 profile compile 的组合顺序固定为：

1. 当前 session 显式 `worldBookIds`，保持 session 保存顺序；
2. 当前所选用户关联的 `worldBookIds`，保持用户关系保存顺序；
3. 按 ID 稳定去重，显式来源优先。

因此一本书若同时来自 session 与用户，只传给共享 world-book adapter 一次。adapter 仍是唯一 matcher/投影入口；用户模块不运行 matcher，UI 不拼 system prompt。切换或解绑用户只改变第二类来源，绝不修改 session 显式列表。普通 fork/subagent 继续遵守 `SessionSelectionStore` 原有策略：fork 固化父 session 选择，delegated subagent 没有用户，因此不会隐式获得用户世界书。

## 持久化与边界

关系文件 schema 为：

```json
{
  "schemaVersion": 1,
  "bindings": {
    "<user-id>": {
      "worldBookIds": ["book-a", "book-b"],
      "updatedAt": "2026-08-15T00:00:00.000Z"
    }
  }
}
```

- user/world-book ID 只接受 1–100 个安全字符 `[A-Za-z0-9_-]`；API 还会确认两类资源都真实存在。
- 每用户最多 100 本，默认最多 2,048 个有非空关系的用户，硬上限 4,096。
- 状态默认最多 2 MiB、配置硬上限 4 MiB；超过 8 MiB 的旧文件在 `JSON.parse` 前拒绝。
- 所有变更先在内存副本上验证字节与数量上限，再以权限收紧的临时文件原子替换；失败不会污染当前内存状态。
- 空关系不留空记录。删除用户清除该用户关系和所有 session 用户选择；删除世界书清除所有用户关系中的该 ID 与所有 session 显式选择。

关系文件只含 ID、顺序和时间，不含用户描述、世界书正文、会话消息、API key 或 token。

## API 与 UI

根插件继续只注册一个经过 Tavern 安全包装的 `/dsh-tavern/api` prefix。新增接口为：

| Method | Path | Meaning |
| --- | --- | --- |
| `GET` | `/dsh-tavern/api/users/:id/world-books` | 读取一个用户的关系 |
| `PUT` | `/dsh-tavern/api/users/:id/world-books` | 以 `{worldBookIds}` 完整替换关系 |

PUT 必须是同源 JSON mutation，并复用用户 API 的 256 KiB body 上限。只允许 `worldBookIds` 一个字段；缺失资源返回结构化 404，类型、字段或数量错误返回 400，关系容量失败返回 409/413。

用户面板会读取独立世界书目录，显示每本书名称和条目数，并提供多选、清空待保存选择和独立保存动作。名字/描述与世界书关系分别显示未保存状态；切换、刷新、新建、关闭或浏览器离开前给出丢弃提示。共享 refresh 发生时，若面板有草稿则保留草稿并提示未自动刷新。绑定用户到 session 前必须先保存该面板的修改。

## Active view、launcher 与 Trace

loader audit 同时公开：

- `sessionSelection`：原始 session 显式选择；
- `worldBookSelection.explicitIds`：session 来源；
- `worldBookSelection.userBoundIds`：用户来源；
- `worldBookSelection.effectiveIds`：真正交给 adapter 的去重集合；
- `worldBookSelection.duplicateIds`：两类来源重叠的 ID；
- `selection.worldBookIds`：供 active view/launcher 使用的实际有效集合。

独立世界书资源摘要带 `bindingSources: ["session"|"user"]`。launcher 因而显示实际组合后的数量，即使本轮没有条目命中。Tavern Trace 保存上述有界来源 ID 和顺序标识，以及真正解析到的资源/匹配决策；它仍不保存用户描述、世界书正文或输入消息。最终模型输入继续以 DSH `request/header` 为权威。

## 自动验收

覆盖项包括：

- 关系原子持久化、重启恢复、稳定顺序、去重、状态/数量/路径边界和失败事务性；
- GET/PUT、未知字段、缺失世界书、三字段用户文档不变；
- 删除用户与删除世界书的双向引用清理；
- 显式优先、同书一次、用户切换/解绑、双 session 隔离、显式选择保留；
- active audit、资源来源、最终 profile 和 Trace 反映实际有效集合；
- UI 多选、保存、未保存提示、丢弃确认和不把关系写进 description；
- 架构测试确认关系只位于 loader policy，user/world-book store 没有交叉所有权。

本分支使用的测试数据均在临时目录内由测试生成，没有读取或修改真实用户资源，也没有加入第三方私有 fixture。

## 人工验收步骤

1. 在隔离 DSH profile 中创建用户 U、世界书 A/B，并在用户面板给 U 保存 A/B。
2. 打开 session S1，显式选择 A，再选择用户 U；确认 launcher 世界书显示 2 本而不是 3 本。
3. 用能命中 A/B 的已有历史触发下一次组装；在 Tavern Trace 确认 explicit 为 A、user-bound 为 A/B、effective 为 A/B、duplicate 为 A，最终 profile 各书正文只出现一次。
4. 打开 session S2，选择另一个用户或不选用户；确认 S1/S2 的有效资源互不串线。
5. 在 S1 解绑 U；确认 A 仍由 session 显式来源保留，B 消失。重新绑定 U 后 B 恢复。
6. 修改用户世界书勾选但不保存；确认未保存提示可见，刷新/切换/关闭会确认，取消后草稿仍在。
7. 删除 B；确认所有用户关系中的 B 被清理，而 A 的 session 显式选择不受影响。删除 U；确认用户关系清除，其他用户与 session 显式书不受影响。
8. 重启隔离 profile，确认剩余用户关系、session 选择、launcher 和 active view 一致恢复。

## 已知风险

- 用户关系是全局资源关系；保存后会影响所有后续选择该用户的 session compile。已经冻结的当前 request/header 不会被回写。
- 多个持久文件之间没有跨文件系统事务。删除流程沿用既有资源先删除、policy 随后清理引用的模式；若底层磁盘在两次原子写之间失败，缺失资源会被 loader 诊断且不会进入 profile，下一次成功删除/清理可修复悬空 ID。
- 当前集成版本已由 loader-owned `PendingInputProjection` 让本步骤 claimed 输入参与首次 assembly；用户绑定书与其他来源共用同一提前识别和 Trace 契约。
