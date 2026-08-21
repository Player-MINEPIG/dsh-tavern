# 第三方 RP 前端接入指南

状态：面向 dsh-tavern 2.0 与 DSH rc.8。HTTP 字段以 [API.md](API.md) 为准；本页说明交付方式、模式生命周期和产品动作组合。

## 1. 先理解双模式兼容边界

`native`（灵珠）不替换 DSH 原生会话表面；`play`（魔丸）才挂载 Tavern 的 RP 侧栏、视图和 opening dock。这种双模式本身就是兼容机制：第三方插件只要把自有 RP UI 绑定到 `play` 生命周期，离开该模式时完整 dispose 自己的 slot/UI，就不会要求用户替换 DSH 原生插件。

模式服务只发布 `native|play` 状态，不仲裁 slot。多个插件仍可能选择同一个 DSH slot；每个插件必须使用独立 id、只清理自己注册的 entry，并遵循该公开 slot 的 priority/order 合同。

## 2. 三种开发与交付方式

| 方式 | 是否需要 fork 本仓库 | 适合范围 | 安装/升级边界 |
| --- | --- | --- | --- |
| fork dsh-tavern | 是 | 深度修改内置魔丸、资源面板或 loader | 维护自己的完整插件包和上游合并 |
| 独立 DSH 客户端插件 | 否 | 在同一 WebUI 中提供新 RP view、侧栏或 dock | 与 dsh-tavern 分开安装；依赖公开 mode service、DSH slots/store 和 HTTP v2 |
| 独立 Web 客户端 | 否 | 自己拥有整个浏览器 UI | 只消费 HTTP v2；不能使用 DSH Cordis service、slots 或 `sessions.open` |

当前**不支持**导入一个配置文件就替换整个魔丸，也没有 frontend provider registry、动态 bundle loader 或“安装远程前端代码”接口。配置文件只能描述数据和选项，不能安全地表达任意 React 组件、slot 所有权与生命周期。需要自定义 WebUI 时，请发布独立 DSH 插件或独立客户端；不要把未实现的一键替换当作现有能力。

## 3. 浏览器端模式服务

稳定服务名是 `pmpDshTavernChrome`。这是 Tavern v2 客户端合同，不是 DSH Host API。

公开 face：

- `getMode()`：同步返回 `native` 或 `play`；
- `getSnapshot()`：同步返回冻结的 `{ mode, revision }`；
- `subscribe(listener)`：立即通知当前快照并返回幂等 disposer；
- `refresh()`：回读服务端权威状态；
- `setMode(mode)` / `switchMode()`：服务端 PUT 成功后才提交本地状态；
- `when(mode, setup)`：进入目标模式时调用 setup，离开、取消注册或 service 卸载时 dispose。

强依赖 dsh-tavern 的插件可以在 manifest 声明 `inject: ['pmpDshTavernChrome']`，再读取 `ctx.pmpDshTavernChrome`。希望缺少 Tavern 时仍工作的插件应使用 `ctx.get('pmpDshTavernChrome')`；取不到时保持自己的原生或无增强行为。

模式生命周期示意（slot 名和 props 必须再按目标 DSH 公开包合同填写）：

```js
export function apply(ctx) {
  const chrome = ctx.get('pmpDshTavernChrome')
  if (chrome == null) return

  return chrome.when('play', () => {
    const disposeOwnUi = registerYourPublicDshSlots(ctx)
    return () => disposeOwnUi()
  })
}
```

不要重新 `provide` 同名 service，也不要依赖 dsh-tavern 内部的 React state、`playSlots`、EventSource、轮询器或 BroadcastChannel。transport 是实现细节；第三方只依赖 face。

## 4. DSH 插件中的 surface 规则

内置魔丸使用的公开 DSH seam 包括：

- `sidebar.workspaces`：角色卡/周目投影；
- `conversation.view`：独立 `rp` view，不注销原生 `chat`；
- `conversation.input.dock`：空周目 greeting/import dock 与一次性默认 view adapter；
- `ctx.sessions.list`：当前 session 的公开 snapshot/subscription；
- `ctx.sessions.open(sessionId)`：完成持久写入和 focus 校验后的导航。

第三方插件可以使用相同种类的公开 seam，但必须：

1. 使用自己的稳定 id，不复用 `rp` 或 `pmp-dsh-tavern-*` id；
2. 在 `when('play', setup)` 的 disposer 中撤销自己创建的所有 entry/effect；
3. 不注销或替换 DSH 原生 `chat`；需要默认进入自己的 view 时使用公开 view store/action，并保持用户可切回；
4. 分类失败、API 不可用或插件卸载时 fail closed 到 DSH 原生表面；
5. 不通过 DOM 查询、私有 bundle symbol 或篡改另一个插件注册表取得所有权。

`pmpDshTavernChrome` 不保证你的 slot 一定胜出。slot 竞争、order、priority 和 owner props 仍由 DSH 的公开 slot 合同决定。

## 5. HTTP v2 数据面

