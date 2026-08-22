# pmp-dsh-tavern

[English](README_en.md)

为 DeepSeek Harness（DSH）提供 Tavern 资源兼容、RP 工作流与第三方前端协议的开源插件。

> 当前文档对应 `2.0.0`。项目代码采用 [MIT License](LICENSE)。

## 设计理念

pmp-dsh-tavern 不是用另一套界面取代 DSH，也不会复制一份会话历史。它以公开扩展点和原子 API 为基础，在 DSH 之上增加一层可测试、可审计、可卸载的 Tavern 兼容框架：

- **灵珠 / DSH 原生模式**：保留 DSH 原生会话、侧边栏和插件生态；
- **魔丸 / RP 模式**：按角色卡与周目重组 RP 侧栏，提供开场白、显示正则、swipe、分支、回退、导入与导出；
- **DSH 仍是权威**：durable history、工具、权限和最终模型请求继续由 DSH 拥有；
- **最小程度改动，最大程度兼容**：优先复用 DSH 公开机制，不替换原生前端，不依赖私有 DOM；
- **卸载后仍可阅读原始会话**：插件只保存资源、选择、周目指针与显示元数据，不伪造或覆盖 DSH 历史。

双模式本身就是兼容方案：不进入魔丸时，用户看到的仍是普通 DSH；只有进入 RP 模式后，插件才挂载自己的 RP 表面。

## ⚠️ 安全警示

安装本插件等同于允许其代码在 DSH Host 和浏览器页面中运行。请只从可信仓库与提交安装，并在更新前检查变更、备份插件数据。以下防护用于降低风险，**不构成操作系统级隔离或账号鉴权**：

- **Agent 与工具风险**：预设、角色卡、世界书、外部记录和用户消息都可能包含 prompt injection。高权限 Agent 仍可能在模型诱导下调用获准的终端、文件、网络、浏览器或其他插件能力；不要在对话中提供密钥，保留 DSH 审批与沙箱，并按最小权限启用工具。
- **RP 安全模式边界**：RP 模式会在 DSH 权限之上增加只读与高风险工具限制，子 agent 也继承该叠加，但它不是虚拟机、容器或系统沙箱，不能约束本机其他进程，也不能把恶意提示词变成可信内容。
- **后端与 API 风险**：v1/v2 API 面向本机 loopback，Host、Origin 和 Content-Type 检查不是登录认证，本机恶意进程仍可能访问。不要把 DSH Web 或本插件 API 直接暴露到局域网或公网；反向代理必须自行增加 TLS、认证和可信 Host 配置。
- **前端渲染风险**：模型输出经过 Markdown 与 DOMPurify 净化，但允许的远程图片或样式仍可能发起网络请求并暴露访问者 IP。显示正则使用 JavaScript `RegExp`，灾难性回溯可能冻结页面；只导入和启用你信任的模板与正则。
- **数据与生命周期风险**：swipe、分支和周目会创建真实 DSH session，并可能增加磁盘占用。revision/CAS、路径检查和原子写入不能替代备份，也不能把多个 API 组合变成跨文件事务。

遇到可疑行为时，停止 Agent、切回 DSH 原生模式并检查原始会话与工具记录。完整威胁模型、已实现边界和漏洞报告方式见 [安全策略](SECURITY.md)；RP 模式具体拦截范围见 [RP 安全模式](docs/RP_SECURE_MODE.md)。

## Quick Start：从角色卡到第一轮 RP 对话

### 0. 安装

环境要求：Node.js 20 或更高版本、可从 `PATH` 调用的 DSH，以及一个已经初始化的 DSH profile（默认 `web`）。

```sh
git clone https://github.com/Player-MINEPIG/dsh-tavern.git
cd dsh-tavern
npm install --cache .npm-cache --legacy-peer-deps
npm run plugin:install
```

安装完成后重启 DSH Web。更新已有安装前请先停止目标 `dsh web`；安装脚本会在刷新期间保留插件数据。其他 profile、独立 `DSH_HOME`、手动安装、备份与卸载方法见 [安装与卸载](docs/INSTALLATION.md)。

