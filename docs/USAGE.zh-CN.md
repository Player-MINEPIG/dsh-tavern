# dsh-tavern 中文使用指南

状态：2026-08-21，对应当前悬浮球交互、前端显示模式切换、角色卡创建/编辑、周目生命周期、外部记录开场绑定、RP 安全模式与委派子 agent 继承父级 Tavern 选择。本文介绍实际操作；消息流、架构和安全契约分别见 `DSH_MESSAGE_FLOW.md`、`ARCHITECTURE.md` 与 `LOADER_CONTRACT.md`。RP 拦/不拦清单见 [RP_SECURE_MODE.md](RP_SECURE_MODE.md)。

## 1. 打开和切换面板

安装并重启 DSH Web 后，页面会显示始终标记为 `DT` 的红、黑、白配色悬浮球。

- 拖动球体可改变位置，位置会在浏览器中记忆；拖动结束不会误触展开。
- 左键立即展开或收起菜单；快速重复点击就是重复执行这个默认切换，双击没有特殊效果。右键单击切换前端显示模式。
- 菜单按钮文案为“切换到自定义前端模式”或“切换到 DSH 原生模式”，并可显示“当前：魔丸”或“当前：DSH 原生”。悬浮提示为“切换前端显示模式”，不使用宣传语。
- 菜单始终挂载，容器在 220ms 展开完成后再淡入内容，以避免首行切换按钮闪烁。打开任一侧栏后，球体仍然保留，可直接切换到其他模块。
- 资源旁的发光绿点表示当前 session 已启用该类资源，红点表示未启用；世界书绿点表示存在有效绑定，不等于本轮关键词已经命中。
- 资源标题旁显示当前启用内容。面板内的“浏览/编辑对象”可能与当前 session 已绑定对象不同，请以绑定状态和“未应用”提示为准。
- “界面设置”可切换简体中文/English，并把全部 Tavern UI 缩放到 75%–150%；还可开关「绑卡跟随 RP」，以及编辑可选的 `rp:policy` 提示词。语言/缩放/跟随是全局设置；RP 开关本身是 per-session。RP 锁定清单见 [RP 安全模式](RP_SECURE_MODE.md)。

## 2. 预设

预设面板支持导入 SillyTavern Chat Completion preset JSON，也可以创建空白预设。

1. 从目录选择一个预设只是打开它供浏览和编辑，不会自动影响当前 session。
2. 可修改名称、append/replace system 策略、DSH 当前支持的采样参数，以及 prompt 块的启用、role、内容和顺序。
3. 拖拽 prompt 左侧横杠调整顺序；拖动来源收缩为横杠，实际落点显示占位框。
4. 保存资源正文后，点击蓝色绑定/更新按钮才把它应用到当前 session；解除绑定不会删除资源。
5. agent 正在运行时，显式预设切换会被拒绝，待当前 turn 结束后重试。

`append` 保留 DSH 原有 system sections；`replace` 仅保留 Tavern profile 的模型可见 system 文本，可能使 Code Mode、结构化输出或工具提示可靠性下降，但不会关闭文件沙箱、审批和工具执行权限。

## 3. 角色卡

角色卡面板支持 SillyTavern V1/V2/V3 JSON，以及包含 `chara`/`ccv3` 数据的 PNG。

1. 导入或创建后可编辑名称、描述、性格、场景、开场白（含备选）、示例对话等字段；保存字段与绑定到会话是两步。插件只保存一份当前角色卡文档；PNG 导入另留去掉卡数据后的封面图，没有封面时导出 PNG 使用占位图。没有「导出原件」。
2. 选择 greeting，并配置是否优先采用角色卡 system prompt 与 post-history instructions。已绑定当前卡时，改开场或策略但尚未点绑定，会提示未应用到会话。
3. 点击绑定/更新应用到当前 session；另一个 session 可以绑定不同角色。delegated subagent 会固化父会话当时的 Tavern 选择（与「用当前配置新开对话」相同）；是否在委派说明里收窄由主 agent / 预设作者决定。
4. 解绑只移除 session 选择；删除会删除插件资源库中的角色卡文档和封面图，并清理引用。

description、personality、scenario、example dialogue 等字段会按预设 marker 或稳定 fallback 进入统一 Tavern profile。greeting 目前只是明确标注的参考内容，不会伪造成已经发生的 assistant 历史消息。

## 4. 世界书

世界书面板把来源分成三类：

