# 世界书兼容验收记录

状态：2026-08-14 纯模块验收通过，随后已集成到首个公开发布候选版本。

本文件在实现后记录命令、结果、兼容范围、降级项、工作树边界和最终提交。验收结果不会只写在 README 或提交消息中。

## 自动化验收

在独立的 `world-book-compat` worktree 执行：

| 命令 | 结果 |
| --- | --- |
| `npm run check` | 通过；build 生成 `dist/client.js`，Node test 42/42 通过，0 failed |
| `npm run pack:check` | 通过；dry-run tarball 包含 `packages/world-book/src/{format,index,loader-bridge,policy}.js` |
| `git diff --check` | 通过，无 whitespace error |

依赖按 lockfile 在本 worktree 内安装；`package-lock.json` 未变化。build 产物内容 hash 与 HEAD 相同，没有纳入功能变更。

## 外部只读兼容扫描

这些文件没有复制进仓库，扫描命令只输出计数和诊断 code：

- SillyTavern checkout 中的官方 `default/content/Eldoria.json`：结构有效，4 entries，连续两次 import/export 结构幂等；
- TauriTavern 便携数据快照中的 `data/default-user/worlds/*.json`：94 files，94 valid，0 invalid，94/94 连续两次 import/export 结构幂等；
- 快照中有 32 处历史 numeric string，均转换为 number 并给出 `coerced-number` warning；
- 有 1 处数组型 comment 给出 `invalid-string` warning，标准字段降级为空字符串，原数组仍保存在 entry `source.raw`。

以上是针对本机快照的兼容证据，不把第三方作品当作仓库 fixture，也不保证未来 ST 新字段无需适配。

## 已验收兼容范围

- 独立 ST World Info：顶层 `entries` object map；
- Character Card V2 等价 `character_book`：顶层 `entries` array；
- 当前 ST position 0–7、role 0–2、secondary logic 0–3；
- key/secondary key、正则 key、启用与三种 strategy、order、概率、扫描覆盖、分组、递归、时效、来源匹配、trigger、character filter、outlet；
- 顶层/entry 未知字段与 book/entry extensions；
- 两种目标格式导出、稳定 JSON、结构幂等、重复 UID 诊断和危险 object-map key 安全往返；
- 无状态普通/正则匹配、secondary logic、稳定排序、显式 group/probability/vector/token 输入下的预算候选建议。
- loader adapter `{ loreEntries, resources, diagnostics }` 纯投影、before/after 精确映射、其他位置诚实降级与多书结果合并。

## 明确降级和未实现项

- 不承诺字节级 JSON 往返：空白、原转义和重复 JSON object key 不可恢复；
- invalid supported field 会标准化为默认值，原值只在 `source.raw` 保留；
- vector embedding、宏替换、真正 tokenizer、递归循环、sticky/cooldown/delay 生命周期、session 来源选择和随机数生成不在格式层；
- candidate token cost 未显式提供时只用确定性的字符数近似，loader 必须在真正注入前使用自己的 tokenizer；
- 不解析整张角色卡或 PNG；角色卡模块传入/接回 `card.data.character_book`；
- 不注入 DSH system prompt，不修改或调用 `packages/tavern-loader/**`。

## 变更边界

审查确认没有改动 `packages/tavern-loader/**`、`packages/preset/**`、本机 SillyTavern/TauriTavern 或任何其他 worktree。共享改动仅为根 `package.json` 子路径导出、架构边界文档和架构测试。

历史切片提交位于 `feature/world-book-compat`；当前集成与发布状态以 `../INTEGRATION_ACCEPTANCE.md` 和根 changelog 为准。
