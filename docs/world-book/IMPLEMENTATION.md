# 世界书兼容实现说明

状态：2026-08-14 已完成，以 `ACCEPTANCE.md` 的命令结果为准。

## 文件布局

- `packages/world-book/src/format.js`：识别、JSON 解析、诊断、标准化模型、双格式导出、稳定序列化。
- `packages/world-book/src/policy.js`：普通/正则 key 匹配、secondary logic、稳定排序、显式概率 roll/group roll/预算输入下的候选计算。
- `packages/world-book/src/loader-bridge.js`：纯候选投影和多书结果合并；只产生 loader adapter 的返回 value，不注册 loader。
- `packages/world-book/src/index.js`：唯一公共入口。
- `test/fixtures/world-book`：自行构造的最小输入，不来自本机作品。
- `test/snapshots/world-book-model.json`：确定性标准化快照。

## 降级原则

- 结构不可识别：拒绝并提供 path/code/message。
- 可恢复字段错误：warning + ST/Character Book 默认值；原错误值仍在 `source.raw`。
- 历史世界书中的合法 numeric string：转换为 number，并发出 `coerced-number` warning。
- 无效正则：该 key 不匹配，并在 entry evaluation 的 `invalidKeys` 返回原因，不抛出使整本书失效。
- vectorized：格式完整保留；纯候选器返回 `external-vector-match-required`，不假装执行 embedding。
- runtime-only 字段：格式完整保留；候选器不模拟 session 时效或递归状态。
- loader 仅支持 before/after：projector 显式近似或跳过 outlet，并返回结构化诊断。

## 不包含的实现

没有修改 `packages/tavern-loader/**`，没有新增存储/API/UI，没有角色卡解析，没有读取文件的 API，没有网络调用，也没有 DSH prompt 注入。