- 当前 session 显式选择的独立世界书；
- 当前用户绑定的独立世界书；
- 当前角色卡内嵌的 `character_book`。

独立世界书可以导入、创建、编辑、导出和删除。勾选当前 session 的世界书后，面板会显示未应用状态；必须点击蓝色应用按钮才写入 session。用户绑定书和角色内嵌书分别显示来源，不会混成同一资源文档；独立书可从任一来源入口打开同一个编辑器。

条目编辑支持主/附加关键词（英文逗号或中文逗号分隔）、secondary logic、常驻、启用、大小写、全词匹配、position、order、probability 和正文。折叠标题会显示常驻、禁用或关键词条件。普通关键词会扫描有界的 durable history 与本步骤 claimed 输入，所以空会话第一条消息也可以在同一轮激活；JavaScript regex 关键词默认阻断。

组合顺序为 session 显式独立书、用户绑定独立书、角色内嵌书。ID 稳定去重，前一来源优先。每次请求的 matcher 输入合计最多 10,000 条；后面的资源若不能整体放入会跳过并产生诊断。

## 5. 用户

用户资源严格只有名字和描述，不包含头像，也不会覆盖 DSH Agent 身份。

1. 创建或选择用户，填写希望模型如何称呼你的名字和用户描述。
2. 名字可用于 `{{user}}`；描述由 `personaDescription` marker、`{{persona}}` 或稳定 fallback 放置一次，避免重复发送。
3. 用户可绑定零本或多本独立世界书。用户正文和世界书关系是两个独立保存动作，面板会提示未保存修改。
4. 保存后再绑定/更新到当前 session。解绑用户会移除用户描述及其世界书来源，但不会删除 session 自己显式选择的世界书。

用户—世界书关系是全局资源关系：修改后会影响以后所有绑定该用户的 session 请求，但不会回写已经冻结的 request/header 或既有历史。

## 6. 新会话与配置模板

同一会话中切换资源不会删除旧资源已经影响过的 assistant 回复。需要避免上下文残留时，应使用“新会话”：

- “维持当前设置新开对话”把当前 preset、角色/greeting 选项、用户、独立世界书和 RP 状态复制到真实 blank DSH session；
- 配置模板保存同一份有界 selection 投影，可在创建前查看模板内容；
- 更新模板只从当前 session 的实际设置获取。请先通过 DT 悬浮球的资源面板完成并保存配置；
- 新会话不会复制 durable history、Inbox、Trace、资源正文或旧运行态；
- 模板引用的资源已删除时会显示诊断并阻止应用。

正常 UI 只把模板应用到新建 blank session。底层配置 apply API 尚未对任意既有运行中目标提供全局事务锁，详见 `LOADER_CONTRACT.md` 的运行态风险说明。

## 7. 周目与外部记录开场

在魔丸侧边栏的角色卡下点击新建周目，会创建或复用该角色最近一个没有任何真实记录的
`x周目`。复用检查同时查看 `timeline.json`、root session 的 DSH user/assistant 消息、开放
turn，以及是否已有外部导入 QA；因此连续点击不会无限增加空周目。周目标题旁的菜单可以
重命名。创建只建立真实 blank DSH session 和周目元数据，不写 greeting 或伪造消息。

空周目尚未出现顶栏时，greeting 会显示在原生对话栏下方的 opening dock 中。左右按钮切换
角色卡 alternate greeting；角色卡没有 greeting 时仍保留空白区域和同一 footer 布局。点击
footer 中央的导入按钮可从 JSON/JSONL 或本插件 bundle 绑定外部记录；已有绑定时按钮变为
换绑和解绑。绑定后 dock 显示最近三轮 QA，显示内容只是本地渲染预览。

外部记录只允许绑定到仍为空的 root session。第一次实际发送请求时，loader 只在同一 profile snapshot 提供至少一个公开 `claimEventSeqs` 后建立持久 claim，再将内容作为转义的、标明 `untrusted` 的只读上下文交给模型；它不会成为 DSH durable history，也不会写入 `timeline.json`，所以不会伪造一轮 QA。没有 claim 的 view/assembly 不注入，也不会消费 pending；同一 claim identity 可重复 assembly，简单 `turn/end` 只会消费已 claimed 绑定。真实 user/assistant 消息、开放 turn 或绑定已 claim 后，都不能再改绑或解绑。完整 retry/swipe lineage 与取消/中断终态由 task 10 继续完成，见
[周目审查记录](PLAY_REVIEW.md)。
导入文件和绑定摘要保存在已选扮演工作区根内；服务端会校验路径、哈希和 `schemaVersion: 1`/QA 结构。import parser 不做 summary、QA 切片或 256 KiB/2,000 QA 人为上限；模型上下文超限交给 DSH/provider，通用工作区文件仍有 1 MiB 文件层上限。

