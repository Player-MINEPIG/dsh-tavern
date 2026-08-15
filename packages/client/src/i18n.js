export const DEFAULT_UI_SETTINGS = Object.freeze({ locale: 'zh-CN', scale: 1 })
export const SUPPORTED_LOCALES = Object.freeze(['zh-CN', 'en'])
export const UI_SCALE_OPTIONS = Object.freeze([0.75, 0.85, 1, 1.15, 1.25, 1.5])

export const MESSAGE_CATALOG = Object.freeze({
  'zh-CN': Object.freeze({
    'common.unavailable': '界面文本暂不可用',
    'settings.menu': '界面设置',
    'settings.title': 'Tavern 界面设置',
    'settings.language': '界面语言',
    'settings.language.zh': '简体中文',
    'settings.language.en': 'English',
    'settings.scale': 'Tavern UI 缩放',
    'settings.scale.help': '仅缩放 Tavern 悬浮入口、资源面板和 Trace，不影响 DSH 主界面。',
    'settings.currentScale': '当前缩放：{scale}%',
    'settings.reset': '恢复默认',
    'settings.saving': '正在保存设置…',
    'settings.saved': '设置已保存，并将在刷新和会话切换后保持。',
    'settings.loadError': '无法读取界面设置：{message}',
    'settings.saveError': '无法保存界面设置：{message}',
    'settings.close': '关闭界面设置侧边栏',
  }),
  en: Object.freeze({
    'common.unavailable': 'Interface text unavailable',
    'settings.menu': 'UI settings',
    'settings.title': 'Tavern UI settings',
    'settings.language': 'Interface language',
    'settings.language.zh': '简体中文',
    'settings.language.en': 'English',
    'settings.scale': 'Tavern UI scale',
    'settings.scale.help': 'Scales only the Tavern launcher, resource panels, and Trace—not the DSH interface.',
    'settings.currentScale': 'Current scale: {scale}%',
    'settings.reset': 'Restore defaults',
    'settings.saving': 'Saving settings…',
    'settings.saved': 'Settings saved and retained across refreshes and session changes.',
    'settings.loadError': 'Could not load UI settings: {message}',
    'settings.saveError': 'Could not save UI settings: {message}',
    'settings.close': 'Close the UI settings sidebar',
  }),
})

