# dsh-tavern package architecture

状态：2026-08-14 已采用。本文是架构决策与合并门槛，不是产品 README。

## 决策结论

`dsh-tavern` 保持为一个可安装的 DSH 插件，在同一仓库和发布包内拆成单向依赖的内部层。preset、角色卡、用户、独立世界书和 Tavern Trace 均由统一 loader/client 组合；不要求用户安装多个互相配套的 DSH 插件。

```text
SillyTavern JSON
       │
       ▼
packages/tavern-format
解析、校验、归一化、未知字段保留、ST macro
       │
       ▼
packages/preset  packages/character  packages/user  packages/world-book-library
预设用例          角色卡资源/UI        用户资源/UI    独立世界书资源/API/UI
          \              |              |              /
           \             |              |       packages/world-book
            \            |              |       世界书纯格式、匹配与投影
             \           |              |             /
       │
       ▼
packages/tavern-loader
DSH 编译策略、session/request 策略、Host hooks
       │
       ├── packages/tavern-trace
       │   最小化审计模型、有界插件存储/API、conversation.view
       │
       ▼
DSH system prompt + agent request
```

依赖只能向下：`tavern-loader → preset/character/user/world-book-library/world-book/tavern-trace → tavern-format`。格式层和 `world-book` 纯库不能导入 DSH、文件系统或 UI；preset、character、user、world-book-library 用例层不能注册 `systemPrompt`、`agent/request` 等 Host seam；只有 loader 是根 `main` 入口并允许依赖 DSH 运行时。`tavern-trace` 接受 loader 传入的普通 snapshot/session event 数据，但不导入 DSH、不 append Session；它只拥有最小化审计格式、有界插件存储、只读 API 和浏览器 view。浏览器侧由 `packages/client` 组合各用例 UI，它不是 Host loader。

## 各层职责

| 层 | 回答的问题 | 当前内容 | 明确不负责 |
| --- | --- | --- | --- |
| `tavern-format` | “这个 ST 文件表达了什么？” | preset 识别、顺序和启用状态归一化、原字段保留、编辑模型、macro 解释 | session 选择、DSH system 段、模型调用参数、HTTP、磁盘 |
| `preset` | “用户如何管理预设？” | 原子文件存储、导入/创建/修改/删除/选择、API、侧边栏源代码 | 决定提示词如何进入 agent |
| `character` | “用户如何管理角色资源？” | JSON/PNG 导入、原件保存/导出、per-session binding、API、UI、loader/world-book 资源快照 | prompt 放置、assistant 历史、世界书激活 |
| `user` | “用户如何管理自己的 Tavern 身份描述？” | 严格三字段文档、CRUD 持久化、API、UI、loader adapter | 头像、DSH Agent 身份、prompt 放置、Host seam |
| `world-book` | “哪些 lore entries 候选应被激活？” | ST/角色内嵌格式、归一化、纯匹配/排序/预算与 loader 投影 | session 选择、DSH 注入、角色卡存储 |
| `world-book-library` | “用户如何管理独立世界书资源？” | 原子 JSON 存储、CRUD/导出 API、编辑 UI、供 loader 读取的 document | session 选择所有权、matcher 复制、Host seam、角色卡内嵌书修改 |
| `tavern-loader` | “当前资源怎样影响这次 DSH 请求？” | 编译选中预设、映射支持的 call config、append/replace 策略、Host/API 挂载 | 重新解释 ST 原始字段、实现具体 UI |
| `tavern-trace` | “这次 loader 为什么得到这个组合？” | turn/step 对齐、资源摘要、世界书接受/拒绝原因、header 摘要引用、有界存储/API/并列 view | 保存正文、替代 request/header、append 会话事件或模型消息 |

角色卡已经在 `tavern-format` 增加 adapter/model，并在 `character` 用例层提供管理与资源入口；用户资源由独立 `user` 用例层提供严格 `{id,name,description}` 文档；世界书格式兼容位于独立纯库 `packages/world-book`。所有资源最终由同一个 `tavern-loader` 组合。角色卡和用户模块都不读取预设排序，也不决定字段插入位置。

统一 loader 把 Host 注册收敛为一个 `dsh-tavern:profile` section，并引入 loader-owned `SessionSelectionStore`：preset、角色、用户和世界书的文档仍由各自模块管理，但“哪个 session 使用哪些资源”由统一策略持久化。普通 fork 复制父选择，subagent 默认空选择。

统一 adapter、session 继承和 marker 契约见 `docs/LOADER_CONTRACT.md`；DSH 原生与插件增强消息流见 `docs/DSH_MESSAGE_FLOW.md`；世界书格式和投影细节见 `docs/world-book/DESIGN.md`。

## 为什么不是两个 DSH 插件

格式解析器有独立价值，但其合适形态是纯库，不是一个可单独安装的 DSH 插件：

- 可被浏览器导入预览、服务端导入、迁移 CLI、快照测试和未来角色卡/世界书工具复用；
- 可在没有 DSH、session、文件系统的测试环境中验证格式兼容；
- 能把“ST 文件解析错误”和“DSH 加载策略错误”分开定位。

理论上可以给 `tavern-format` 增加自己的 package manifest 并单独发布为 npm library，但当前没有必要。它没有 Host entry、bundle patch 或独立用户功能，不能单独把内容发送给 agent。把它包装成第二个 DSH 插件会产生以下问题：

- 用户看到“安装成功”却没有对话效果，形成半安装状态；
- loader 与 parser 版本必须额外协商；
- 两个插件都可能争用 API、存储或 UI 生命周期；
- 安装、卸载、备份和故障排查成本翻倍。

因此发布与安装单位固定为根包 `dsh-tavern`，内部包边界用于代码复用和测试隔离。`package.json` 的 `./format`、`./preset`、`./character`、`./user`、`./world-book`、`./world-book-library`、`./trace`、`./loader` exports 是程序接口，不代表可分别安装的插件。

## 合并顺序与门槛

推荐顺序是：

1. 在 preset feature 分支完成内部边界拆分；
2. 运行格式兼容验收，证明 ST 解析、未知字段保留和归一化结果稳定；
3. 运行加载验收，证明选中状态、system prompt、call config、API 和发布入口仍工作；
4. 用隔离 `DSH_HOME` 安装根插件，确认真实 DSH 从 loader 入口启动；
5. 文档和 changelog 与实现同步后合并 `main`；
6. 角色卡分支基于新 `main` 对齐，仅扩展 adapter/model，最后接入统一 loader。

若在拆分后才发现运行回归，修复范围仍留在 feature 分支；这就是不先合并再拆分的主要原因。

## 两组长期验收

格式兼容验收关注：输入识别、诊断、prompt order、启用状态、未知字段保留、稳定归一化，以及外部版权 fixture 只读且不进入仓库。

运行加载验收关注：当前选择、session 隔离、append/replace、资源组合顺序、call config、最终 request/header、API 审计与安装入口。以后更换加载策略时，不应使格式解析测试一起失效。

当前架构测试会检查关键依赖方向；它不能替代代码评审，但会阻止最明显的 DSH Host 逻辑回流到格式层。
