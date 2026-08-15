# User resource implementation

状态：2026-08-15，已集成到首个公开发布候选版本。本文保留 `feature/user-profiles` 的模块实施边界，不是 README。

## Scope and model

用户资源的持久模型严格为：

```json
{
  "id": "safe-resource-id",
  "name": "Display name",
  "description": "Optional persona text"
}
```

不保存 `createdAt`、`updatedAt`、来源元数据、标题、绑定选项或未知扩展，尤其不实现头像。创建和修改若包含任何额外字段会返回 400。名字非空、禁止控制字符并限制为 200 字符；描述限制为 100,000 字符；API JSON body 上限为 256 KiB。

每个文档以权限收紧的原子 JSON 写入 `<plugin-data>/users/<id>.json`。列表读取时跳过损坏文档；按名字和 id 稳定排序。session 绑定不写进用户文档，而是由 loader-owned `session-selections.json` 中的一个 nullable `userId` 保存。

## API and UI

统一 Tavern API prefix 内提供：

| Method | Path | Meaning |
| --- | --- | --- |
| `GET` / `POST` | `/dsh-tavern/api/users` | 列表 / 创建 |
| `GET` / `PATCH` / `DELETE` | `/dsh-tavern/api/users/:id` | 读取 / 修改 / 删除 |
| `GET` / `POST` | `/dsh-tavern/api/user-selection` | 按 `sessionId` 读取 / 变更一个绑定 |
| `GET` / `PUT` | `/dsh-tavern/api/users/:id/world-books` | Phase 3：读取 / 完整替换 loader-owned 独立世界书关系 |

所有 mutation 继续经过既有 loopback Host、same-origin 和 JSON Content-Type 安全边界。运行中的 agent 拒绝切换，避免一轮中 system assembly 与 UI 选择不一致。删除资源通过 `clearResource('user', id)` 清理所有 session；解绑写入明确的 `null`，重启不会复活。

世界书关系不扩展上述三字段文档；它由 loader 的独立有界原子策略保存，并在 compile 时与 session 显式世界书组合。完整语义与验收见 `docs/user-world-books/IMPLEMENTATION_AND_ACCEPTANCE.md`。

共享 Tavern launcher 的“用户”入口提供新建、浏览、编辑、保存、绑定、解绑和删除。UI 不包含文件上传或图像元素。变更成功后既更新本组件状态，也发送共享 refresh 事件；Host API 同时触发 `system-prompt/change`，下一次组装读取新文档和选择。

## Loader semantics

`packages/user` 只提供资源 adapter，不导入 loader 或注册 Host hook。根 loader 注册该 adapter，并把选中的三字段文档交给 `compileTavernProfile()`：

- `name` 覆盖本次 Tavern profile 的宏 context，因此所有已有 `{{user}}` 使用当前 session 用户名；
- `description` 优先消费有序 preset 中第一个 enabled `personaDescription` marker；同时接受 `userDescription`/`userPersona` 显式别名；
- 普通 prompt 的第一个 `{{persona}}` 也是显式放置点；后续 persona 宏和 marker 为空，避免描述重复；
- 若上述放置点均不存在，description 在普通 preset blocks 之后、fallback character fields 之前输出 `<st-user-field name="persona-description">`，并产生 `USER_PERSONA_MARKER_FALLBACK`；
- 描述内部的 `{{user}}`、`{{char}}` 等既有宏由同一 renderer 展开，未知严格双花括号不会泄漏到 DSH；
- active/audit view 的 `resources.user` 仍是相同三字段模型。

用户 adapter 不改变 preset 的 append/replace 选择，不创建额外 system section，不修改 DSH Agent/deployment persona，不写用户或 assistant 历史。最终仍只有一个 `dsh-tavern:profile` contribution；实际发给模型的内容以 DSH `request/header` 为权威。

## Boundaries

- 当前描述只能进入统一 system profile；DSH 尚无 ST 任意 role/depth persona 注入的公开 seam。
- 切换只影响后续请求，不改写旧历史；旧 assistant 输出可能保留上下文影响。
- API 是本地可信 Web 控制面，不是多用户身份认证系统；描述仍是会发送给模型的提示词内容，不能存放秘密。
