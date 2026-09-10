# DSH 0.1.5-rc.1 兼容与旧周目迁移

[English](DSH_0.1.5_MIGRATION_en.md)

本页对应 `2.2.0`（尚未发布）的兼容更新。未新增界面功能，但新增的公开 coordinates API 与兼容字段属于公共合同扩展，因此采用次版本号；纯内部兼容修复才使用 `2.1.1`。Tavern 保留 DSH `0.1.2-rc.1` 路径，并适配 `0.1.5-rc.1`；不扩大到未经验证的中间/未来候选版本。新版 Host 的 Node 要求是 `^22.19.0 || >=24.0.0`，Tavern 独立测试的 Node `>=20` 声明不能替代它。

外部前端接入保留的公开坐标查询 API 时，请先看 [请求、字段与分支示例](API.md#session-coordinates)。格式版本由 DSH 定义；迁移标记由 Tavern 推断，查询本身不会迁移旧引用。

## 已改变的合同

- Trace 在 V0–V2 读取 `header.system`；V3 从公共 `Session.deriveMessages()` 的有效 system surface 读取系统提示词。只保存指纹和判定，不保存原文。`authority.systemSource` 区分 `request/header` 与 `system/message`。
- 新 QA/swipe 的 `variant.ext.pmpDshTavern.sessionFormatVersion` 保存产生该数值范围的 Session 格式。`GET /v2/sessions/:id/messages` 增加可选 `sessionFormatVersion`、`migratedFromV2`；`GET /v2/sessions/:id/coordinates` 返回格式与迁移标记，不返回消息正文。
- timeline 文件 GET/PUT 会校验范围格式。版本不符，或 Session 含 V2→V3 插入标记而引用没有版本时，返回 `409 PLAY_COORDINATES_MIGRATION_REQUIRED`。不会猜测偏移、静默丢弃或自动重写旧文件。
- `POST /v2/sessions/:id/branch` 接收可选 `sessionFormatVersion`。对迁移过的 Session 必须显式提供当前格式；验证发生在 Host fork 之前。内置客户端随读取/保存的范围传递版本。
- 导入上下文的 claim、terminal、lineage 也记录格式；旧坐标必须迁移后才能再次参与导入或分支判断。
- crypto 必需 peer 允许精确的 `0.1.2-rc.1 || 0.1.5-rc.1`；Cordis 保持 `4.0.2`。pnpm 的 profile 静态检查仍可能报告缺失 peer，因为 DSH 在启动时提供依赖。实际启动报 `ERR_MODULE_NOT_FOUND` 不能忽略。

完整前缀为 `/pmp-dsh-tavern/api`。原有 schema 字段、CAS revision、timeline 节点/variant ID、head 与外部扩展保留。

## 为什么旧范围不能直接复用

DSH 0.1.2-rc.1 使用 V0 日志。官方 V0→V1→V2→V3 迁移中，V1→V2 会合并 assistant 分片，V2→V3 会插入 system message，改变 seq 和继承切点。DSH 只迁移日志内它认识的引用，不负责 Tavern 的外部 JSON。迁移次数依赖提示词变更，不能简单为所有序号加同一个常量。DSH 保留旧格式原日志，但 V3 新写入不能通过降级旧 Host 读取。

如果此前已在未修复的 Tavern 上使用 DSH V3，而且未标记文件混有旧格式/V3 坐标，**不要把这些文件全部当作旧格式输入**。必须先根据备份确认每个范围的来源；本命令不会从不带版本的整数猜测来源。

## 迁移命令

先备份 DSH 数据和 RP 工作区，停止所有会写入这些文件的 DSH 进程。用 DSH 的正常升级流程生成 V3 后停止 Host；命令不会创建或改写 DSH 日志。

为要迁移的 V0、V1 或 V2 引用准备一个 JSON manifest，路径使用绝对路径；`timelines` 是相对所选 RP 根目录的路径。

```json
{
  "dshRoot": "/path/to/dsh-install",
  "workspace": "/path/to/rp-workspace",
  "storageDir": "/path/to/DSH_HOME/pmp-dsh-tavern",
  "sessions": [
    {
      "source": "/path/to/session/session.v2.jsonl.zstd",
      "target": "/path/to/session/session.v3.jsonl.zstd"
    }
  ],
  "timelines": ["character-id/playthrough-id/timeline.json"]
}
```

`dshRoot` 指可解析已安装 `@deepseek-ai/dsh-session-format-v2-to-v3@0.1.5-rc.1` 的目录（通常含 `node_modules`），不是 DSH_HOME。支持普通 `.jsonl` 和包含多个追加帧的 `.jsonl.zstd`。V0 源文件通常叫 `session.jsonl.zstd`，格式以头部 version 为准。每对文件必须属于同一 Session，目标必须含官方迁移器产生的完整、完全匹配的前缀；额外的 V3 后续事件允许保留。

包含所有 variant 对应的 Session，也要包含导入 lineage 指向的父 Session。manifest 明确声明未标记引用属于对应 source 日志的格式；已有版本标记必须与 source 一致，V3 范围会跳过。V0/V1 只映射可唯一确认的 user/message、assistant/message 与 turn/end 坐标；已合并的分片或其他任意事件引用会拒绝。缺映射、原日志不匹配、未知格式或不合法日志都会拒绝写入。

```sh
# 预览：验证全部日志和插件文件，不写入
node scripts/migrate-session-coordinates.mjs --manifest /path/to/migration.json

# 应用已检查的迁移
node scripts/migrate-session-coordinates.mjs --manifest /path/to/migration.json --apply
```

命令只更新列出的 timeline 与 `storageDir/import-context-bindings.json` 中相关的数字引用和格式标记，不改角色卡、预设、显示文本、DSH 历史、会话 ID、节点 ID 或 variant ID。每个变更文件旁保留 `.pre-v3-coordinates` 原始字节备份，再通过临时文件和 rename 替换。

写入是逐文件原子的，不是跨文件事务。中断后先保持 Host 停止，重新运行同一 manifest；已标记 V3 的引用跳过，尚未写入的文件继续处理。同名备份与待处理原文件不一致会拒绝覆盖，需人工核对。完成后重启 Host，并回归历史、swipe 与分支。

## 验证

```sh
npm run check
DSH_TAVERN_COMPAT_ROOT=/path/to/dsh-install node --test test/coordinate-migration-integration.test.mjs
DSH_TAVERN_COMPAT_ROOT=/path/to/dsh-install npm run verify:2.0
```

集成测试使用指定安装里的真实官方 codec/迁移器、合成 V0/V1/V2→V3 多帧压缩日志，验证分片合并、截断/目标不匹配拒绝、范围迁移、导入 claim/terminal、备份与重复运行。缺少该环境变量时明确跳过，不把 fixture 测试当作 Host 验收。实际模型输出质量、KV Cache 和用户历史数据仍需各自验证。

上游依据：[目标 release](https://github.com/deepseek-ai/deepseek-harness/releases/tag/dsh-v0.1.5-rc.1)、[V2→V3 规范](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.5-rc.1/packages/session/session-format-v2-to-v3/README.md)。

### 2026-09-10 实际验收（未发布工作区）

Node 22.23.1；隔离 DSH_HOME；真实 DSH Host + 本地模拟模型：

- 0.1.2-rc.1 与 0.1.5-rc.1：加载插件、预设注入、采样参数、完整回复、Trace 和 RP 周目通过。
- 0.1.2 生成真实 V0 周目后，用 0.1.5 升级同一数据目录：旧 timeline 返回迁移所需的 409；官方多帧 V0/V3 原日志校验、备份、应用与重复执行通过。
- 最终构建：swipe 新增后双向切换通过；导入 claim 消费与分支 lineage 均保存 V3 版本。`npm run check`（启用真实 codec 测试）为 538 通过、2 个已有 opt-in 测试跳过；`verify:2.0` 通过。
- 真实旧 QA 范围 `8..19` 正确变为 `9..16`；重启后旧回复与升级后新回复均保留，从旧 QA 分出的周目只含该处历史。

这些验收使用合成角色和模型回复，没有迁移用户的实际数据，也不代表真实模型质量或 KV Cache 性能已验证。
