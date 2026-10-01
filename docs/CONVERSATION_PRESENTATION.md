# 数学公式、头像、对话框与受限交互卡

[English](CONVERSATION_PRESENTATION_en.md) · [使用](USAGE_zh-CN.md) · [API](API.md) · [安全](../SECURITY.md)

本合同适用于 Tavern 2.5.1，目标 DSH `0.2.0-rc.2`。通过官方 UI 服务和 slots 嵌入 Web/桌面主页面，不需要另开浏览器。DSH 历史仍为消息权威，以下数据都只是显示元数据。

RP 页面直接显示 DSH 会话/轮次错误的具体信息。若提示活动写入句柄占用，同一数据目录中的会话可能正由另一个网页端或桌面端实例持有；结束其操作并关闭该实例后，再重新打开会话。静态消息的样式表和行内样式均受 Shadow DOM 与外层绘制边界限制，固定定位内容不能覆盖主界面。

## 数学公式

RP 正文、开场白、显示编辑和静态 HTML 导出共用 Markdown → KaTeX MathML → DOMPurify 路径。公式默认开启，不增加 conversation-settings 字段或专门控制按钮，也不改写 DSH 原文、提示词和 JSONL。行内用 `$…$` / `\(…\)`，独立公式用 `$$…$$` / `\[…\]`；多行分隔符各占一行。分数、根号、积分、矩阵和对齐公式使用 KaTeX 语法，浏览器负责原生 MathML 排版，不加载远程字体或脚本。

仅识别 Markdown 文字中的分隔符；代码、HTML 属性/注释、原始 HTML 块、完整文档模板和交互卡片内部保持原语义。行内 HTML 文字与 `<details>` 的 Markdown 正文/标题可使用公式。常见金额不会被当成公式，但字面 `$x$` 必须转义或放进代码。Markdown 强调不会消耗公式内部的 `*` / `_`；公式样式限于 Tavern 内容，普通公式不会为整条消息引入 Shadow DOM。独立长公式横向滚动，流式内容闭合后才排版，未变化的历史消息复用 DOM。

