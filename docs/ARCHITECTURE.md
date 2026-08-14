# dsh-tavern package architecture

状态：2026-08-14 已采用。本文是架构决策与合并门槛，不是产品 README。

## 决策结论

`dsh-tavern` 保持为一个可安装的 DSH 插件，在同一仓库和发布包内拆成三个单向依赖的内部层。当前 feature 分支先完成拆分与安装验收，验收通过后再合并 `main`；不先把耦合实现合入 `main`，也不要求用户安装两个互相配套的 DSH 插件。

```text
SillyTavern JSON
       │
       ▼
packages/tavern-format
解析、校验、归一化、未知字段保留、ST macro
       │
       ▼
packages/preset
预设存储、CRUD、HTTP API、浏览器用例
       │
       ▼
packages/tavern-loader
DSH 编译策略、session/request 策略、Host hooks
       │
       ▼
DSH system prompt + agent request
```

依赖只能向下：`tavern-loader → preset → tavern-format`。格式层不能导入 DSH、文件系统或 UI；preset 层不能注册 `systemPrompt`、`agent/request` 等 Host seam；只有 loader 是根 `main` 入口并允许依赖 DSH 运行时。

## 各层职责

| 层 | 回答的问题 | 当前内容 | 明确不负责 |
| --- | --- | --- | --- |
| `tavern-format` | “这个 ST 文件表达了什么？” | preset 识别、顺序和启用状态归一化、原字段保留、编辑模型、macro 解释 | session 选择、DSH system 段、模型调用参数、HTTP、磁盘 |
| `preset` | “用户如何管理预设？” | 原子文件存储、导入/创建/修改/删除/选择、API、侧边栏源代码 | 决定提示词如何进入 agent |
| `tavern-loader` | “当前资源怎样影响这次 DSH 请求？” | 编译选中预设、映射支持的 call config、append/replace 策略、Host/API 挂载 | 重新解释 ST 原始字段、实现具体 UI |

角色卡和世界书采用各自专属的纯 adapter/model 路径，在用例层增加管理入口，再由同一个 `tavern-loader` 组合。角色卡不读取预设的 UI 排序逻辑，预设也不决定角色字段插入位置。

世界书格式兼容现已落在独立纯库 `packages/world-book`，避免把不断扩展的 entry 模型塞入 preset adapter。它与 `tavern-format` 同属无宿主副作用的格式层，通过根包 `./world-book` 子路径暴露；统一 loader 可同时依赖二者，但世界书包不得反向依赖 preset 或 loader。格式与 loader 的详细契约见 `docs/world-book/DESIGN.md`。

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

因此发布与安装单位固定为根包 `dsh-tavern`，内部包边界用于代码复用和测试隔离。`package.json` 的 `./format`、`./preset`、`./loader` exports 是程序接口，不代表三个可分别安装的插件。

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
