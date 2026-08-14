# 世界书兼容调研记录

状态：2026-08-14 完成。本文记录实施前的只读证据、结论与边界，不是使用说明。

## 调研范围

- SillyTavern checkout：只读检查 `public/scripts/world-info.js`、`src/endpoints/worldinfo.js`、`src/endpoints/characters.js`、`src/validator/TavernCardValidator.js`、`public/scripts/char-data.js` 与官方自带 `default/content/Eldoria.json`。checkout 为 `staging`，提交 `380e31e8c58d196969b6a0da74f431ba999c7e0a`。未读取或复制用户角色卡、用户世界书内容。
- TauriTavern 便携数据目录：只读检查迁移说明、迁移 manifest 和公开类型声明。该目录是 ST 数据的一次性只读快照；没有发现第二套 TauriTavern 世界书磁盘格式。
- SillyTavern 官方 [World Info 文档](https://docs.sillytavern.app/usage/core-concepts/worldinfo/)、官方 [SillyTavern 源码仓库](https://github.com/SillyTavern/SillyTavern) 与 Character Card V2 的 [character_book 规范](https://github.com/malfoyslastname/character-card-spec-v2/blob/main/spec_v2.md)。
- TauriTavern 官方 [源码仓库](https://github.com/Darkatse/TauriTavern)；其说明明确前端同步上游 ST，数据格式与目录布局兼容。

## 证据与结论

### 独立 ST 世界书

`src/endpoints/worldinfo.js` 的导入只要求 JSON 顶层存在 `entries`，原生编辑和扫描路径则按对象映射使用它：`entries[uid]`、`Object.keys(entries)` 与 `Object.values(entries)`。官方自带世界书也采用：

```text
{ "entries": { "0": { "uid": 0, "key": [...], ... } } }
```

当前 ST entry 的实际字段比 Character Card V2 基础规范更丰富，包含 `key`、`keysecondary`、`comment`、`content`、`constant`、`selective`、`order`、`position`、`disable`、概率、递归、分组、扫描覆盖、角色过滤、触发类型和 outlet 等。部分历史/转换路径把相同语义放在 `extensions` 内，因此适配器必须读取两处并保留两处未知值。

### 角色卡内嵌 character_book

Character Card V2 定义的是数组外形：`character_book.entries[]`，基础字段为 `keys`、`content`、`extensions`、`enabled`、`insertion_order`，以及可选 `id`、`comment`、`selective`、`secondary_keys`、`constant`、`position` 等。规范明确要求未知扩展字段在导入导出中不得丢失。

ST 的 `convertCharacterBook()` 把该数组转换为内部对象映射，`convertWorldInfoToCharacterBook()` 做反向转换，并把较新的 ST 字段放在 entry `extensions`。因此角色卡模块只需把 `card.data.character_book` 作为值交给本模块，不应让本模块解析或修改整张角色卡。

### 匹配与运行策略

ST 当前实现的关键事实：

- primary key 任意命中后才考虑 secondary key；secondary 逻辑数值为 AND_ANY=0、NOT_ALL=1、NOT_ANY=2、AND_ALL=3；
- `/pattern/flags` 形式按 JavaScript 正则处理，并覆盖大小写/整词设置；普通 key 默认不区分大小写；
- entry 按 insertion order 降序参与激活和预算检查，最终同一插入位置的内容顺序会再次组合；
- 概率、inclusion group、sticky/cooldown/delay、递归、tokenizer 和来源优先级均依赖运行状态或宿主设置；
- outlet、Author's Note、example messages 与 depth role 的真正注入位置属于 loader/prompt builder，而不是格式适配器。

因此本分支只提供确定性的匹配、排序和预算“候选建议”。它不声称复制完整 ST runtime，不读取 session，不生成随机数，不调用 tokenizer，不把内容注入 DSH。

## 有意不采用的资料

本机 TauriTavern 含有用户世界书和第三方扩展数据。它们不属于格式契约的必要证据，本次没有把其内容复制为 fixture 或快照。测试数据全部在本仓库内自行构造，且只覆盖最小字段组合。
