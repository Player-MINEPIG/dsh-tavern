# 安全策略

[English](SECURITY_en.md)

## 支持范围

当前安全维护线为 `2.5.x`；具体版本的 DSH 兼容范围以该版本的 README 和安装说明为准。安全修复只以新的补丁版本发布；开发分支和旧版本不承诺单独回补。

发现疑似漏洞时，请优先使用 GitHub 仓库的 **Security / Report a vulnerability** 私下报告，不要先公开可复现利用、用户数据或真实本机路径。报告应包含受影响版本、最小复现、预期影响和不含秘密的日志片段。

## 威胁模型

- 插件面向本机 DSH Web。HTTP API 默认拒绝非 loopback TCP peer，并校验 Host、同源写请求与 Content-Type；这不是账号鉴权，本机受信任进程仍可访问。
- Tavern 资源、角色卡、世界书、导入记录、模型回复和显示正则都视为不可信输入。资源正文可能成为模型指令；显示内容只在浏览器中处理。
- DSH session 和 durable history 是消息权威。插件不复制或改写原始历史；timeline 只保存指针、分支和显示元数据。
- RP 安全模式是 DSH 权限之上的保守叠加，不是操作系统级隔离，也不能阻止用户主动把秘密贴进对话。

## 已实现的边界

- 全部 v1/v2/v3 浏览器 API 经过同一安全中间件；变更请求要求同源（官方桌面缺省 Origin 时使用进程令牌）与受支持媒体类型。
- 请求体、资源、结构、Trace、持久状态和扮演工作区文件均有明确上限。
- LaTeX 在本地用 KaTeX 转为 MathML，再经 DOMPurify 净化；`trust: false` 禁用公式中需要显式授权的外部资源和 HTML 扩展命令（如 `\includegraphics`、`\href`、`\htmlStyle`），拒绝 `annotation-xml`，宏定义不跨公式共享。限制公式长度、宏展开与用户指定尺寸，错误回退为转义源码；这些上限不能消除浏览器布局或依赖漏洞的风险。公式不加载远程字体或脚本，也不执行 LaTeX 文件/系统命令。
- 扮演工作区使用安全相对路径、逐段链接/reparse 检查、根目录复核、排他临时文件、原子替换和 revision/CAS。
- 静态富文本经过 DOMPurify 与 Shadow DOM/绘制隔离；实时图片由可信父页按可见性、CORS/无凭据/禁重定向及栅格预算获取，静态导出不加载远程图片；URL 检查不验证 DNS，图片服务器仍可见 IP/URL。iframe 与 QuickJS 不开放任意网络；外部链接需点击且带 `noopener noreferrer`。可选交互卡片在禁脚本 iframe 呈现净化 HTML，在有配额的 QuickJS 中执行 JS，仅开放卡片局部 JSON DOM 桥和卡片外的消息确认。见[边界与限制](docs/CONVERSATION_PRESENTATION.md)。
- 选图仅由可信用户操作触发，宿主只读取选定单图并重编码为有界 JPEG；VM 门面不接收原文件名、路径、原图字节或本机对象，也不授予任意文件、canvas、发送消息或存储权限。
- 生命周期日志输出到 Host `ctx.logger` 及 Tavern 的有界 `operation-logs/` journal（最多 4 MiB，可通过 `operationLogs.enabled=false` 禁用持久层）。字段使用白名单和长度上限；持久层还排除路径，不记录提示词、用户消息、模型回复、资源正文、正文长度、摘要或异常 message/stack/cause。查询和分页导出继承 Tavern API 安全边界；无浏览器日志上报。会话与操作标识仍可能敏感，公开前须检查。
- 正式仓库与发布包不得包含真实开发机路径、用户名、临时下载路径、私有 fixture、导入资源或密钥。文档中的路径只能使用明确的通用占位符。

## Trace 官方历史引用

当前 Trace 把 v1 审计与 v3 装配 metadata 合并进 0600 原子写入的 `tavern-trace-records.json` schema 4 文件。它只保存官方 Session 引用、hash、计数、资源/模型/工具摘要和来源关系，不保存 section、context、system message 或 `source.text` 正文副本。详情接口会冷读取 DSH 官方历史，并只在 session 身份、日志截点、事件、消息、hash 和 range 全部验证后返回段落/context 正文；来源正文始终为 `textStatus: "not-stored"`。无法恢复时明确返回 unavailable，不用当前资源或另一份全文兜底。默认上限为 256 条 / 单条 2 MiB / 总计 16 MiB。

旧 `tavern-traces.json` 元数据与旧 `tavern-assemblies.json` schema 3 正文快照只读保留；后者可能继续包含升级前保存的敏感提示词。schema 4 记录文件虽不含提示词正文，其引用 metadata 仍可能敏感，且本地详情 API 能从 DSH 历史返回经验证的提示词正文。应像保护 DSH Session 数据一样保护数据目录和 API。详见 [合同](docs/PROMPT_API_V3.md)。

## 已知风险与操作要求

- 不要把 DSH Web 或本插件 API 直接暴露到局域网或公网。反向代理场景必须自行提供 TLS、认证和可信 Host 配置。
- 预设、卡、世界书、导入记录和用户消息可能包含 prompt injection。高权限 Agent 可能在模型诱导下调用已经获准的终端、文件、网络、浏览器或第三方插件能力；只使用可信内容，不在对话中放入密钥，并保留 DSH 工具审批、沙箱和最小权限控制。
- RP 安全模式及其对子 agent 的继承只是 DSH 权限之上的叠加，不是虚拟机、容器或操作系统沙箱；它不约束本机其他进程，也不保证覆盖其他插件新增加的能力。
- ST/用户显示正则使用 JavaScript `RegExp`，没有可移植的同步超时机制；恶意或灾难性回溯规则可能冻结当前页面。导入者负责审阅规则。
- 解释器配额不能完整覆盖浏览器布局、图片解码、昂贵 CSS 或引擎漏洞；显示不可信内容仍有可用性风险。
- DOMPurify 防的是浏览器 HTML 注入，不会把提示词变安全，也不会限制 Agent 工具权限。
- API 的 loopback/Origin 防护不防本机恶意进程；生命周期日志由 DSH/Cordis 决定保存位置、保留期和轮转，不能当作不可篡改审计日志。
- swipe、分支和周目会创建真实 DSH session，可能显著增加磁盘占用；扮演工作区应位于空间充足的非系统盘。

## 发布检查

维护者在发布前至少执行：

```text
npm audit --omit=dev
npm run verify:2.0
```

还需检查实际打包清单、公开分支历史和生成 bundle 中不存在真实本地路径或秘密，并在目标 DSH 版本上验证 native/play 切换、双标签页收敛及卸载回退。发布流程不应自动 push；由维护者审核提交后再合并、打 tag 和推送。