单个公式限制为 4096 字符、200 次宏展开与用户指定尺寸上限 10 em；宏定义不跨公式共享，错误或不支持的 TeX 回退源码。KaTeX 使用 `trust: false`，禁用公式中需要显式授权的外部资源和 HTML 扩展命令；此设置不影响普通 Markdown 链接、图片或现有 HTML 渲染。公式生成内容仍须净化；允许 MathML 及纯文本 `annotation`，禁止 `annotation-xml`。这不是完整 LaTeX 文档运行环境，浏览器布局仍有资源成本；需要支持 MathML 的现代浏览器。详细转义与混排规则见[使用说明](USAGE_zh-CN.md#markdownhtml-与模板样式)。

## 头像

在 **DT → 用户** 上传 PNG/JPEG/WebP，然后保存资源。浏览器接受最多 8 MiB、边长不超过 8192 的图片，中心裁成 256×256 WebP。API 接受至多 128 KiB 的 raster data URI，校验媒体类型、base64 与文件签名；不接受 SVG、外部 URL 或文件路径。

默认用户图取自周目根 session 所绑定的用户资源；角色图使用当前绑定角色卡的现有 PNG 接口，缺图使用占位。名称/描述参与提示词装配，头像不进入提示词。

消息头像位于输入栏外沿两侧：角色在左，用户在右；正文和操作按钮位于中间。气泡按内容宽度收缩，达到中间列最大宽度后换行；用户气泡及正文右对齐。布局使用 Host 的 composer 宽度变量，在显示 Tavern 的 Session 内通过公开 slot 限定 composer 两侧留白；离开 Tavern 视图后恢复 Host 默认留白。设置预览使用相同的气泡布局，按钮尺寸随草稿实时变化，点击“应用并保存”后生效。

点击对话头像可以上传替换图，选择“仅此条”或“此周目所有用户/角色头像”。优先级如下：

```mermaid
flowchart LR
  A[单条显示覆盖] -->|无| B[本周目该角色覆盖]
  B -->|无| C[绑定用户头像或角色卡图]
  C -->|无| D[占位头像]
```

- **仅此条**：用户按 QA node ID，角色按 QA node ID + variant ID + 输出段序号保存。开场白按开场序号，导入正文按导入位置保存。流式临时消息不可编辑头像，终态再编辑。
- **整周目替换**：覆盖该角色已有及后续消息，并清除该角色所有单条覆盖。另一个角色保持原样。
- **此条恢复继承**：只删除单条覆盖，继续继承本周目覆盖或资源默认值。
- **此周目全部恢复资源默认图**：清除该角色整周目覆盖及所有单条覆盖。
- 在用户面板修改资源头像，会改变所有继承该资源默认图的周目；对话内编辑不会修改用户资源、角色卡源图或其他周目。
- 新建普通周目从资源默认图开始。分支为新周目时复制当时的显示元数据；此后独立保存，不与原周目联动。更换导入记录后，导入位置覆盖仍跟随该位置；需要时恢复默认。

资源 `avatar` 随用户 JSON 导入/导出。覆盖保存在已有 timeline 的 `ext.pmpDshTavern.appearance`，`schemaVersion:1`，字段为可选 `user`、`assistant` 和 `messages`。图片是有界 data URI，`messages` 最多 500 个键，appearance 总计不超过 512K 字符（JSON 序列化后）；timeline 仍受原来的 1 MiB 总限制。更新使用现有 workspace 文件 API 的 revision/CAS，不写 DSH 日志；超限或冲突失败不会覆盖原文件。

## 对话框样式 v1

进入 **DT → 对话设置**，选择柔和、书页或夜色，或使用颜色、圆角、边距和字体控件编辑；预览后点“应用并保存”。也可展开 JSON 编辑、导入或导出。导入只更新预览，应用才保存。一个自定义样式随当前全局对话设置保存；可导出多个文件作为自己的样式库。

[完整示例](examples/bubble-paper.json)：

```json
{
  "format": "tavern-bubble", "version": 1, "name": "Paper",
  "radius": 4, "padding": 20, "borderWidth": 1, "font": "serif",
  "user": {"background":"#f4ecd9","text":"#483923","border":"#d5c6a9"},
  "assistant": {"background":"#fffaf0","text":"#40392d","border":"#ded3bd"}
}
```

名称 1–80 字符；颜色必须是六位 `#RRGGBB`；圆角 0–32、边距 8–24、边框 0–3（整数像素）；字体为 `sans|serif|mono`。文件最多 16 KiB，未知字段、版本或非法值明确拒绝。没有 CSS、HTML、JS、资源 URL 或任意代码字段。

`PUT /v1/conversation-settings` 在既有 `textScale/actionScale` 外接受可选 `bubbleStyle`（上述完整文档）和 `interactiveCards`（boolean）。省略恢复默认，DELETE 恢复全部默认。设置存于原有 `conversation-settings.json`；不绑定周目，不改变 DSH 原生样式。

## 三种边界与方案选择

1. **静态内容**：Markdown → DOMPurify；样式在 Shadow DOM 与绘制边界内隔离。外部自动资源不开放：图片只接受有界 PNG/JPEG/WebP data URI，移除 srcset、poster 等；含 URL、image/image-set/src 函数、`@import` 或转义的 CSS 块/内联样式整体丢弃。正常布局、颜色、渐变、变量、媒体查询和动画可用。外链需用户主动点击，带 `noopener noreferrer`。
2. **脚本环境**：只识别已闭合 `html` 代码围栏或完整 `<html>…</html>` 中的控件/脚本。静态 DOM 在 `sandbox="allow-same-origin"`、无 `allow-scripts` 的 iframe 内呈现，CSP 禁止连接、外部图片、脚本、子 frame、表单提交等。卡片 JS 在独立 QuickJS WASM 中运行，不在 iframe 或父页面执行。iframe/Shadow DOM 本身不承担完整权限保证。
3. **能力接口**：唯一的 JSON bridge 白名单提供卡片内部 DOM 与只读姓名上下文，以及“建议消息”。没有通用 RPC、Host API、凭据、文件、网络、父页面、模块加载或 native eval 入口。建议只在卡片外显示，必须经用户点击 Tavern 按钮才调用已有 `user-message` API。

[DSH sandbox 固定版文档](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.0-rc.2/packages/sandbox/sandbox/README.md) 隔离的是子进程与文件访问，不能复用为消息 JS 的浏览器隔离。[官方桌面转发](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.0-rc.2/apps/desktop/src/web-document.ts) 会剥离 Origin；[桌面请求令牌](API.md#桌面请求令牌) 解决此差异，没有关闭 webSecurity。

[酒馆助手渲染器文档](https://n0vi028.github.io/JS-Slash-Runner-Doc/guide/基本用法/渲染器.html) 与 [固定源码](https://github.com/N0VI028/JS-Slash-Runner/blob/519599bc68247d8e759cc844a983f8f5252941a8/src/panel/render/Iframe.vue) 使用 srcdoc/blob iframe；其构建函数注入公共接口、外部库和头像路径，部分工具桥接父页面。因此复用其显示思路，不能照搬权限模型或声明全量兼容。实现为 Tavern 内可关闭模块，复用已有周目与组件销毁边界；额外插件目前没有独立宿主能力需求，反而需要跨插件生命周期和权限协商。后续若增加通用、独立授权能力，再评估拆分。

```mermaid
flowchart LR
  A[闭合消息 HTML] --> B[净化与禁脚本 iframe]
  A --> C[QuickJS 配额解释器]
  C --> D[有界 JSON 白名单]
  D --> B
  D --> E[姓名上下文]
  D --> F[卡片外消息建议]
  F -->|用户点击| G[已有 Tavern API / DSH 历史]
```

## 支持接口与限制

默认关闭脚本，在对话设置明确启用。可从[计数器示例](examples/interactive-counter.html)开始，将完整文件放进 `html` 代码围栏。每次重新挂载/切换周目/修改卡片源码都新建运行时；普通父组件刷新保留状态。生成中的消息不执行脚本，历史卡片不因其他消息的流式更新而重置。卡片局部变量只在内存中，刷新或重挂载后重置。

| 接口 | 支持范围 |
| --- | --- |
| `document.body`, `getElementById`, `querySelector`, `querySelectorAll` | 仅卡片 body 内，返回 facade，不返回真实浏览器对象；净化可能移除 DOM 保留名称 |
| 元素 `textContent`, `innerHTML`, `value`, `checked` | innerHTML 每次重新净化；不激活插入的脚本 |
| `createElement`, `appendChild`, `remove` | 白名单 HTML 标签，禁止创建 script、iframe、style、img、input；现有受限 input 可交互 |
| `setAttribute/getAttribute`, `classList`, `style.setProperty` | 写属性仅 id/class/title/disabled/aria-label/data-action；CSS 仍在 CSP/iframe 内 |
| `addEventListener` | click/input/change；document 仅同步 DOMContentLoaded；不支持定时器、动画回调、网络或浏览器库 |
| `TavernUI.version`, `getContext()` | v1；角色与挂载时复制的 userName/characterName，复制的 JSON，不含 session ID 或凭据 |
| `TavernUI.proposeMessage(text)` | 最多 4000 字符，生成可见建议；不能自行发送 |

外部 `<script src>`、模块、内联 on*、jQuery/Vue/React、酒馆助手变量/世界书/聊天/生成接口、MVU、父页面和系统接口不兼容。外部脚本/模块/on* 会报告并停用该卡片全部脚本；未提供的运行时 API 会报错并销毁运行时，不静默成功。静态 HTML 导出不运行卡片脚本，也不导出内存中的交互状态。

每卡源码最多 128K UTF-16 字符单元、解释器 8 MiB/256 KiB 栈；每次执行 60 ms 与 500 次中断检查双重上限、1000 bridge 操作、100 Promise jobs；DOM 最多 2048 handles，最多 256 listeners；高度 100–800 px。超限显示错误。浏览器布局/图片解码、WASM 引擎缺陷和复杂 CSS 的拒绝服务不由解释器配额完全覆盖，不能承诺绝对安全；显示正则仍有既有 RegExp 回溯风险。

自动检查见 [TESTING](TESTING.md)。安装到真实 profile 前，仍应对目标官方桌面发行包、实际角色卡与模型完成维护者验收。

## 解释器依赖

`quickjs-emscripten-core` 与 `@jitl/quickjs-singlefile-browser-release-sync` 固定为 `0.31.0`。浏览器变体把 WASM 嵌入客户端包（整体未压缩约 1.6 MiB），不使用 CDN 或外部脚本加载器。包装库与引擎的 MIT 声明保留在生成包和[源码声明](../packages/presentation/THIRD_PARTY_NOTICES.txt)中。解释器模块延迟共享初始化，每张卡片单独创建 runtime。升级依赖需重新验证配额与隔离测试。[上游发布说明](https://github.com/justjake/quickjs-emscripten/releases/tag/v0.31.0)。

样式页顶部为“导入 JSON、导出 JSON、创建样式”。正文字号纳入样式预览，通过滑块或数字输入调节，以可选整数字段 `fontSize` 保存（8–48 px），点击“应用并保存”生效。没有此字段的旧 v1 文件仍可导入，并继承旧的文字缩放；编辑器应用时转换为像素字号。不支持的脚本提示按原因本地化并去重，区分外部文件、模块、其他 script 类型与内联事件属性；开启开关不会开放这些能力。
