# 资源装配布局接入

[English](RESOURCE_LAYOUT_en.md)

资源布局由独立 `dsh-prompt-assembler` 实现。Tavern 的 `packages/request-assembler/resource-layout.js` 只转发 `normalizeLayout`、`describeResourceLayout` 和 `withBlockMove`，不复制装配逻辑。已有 `AssemblyPanel` 嵌入组件直接使用 assembler 的策略/资源布局 UI；现有来源适配器提供角色卡、预设及世界书条目。

来源不再作为拖拽单位。当前预览将连续输出拆成块和位置插槽，部分引用的世界书会显示绑定组与自由组；自由组整体移动，插槽绑定组需明确覆盖。身份保留或位置适配、来源布局和失效回退分别设置。定位覆盖保存稳定目标，不保存本轮触发列表；下一轮新条目进入所属组。

预览和实际请求共用 assembler 的展开和定位验证。标准后端保留原生历史、system/user 投递区域及 context 快照复用限制；不会承诺任意跨历史、assistant 投递或精确 ST depth。旧策略没有 `layout` 时仍按原行为执行，需要用户在草稿显式采用、预览、保存、应用。

接入需要更新 Tavern 的 assembler 依赖到包含资源布局 API 的版本，并重新生成客户端 bundle。`package.json`、lockfile 和 `dist/client.js` 由集成方统一生成。历史筛选仍由独立历史策略模块负责。

验证：`node --test test/resource-layout-*.test.mjs`、`npm run check`。完整 API、双语使用说明及 stock/core Host 验证步骤位于 assembler 的 `docs/RESOURCE_LAYOUT.md` 与 `docs/RESOURCE_LAYOUT_en.md`。
