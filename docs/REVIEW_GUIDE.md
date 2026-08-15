# dsh-tavern 发布审查指南

状态：2026-08-15，适用于首个公开发布候选版本。

## 审查顺序

1. 阅读根 `README.md` 与 `docs/USAGE.zh-CN.md`，确认宣传能力和已知风险准确。
2. 阅读 `ARCHITECTURE.md`、`LOADER_CONTRACT.md`、`DSH_MESSAGE_FLOW.md`，确认一个插件、一个 loader、一个 profile section 和 DSH 原生历史权威边界。
3. 先审查 `packages/**/src`，再运行 build 核对生成的 `dist/client.js`；不得把 generated bundle 当作业务源码手工修改。
4. 阅读 `INTEGRATION_ACCEPTANCE.md` 与 changelog 最新条目，区分自动通过、人工抽查和仍待执行的发布步骤。

## 关键所有权

- `tavern-format`：纯 ST preset/角色格式、归一化、未知字段保留；
- `world-book`：纯 World Book/Character Book parser、matcher 与投影；
- `preset`、`character`、`user`、`world-book-library`：资源 store、API 用例和 UI，不注册 Host prompt seam；
- `session-template`：只保存/应用有界 selection 投影；
- `tavern-trace`：只保存最小化审计，不写 Session 或模型消息；
- `tavern-loader`：唯一 Host 根入口，拥有 session policy、profile compile、current-input projection、request config 与 API dispatcher；
- `client`：唯一 shell overlay/launcher 组合根和语义键 i18n runtime。

内部目录是一个发布包中的模块，不是多个可分别安装的 DSH 插件。

## 重点风险检查

- API 必须继续经过 loopback peer、Host、Origin、Content-Type 与 no-cache/nosniff 包装；
- 资源/API/结构/profile/Trace/session state 上限不得被 ST soft budget 或 `ignoreBudget` 绕过；
- unsafe JavaScript regex 必须默认关闭；
- 用户/资源正文、输入消息、完整 system、API key 和工具 schema不得进入 Trace；
- 动态资源名、关键词和用户输入必须走 i18n raw boundary；
- per-session 绑定只由显式按钮/API 改变，浏览目录、导入和创建不得产生隐式绑定；
- DSH durable history 与 request/header 始终是权威，插件不得伪造 greeting/history/Trace Session event；
- running-agent 保护目前只是显式选择边界，不能误报为全局事务锁。

## 版权与发布包

仓库和发布包不得包含用户提供的外部验收 preset、角色卡、世界书、未经发布授权的截图内容或本机数据目录。项目所有者明确选作公开说明材料的合成 UI 截图可以放入 `docs/assets/`；加入前仍须检查本机路径、密钥和非公开作品内容。外部 fixture 只能通过 `DSH_TAVERN_ACCEPTANCE_FIXTURE` 原地读取；测试、日志和 snapshot 只能记录结构、计数与自制最小内容。

`npm run pack:check` 应包含根 LICENSE、Cordis patch、scripts、dist、packages 和 README 引用的 `docs/assets/*.png`；应排除其他 docs、test、cache、worktree 计划、runtime `data/` 和外部 fixture。

## 验证命令

```sh
npm run check
npm run pack:check
git diff --check
```

发布前再对 tracked tree 与 npm 包清单执行本机绝对路径、私钥头和常见 API/token 形状扫描。命中 `token`、`key` 等普通技术术语不能直接判为泄露，必须检查实际值和上下文。

人工 smoke 使用隔离 `DSH_HOME`、唯一 loopback 端口和合成资源；完成后停止本次创建的 DSH 进程并确认端口释放。
