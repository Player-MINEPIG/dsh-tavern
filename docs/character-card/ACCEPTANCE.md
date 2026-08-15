# 角色卡格式与用例切片验收记录

状态：历史 feature 验收，随后已完成 loader/world-book/UI 集成。下表中“等待 loader/不属于本分支”描述的是当时的切片边界；当前整体证据见 `../INTEGRATION_ACCEPTANCE.md`。

日期：2026-08-14

分支：`feature/character-card-compat`

基线：本地 `main` `a38ae9a`
范围：格式、模型、原件存储/导出、API、资源契约、角色 UI 和浏览器 bundle。

## 自动化结果

`npm run check` 已成功：

- esbuild 从 `packages/client/src/index.js` 生成包含 preset 与 character UI 的
  `dist/client.js`；
- Node test runner 通过 38/38；
- 原有 preset 格式、store、API、Host、client、安装脚本共 21 项全部回归通过；
- 新增角色卡相关 17 项全部通过。

新增覆盖：

| 范围 | 已验证内容 |
| --- | --- |
| V1 | 缺省字段、creatorcomment 映射、未知字段和源 JSON 保留 |
| V2 | data 优先、已知类型校验、alternate greeting、内嵌 character_book |
| V3 | nickname、group greeting、未来 3.x warning、assets 惰性保留 |
| PNG | IHDR/IEND、chara、ccv3 优先、坏边界、坏 base64、元数据上限 |
| Store | SHA-256、原件字节一致、重启恢复、路径 ID、防重复、删除清 binding |
| Selection | `characterCardId/character`、per-session、显式 child 不覆盖、greeting 范围、特殊 key 拒绝 |
| API | raw import、list/detail、选择、artifact/JSON 导出、删除、结构化错误、409 policy hook |
| Resource | adapter `{ character, diagnostics }`、最小模型字段、无 raw 默认泄漏、内嵌书接口 |
| UI state | 空白/活动入口、greeting options、默认 loader policy |
| Architecture | format 无 Node/DSH；character 无 system/agent runtime；preset Host 回归不变 |

测试 fixture 全部由测试代码即时合成；没有读取、复制、snapshot 或提交任何本机第三方
角色卡作品。测试临时目录在每项结束后删除。

## 只读真实格式烟测

另对本机 SillyTavern 仓库自带的 `default/content/default_Seraphina.png` 做了一次原地
只读解析。输出仅包含结构统计，不包含角色名或正文：识别为 Character Card V3
`3.0`、PNG `ccv3`，description 长度 2,851，内嵌 character_book 存在；解析成功并
产生 1 条兼容 warning、3 条惰性/跨模块诊断。源文件未修改、未复制到 worktree、未
进入测试 snapshot 或发布包。

## 验收标准状态

| 标准 | 状态 | 证据/说明 |
| --- | --- | --- |
| V1/V2/V3 JSON 解析 | 通过 | `character-format.test.mjs` |
| PNG chara/ccv3 与 V3 优先 | 通过 | `character-png.test.mjs` |
| 未知字段与 extensions 保留 | 通过 | model `source.raw` 与格式测试 |
| 原始导入文件无损导出 | 通过 | artifact Buffer 字节相等断言 |
| 角色库与 per-session binding | 通过 | store/API 重启与隔离测试 |
| 内嵌 character_book 暴露 | 通过 | inert resource 深拷贝契约 |
| 不执行扩展/远程 asset | 通过（结构） | 没有执行器；UI 只请求同源 PNG artifact |
| 角色管理 UI 可构建 | 通过 | esbuild bundle；client-state 单测 |
| 安装态 UI/API 联调 | 等待 loader 合并 | 当前根 loader 按并行边界未修改 |
| 角色实际进入 agent 请求 | 不属于本分支 | `feature/tavern-loader` 负责 |
| character_book 匹配/预算 | 不属于本分支 | `feature/world-book-compat` 负责 |
| fork/subagent 自动策略 | 等待 loader | store 已提供不覆盖显式 child 的复制原语 |

## 尚需合并分支执行的验收

1. loader 挂载 CharacterStore 和 API 后，在隔离 `DSH_HOME` 进行 JSON/PNG 导入；
2. 验证活动 session 的选择、running 409、普通 fork 继承与 subagent 不继承；
3. 验证 preset、角色卡、world book 的统一组合顺序和 request/header；
4. 手工检查角色 UI 的 overlay/header 可达性、卡面、下载和删除；
5. 对最终组合分支重新运行 `npm run check`、`npm run pack:check` 与安装刷新测试。

loader contract 对齐检查：`createCharacterAdapter(store).resolve()` 已接受
`SessionSelectionStore.characterCardId/character`，并返回
`{ character, diagnostics }`；character 包含 `id/name/updatedAt/data`。当前独立
`character-state.json` 到统一 `session-selections.json` 的单向迁移仍是最终集成项，
不得通过双写规避。

本记录不把上述跨分支项目冒充为已完成。