// Existing Tavern clients historically used Simplified Chinese source copy.
// Keeping the source phrases in this one catalog lets every composed panel use
// the same localization boundary without coupling resource data to a locale.
const SOURCE_EN = Object.freeze({
  '预设': 'Preset',
  '角色卡': 'Character card',
  '角色卡图片': 'Character card image',
  '世界书': 'World book',
  '用户': 'User',
  '界面设置': 'UI settings',
  '语言与缩放': 'Language and scale',
  '未选择预设': 'No preset selected',
  '未绑定角色': 'No character bound',
  '未绑定世界书': 'No world book bound',
  '未绑定用户': 'No user bound',
  '无会话': 'No session',
  '无': 'None',
  '未知': 'Unknown',
  '未知作者': 'Unknown author',
  '加载中…': 'Loading…',
  '刷新': 'Refresh',
  '删除': 'Delete',
  '保存': 'Save',
  '保存修改': 'Save changes',
  '已保存': 'Saved',
  '重新载入': 'Reload',
  '新增条目': 'Add entry',
  '新建用户': 'New user',
  '创建预设': 'Create preset',
  '导入 ST JSON': 'Import ST JSON',
  '导入 JSON / PNG': 'Import JSON / PNG',
  '导出 JSON': 'Export JSON',
  '导出原件': 'Export original',
  '当前选择': 'Current selection',
  '不使用预设': 'Do not use a preset',
  '基本设置': 'Basic settings',
  '高级设置': 'Advanced settings',
  '收起高级设置': 'Hide advanced settings',
  '展开高级设置': 'Show advanced settings',
  '保存并应用': 'Save and apply',
  '处理中…': 'Working…',
  '浏览角色库': 'Browse character library',
  '浏览用户资源': 'Browse user resources',
  '浏览独立世界书': 'Browse standalone world books',
  '角色库为空': 'Character library is empty',
  '用户资源库为空': 'User library is empty',
  '资源库为空': 'Library is empty',
  '独立世界书资源库为空。': 'The standalone world-book library is empty.',
  '绑定到当前会话': 'Bind to current session',
  '更新会话绑定': 'Update session binding',
  '刷新会话绑定': 'Refresh session binding',
  '解除绑定': 'Unbind',
  '解除当前会话绑定': 'Unbind from current session',
  '删除角色卡': 'Delete character card',
  '删除用户': 'Delete user',
  '删除独立书': 'Delete standalone book',
  '名称': 'Name',
  '角色': 'Role',
  '内容': 'Content',
  '启用': 'Enabled',
  '已禁用': 'Disabled',
  '常驻': 'Always active',
  '使用附加关键词': 'Use secondary keywords',
  '区分大小写': 'Case sensitive',
  '全词匹配': 'Whole-word matching',
  '主关键词': 'Primary keywords',
  '附加关键词': 'Secondary keywords',
  '附加关键词逻辑': 'Secondary keyword logic',
  '无主关键词': 'No primary keywords',
  '排序权重': 'Sort weight',
  '插入位置': 'Insertion position',
  '位置': 'Position',
  '顺序': 'Order',
  '概率': 'Probability',
  '正文': 'Body',
  '条目标题': 'Entry title',
  '条目名称 / 备注': 'Entry name / note',
  '世界书名称': 'World-book name',
  '删除条目': 'Delete entry',
  '新增内嵌条目': 'Add embedded entry',
  '保存内嵌书': 'Save embedded book',
  '内嵌书已保存': 'Embedded book saved',
  '独立世界书': 'Standalone world books',
  '角色卡绑定的世界书': 'Character-bound world book',
  '角色卡内嵌世界书': 'Embedded character world book',
  '角色卡内嵌世界信息': 'Embedded character World Info',
  '世界信息（Lorebook）': 'World Info (Lorebook)',
  '运行诊断': 'Runtime diagnostics',
  '兼容警告': 'Compatibility warnings',
  '需要 loader/其他模块处理': 'Requires loader/other module handling',
  '当前开场参考内容': 'Current greeting reference',
  '开场参考': 'Greeting reference',
  '名字（用于 {{user}} 宏）': 'Name (used by the {{user}} macro)',
  '描述（进入 personaDescription marker；缺 marker 时由 loader 稳定降级）': 'Description (placed at the personaDescription marker, with a stable loader fallback)',
  '保存资源': 'Save resource',
  '预设名称': 'Preset name',
  '跟随模型默认': 'Use model default',
  'DSH 系统提示词': 'DSH system prompt',
  '保留 DSH 系统提示词，并追加预设（推荐）': 'Keep the DSH system prompt and append the preset (recommended)',
  '仅使用预设，移除 DSH 系统段（高级）': 'Use only the preset and remove DSH system sections (advanced)',
  '提示词': 'Prompts',
  '＋ 添加': '+ Add',
  '拖拽排列顺序': 'Drag to reorder',
  '松开后放置于此': 'Release to place here',
  '已启用': 'Enabled',
  '已绑定': 'Bound',
  '未绑定': 'Not bound',
  '规划中': 'Planned',
  '关闭右侧栏': 'Close sidebar',
  '关闭预设侧边栏': 'Close preset sidebar',
  '关闭角色卡面板': 'Close character-card panel',
  '关闭角色卡侧边栏': 'Close character-card sidebar',
  '关闭用户面板': 'Close user panel',
  '关闭用户侧边栏': 'Close user sidebar',
  '拖动可移动；点击展开 Tavern 资源面板': 'Drag to move; click to open Tavern resource panels',
  '正在加载预设…': 'Loading presets…',
  '正在加载角色库…': 'Loading character library…',
  '正在加载用户资源…': 'Loading user resources…',
  '正在读取世界信息…': 'Reading World Info…',
  '正在读取审计记录…': 'Reading audit records…',
  '用户资源已加载': 'User resources loaded',
  '用户资源已刷新': 'User resources refreshed',
  '用户资源已创建；保存名字和描述后再绑定': 'User created; save its name and description before binding',
  '名字和描述已保存；已绑定会话的下一次请求会立即使用新内容': 'Name and description saved; bound sessions will use them on the next request',
  '用户已绑定；当前会话的下一次请求会使用该名字和描述': 'User bound; the current session will use this name and description on its next request',
  '当前会话已解除用户绑定': 'User unbound from the current session',
  '用户已删除，相关会话绑定已清除': 'User deleted and related session bindings cleared',
  '检测到其他 Tavern 资源变化；为保留本面板未保存修改，未自动刷新。': 'Other Tavern resources changed. This panel was not refreshed so its unsaved changes are preserved.',
  '当前用户资源或世界书绑定有未保存修改。放弃修改并新建用户吗？': 'This user resource or its world-book binding has unsaved changes. Discard them and create a user?',
  '用户绑定的世界书已保存；选择该用户的会话会在下一次组装时自动使用': 'The user’s world-book binding was saved; sessions using this user will apply it on their next assembly',
  '当前用户资源或世界书绑定有未保存修改。放弃修改并切换吗？': 'This user resource or its world-book binding has unsaved changes. Discard them and switch?',
  '用户资源和世界书绑定已加载': 'User resource and world-book binding loaded',
  '当前用户资源或世界书绑定有未保存修改。仍然关闭吗？': 'This user resource or its world-book binding has unsaved changes. Close anyway?',
  '放弃尚未保存的用户资源或世界书绑定修改？': 'Discard unsaved user-resource or world-book-binding changes?',
  '有未保存修改：': 'Unsaved changes: ',
  '名字/描述': 'Name/description',
  '用户世界书绑定': 'User world-book binding',
  '当前显示的用户资源和世界书绑定均已保存。': 'The displayed user resource and world-book binding are saved.',
  '保存资源（未保存）': 'Save resource (unsaved)',
  '资源已保存': 'Resource saved',
  '请先保存修改': 'Save changes first',
  '用户绑定的独立世界书': 'Standalone world books bound to this user',
  '选择该用户时，loader 会自动组合这里的世界书与当前会话显式选择的世界书；重复的同一本书只执行一次。': 'When this user is selected, the loader combines these books with the session’s explicit world books; a duplicate book runs only once.',
  '正在加载独立世界书资源库…': 'Loading the standalone world-book library…',
  '独立世界书资源库为空。请先在世界书面板创建或导入。': 'The standalone world-book library is empty. Create or import one in the world-book panel first.',
  '保存世界书绑定（未保存）': 'Save world-book binding (unsaved)',
  '世界书绑定已保存': 'World-book binding saved',
  '清空待保存选择': 'Clear pending selection',
  '用户资源正文仍严格只有名字和描述；世界书关系保存在 loader 的独立结构化策略中。用户资源不包含头像，也不会覆盖 DSH Agent 身份。': 'The user resource remains strictly name and description only; world-book relationships are stored in a separate structured loader policy. User resources have no avatar and do not override the DSH Agent identity.',
  '角色库已加载': 'Character library loaded',
  '角色状态已刷新': 'Character status refreshed',
  '角色卡已导入；尚未绑定到会话': 'Character card imported; it is not yet bound to a session',
  '角色选择已保存；实际对话加载由 Tavern loader 统一处理': 'Character selection saved; the Tavern loader handles runtime loading',
  '当前会话已解除角色绑定': 'Character unbound from the current session',
  '角色卡已删除，相关会话绑定已清除': 'Character card deleted and related bindings cleared',
  '预设已加载': 'Preset loaded',
  '预设状态已刷新': 'Preset status refreshed',
  '已创建并选择新预设': 'New preset created and selected',
  'ST 预设已导入并选择': 'ST preset imported and selected',
  '预设配置已保存': 'Preset settings saved',
  '预设已删除': 'Preset deleted',
  '当前绑定已应用': 'Current binding applied',
  '清空待应用选择': 'Clear pending selection',
  '应用会话绑定（未保存）': 'Apply session binding (unsaved)',
  '面板显示的绑定已应用到当前会话。': 'The binding shown in this panel is applied to the current session.',
  '绑定有未保存修改，当前勾选尚未应用到会话。': 'The binding has unsaved changes; the current selection is not yet applied.',
  '本轮没有可审计的世界书匹配来源。': 'This request has no auditable world-book source.',
  '刷新或宿主重启后可恢复。': 'Restored after refresh or host restart.',
  '未使用': 'Not used',
  '无配置关键词': 'No configured keywords',
  '无关键词命中': 'No keyword matches',
  '已插入': 'Inserted',
  '已拒绝': 'Rejected',
  '等待权威 header': 'Waiting for authoritative header',
  '组合与插入': 'Assembly and insertion',
  '世界书匹配决策': 'World-book match decisions',
  '新预设': 'New preset',
  '新提示词': 'New prompt',
  '新用户': 'New user',
  '新会话': 'New session',
  '当前设置或配置模板': 'Current settings or configuration template',
  '新会话与配置模板': 'New session and configuration templates',
  '关闭新会话侧边栏': 'Close the new-session sidebar',
  '维持当前 Tavern 设置新开对话': 'Start a new conversation with the current Tavern settings',
  '只继承 preset、角色卡与 greeting/开关、用户和独立世界书选择。DSH 历史、Tavern Trace、Inbox、运行中 turn/step 和其他运行态不会复制。': 'Carries only the preset, character and greeting/options, user, and standalone world-book selections. DSH history, Tavern Trace, Inbox, active turns/steps, and other runtime state are not copied.',
  '没有可用的 DSH 目标工作区。请先在 DSH 侧栏中加入或打开工作区。': 'No DSH target workspace is available. Add or open a workspace in the DSH sidebar first.',
  '配置模板': 'Configuration templates',
  '已选择模板': 'Selected template',
  '未选择模板': 'No template selected',
  '模板名称': 'Template name',
  '新配置模板': 'New configuration template',
  '由当前设置创建': 'Create from current settings',
  '仅保存名称': 'Save name only',
  '用当前设置更新': 'Update from current settings',
  '删除模板': 'Delete template',
  '保存内容：': 'Saved content: ',
  '空 Tavern 配置': 'Empty Tavern configuration',
  '该模板暂不可用于创建：': 'This template cannot currently be used:',
  '根据所选模板新开干净对话': 'Start a clean conversation from the selected template',
  '模板与新会话操作已就绪。': 'Template and new-session actions are ready.',
  'DSH 可能复用同工作区中已有的真实 blank session；这是其公开 New Session 语义。插件会在导航前原子替换该 blank session 的 Tavern 选择。': 'DSH may reuse an existing real blank session in the same workspace; this is its public New Session behavior. The plugin atomically replaces that blank session’s Tavern selection before navigation.',
  '模板选择已更新': 'Template selection updated',
  '请先打开一个会话，再保存当前 Tavern 设置': 'Open a session before saving its current Tavern settings',
  '请先选择一个模板': 'Select a template first',
  '请先打开会话并选择模板': 'Open a session and select a template first',
  '模板已删除': 'Template deleted',
  '请先打开一个来源会话': 'Open a source session first',
  '当前会话不属于 DSH 工作区；请先把会话加入工作区': 'The current session is not in a DSH workspace; add it to a workspace first',
  '已创建模板：': 'Template created: ',
  '已重命名模板：': 'Template renamed: ',
  '已用当前设置更新模板：': 'Template updated from current settings: ',
  '已切换到干净会话：': 'Switched to clean session: ',
  '删除配置模板“': 'Delete configuration template “',
  '”？这不会删除任何 DSH 会话。': '”? This will not delete any DSH session.',
  ' 本世界书': ' world books',
  '保存会更新插件保存的角色卡副本及其 JSON 导出；为避免破坏签名或图片数据，最初导入的 PNG/JSON artifact 仍保持不变。matcher 会在首次请求组装前把本步骤 claimed 输入与 Session 历史组合扫描，不会向历史写入副本。': 'Saving updates the plugin copy of the character card and its JSON export. The original PNG/JSON artifact remains unchanged. Before the first request assembly, the matcher scans this step’s claimed input together with Session history without writing a duplicate into history.',
  '实际激活、排序、概率和预算由共享 matcher 确定；最终注入仍由 Tavern loader 统一完成。当前扫描会把本步骤 claimed 输入与持久历史组合成临时上下文，因此单步骤会话也能在首次请求触发关键词。': 'The shared matcher determines activation, ordering, probability, and budget, and the Tavern loader performs final injection. Scanning combines this step’s claimed input with durable history in a temporary context, so a single-step session can trigger keywords on its first request.',
  '匹配基于本步骤 assembly 的临时激活上下文：持久历史 + ': 'Matching uses this step’s temporary activation context: durable history + ',
  ' 条本轮 claimed 输入；不保存输入正文': ' claimed messages from this turn; input bodies are not stored',
  '；扫描输入已按上限截断': '; scan input was truncated to the configured limit',
  '主关键词（每行一个；任一命中）': 'Primary keywords (one per line; any match)',
  '附加关键词（每行一个）': 'Secondary keywords (one per line)',
  '主关键词（支持中文、英文逗号分隔）': 'Primary keywords (Chinese or English comma separators)',
  '附加关键词（支持中文、英文逗号分隔）': 'Secondary keywords (Chinese or English comma separators)',
  'AND ANY：命中任一': 'AND ANY: match any',
  'AND ALL：命中全部': 'AND ALL: match all',
  'NOT ANY：不能命中任一': 'NOT ANY: match none',
  'NOT ALL：不能全部命中': 'NOT ALL: not all may match',
  '条目内容（触发后注入 system profile）': 'Entry content (injected into the system profile when triggered)',
  '角色定义之前': 'Before character definition',
  '角色定义之后': 'After character definition',
  '作者注释之前（近似）': 'Before author note (approximate)',
  '作者注释之后（近似）': 'After author note (approximate)',
  '指定深度（近似）': 'At depth (approximate)',
  '示例消息之前（近似）': 'Before example messages (approximate)',
  '示例消息之后（近似）': 'After example messages (approximate)',
  'Outlet（当前不注入）': 'Outlet (not currently injected)',
  '删除这个世界信息条目？保存后才会写入角色卡副本。': 'Delete this World Info entry? It is written to the saved character-card copy only after saving.',
  '放弃尚未保存的条目修改并重新载入？': 'Discard unsaved entry changes and reload?',
  '放弃尚未保存的修改？': 'Discard unsaved changes?',
  '有尚未保存的条目修改。': 'There are unsaved entry changes.',
  '当前会话没有可用世界信息。绑定含 character_book 的角色卡后，其内嵌条目会自动由 loader 匹配；解绑角色会同时移除该来源。': 'No World Info is available for this session. Bind a character card containing character_book to let the loader match its entries; unbinding removes that source.',
  '保存会更新插件保存的角色卡副本及其 JSON 导出；为避免破坏签名或图片数据，最初导入的 PNG/JSON artifact 仍保持不变。当前 matcher 扫描已进入 Session 的历史；刚提交的输入可能在同一可见回合的下一 agent step（如工具继续）或下一用户回合触发关键词。': 'Saving updates the plugin copy of the character card and its JSON export. The originally imported PNG/JSON artifact remains unchanged to preserve signatures and image data. The matcher scans durable session history; newly submitted input may trigger on the next agent step or user turn.',
  'ST marker 不会作为独立提示词注入': 'ST markers are not injected as standalone prompts',
  '启用提示词': 'Enable prompt',
  '正在同步当前会话的预设状态…': 'Syncing preset state for the current session…',
  '预设已选择；下一条消息将携带此 preset。已有会话历史不会被清除。': 'Preset selected; the next request will use it. Existing session history is unchanged.',
  '已停用 preset；已有会话历史不会被清除': 'Preset disabled; existing session history is unchanged',
  '请选择或创建预设以开始配置。': 'Select or create a preset to begin configuring it.',
  '这些字段会被完整保存；dsh 0.1.0 当前请求协议未暴露的参数不会强行下发给适配器。': 'These fields are saved in full. Parameters not exposed by the current dsh request protocol are not forced into the adapter.',
  '警告：这会移除模型可见的 Harness 身份、Agent persona 和工具说明，可能破坏工具调用或结构化输出；沙箱与审批等执行层安全仍然有效。': 'Warning: this removes the model-visible Harness identity, Agent persona, and tool instructions, which may break tool use or structured output. Execution-layer sandboxing and approvals remain active.',
  '请先创建或打开一个会话再绑定角色': 'Create or open a session before binding a character',
  '请先创建或打开一个会话再绑定世界书': 'Create or open a session before binding world books',
  '请先创建或打开一个会话并选择用户资源': 'Create or open a session and select a user resource first',
  '当前会话已有历史。更换角色只影响后续请求，不会重写已有消息；继续吗？': 'This session already has history. Changing the character affects only future requests and does not rewrite messages. Continue?',
  '当前会话已有历史。切换用户只影响后续请求，不会重写已有消息；继续吗？': 'This session already has history. Changing the user affects only future requests and does not rewrite messages. Continue?',
  '当前没有可解绑的会话': 'There is no session to unbind',
  '角色库已刷新': 'Character library refreshed',
  '角色详情已加载': 'Character details loaded',
  '导入一张合成或自有授权的 SillyTavern 角色卡以查看详情。': 'Import a synthetic or properly licensed SillyTavern character card to view its details.',
  '允许 loader 优先采用卡内 system_prompt': 'Allow the loader to prefer the card system_prompt',
  '允许 loader 采用 post_history_instructions（实际位置由 loader 决定）': 'Allow the loader to use post_history_instructions (the loader determines placement)',
  '角色卡模块负责保存标准化资源和会话选择；实际 system profile 与内嵌世界信息匹配由 Tavern loader 在每次请求时统一处理，不会伪造 assistant 历史。': 'The character-card module stores normalized resources and session selection. The Tavern loader handles the system profile and embedded World Info on each request without fabricating assistant history.',
  'System prompt（由 loader 按绑定设置处理）': 'System prompt (handled by the loader according to binding settings)',
  'Post-history instructions（由 loader 近似放置）': 'Post-history instructions (approximately placed by the loader)',
  '世界书资源库已加载': 'World-book library loaded',
  '世界书资源库已刷新': 'World-book library refreshed',
  '世界书详情已加载': 'World-book details loaded',
  '已创建独立世界书；尚未绑定当前会话': 'Standalone world book created; not yet bound to the current session',
  '世界书已导入；尚未绑定当前会话': 'World book imported; not yet bound to the current session',
  '世界书修改已持久化，后续请求将使用新内容': 'World-book changes saved; future requests will use the new content',
  '当前会话的世界书绑定已保存': 'World-book binding saved for the current session',
  '独立世界书已删除，相关会话绑定已清理': 'Standalone world book deleted and related session bindings cleared',
  '角色卡内嵌世界书已保存，后续请求将使用新内容': 'Embedded character world book saved; future requests will use the new content',
  '世界信息（World Book）': 'World Info (World Book)',
  '关闭世界书侧边栏': 'Close world-book sidebar',
  '导入 JSON': 'Import JSON',
  '新建世界书': 'New world book',
  '当前会话绑定': 'Current session binding',
  '删除这个世界书条目？保存后生效。': 'Delete this world-book entry? The change takes effect after saving.',
  '删除这个角色卡内嵌世界书条目？保存后生效。': 'Delete this embedded character world-book entry? The change takes effect after saving.',
  '实际激活、排序、概率和预算由共享 matcher 确定；最终注入仍由 Tavern loader 统一完成。当前扫描基于已持久化的会话历史；刚提交的输入可能在同一可见回合的下一 agent step（如工具继续）或下一用户回合触发。': 'The shared matcher determines activation, ordering, probability, and budget; the Tavern loader performs final injection. Scanning uses durable session history, so newly submitted input may trigger on the next agent step or user turn.',
  '创建一个只含名字和描述的用户资源。': 'Create a user resource containing only a name and description.',
  '用户资源不包含头像，也不会覆盖 DSH Agent 身份。loader 只在统一 Tavern profile 中解析名字宏并放置一次描述。': 'User resources contain no avatar and do not override the DSH Agent identity. The loader resolves the name macro and places the description once in the unified Tavern profile.',
  '常驻条目': 'Always-active entry',
  '主关键词命中': 'Primary keyword matched',
  '主关键词未命中': 'Primary keyword missed',
  '附加关键词任一命中': 'Any secondary keyword matched',
  '附加关键词均未命中': 'No secondary keyword matched',
  '附加关键词全部命中': 'All secondary keywords matched',
  '附加关键词未全部命中': 'Not all secondary keywords matched',
  '附加关键词排除条件通过': 'Secondary exclusion condition passed',
  '附加关键词触发排除': 'Secondary keyword triggered exclusion',
  '附加关键词非全中条件通过': 'Secondary not-all condition passed',
  '附加关键词全中而排除': 'All secondary keywords matched and excluded the entry',
  '条目已禁用': 'Entry disabled',
  '需要外部向量匹配': 'External vector match required',
  '互斥组未胜出': 'Did not win the inclusion group',
  '概率检查拒绝': 'Rejected by probability check',
  '超出 token 预算': 'Token budget exceeded',
  '正文为空，未插入': 'Empty body; not inserted',
  'Outlet 无稳定插入 seam': 'Outlet has no stable insertion seam',
  '尚未观察到可对齐的 DSH request/header；这不代表请求已经发送。刷新后仍会保留该待确认记录。': 'No alignable DSH request/header has been observed; this does not mean the request was sent. The pending record remains after refresh.',
  '匹配基于 system assembly 当时可见的持久化会话历史；刚提交的输入会在下一次 agent step 扫描时可见，该 step 可能仍属于同一可见回合（如工具继续），也可能属于下一用户回合。': 'Matching uses durable session history visible during system assembly. Newly submitted input becomes visible on the next agent step, which may be in the same visible turn or the next user turn.',
  '隐私边界：这里只保存资源摘要、配置/命中关键词、决策原因、位置、预算和 SHA-256 摘要；不保存 preset/角色/user/世界书正文、完整 system、聊天历史、header 内容或 tool payload。': 'Privacy boundary: this stores only resource summaries, configured/matched keywords, decision reasons, placement, budgets, and SHA-256 digests—not resource bodies, full system text, chat history, header content, or tool payloads.',
  '与 Conversation / Trajectory 并列的 loader 审计视图。DSH request/header 始终是最终发送 system、tools 与生效 config 的权威。': 'A loader audit view alongside Conversation and Trajectory. The DSH request/header remains authoritative for the final system, tools, and effective config.',
  '此会话还没有 Tavern 请求审计记录。发送下一条消息后再查看。': 'This session has no Tavern request audit records yet. Send the next message and check again.',
  '无关键词': 'No keywords',
  '顺序（高值优先）': 'Order (higher values first)',
  '（近似）': ' (approximate)',
  ' → 未插入': ' → not inserted',
  '（沿用上一份 header）': ' (reused previous header)',
  '未找到': 'Not found',
  '该记录已对齐 DSH request/header #': 'This record is aligned with DSH request/header #',
  '。Tavern profile 校验：': '. Tavern profile validation: ',
  '；采样字段：': '; sampler fields: ',
  '匹配基于本步骤 system assembly 当时可见的持久化会话历史；没有重复附加 pending 输入。': 'Matching uses durable session history visible during this step’s system assembly; pending input was not appended a second time.',
  '一致': 'Consistent',
  '本轮无 profile': 'No profile this request',
  '不一致': 'Inconsistent',
  '一致或无字段': 'Consistent or no fields',
  '内嵌 character_book 已无损保留': 'Embedded character_book preserved losslessly',
  '未知宏：': 'Unknown macros: ',
  '预算：': 'Budget: ',
  '关闭': 'Close ',
  '侧边栏': ' sidebar',
})

