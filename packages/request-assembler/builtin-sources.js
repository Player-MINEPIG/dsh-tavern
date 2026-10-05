import { RequestSourceRegistry } from './registry.js'
const textOf = m => (m.content ?? []).filter(b => b.type === 'text').map(b => b.text).join('\n')
const text = (id, value, extra = {}) => ({ type: 'text', id, text: value ?? '', ...extra })
const ref = (id, sourceId, blockIds, extra = {}) => ({ type: 'reference', id, sourceId, blockIds, ...extra })
function references(blocks, id, name) {
  if (['chatHistory', 'history'].includes(name)) { blocks.push(ref(`${id}:history`, 'history', undefined, { owner: id })); if (name === 'chatHistory') blocks.push(ref(`${id}:input`, 'input', undefined, { owner: id })) }
  else if (name === 'input') blocks.push(ref(`${id}:input`, 'input', undefined, { owner: id }))
  else { if (name !== 'worldInfoAfter') blocks.push(ref(`${id}:before`, 'worldbook', undefined, { group: 'before', owner: id })); if (name !== 'worldInfoBefore') blocks.push(ref(`${id}:after`, 'worldbook', undefined, { group: 'after', owner: id })) }
}
// Tavern-authored text uses one reference parser, whether supplied by a preset
// or a custom rule. Source resolvers still own their own compilation semantics.
function tavernText(blocks, id, raw, extra) {
  const matches = [...raw.matchAll(/\{\{\s*(chatHistory|history|input|worldInfoBefore|worldInfoAfter|worldInfo)\s*\}\}/g)]
  if (!matches.length) { blocks.push(text(id, raw, extra)); return }
  let offset = 0
  for (const match of matches) {
    blocks.push(text(`${id}:text:${offset}`, raw.slice(offset, match.index), extra))
    references(blocks, `${id}:${offset}`, match[1]); offset = match.index + match[0].length
  }
  blocks.push(text(`${id}:text:${offset}`, raw.slice(offset), extra))
}
function characterFields(assets) {
  const data = assets.character?.data ?? {}, selection = assets.characterSelection ?? {}
  return { description: data.description ?? '', personality: data.personality ?? '', scenario: data.scenario ?? '', examples: data.messageExample ?? data.mes_example ?? '',
    system: selection.preferCharacterSystemPrompt === false ? '' : data.systemPrompt ?? data.system_prompt ?? '',
    phi: selection.preferCharacterPostHistory === false ? '' : data.postHistoryInstructions ?? data.post_history_instructions ?? '' }
}
const native = (id, name) => ({ id, pluginId: 'DSH', name, roles: ['preserve'], lifetimes: ['request'], depth: false, generationRequiresPlugin: false, stability: id === 'native-system' ? 'assembly' : 'conversation', resolve(context) {
  const claimed = new Set(context.inputIds)
  const messages = context.nativeMessages.filter(m => id === 'native-system' ? m.role === 'system' : m.role !== 'system' && (id === 'input' ? claimed.has(m.id) : !claimed.has(m.id)))
  const children = id === 'native-system' ? (context.assets.officialSections ?? []).map((s, i) => ({ id: `official:${i}`, name: s.name, text: s.text, locked: true, lockReason: 'native-system-section', source: { plugin: s.plugin ?? s.source?.plugin ?? (s.name === 'rp:policy' || s.name?.startsWith('pmp-dsh-tavern:') ? 'pmp-dsh-tavern' : null), providedBy: 'DSH', section: s.name, generationRequiresPlugin: null, recordedContentSurvivesRemoval: true } }))
    : messages.map(m => ({ id: m.id, name: m.role, text: textOf(m), locked: true, lockReason: 'native-message', source: { plugin: m.source?.plugin ?? 'DSH', sourceKind: m.source?.kind ?? 'unknown', generationRequiresPlugin: Boolean(m.source?.plugin), recordedContentSurvivesRemoval: true } }))
  if (id !== 'native-system') return { blocks: [{ type: 'native', id, messageIds: messages.map(m => m.id), children }] }
  const enabled = kind => !context.preset.rules.some(rule => rule.kind === kind) || context.preset.rules.some(rule => rule.kind === kind && rule.enabled)
  const included = m => m.role !== 'system' && enabled(claimed.has(m.id) ? 'input' : 'history')
  return { blocks: messages.map((message, index) => {
    const nativeIndex = context.nativeMessages.indexOf(message)
    // An empty native head may have been filtered out: even the first visible
    // system is an update when conversation messages precede it.
    const followsConversation = context.nativeMessages.slice(0, nativeIndex).some(included)
    return { type: 'native', id: index === 0 ? id : `${id}:${message.id}`, messageIds: [message.id],
      ...(followsConversation ? { depth: context.nativeMessages.slice(nativeIndex + 1).filter(included).length } : {}),
      children: index === messages.length - 1 ? children : [],
    }
  }) }
} })
/** No privileged registration path: these descriptors also serve the public UI catalog. */
export function registerBuiltinSources(registry, { worldbookPolicy, worldbookValidateResolved } = {}) {
  const dispose = [], register = source => dispose.push(registry.register({ pluginId: 'pmp-dsh-tavern', stability: 'asset', ...source }))
  for (const [id, name] of [['native-system', '官方基础指令'], ['history', '原生历史'], ['input', '本步输入']]) register(native(id, name))
  register({ id: 'character', name: '角色卡', resolve({ assets, preset, nativeMessages }, rule) {
    const fields = characterFields(assets), data = assets.character?.data ?? {}, selection = assets.characterSelection ?? {}
    const blocks = Object.entries(fields).map(([id, value]) => text(id, value, { referenceOnly: id === 'phi', source: { resourceId: assets.character?.id, field: id } }))
    // The opening assistant reference precedes the conversation even when a
    // preset's chatHistory marker has already claimed history/current input.
    // Use the existing depth placement so it cannot split a tool transaction.
    if (assets.includeGreetingReference) { const i = selection.greetingIndex ?? 0; blocks.push(text('greeting', i > 0 ? (data.alternateGreetings ?? data.alternate_greetings ?? [])[i - 1] : data.firstMessage ?? data.first_mes, { role: 'assistant', depth: rule.depth ?? Math.max(1, nativeMessages.filter(m => m.role !== 'system').length), source: { resourceId: assets.character?.id, field: 'greeting' } })) }
    const dp = data.extensions?.depth_prompt
    if (dp?.prompt) blocks.push(text('depth_prompt', dp.prompt, { role: dp.role ?? 'system', depth: dp.depth ?? 4, source: { resourceId: assets.character?.id, field: 'depth_prompt' } }))
    return { blocks, macros: { description: 'description', personality: 'personality', scenario: 'scenario', mesexamples: 'examples', charDescription: 'description', charPersonality: 'personality' } }
  } })
  register({ id: 'persona', name: '用户设定', resolve: ({ assets }) => ({ blocks: [text('persona', assets.user?.description, { source: { resourceId: assets.user?.id, field: 'persona' } })], macros: { persona: 'persona' } }) })
  register({ id: 'worldbook', name: '世界书', stability: 'conversation', validateResolved: worldbookValidateResolved, resolve: context => { const { assets, preset } = context; const output = { blocks: (assets.loreEntries ?? []).map(e => text(`worldbook:${e.id ?? e.uid}`, e.content, {
    name: e.comment || `worldbook:${e.id ?? e.uid}`, group: e.position ?? 'after', stability: e.constant ? 'asset' : 'conversation', role: e.role ?? 'system',
    ...(e.requestedPosition === 'at_depth' ? { depth: e.depth ?? 0 } : {}), source: { resourceId: e.resourceId, field: String(e.uid ?? e.id) },
  })) }; return worldbookPolicy ? worldbookPolicy(context, output) : output } })
  register({ id: 'preset', name: '预设正文', lifetimes: ['request'], dependencies: ['character', 'persona', 'history', 'input', 'worldbook'], resolve({ assets, preset }) {
    const blocks = [], diagnostics = [], fields = characterFields(assets)
    const markerFields = { charDescription: ['character', 'description'], charPersonality: ['character', 'personality'], scenario: ['character', 'scenario'], dialogueExamples: ['character', 'examples'], personaDescription: ['persona', 'persona'], userDescription: ['persona', 'persona'], userPersona: ['persona', 'persona'] }
    for (const p of assets.preset?.prompts ?? []) {
      if (!p.enabled) continue
      const id = `preset:${p.identifier}`
      if (p.marker) {
        if (markerFields[p.identifier]) { const [sourceId, field] = markerFields[p.identifier]; blocks.push(ref(id, sourceId, [field], { honorEnabled: false, useOwnerRule: true, owner: id })) }
        else if (['chatHistory', 'worldInfoBefore', 'worldInfoAfter'].includes(p.identifier)) references(blocks, id, p.identifier)
        else diagnostics.push({ code: 'UNSUPPORTED_MARKER', owner: id })
        continue
      }
      let raw = p.content ?? '', claims = []
      const field = p.identifier === 'main' ? 'system' : p.identifier === 'jailbreak' ? 'phi' : null
      if (field && fields[field] && !p.st?.forbid_overrides) { raw = fields[field].replace(/\{\{\s*original\s*\}\}/gi, raw); claims.push({ sourceId: 'character', blockId: field }) }
      const src = { resourceId: assets.preset?.id, field: p.identifier }
      const toPhi = preset.placement !== 'st' && p.identifier === 'jailbreak' && preset.rules.some(r => r.kind === 'phi' && r.enabled)
      tavernText(blocks, id, raw, { name: p.name, role: p.role, source: src, claims, ...(toPhi ? { targetSourceId: 'phi' } : {}), ...(p.injectionPosition === 1 ? { depth: p.injectionDepth ?? 0, order: p.injectionOrder ?? p.st?.injection_order ?? 100 } : {}) })
    }
    return { blocks, diagnostics }
  } })
  register({ id: 'phi', name: '后置指令（PHI）', dependencies: ['character'], resolve: (_, rule) => ({ blocks: [ref('phi', 'character', ['phi'], { honorEnabled: false, useOwnerRule: true, lock: false, owner: 'phi' }), text('additional-phi', rule.text, { source: { field: rule.id } })] }) })
  register({ id: 'custom', name: '自定义内容', roles: ['user', 'system', 'assistant'], multiple: true, dependencies: ['character', 'persona', 'history', 'input', 'worldbook'], resolve: (_, rule) => {
    const blocks = []
    tavernText(blocks, rule.name || 'custom', rule.text, { source: { field: rule.id } })
    return { blocks }
  } })
  return () => dispose.reverse().forEach(fn => fn())
}
export function createDefaultRegistry(options) { const registry = new RequestSourceRegistry(); registerBuiltinSources(registry, options); return registry }
