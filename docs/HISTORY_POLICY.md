# 模型历史筛选：标准版与进阶版

[English](HISTORY_POLICY_en.md)

进阶版的历史筛选由独立 assembler 能力实现：在已有协议 1 装配接口中筛选本次请求的副本，
并将最终消息、规则版本和具体匹配范围记入 `request/assembly`。原始事件、助手 stream、
聊天展示及 MVU 审计原文保持不变。标准版通过 stock DSH 公开 pre-step 与 surface replacement
自动清理旧插件 user 注入，完整保留助手回复；不需要进阶核心。

## Tavern 提供的内容

`packages/history-policy/index.js` 提供：

- `TAVERN_HISTORY_FRAGMENT_PRESETS`：默认关闭的 MVU 变量更新片段示例。
- `mountTavernHistoryPolicyPanel(container, options)`：挂载通用历史设置组件，并加入 Tavern 示例。

MVU 示例按 `sourceKind: model` 筛选助手正文，只匹配从行首开始的独立 `<UpdateVariable>` /
`</UpdateVariable>` 行，排除整个 wrapper 内的更新分析与结果，保留前后的 RP 正文。
它不使用 `think`、`Analysis` 等通用词猜来源，也不默认匹配普通叙述。代码围栏中的示例、
行内引号示例、缩进代码、嵌套或缺失闭合标记会保留。用户需要行内匹配时可显式选择 literal 模式，
并先查看匹配预览。来源不明的旧历史保留并提示。

## 标准版来源清理

同一设置面板提供可操作的来源选择、预览和保存。按精确 `source.kind` 排除已消费的插件注入；
真人和助手来源锁定保留，未知来源保留并提示。内容类型、思考与 MVU 片段控件禁用且标为进阶专用。
存储中的进阶规则保留，但标准版不执行它们，标准 API 也拒绝修改这些字段。

新会话默认关闭。保存从下一 accepted pre-step 生效；重试沿用已经清理的 surface。
本步/尚未发送的注入与最新复用 runtime-context 保留，旧插件注入在原位替换为空 developer 消息。
改规则/关闭时，从下一步恢复仍由本功能隐藏的原始 user 消息、ID 和顺序；压缩覆盖的占位不复活。
重启保持配置；新 fork ID 默认关闭，在首次运行时恢复继承的占位，也可显式复制父策略。
卸载后保留已经写入的清理效果，原生会话仍可继续；如需恢复，应先关闭并运行一步，
或由授权调用方在空闲时调用通用 `applyStandardHistory` 恢复原语。原始日志及来源引用完整保留。

两轮 `预设、预设、真人、预设、assistant` 后，第三轮会发送前两轮的
`真人、完整 assistant、真人、完整 assistant` 加第三轮所需预设与输入。正文相同的真人不会误删。

## 进阶版设置和生效范围

面板支持按来源和 text/image/reasoning 类型选择保留内容，编辑精确片段规则，查看原文、
有效内容与被排除区间，再保存。新会话默认关闭，规则从下一步进阶请求生效；同一步重试使用原版本。
关闭/卸载恢复原生有效历史，不能撤销 DSH 已完成的压缩。fork 的新 session ID 默认关闭，可显式复制策略。

当前步有效注入、最新的原生运行上下文、系统指令、工具调用/配对结果以及 adapter replay 数据受保护。
已核对的 DeepSeek Messages v1 replay 支持保留全部块与签名、只编辑正文片段；未知 replay 格式整条保留。
思考仅在经过验证的目标模型合同允许时排除，未验证则保留并提示。通用引擎不把 UI 隐藏当成模型不接收，
也不承诺 DeepSeek 带 tools 请求可删除思考。

## 正式入口与操作

打开提示词装配策略，在当前会话应用区域展开「模型历史筛选」。选择保留来源，先查看匹配预览，再点「保存历史规则」。这份规则属于当前会话，与装配策略分别保存；切换装配策略不会丢弃历史规则。新会话默认关闭。

assembler 主插件挂载标准版清理钩子，共用 `HistoryPolicyStore`；可选 core 插件挂载进阶筛选钩子。实际已应用的 backend 决定 API 能力和编辑器控件，编辑中的策略不会提前改变能力。切换到进阶版时，标准钩子先恢复仍有效的隐藏占位，再由进阶路径筛选请求副本。

历史 API 与装配 API 共用已有安全路由及浏览器/桌面 transport。冷会话通过公共 inspect 和 sessions.prepare 预览，不创建 Agent。Tavern 只提供 MVU 示例和界面嵌入，不复制通用引擎或策略存储。包级 `./history-policy` 导出 Tavern 示例与挂载函数。

实际请求以保存的最终 messages 为准；进阶卡片按 `metadata.historyPolicy` 对布局中的历史正文作显示修正，保留原始布局及事件审计。标准版通过内置替换事件的 `data.historyPolicy/sourceEventSeqs` 追溯。布局先装配，历史策略随后筛选。

## 验证边界

Tavern 的 `DSH_HISTORY_ASSEMBLER_ROOT=/path/to/assembler node --test test/history-policy-mvu.test.mjs`
通过真实通用引擎验证默认 opt-in、进阶 MVU wrapper 排除、标准版完整保留助手思考/MVU、真人同文保留与原始消息不变。未设置路径时明确跳过。
通用筛选、HTTP/UI、真实 Host 模块的多轮/重试/工具事务/重启/fork/压缩边界和 stock 卸载后继续
由 assembler 的 `test/history-*.test.mjs` 验证。独立浏览器页可以挂载同一组件验收。
正式入口的 backend 切换与同一安全边界通过组合 Host 测试验证。真实目标 adapter 的远端合同、付费模型调用与 token 节省测量不属于离线检查的结论。