### 1. 导入角色卡

左键点击 `DT` 悬浮球打开菜单，进入“角色卡”，导入 SillyTavern JSON 或 PNG 角色卡。导入只创建资源，不会伪造会话或自动发送消息。

![悬浮球角色卡](.\docs\assets\悬浮球角色卡.png)

![导入角色卡](.\docs\assets\导入角色卡.png)

### 2. 创建 DSH 工作区

回到 DSH 原生界面，使用 DSH 自己的工作区能力创建一个准备专门用于 RP 的工作区。所有周目 session 都会归入同一工作区，避免多个角色会话散落并遮挡普通工作。

![新建工作区](.\docs\assets\新建工作区.png)

### 3. 进入 RP 前端并选择工作区

右键单击 `DT` 悬浮球，或在菜单中点击“切换到自定义前端模式”。首次进入魔丸时，插件会要求从 DSH 已有工作区中明确选择 RP 工作区；写入并回读确认前不会进入 RP 内容。

![切换](.\docs\assets\切换.png)

### 4. 创建周目

在 RP 侧边栏找到刚导入的角色卡，点击角色卡右侧的 `+`。插件会创建或复用该角色最近一个完全空白的 `N周目`，并确保 root session 绑定的是你实际点击的角色卡。

![创建周目](.\docs\assets\创建周目.png)

### 5. 选择开场白

空周目的 opening dock 会显示角色卡 greeting。存在备选开场白时可用左右按钮选择；这只是前端展示与首轮提示词参考，不会伪造成一次已经发生的 assistant 回复。

![开场白](.\docs\assets\开场白.png)

### 6. 开始对话

在 DSH 原生输入栏发送第一条用户消息。用户消息会立即出现在 RP 视图中；随后可继续使用 swipe、分支新周目、同周目回退、显示文字编辑及导入/导出等功能。

![对话](.\docs\assets\对话.png)

完整操作与边界见 [中文使用指南](docs/USAGE_zh-CN.md)。

## v2.0 功能概览

| 模块 | 主要能力 | 详细文档 |
| --- | --- | --- |
| 资源 | ST 预设、V1/V2/V3 JSON/PNG 角色卡、独立/内嵌世界书、用户资料、资源绑定与导出 | [中文使用指南](docs/USAGE_zh-CN.md) |
| RP 前端 | 角色卡/周目侧栏、greeting、正文渲染、显示正则、swipe、分支、回退和显示层编辑 | [中文使用指南](docs/USAGE_zh-CN.md) |
| 周目数据 | DSH 权威 session、树状 timeline、工作区 catalog、外部记录首轮只读注入、静态 HTML 与 ST JSONL 导出 | [API](docs/API.md) · [架构](docs/ARCHITECTURE.md) |
| 安全 | RP 权限叠加、同源/loopback API、工作区路径防护、CAS、DOMPurify、无正文 operation log | [RP 安全模式](docs/RP_SECURE_MODE.md) · [安全策略](SECURITY.md) |
| 调试 | Tavern Trace 展示本轮资源、世界书命中与 request/header 对齐信息，不记录完整正文 | [DSH 消息流](docs/DSH_MESSAGE_FLOW.md) |
| 第三方开发 | v2 HTTP API、`pmpDshTavernChrome` 模式服务、DSH slots/store 与独立客户端接入 | [第三方 RP 前端接入](docs/FRONTEND_INTEGRATION_zh-CN.md) |

> **图片占位｜v2.0 其他功能拼图**
> 建议文件名：`docs/assets/v2-feature-overview.png`
> 建议内容：正则、世界书、swipe、周目导入导出、设置页各取一个局部画面。

## 重要边界