const SOURCE_REPLACEMENTS = Object.entries(SOURCE_EN).sort((left, right) => right[0].length - left[0].length)
const RAW_TEXT = Symbol('dsh-tavern.raw-text')
let current = { ...DEFAULT_UI_SETTINGS }

function fill(template, values) {
  return template.replace(/\{([A-Za-z0-9_]+)\}/g, (_match, key) => String(values?.[key] ?? ''))
}

export function translate(key, values = {}, fallback) {
  const messages = MESSAGE_CATALOG[current.locale] ?? MESSAGE_CATALOG['zh-CN']
  const template = messages[key]
  if (typeof template === 'string') return fill(template, values)
  if (typeof fallback === 'string' && fallback !== '') return fill(fallback, values)
  return messages['common.unavailable']
}

export function translateVisibleText(value) {
  if (typeof value !== 'string' || current.locale !== 'en' || !/[\u3400-\u9fff]/u.test(value)) return value
  if (SOURCE_EN[value] !== undefined) return SOURCE_EN[value]
  let output = value
  for (const [source, translated] of SOURCE_REPLACEMENTS) output = output.split(source).join(translated)
  return output
    .replaceAll('当前会话：', 'Current session: ')
    .replaceAll('绑定：', 'Binding: ')
    .replaceAll('状态同步失败：', 'Status sync failed: ')
    .replaceAll('条目 ', 'Entry ')
    .replaceAll('新条目 ', 'New entry ')
    .replaceAll(' 本', ' books')
    .replaceAll(' 条', ' entries')
    .replaceAll('轮次 ', 'Turn ')
    .replaceAll('步骤 ', 'Step ')
    .replaceAll('尝试 ', 'Attempt ')
    .replaceAll('诊断（', 'Diagnostics (')
    .replaceAll('（', ' (')
    .replaceAll('）', ')')
    .replaceAll('；', '; ')
    .replaceAll('：', ': ')
    .replaceAll('、', ', ')
}

