# 进阶模型历史筛选

[English](HISTORY_POLICY_en.md)

进阶版的历史筛选由独立 assembler 能力实现：在已有协议 1 装配接口中筛选本次请求的副本，
并将最终消息、规则版本和具体匹配范围记入 `request/assembly`。原始事件、助手 stream、
聊天展示及 MVU 审计原文保持不变。标准版沿用现有行为。

## Tavern 提供的内容

`packages/history-policy/index.js` 提供：

- `TAVERN_HISTORY_FRAGMENT_PRESETS`：默认关闭的 MVU 变量更新片段示例。
- `mountTavernHistoryPolicyPanel(container, options)`：挂载通用历史设置组件，并加入 Tavern 示例。

MVU 示例按 `sourceKind: model` 筛选助手正文，只匹配从行首开始的独立 `<UpdateVariable>` /
`</UpdateVariable>` 行，排除整个 wrapper 内的更新分析与结果，保留前后的 RP 正文。
它不使用 `think`、`Analysis` 等通用词猜来源，也不默认匹配普通叙述。代码围栏中的示例、
行内引号示例、缩进代码、嵌套或缺失闭合标记会保留。用户需要行内匹配时可显式选择 literal 模式，
并先查看匹配预览。来源不明的旧历史保留并提示。

## 设置和生效范围

面板支持按来源和 text/image/reasoning 类型选择保留内容，编辑精确片段规则，查看原文、
有效内容与被排除区间，再保存。新会话默认关闭，规则从下一步进阶请求生效；同一步重试使用原版本。
关闭/卸载恢复原生有效历史，不能撤销 DSH 已完成的压缩。fork 的新 session ID 默认关闭，可显式复制策略。

当前步有效注入、最新的原生运行上下文、系统指令、工具调用/配对结果以及 adapter replay 数据受保护。
已核对的 DeepSeek Messages v1 replay 支持保留全部块与签名、只编辑正文片段；未知 replay 格式整条保留。
思考仅在经过验证的目标模型合同允许时排除，未验证则保留并提示。通用引擎不把 UI 隐藏当成模型不接收，
也不承诺 DeepSeek 带 tools 请求可删除思考。

## 根入口接入

主集成方需要完成这些接线，本目录不改现有根入口、布局模块或依赖锁：

1. 引入含历史能力的 assembler 版本，在现有进阶 Host 注入服务上下文注册
   `registerHistoryPolicy`；用同一 `HistoryPolicyStore` 创建 preview/service/API。
2. 将 `createHistoryPolicyHandler` 放进现有 assembler 安全路由内，复用现有浏览器/桌面 token transport。
   冷会话预览沿用 inspect + sessions.prepare；读取原生 surface，而不是已过滤过的上一请求。
3. 仅在进阶会话设置中 `await mountTavernHistoryPolicyPanel(container,{sessionId,request})`，
   切换/卸载时调用返回组件的 dispose。标准版不挂载历史筛选控件。
4. 如果需要包级导入，增加 `./history-policy` 到 `./packages/history-policy/index.js` 的导出，
   并按既有流程更新依赖锁和生成客户端 bundle。
5. Trace/实际请求展示以 `request/assembly.data.messages` 为最终发送内容，
   `metadata.historyPolicy` 为规则证据。旧 `metadata.assembly` 的布局节点是筛选前数据，不能冒充最终正文。

通用合同与完整 API 在 assembler `docs/HISTORY_POLICY.md`。Tavern 不复制引擎，也不新增第二套配置持久化。
本适配与布局/身份策略独立；布局先装配，历史策略随后筛选。

## 验证边界

Tavern 的 `DSH_HISTORY_ASSEMBLER_ROOT=/path/to/assembler node --test test/history-policy-mvu.test.mjs`
通过真实通用引擎验证默认 opt-in、MVU wrapper 排除、真人同文保留与原始消息不变。未设置路径时明确跳过。
通用筛选、HTTP/UI、真实 Host 模块的多轮/重试/工具事务/重启/fork/压缩边界和 stock 卸载后继续
由 assembler 的 `test/history-*.test.mjs` 验证。独立浏览器页可以挂载同一组件验收。
最终根入口接线、另一布局分支合并后的组合测试及真实目标 adapter 合同确认由主集成方完成；
没有真实 profile 写入、付费模型调用或 token 节省测量。
