# Third-language-ready i18n migration specification

状态：已实现（2026-08-15）。本文是实施与验收合同；后续增加语言时仍按第 1 节的三步流程，不得回退到中文原文或片段替换。

## 1. 目标

把当前“语义 catalog + 中文原文兼容替换”的两层实现收敛为纯语义 key 架构。完成后，第三方开发者增加一种语言时，只应：

1. 新增一个 locale catalog 文件；
2. 在共享 locale registry 注册 locale id 与显示名称；
3. 增加该语言的 catalog/显示验收测试。

新增语言不得要求修改 preset、角色卡、世界书、用户、模板、设置、launcher 或 Tavern Trace 的业务组件，也不得要求维护一份中文原文或中文片段替换表。

## 2. 迁移前的问题

以下问题已在本次实现中关闭，保留作为对照，避免回退：

- `MESSAGE_CATALOG` 已覆盖重要动态句，但约 300 条旧 UI 文案仍由中文 literal 驱动；
- `LEGACY_SOURCE_CATALOGS`/`LEGACY_REPLACEMENTS` 和 `translateVisibleText()` 依赖中文原文及片段顺序；
- `translate()` 的缺省 catalog 写死为 `zh-CN`，没有跟随 `DEFAULT_UI_LOCALE`；
- `PanelHeader` 通过 `关闭` + title + `侧边栏` 拼接无障碍文本，不能表达不同语言的语序；
- catalog 集中在一个较大的客户端文件，语言补丁容易与运行时代码发生合并冲突。

现有 `uiMessage`、`rawText`、共享 locale contract、设置持久化和即时刷新是应保留的基础，不应重写 loader 或资源模块来实现本迁移。

## 3. 要求的最终架构

推荐目录职责如下；文件名可以调整，但边界必须等价：

```text
packages/ui-settings/src/locale-contract.js   # 环境无关的 locale registry/default
packages/client/src/i18n/
  runtime.js                                  # translate/uiMessage/rawText 与当前设置
  catalogs/
    zh-CN.js
    en.js
    <future-locale>.js
```

### 3.1 Locale contract

- `DEFAULT_UI_LOCALE` 是唯一默认语言来源；客户端和服务端不得再次写死默认 locale。
- 客户端和 `ui-settings` API 继续消费同一份 supported-locale registry，不得恢复两份白名单。
- 已持久化 locale 缺失或将来被移除时，读取必须安全回退到 `DEFAULT_UI_LOCALE`，不得导致插件启动或 UI 渲染失败。

### 3.2 Catalog contract

- 每种语言一个独立 catalog 模块；catalog 只包含静态 UI 文案，不包含用户资源数据。
- 所有 catalog 必须拥有和默认 catalog 完全相同的语义 key。缺键、额外键或非字符串值应由测试或模块初始化明确失败。
- key 使用稳定的功能/语义命名，例如 `panel.close`、`preset.binding.bind`、`trace.worldBook.noKeywordMatches`，不得把中文或英文原句作为 key。
- 完整动态句必须使用带命名参数的模板；不同 locale 独立决定参数顺序和标点。
- `translate()` 的回退顺序必须为：当前 locale 对应 key → `DEFAULT_UI_LOCALE` 对应 key → 默认 catalog 的 `common.unavailable`。实现中不得出现 `MESSAGE_CATALOG['zh-CN']` 一类默认值特判。
- 不得把缺失 key、内部错误栈或未解析模板直接渲染给用户。

### 3.3 UI source contract

- 所有 Tavern 自有的可见文案及 `title`、`aria-label`、`placeholder`、`alt`、确认框文本必须使用语义 key。
- `PanelHeader` 的关闭说明必须是完整语义模板，例如 `panel.close: "关闭{title}侧边栏"`；`title` 作为 raw 插值，不允许用多个可翻译片段拼接。
- 删除 `LEGACY_SOURCE_CATALOGS`、`LEGACY_REPLACEMENTS` 及基于中文字符/原文自动替换的生产路径。`translateVisibleText()` 不得继续承担运行时翻译；若为兼容导出暂时保留名称，它只能代理明确的语义调用且不得扫描/替换任意文本。
- 业务组件中不得新增 UI 自有的中文或英文 literal。允许保留的 literal 仅限协议值、CSS/class 名、格式标识、诊断 code、测试数据和明确的用户/资源原始内容。
- 不得用全局 DOM 扫描、MutationObserver 或事后 text-node 替换弥补未迁移文案。

### 3.4 Raw data boundary

以下内容必须逐字保留，不得被 catalog、片段替换或 locale 格式化修改：

- preset、角色卡、世界书和用户的名称及正文；
- 世界书关键词、条目 comment、角色 greeting、prompt 文本；
- session/resource id、诊断 code、模型参数和值；
- 服务端返回的未知第三方字段和用户输入。