根路径：`/pmp-dsh-tavern/api/v2`。它面向任意 RP 前端，提供：

- chrome 权威状态与 SSE；
- RP 工作区绑定、目录与受管文件；
- session create / branch / user-message / 完整 messages；
- import-context reference；
- `GET /playthroughs/:id/focus`。

重要约束：

- `timeline.json` 只保存 session/event 指针和显示元数据，不复制 QA 正文；
- greeting 从角色卡和 session selection 派生，不伪造 assistant message；
- `/user-message` 只提交用户正文，不接受前端拼好的完整 prompt；
- 受管 catalog/timeline GET 返回 revision，PUT 必须带 `expectedRevision`；409 后回读新文档并重放局部意图；
- focus 按非空 playthrough id 查询；旧 path 入口仅作迁移兼容；
- 导入记录通过 claim/lineage 首轮注入，不写成历史；
- history API 读到 Host `hasMore: false`，但模型上下文能否容纳由 DSH/provider 决定；
- 工作区不要放系统盘。

浏览器插件应使用同源相对 URL。独立 Web 客户端必须自行满足 Host/Origin/peer 与 Content-Type 防护；不要把只监听本机的 API 直接暴露到局域网或公网。

## 6. 用原子 API 组合产品动作

v2 不为每个按钮增加专用 endpoint。推荐组合：

| 产品动作 | 组合 |
| --- | --- |
| 隐藏渲染 | CAS 修改目标 node 的 `hidden` |
| 显示层改字 | CAS 修改 `displayOverride`；DSH 原文不变 |
| 左右切已有回复 | CAS 修改 `adoptedVariantId` → GET focus → `sessions.open` |
| 回复 swipe | 由当前输出向前找最近真实 user/steering → branch 到用户前 → user-message 原文 → 等 durable pair → CAS 添加/采用 variant 并移动 tree head → focus；不得重发 context |
| 修改并重新生成 | 与 swipe 相同，只把新分支的 user-message 换成编辑后的文字；内置魔丸不提供此按钮 |
| 周目分支 | branch 到 adopted assistant 末尾 → 验证子 session durable 区间 → 创建目录/timeline 副本 → 把副本末 adopted 指针重定向到子 session → catalog CAS → focus |
| 同周目回退 | 复用相同 branch/继承区间校验 → timeline CAS 只移动活动 head → focus；不建目录、timeline 副本或 catalog 行 |
| 新发一轮 | user-message → 等 messages 完成 → CAS append QA 指针 |

branch、session、目录、timeline 和 catalog 是多个原子操作，不构成跨资源大事务。副作用只做一次，CAS 冲突只重放纯文档意图；中途失败根据 operation log、已返回 session id、文件回读和稳定错误码恢复。不要通过删除或改写 DSH 历史伪造回滚。

## 7. v1 资源面与 v2 RP 面

v2 是第三方 RP 表面的稳定协议。v1 是本插件 bundled UI 的资源管理合同，包含预设、角色卡、世界书、用户、正则、selection、RP/Trace 等。第三方 DSH 插件可以在用户已安装 dsh-tavern 时选择性调用 v1，但这不等于 v2 对资源编辑器 UI/字段的长期承诺。

若第三方只需要渲染和周目操作，应尽量依赖 v2 与 timeline/catalog 中已有引用。若必须编辑 Tavern 资源，明确声明对相应 v1 版本和 dsh-tavern 版本的依赖，并对缺失 API 提供降级。

## 8. 卸载、冲突与升级

- 卸载第三方 UI 插件：它拥有的 slot/effect 应全部撤销；dsh-tavern 内置魔丸和 DSH native 继续存在。
- 卸载 dsh-tavern：mode service 消失；可选消费者必须降级，DSH durable history 仍可由原生 Chat 查看。
- 同装多个 RP UI：避免同 id；若竞争同一高优先级 surface，必须在各自文档说明胜出规则，不能互相 unregister。
- DSH 升级：先核对 manifest inject、公开包根导出、slot owner props、store 字段和 Host RPC；再验证 native/play、快速切换和卸载回退。
- 公开 seam 消失时：关闭对应增强并保留原生 UI，再讨论 adapter；不要临时改用私有 API。

## 9. 发布前自测

1. `native` 下没有第三方 RP slot/UI 残留，原生 Chat 可用。
2. 切到 `play` 立即挂载；快速反复切换不重复注册或泄漏 effect。
3. 刷新、另一标签页和 HTTP 改 mode 都会收敛；缺少 SSE 时仍可回读。
4. 插件缺失、API 失败、分类失败时回到原生表面，不显示猜测数据。
5. timeline 写入使用 revision/CAS；冲突不会静默覆盖别的标签页修改。
6. 所有显示正则、hidden、displayOverride 都不改变 AI 请求或 DSH 原文。
7. 卸载第三方插件后内置魔丸恢复；卸载 dsh-tavern 后 DSH native 仍可查看会话。
8. 包内没有本机路径、密钥、私有 fixture 或用户导入内容。