## 8. Tavern Trace

Tavern Trace 位于 Conversation、Trajectory 同级视图，用来解释某一 turn/step 实际采用了哪些 Tavern 配置。

它会显示 preset、角色卡、用户和世界书摘要，世界书配置关键词、本轮匹配关键词、接受/拒绝原因、预算以及 request/header 对齐信息。当前输入提前识别的 metadata 也会与同一轮记录对齐。

Trace 不保存完整 Tavern profile、用户消息、资源正文或工具 schema，也不能替代 DSH 的 `request/header`；后者仍是模型实际请求头的权威记录。Trace 使用有界插件存储，刷新或 Host 重启后可恢复近期记录。

## 8. RP 安全模式

RP 是当前 session 的叠加，不是 DSH agent preset。

1. 角色卡面板上的 RP 开关控制本会话。界面设置里的「绑卡跟随」默认开启，绑定角色卡会自动进入 RP。
2. 关掉该开关或发送 `/rp off` 即可离开。聊天栏改文件权限不能解除锁定。
3. 开启后：写文件、终端、外连抓取被拒绝；本地读取只限当前工作区，且不读 `.env` 等机密文件名。触发拦截时弹出告知窗（不是审批），并中断该 agent 当前轮。
4. 子 agent 可以派。孩子继承同一套限制，并固化父会话当时的 Tavern 选择（与「用当前配置新开对话」相同）。委派任务是否收窄由主 agent 的 spawn 提示决定；插件不往 `rp:policy` 里写委派策略。
5. 界面设置里可改可选的 `rp:policy` 提示词。默认只说明高风险操作被锁。身份和文风写在预设或角色卡。留空则不附加这段文本，锁定仍有效。底部「恢复默认」只重置语言、缩放和绑卡跟随，不会改这段提示词。

完整拦/不拦清单见 [RP_SECURE_MODE.md](RP_SECURE_MODE.md)。

## 9. 数据、备份与卸载

默认数据位于：

```text
<DSH_HOME>/profiles/<profile>/node_modules/pmp-dsh-tavern/data/
```

主要内容包括：

```text
presets/                       预设标准化文档
characters/                    角色卡当前文档
character-artifacts/           PNG 导入留下的封面图（无卡数据）
world-books/                   独立世界书
users/                         用户名字与描述
session-selections.json        per-session 选择（含 RP 状态）
user-world-book-bindings.json  用户—世界书关系
session-templates.json         配置模板（含 RP 投影）
tavern-traces.json             有界 Trace 元数据
ui-settings.json               全局语言、缩放与绑卡跟随 RP
rp-policy.json                 可选的 rp:policy 提示词
```

如插件配置指定外部 `storageDir`，以上数据改存该目录。备份时复制整个 `data/`，不要只复制 `presets/`。

重复执行安装脚本会先暂存并恢复插件内 `data/`。卸载脚本默认备份到 `<DSH_HOME>/backups/pmp-dsh-tavern/<timestamp>/`；只有确认不需要数据时才使用 `--no-backup`。外部导入源文件和外部 `storageDir` 不会被卸载器删除。

完整安装、刷新恢复、跨平台参数和卸载说明见 `INSTALLATION.md`。

## 10. 当前兼容边界

- ST `system`/`user`/`assistant` prompt role 目前作为可审阅标签进入一个 DSH system section，不是真实交错 role message。
- `chatHistory` 始终由 DSH durable history 提供，插件不复制历史。
- example dialogue、greeting、PHI 和 depth/absolute placement 采用明确标注的 system 近似或诊断降级。
- 世界书尚未完整执行 recursive、sticky/cooldown/delay、vector、严格 depth/role 和 outlet 语义。
- 只映射 DSH 当前明确支持的 `temperature`、`maxTokens`、`reasoningEffort` 与 `stop`；其他 ST sampler 会保留但不宣称已下发。
- ST macro 只实现常用子集，不具备完整 SillyTavern runtime。

更精确的 ST、TauriTavern 与 DSH 消息拓扑差异见 `PROMPT_PIPELINE.md`。