完整句中的这些值必须通过 `uiMessage(key, values)` 的 raw 参数插入；纯数据节点继续使用 `rawText()` 或等价的显式边界。不得根据“字符串是否包含中文”推断它是 UI 文案还是用户数据。

## 4. 迁移范围

必须覆盖当前单插件内的全部浏览器表面：

- DT launcher、状态点和菜单；
- preset、角色卡、独立/用户绑定/角色内嵌世界书、用户侧边栏；
- session template / 维持设置新建会话；
- UI 设置；
- Tavern Trace conversation view；
- 所有确认框、未保存警告、空状态、错误提示和无障碍属性。

服务端机器可读 error `code` 不需要本地化。浏览器如展示服务端 message，应使用本地语义上下文或明确标为原始诊断，不得通过中文片段替换服务器文本。

## 5. 不得改变的行为

- 默认 locale 仍为 `zh-CN`，当前支持 `zh-CN` 和 `en`；
- 全局语言/缩放设置的 API、持久文件和即时刷新语义保持兼容；
- 语言切换不改变 session selection、Tavern profile、Trace schema、资源文件或 durable history；
- 未绑定时可打开 catalog 第一项供浏览但不得写入绑定；
- launcher/panel 布局、按钮行为和已验收的中英文含义保持一致；
- 不手工编辑 `dist/client.js`，只通过现有 build 生成；
- 不引入运行时网络翻译服务或新的生产依赖。

## 6. 自动化验收标准

以下条件必须全部满足：

1. `npm run check` 通过，现有功能测试无回归。
2. `npm run pack:check` 通过，catalog 源文件进入发布包，测试/本机文件不进入。
3. catalog parity 测试验证所有 locale 与默认 catalog 的 key 集合完全一致，所有值均为字符串。
4. 默认回退测试以 `DEFAULT_UI_LOCALE` 为断言来源；源码检查和测试均不得依赖默认值恰好为 `zh-CN`。
5. 增加一个仅用于测试的合成 locale，其 `panel.close` 使用与中文/英文不同的参数顺序。测试证明完整模板按该语言语序输出，并证明新增该 locale 不需要修改任何业务组件。
6. `PanelHeader` 的 visible label、`title` 和 `aria-label` 使用完整语义消息；测试覆盖 raw title 插值及不同语序。
7. 客户端生产源码中不存在 `LEGACY_SOURCE_CATALOGS`、`LEGACY_REPLACEMENTS` 或任意中文原文扫描替换路径。
8. 静态边界测试扫描当前 Tavern 客户端：catalog 目录以外不得存在 UI 自有的中/英文句子。测试必须有允许列表规则区分协议值与合成 fixture，不能简单禁止所有 Unicode 或字符串 literal。
9. 每个 `window.confirm`、动态状态句、未保存提示和错误上下文均使用完整语义 key；禁止用多个翻译片段拼成长句。
10. raw-data 测试至少使用包含中文、英文、花括号、引号和类似 UI 词语的资源名/关键词，证明两种正式 locale 和合成 locale 下内容逐字不变。
11. 切换 locale 后 launcher、所有已打开 panel 和 Trace 无需刷新即可更新；切换 session 不重置全局 locale。
12. 构建两次后 `dist/client.js` 稳定，且没有手工维护的 bundle 差异。

## 7. 人工验收标准

在隔离 `DSH_HOME` 安装构建后的插件，至少完成：

1. 分别使用简体中文和英文打开 launcher、五个资源/设置入口、session template 和 Tavern Trace；不存在半中半英的 UI 自有句子。
2. 检查关闭按钮、tooltip、输入框 placeholder、图片 alt、屏幕阅读器 `aria-label` 与确认框，不只检查可见正文。
3. 创建名称为 `关闭用户侧边栏 / Close preset / 世界书` 的合成资源，并配置中英文关键词；切换语言后这些原始值逐字不变。
4. 在各 panel 打开状态下切换语言，标题、按钮、空状态和警告立即更新，资源编辑草稿不丢失。
5. 刷新并切换至少两个 session，语言设置保持全局，资源绑定保持各 session 独立。
6. 恢复默认设置后重新启动 Host，确认回到 `zh-CN` 且 100% 缩放。

## 8. 提交与审查要求

- 重构提交不得夹带 loader、matcher、资源格式或 session policy 的行为变更。
- changelog 应说明迁移目的、删除的 legacy 机制、测试数量和人工验收结果，不能把“注册表可扩展”等同于“第三语言已完整翻译”。
- 审查时优先查看 locale contract、runtime/catalog 边界和业务组件 diff，再由 `npm run build` 核对生成 bundle。
- 若迁移发现无法判断某字符串属于 UI 文案还是用户数据，应先把来源改成显式 typed/raw 边界，不得继续依赖字符内容猜测。

