# 模型历史筛选接入边界

[English](HISTORY_POLICY_en.md)

DSH `0.2.0-rc.2` 下尚未接入完整历史筛选功能。展示原文、原始审计历史与模型有效历史
可以不同，但修改有效历史仍须保留其余逐消息角色与顺序，且移除 Tavern/assembler 后原生会话可继续。

通用能力验证由 assembler 的 `test/history-native-capabilities.test.mjs` 与
`docs/HISTORY_POLICY.md` 维护。原生空 system replacement 可以隐藏单个旧 user 注入；
助手 replacement 在无来源引用和有来源引用时分别触发相互冲突的校验。
自定义投影可编辑助手内容，但卸载使用过的解释器会阻止读取和后续写入。
因此不能把该机制作为满足卸载兼容的 Tavern 功能发布。

## Tavern 专属约束

- 真人输入仅能由可靠的 `source.kind: user` 及生产者合同识别；不得因消息角色是 user
  就把 preset/worldbook/PHI 或工具注入当作真人。来源不明的历史保留并提示。
- 历史策略必须独立于请求布局与身份适配。旧注入是否保留不能影响当前步重新装配的有效资源。
- MVU 的变量更新片段属于助手正文中的结构，不等同于 provider reasoning。
  将来应显式选择已知 MVU 结构并预览边界与剩余正文；不得默认用 `think`、`Analysis`
  等通用词匹配普通 RP 文字。引号内示例、缺失闭合标记、嵌套结构及歧义匹配均需明确保留策略。
- 片段排除不得修改聊天展示原文或 MVU 的原始审计证据。工具调用及结果配对必须保留；
  思考是否能排除取决于具体 provider/adapter 的合同。
- 规则变更对旧历史的生效时间、关闭后的恢复语义、fork/压缩后的坐标边界必须由
  原生可重放的编辑决定记录，不能只存当前配置并据此解释过去请求。

## 接入前置条件

需要原生支持持久的消息隐藏/内容编辑与撤销，并保留原模型 stream、来源及消息身份，
在插件缺席时可重放。不能用单个 user checkpoint、伪造 assistant stream 或未声明的
跨角色事件载荷绕过合同。当前未添加 `packages/history-policy/` 运行时、设置开关、API
或客户端挂载入口；没有可供集成方打开的隐式开关。

取得上述能力后，通用规则、持久配置和可嵌入 UI 应位于 assembler；Tavern 只提供
MVU/资源识别及设置接入。原始历史与有效历史的差异必须能按请求重建，测试通过再接入根入口。
