# 独立 Prompt Assembler 接入

[English](ASSEMBLER_INTEGRATION_en.md) · [装配行为](REQUEST_ASSEMBLY.md)

Tavern 的 npm 运行时依赖方向为 `Tavern → dsh-prompt-assembler`。assembler 不引入 Tavern 或 Memory Manager 包，`adapters/tavern`、`adapters/memory-manager` 接收它们公开的只读服务接口。adapter 由 assembler 仓库维护，第三方可 fork 或向该仓库提 PR；来源仍拥有数据与权限。

## 当前候选的使用

独立 assembler `0.1.0` 尚未发布。源码开发时把 assembler checkout 放在本仓库 `.local/dsh-prompt-assembler`，再运行 `npm ci`、`npm run check`。这个位置只属于本地开发依赖，不包含在 Tavern Git 或发布包中。

```sh
node scripts/pack-with-assembler.mjs --assembler .local/dsh-prompt-assembler --output .local/packages
# 在目标测试 profile 对应的依赖目录，同时安装两个候选包。
npm install /path/to/dsh-prompt-assembler-0.1.0.tgz /path/to/pmp-dsh-tavern-2.5.1.tgz
```

打包脚本将 Tavern 发布包中的依赖固定为 `dsh-prompt-assembler:0.1.0`。已有稳定 `2.5.1` 与本地候选的版本标签相同，这不是稳定版覆盖发布；按交付 receipt 和对应 Git 提交选择候选。真实 DSH profile 仍需使用现有安全安装流程，保持原配置、credentials 和数据；只有 package 安装不足以启用装配核心。参见[准备核心](REQUEST_ASSEMBLY.md#核心扩展和安装边界)。

## Tavern 的接入切面

Tavern 提供当前资源快照和世界书策略校验，将它们传给 assembler 的 store、registry、runtime；装配前完成来源资产准备，装配后再核对策略租约。新来源服务为 `dshPromptSources`；旧 `tavernRequestSources` 和 `pmp-dsh-tavern/request-assembler` 保留转发。HTTP 仍在 Tavern 认证/同源/desktop 令牌保护下，UI 注入 Tavern 的 fetch、语言与 Trace 地址。现有 selection、play/native 默认值、子会话继承、Trace owner 和存储格式保留。

注册与转换由 assembler adapter 完成：preset、character、persona、worldbook、PHI、自定义文本、模板与 MVU 的装配描述都在那里维护。Tavern 保留资源状态、EJS 受限运行时、MVU 提交路径；adapter 不复制它们的状态或读取私有文件。Memory Manager 的装配 adapter 调用公开 `requestAssemblyResources()` 和 `trigger`，管理器继续拥有配置与检索策略。

提供 `parseText(context,rule)` 的来源通过 `inputMode:'text'` 解析用户手填内容；默认模式读取来源资产。两种模式共用位置、深度、角色与快照机制。第三方使用自己的语法，Tavern 使用 ST 解析，DSH 自定义文本使用原生变量插值。Skill 不重复注入。

模块来源与文本解析器分开添加：不能提供当前独立内容的来源不出现在模块菜单，其 parseText 仍可供用户输入文本使用。Tavern 模板文本通过来源自己的只读 EJS 子集解析，存储模板、MVU 状态和 Manager 检索模块按当前真实绑定/配置显示。记忆管理只读查询通过 withSessionRead 等待并借用持久化冷会话；不会创建 Agent 或追加历史。会话不存在、读取服务初始化和读取失败分别处理。

Tavern 的自定义文本只有一个 tavern.text 入口：手填 EJS → 内容引用 → ST 宏；DSH 变量插值仍独立。旧文本规则兼容执行，界面预览、导出和保存时使用统一入口，打开界面不会写入策略。模块描述由 assembler adapter 提供包含内容、内容来源、手动编辑和修改入口四项双语说明；真实正文和资源身份在只读预览中查看。MVU 当前变量在 Tavern Trace 最新轮次编辑；已有实例更新指令目前没有公开编辑入口，不把重启或 InitVar 修改描述成覆盖既有实例的方法。

## GitHub 与分发

一般用独立 repository 与 package.json 的 dependencies 表示单向依赖；README 同时给包依赖图与运行时接口图。GitHub Dependency Graph 从 manifest/lockfile 获取依赖，不必把子库作为 submodule。正式发布 assembler 后，Tavern 的源码依赖应从本地 file spec 改为精确 npm 版本，并用 npm 重生成 lockfile。用户正常安装 Tavern 时即可拉取 assembler；当前本地候选通过两包组合安装，避免要求用户手动拼接运行时代码。

维护者发布两个包的先后顺序为 assembler → Tavern；本次工作不创建远端仓库、不 push、不发布。
