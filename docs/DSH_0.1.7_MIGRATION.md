# DSH 0.1.7-rc.1 兼容与历史坐标升级

[English](DSH_0.1.7_MIGRATION_en.md)

当前支持的 Host 为 DSH **0.1.7-rc.1**，其 Session 当前写入格式为 V4。不支持旧 DSH 运行时。历史格式读取与升级属于数据兼容路径，不代表承诺旧运行时可用。Node 使用目标 Host 要求的 `^22.19.0 || >=24.0.0`。

DSH durable history 保持权威。Tavern 使用公开生命周期、Session 与 controller 接口，卸载后原生 DSH 与原会话仍可使用。升级为单向；保留旧日志和备份用于保护原始数据，不提供 Tavern 回滚工具，不支持 V4 的旧 Host 无法读取 V4 新写入。

从 alpha.1／alpha.2 升级至 rc.1 时，已使用 V4 且 Tavern 引用已标记 V4 的数据不需要再次转换。离线迁移工具保留对 alpha.1、alpha.2、rc.1 官方格式库的支持，不接受其他未验证版本；这不扩大当前 Host 运行支持范围。

## 当前坐标与 Trace

- 新 QA/swipe 范围携带 `variant.ext.pmpDshTavern.sessionFormatVersion`。[坐标 API](API.md#session-coordinates) 只报告当前 Session 格式，不迁移引用，也不返回消息正文。
- V4 timeline 范围、分支请求与导入引用必须携带匹配的格式版本。缺失或过期版本会在 Host fork 或依赖引用的操作之前返回 `409 PLAY_COORDINATES_MIGRATION_REQUIRED`。V4 没有可靠的通用迁移标记；`migratedFromV2: false` 不表示未标记引用安全。
- 导入上下文的 claim、terminal 与父 lineage 各自包含 Session 坐标。必须包含所选文件中所有坐标所属的 Session。
- 新 Trace 引用 `system/message` 与官方 context `user/message`。V4 context snapshot 的 `source.kind` 为 `runtime-context`，system prompt 为 `system-prompt`。[Trace 合同](PROMPT_API_V3.md) 说明 cold inspect、身份/hash 校验和明确不可用状态。
- API v3、Trace schema 4 与 DSH Session 格式 V4 是独立版本号。

API 前缀为 `/pmp-dsh-tavern/api`。升级保留 Session ID、timeline 节点/variant ID、head、无关扩展以及已有资源正文。

## 为什么引用需要升级

官方 V0→V1→V2→V3→V4 恢复可能改变逻辑事件坐标。V1→V2 合并 assistant 分片，V2→V3 插入 system message；V3→V4 可依据证据在后续源事件前插入 interrupted `turn/end`，转换 producer-owned source 与 tool-role result，并依据保留的直接子会话证据追加缺失的父 catalog 记录。因此不能统一加一个数值偏移。

DSH 负责迁移日志内其拥有的引用，不负责 Tavern 外部 JSON。Tavern 离线命令逐步执行已安装的官方迁移阶段，并将完整转换结果与目标日志核对后才更新外部引用。不会只凭消息文本或整数位置猜测事件映射。

若未标记文件已经混有多代坐标，应先依据保留证据确认各引用来源。manifest 声明未标记引用属于 source 日志格式，命令不能从整数发现这个事实。

## 准备升级

备份 DSH 数据目录与 RP 工作区。通过 DSH 正常升级流程生成 V4 后继，保留旧日志及继承依赖。在应用 Tavern 升级前停止所有可能写入所选文件的 DSH 进程。命令不会创建或改写 DSH 日志。

在另一 DSH_HOME 加载旧 RP 工作区不会复制其 Session。即使 timeline 已标为 V4，`session "…" not found` 仍表示当前 Host 找不到该历史。应恢复原数据目录或所需日志及依赖；修改 Session ID 或清空 timeline 会破坏关联。历史会话缺失与坐标格式错误是不同情况。

准备下列 manifest；日志和根目录使用绝对路径，`timelines` 使用相对 RP 工作区的路径：

```json
{
  "dshRoot": "/path/to/dsh-install",
  "workspace": "/path/to/rp-workspace",
  "storageDir": "/path/to/DSH_HOME/pmp-dsh-tavern",
  "sessions": [
    {
      "source": "/path/to/session/session.v3.jsonl.zstd",
      "target": "/path/to/session/session.v4.jsonl.zstd",
      "children": []
    }
  ],
  "timelines": ["character-id/playthrough-id/timeline.json"]
}
```

`dshRoot` 必须能解析 **0.1.7-alpha.1、0.1.7-alpha.2 或 0.1.7-rc.1** 的官方 format/catalog 包，包括 `@deepseek-ai/dsh-session-format-v3-to-v4`；它不是 DSH_HOME。source 可为 V0、V1、V2 或 V3，target 必须为 V4。支持普通 JSONL 与多追加帧 `.zstd` 文件；格式由头部而非文件名确定。

每对日志必须提供 `children`：完整的可用、已保留直接 subagent 子会话日志路径列表；没有可用子日志时显式填 `[]`。命令通过官方读取器提取子会话事实，检查直接父会话归属与子身份唯一性，并拒绝冲突证据。不会从工具参数推断缺失 descriptor 或子身份。应提供与已验证后继相符的保留子日志代；descriptor 后续变化可能使后继不匹配。

每对 source/target 必须属于同一 Session。target 必须以官方完整迁移结果为精确前缀，其后允许保留已验证的 V4 后续事件。包含所有 timeline Session，以及导入 lineage 坐标所属的父 Session。已标记 V4 的引用跳过，显式旧版本必须与 source 一致。对早期阶段合并事件的 V0/V1 升级，只映射可唯一验证的消息/terminal 坐标；被合并分片与不支持的引用会拒绝。

```sh
# 验证并预览全部变更，不写入
node scripts/migrate-session-coordinates.mjs --manifest /path/to/migration.json

# Host 停止后应用已检查的升级
node scripts/migrate-session-coordinates.mjs --manifest /path/to/migration.json --apply
```

## 文件、备份与拒绝边界

命令处理列出的 timeline，以及 `storageDir` 下存在时的相关记录：

- `import-context-bindings.json`；
- `tavern-trace-records.json`；
- `tavern-traces.json` 与 `tavern-assemblies.json` 中的历史 audit 坐标。

Trace 正文/失败引用、log cut、delivery 格式、audit header 坐标与 activation claim 一同升级。正文和错误引用必须能在两代已验证日志中解析出相同内容与含义。已有历史快照正文保留，不生成新的正文副本。

**V3 之前的 `request-header-system` Trace 引用不会被转换成 V4 system-message 引用。** 受影响记录包含此引用时，升级在发布任何插件变更前拒绝。缺失历史、不支持的格式、不完整映射、身份/hash 变化、记录内部版本不一致、不合法日志与冲突备份同样拒绝。未转换的历史引用在 V4 Host 中可能显示 `format-mismatch` 或其他明确不可用状态，不使用当前资源替代历史正文。

第一次替换之前，每个变更插件文件都会按原始字节备份为 `<filename>.pre-v4-coordinates`。已有备份保留，不以不同内容覆盖。source、target、child 日志会检查是否变化；插件输入也在替换前再次核对。不改写角色卡、预设、DSH 日志或无关插件数据。

每个文件使用临时文件与原子 rename 发布，不是跨文件事务。中断后保持 DSH 停止并重跑同一 manifest：已完成的 V4 记录跳过，剩余文件继续处理。备份冲突需要依据证据人工核对。完成后重启 Host，检查历史读取、Trace、swipe 与分支。

## 验证与依据

```sh
DSH_TAVERN_COMPAT_ROOT=/path/to/dsh-install node --test test/coordinate-migration-integration.test.mjs test/dsh017-host-migration.test.mjs
DSH_TAVERN_PROMPT_COMPAT_ROOT=/path/to/dsh-install node --test test/trace-v3-host.test.mjs test/trace-failures-host.test.mjs
```

这些检查使用官方模块、临时历史与合成模型响应，覆盖历史格式链、interrupted turn 插入、子会话证据、Trace 正文/错误冷读、拒绝、原字节保留与重复执行。它们不等于浏览器、桌面、真实 provider 或用户 profile 验收；对应环境见[开发验证指南](TESTING.md)。

上游依据：[固定目标 release](https://github.com/deepseek-ai/deepseek-harness/releases/tag/dsh-v0.1.7-rc.1)、[V3→V4 规范](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.7-rc.1/packages/session/session-format-v3-to-v4/README.md)、[Session format catalog](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.7-rc.1/packages/session/session-format-catalog/README.md)。