- “预设”指 SillyTavern 风格的采样参数与提示词编排，不是 DSH agent preset。
- greeting 不进入 timeline，也不会伪造成 DSH 历史；外部记录只在首次真实请求中作为 `untrusted` 只读上下文注入。
- 显示正则只影响魔丸前端渲染，不改写模型请求、DSH 原始消息或导出所依据的权威正文。
- 魔丸隐藏 reasoning、工具 context 与子 agent 通知；需要查看完整运行细节时切回 DSH 原生“对话”视图。
- 当前没有“导入一个配置文件即可替换整个魔丸”的动态前端加载器。完整替换请发布独立 DSH 插件、独立 Web 客户端或维护 fork。
- DSH rc.8 外层“新建会话”没有公开点击接管 seam。魔丸不使用私有 DOM 覆盖它；创建周目请使用角色卡右侧的 `+`。
- 本插件面向本机 loopback DSH Web，不应直接暴露到局域网或公网。

## 文档导航

默认文档为中文。英文入口见 [README_en.md](README_en.md)（无截图）。

- [中文使用指南](docs/USAGE_zh-CN.md) · [Usage](docs/USAGE_en.md)：全部用户功能、操作步骤与兼容边界
- [安装与卸载](docs/INSTALLATION.md) · [Installation](docs/INSTALLATION_en.md)：安装参数、更新恢复、备份与卸载
- [HTTP API](docs/API.md) · [HTTP API](docs/API_en.md)：v1 资源合同与 v2 RP 前端稳定面
- [第三方 RP 前端接入](docs/FRONTEND_INTEGRATION_zh-CN.md) · [RP frontend integration](docs/FRONTEND_INTEGRATION_en.md)：模式生命周期、交付方式与动作组合
- [架构说明](docs/ARCHITECTURE.md) · [Architecture](docs/ARCHITECTURE_en.md)：最小改动原则、模块边界与 DSH 公开 seam
- [Loader contract](docs/LOADER_CONTRACT.md) · [Loader contract](docs/LOADER_CONTRACT_en.md)：session selection、profile 组合与运行时限制
- [DSH 消息流](docs/DSH_MESSAGE_FLOW.md) · [DSH message flow](docs/DSH_MESSAGE_FLOW_en.md)：DSH 原生流程以及插件介入点
- [Prompt pipeline](docs/PROMPT_PIPELINE.md) · [Prompt pipeline](docs/PROMPT_PIPELINE_en.md)：ST 格式、宏、角色字段与世界书兼容范围
- [RP 安全模式](docs/RP_SECURE_MODE.md) · [RP secure mode](docs/RP_SECURE_MODE_en.md)：RP 模式拦截与不拦截的能力
- [世界书设计](docs/world-book/DESIGN.md) · [World-book design](docs/world-book/DESIGN_en.md)：World Info 格式、匹配与投影契约
- [周目审查记录](docs/PLAY_REVIEW.md) · [Playthrough review](docs/PLAY_REVIEW_en.md)
- [发布变更](docs/CHANGELOG.md)（英文）
- [安全策略](SECURITY.md) · [Security policy](SECURITY_en.md)

## 共同开发

项目采用 [MIT License](LICENSE) 开源。欢迎通过 GitHub 提交 Issue、Pull Request、兼容性报告与设计讨论。

如果你希望基于这套框架开发自己的工具，不必先 fork 整个仓库：

- 资源管理工具可使用公开 v1 API；
- RP 视图或 DSH 客户端插件可使用 v2 API、`pmpDshTavernChrome` 模式生命周期和 DSH 公开 slots/store；
- 独立 Web 客户端可以只消费 HTTP v2；
- 需要改变 loader、资源模型或内置魔丸本身时，再选择 fork。

请让第三方 UI 使用独立 slot id，只清理自己注册的表面，并在离开 `play` 模式或卸载时完整 dispose。模式服务负责生命周期，不负责替多个插件仲裁同一个 slot。

希望 pmp-dsh-tavern 不只服务于一个 RP 前端，也能成为社区共同开发、验证和复用的基础。

## 参考

- [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)
- [SillyTavern](https://github.com/SillyTavern/SillyTavern)
- [NemoPresetExt](https://github.com/NemoVonNirgend/NemoPresetExt)

Copyright © 2026 Zhu Bohan.
