# 首个公开版本集成验收

状态：2026-08-16，`1.0.0` 发布验收完成；中文版 README 已由项目所有者审核。本文件记录当前整体，而不是早期单一 feature 分支。

## 1. 发布范围

当前根插件一次安装并组合以下能力：

| 模块 | 当前发布能力 |
| --- | --- |
| preset | ST Chat Completion JSON、编辑/拖拽、per-session 显式绑定、支持参数映射 |
| character | V1/V2/V3 JSON、PNG、原件保存/导出、greeting/system/PHI 选择、内嵌书编辑 |
| world book | 独立资源库、session/用户/角色三类来源、统一 matcher、当前输入提前识别 |
| user | 严格名字/描述、per-session 绑定、独立世界书关系 |
| session template | 当前设置或模板创建真实 blank DSH session，不复制历史 |
| launcher/settings | 单一可拖拽 DT 入口、状态标题/红绿点、75%–150%、简体中文/English |
| Tavern Trace | turn/step 资源与 matcher 决策、request/header 对齐、有界无正文持久化 |
| loader/security | 统一 profile、selection policy、API 安全包装、结构/profile/state 上限 |

功能性加固前的用户验收基线为 `fdf9fd27254359feb3fe0f1016141683db529784`，annotated tag 为 `accepted-functional-pre-hardening-20260815`。`1.0.0` 在该基线上增加安全加固、世界书提前识别、用户绑定世界书、配置模板、UI 设置、语义键 i18n 与预设显式 session 绑定。正式发布提交与 tag 以 Git history 为准。

## 2. 自动验收

最新 i18n 重构交付记录：

- `npm run check`：构建成功；185 项测试中 184 通过、0 失败、1 个仓库外版权 fixture 因未提供环境变量而跳过；
- 连续两次 build 的 `dist/client.js` SHA-256 一致；
- `npm run pack:check`：最终为 74 个发布文件；包含独立 locale catalogs/runtime 和 README 使用的 7 张公开 UI 图片，不包含其他 docs、测试、本地 cache、运行 `data/` 或外部 fixture。

在最终合入前，主审应从当前工作树重新执行上述两个命令，而不能只引用 Cursor 的交付文本。自动覆盖至少包括：

- ST 格式解析、未知字段保留、macro、角色 JSON/PNG 和世界书 round trip；
- 资源 CRUD、原子持久化、请求/文件/结构/state/profile 上限；
- per-session preset/角色/用户/世界书选择、fork/subagent、删除清理；
- 用户世界书稳定组合、去重、当前输入同 step 激活；
- exact assembly、call config、Trace/header 对齐与敏感正文最小化；
- 单 launcher、面板切换、拖拽状态、模板事务、UI 设置；
- catalog parity、默认 locale fallback、第三语言语序、raw 资源数据不翻译；
- 安装/刷新恢复/卸载参数与 npm 发布边界。

## 3. 人工验收状态

此前各阶段已在隔离 DSH profile 中实际验证 preset 导入/创建/修改/删除/绑定、角色卡、独立/内嵌/用户世界书组合、用户资料、launcher、Trace、当前输入同轮触发、新会话模板和安装刷新恢复。对应阶段证据保留在 `docs/CHANGELOG.md` 及各模块文档。

本次“纯语义 key i18n”重构完成后，项目所有者已启动界面做过外观与基本操作抽查，未发现明显问题；但没有重新逐项执行 `docs/ui-settings-i18n/THIRD_LANGUAGE_MIGRATION.md` §7 的全部人工矩阵。因此发布记录必须诚实标注为“自动验收完成、人工抽查通过”，不能写成完整双语言/全控件人工验收。

建议合入前至少再做一次短 smoke：

1. 在隔离 `DSH_HOME` 安装当前工作树并启动 loopback DSH；
2. 中英文各打开 DT 菜单、六类 panel/视图和一个确认框；
3. 用含中英文 UI 词语的合成资源名确认切换语言后原文不变；
4. 绑定 preset、角色、用户和一本世界书，发送一次普通关键词消息；
5. 对照同一 turn/step 的 Tavern Trace 与 DSH request/header；
6. 从当前设置创建 blank session，确认选择复制而历史未复制；
7. 停止本次 DSH 进程并确认测试端口释放。

## 4. 已知但不阻止本次发布的边界

- ST role/depth/absolute 拓扑、真实 example dialogue/greeting history 与部分高级世界书状态尚未完整实现；
- API 没有独立账号认证，安全前提仍是 DSH loopback 部署；unsafe regex 是显式风险模式；
- running-agent 保护覆盖四类显式 session binding，不是资源编辑、删除、用户关系和任意模板 apply 的全局事务锁；
- 角色卡原始导入会无损保留内嵌书，完整结构 guard 在编辑和运行消费时执行，导入期仍可提前诊断；
- session selection 等待 DSH 权威 session-delete seam 才能自动回收；容量满时明确拒绝而不静默删除用户绑定；
- i18n 架构已允许 catalog-only 新语言补丁，但正式发布语言仍只有 `zh-CN` 与 `en`。

这些边界必须同时出现在 README 或链接到可发现的技术文档，不能用“完全兼容 SillyTavern”宣传。

## 5. 合入与发布清单

- [x] 项目所有者审核中文版 README；
- [x] 根据审核意见更新安装说明、截图、能力边界和 `1.0.0` 版本；
- [ ] 后续补充英文 README；此项不阻塞已审核的中文首发版本；
- [x] 从当前工作树重跑 `npm run check`；
- [x] 重跑 `npm run pack:check` 并审查包清单；
- [x] 扫描跟踪文件和 package tarball，确认无本机路径、API key、私有 fixture、第三方导入正文；
- [ ] 可选但推荐：完成第 3 节短 smoke；
- 发布提交、`main` 合并、正式 tag 与公开推送以 Git history 和远端引用为权威，不在提交前预填 SHA。