export function rawText(value) {
  return Object.freeze({
    [RAW_TEXT]: true,
    value: value === null || value === undefined ? '' : String(value),
    toString() { return this.value },
  })
}

export function isRawText(value) {
  return value?.[RAW_TEXT] === true && typeof value.value === 'string'
}

export function unwrapText(value) {
  return isRawText(value) ? value.value : String(value ?? '')
}

/**
 * Localizes only the literal pieces of a UI template. Interpolated resource,
 * user, server, and runtime values are inserted verbatim and the branded
 * result bypasses the element factory's static-copy translation pass.
 */
export function uiText(strings, ...values) {
  let output = ''
  for (let index = 0; index < strings.length; index += 1) {
    output += translateVisibleText(strings[index])
    if (index < values.length) output += unwrapText(values[index])
  }
  return rawText(output)
}

function localizeChild(value) {
  if (isRawText(value)) return value.value
  if (typeof value === 'string') return translateVisibleText(value)
  if (Array.isArray(value)) return value.map(localizeChild)
  return value
}

export function createLocalizedElement(createElement) {
  return (type, props, ...children) => {
    let localizedProps = props
    if (props !== null && props !== undefined) {
      localizedProps = { ...props }
      for (const key of ['title', 'aria-label', 'placeholder', 'alt']) {
        if (isRawText(localizedProps[key])) localizedProps[key] = localizedProps[key].value
        else if (typeof localizedProps[key] === 'string') localizedProps[key] = translateVisibleText(localizedProps[key])
      }
    }
    return createElement(type, localizedProps, ...children.map(localizeChild))
  }
}

export function getClientUiSettings() {
  return { ...current }
}

export function setClientUiSettings(value, { announce = true } = {}) {
  const locale = SUPPORTED_LOCALES.includes(value?.locale) ? value.locale : DEFAULT_UI_SETTINGS.locale
  const numericScale = Number(value?.scale)
  const scale = Number.isFinite(numericScale) && numericScale >= 0.75 && numericScale <= 1.5
    ? Number(numericScale.toFixed(2))
    : DEFAULT_UI_SETTINGS.scale
  current = { locale, scale }
  if (announce && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('dsh-tavern:ui-settings', { detail: getClientUiSettings() }))
  }
  return getClientUiSettings()
}
