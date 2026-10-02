import { createHash, randomUUID } from 'node:crypto'
import { renderSillyTavernMacros } from '../tavern-format/src/index.js'
import { normalizePreset } from './model.js'

const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')
export const textOf = message => (message.content ?? []).filter(b => b.type === 'text').map(b => b.text).join('\n')
const fieldMacros = { description: 'description', personality: 'personality', scenario: 'scenario', mesexamples: 'examples', persona: 'persona', charDescription: 'description', charPersonality: 'personality' }
const markerFields = { charDescription: 'description', charPersonality: 'personality', scenario: 'scenario', dialogueExamples: 'examples', personaDescription: 'persona', userDescription: 'persona', userPersona: 'persona' }
function message(role, text, id) {
  const hex = hash(id)
  const uuid = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`
  return { id: uuid, role, content: [{ type: 'text', text }], source: role === 'assistant' ? { kind: 'model', provider: 'tavern', model: 'assembly' } : { kind: role === 'system' ? 'system-prompt' : 'tavern-assembly' } }
}
function source(kind, id, field) {
  return { plugin: kind === 'native' ? 'DSH' : 'pmp-dsh-tavern', module: kind, resourceId: id ?? null, field, generationRequiresPlugin: kind !== 'native', recordedContentSurvivesRemoval: true }
}

/** Preserve native order and complete tool transactions when inserting depth prompts. */
export function insertionIndex(messages, depth) {
  let index = Math.max(0, messages.length - depth)
  const pending = new Set()
  for (let i = 0; i < index; i++) {
    const m = messages[i]
    for (const b of m.content ?? []) if (b.type === 'tool-call') pending.add(b.id)
    if (m.role === 'tool') pending.delete(m.toolCallId ?? m.source?.callId ?? m.callId)
  }
  while (pending.size && index < messages.length) {
    const m = messages[index++]
    for (const b of m.content ?? []) if (b.type === 'tool-call') pending.add(b.id)
    if (m.role === 'tool') pending.delete(m.toolCallId ?? m.source?.callId ?? m.callId)
  }
  if (pending.size) throw new Error('Cannot insert into an unfinished native tool transaction')
  return index
}

/** Pure request assembly. Persistence and provider serialization remain core-owned. */
export function assembleRequest({ preset: suppliedPreset, assets = {}, nativeMessages = [], inputIds = [], previous = null, snapshots = [], maxBytes = 2 * 1024 * 1024, preview = false }) {
  const preset = normalizePreset(suppliedPreset)
  const data = assets.character?.data ?? {}, selection = assets.characterSelection ?? {}, user = assets.user
  const fields = {
    description: data.description ?? '', personality: data.personality ?? '', scenario: data.scenario ?? '',
    examples: data.messageExample ?? data.mes_example ?? '', persona: user?.description ?? '',
    system: selection.preferCharacterSystemPrompt === false ? '' : data.systemPrompt ?? data.system_prompt ?? '',
    phi: selection.preferCharacterPostHistory === false ? '' : data.postHistoryInstructions ?? data.post_history_instructions ?? '',
  }
  const context = { ...assets.context, user: user?.name ?? assets.context?.user ?? 'User', character: data.nickname || data.name || assets.character?.name || 'Assistant',
    lastUserMessage: textOf(nativeMessages.findLast(m => m.role === 'user' && (m.source?.kind === 'user' || !m.source)) ?? {}),
    lastAssistantMessage: textOf(nativeMessages.findLast(m => m.role === 'assistant') ?? {}),
    ...(preview ? { random: () => 0.5 } : {}),
  }
  const consumed = new Map(), diagnostics = structuredClone(assets.diagnostics ?? []).filter(d => !(preset.placement === 'st' && d.code === 'WORLD_BOOK_POSITION_APPROXIMATED' && d.originalPosition === 'at_depth')), variables = new Map()
  const rules = preset.rules.filter(r => r.enabled)
  const enabled = kind => rules.some(r => r.kind === kind)
  const nodes = [], deferred = [], usedNative = new Set(), claimed = new Set(inputIds)
  const nativeSystem = nativeMessages.filter(m => m.role === 'system')
  const history = nativeMessages.filter(m => m.role !== 'system' && !claimed.has(m.id))
  const input = nativeMessages.filter(m => claimed.has(m.id) && m.role !== 'system')
  const lore = assets.loreEntries ?? []
  const lookupRule = kind => rules.find(r => r.kind === kind)
  const claimField = (key, owner) => consumed.set(key, owner)
  function render(text, owner, children = []) {
    const expanded = String(text ?? '').replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (whole, name) => {
      const key = fieldMacros[name]
      if (!key) return whole
      claimField(key, owner)
      children.push({ id: `${owner}:${key}:${children.length}`, name: key, locked: true, lockReason: `macro:${name}`, source: source(key === 'persona' ? 'user' : 'character', key === 'persona' ? user?.id : assets.character?.id, key), text: fields[key], stability: 'asset', lifetime: 'request' })
      return fields[key]
    })
    const unsupported = [...expanded.matchAll(/\{\{\s*([^{}]+?)\s*\}\}/g)].map(m => m[1]).filter(m => !/^(user|char|lastusermessage|lastcharmessage|trim|random::|roll |setvar::|getvar::|\/\/)/i.test(m))
    for (const macro of unsupported) diagnostics.push({ code: 'UNSUPPORTED_MACRO', macro, owner })
    return renderSillyTavernMacros(expanded, context, variables)
  }
  function add(rule, suffix, raw, src, { role = 'system', depth = rule.depth, locked = false, lockReason = null, children = [], stability = 'asset' } = {}) {
    const id = `${rule.id}:${suffix}`
    const text = render(raw, id, children)
    if (!text) return
    const actualRole = rule.role === 'preserve' ? role : rule.role
    const contentHash = hash({ text, role: actualRole })
    // Deterministic per-content ids let unchanged injected messages retain identity.
    const msg = message(actualRole, text, `tavern-${hash({ id, contentHash }).slice(0, 32)}`)
    const node = { id, ruleId: rule.id, module: rule.kind, name: assets.preset?.prompts?.find(p => `preset:${p.identifier}` === suffix)?.name || (src.module === 'world-book' ? lore.find(e => String(e.uid ?? e.id) === src.field)?.comment : null) || suffix, role: actualRole, text, messages: [msg], source: src, stability: /\{\{\s*(random::|roll |getvar::)/i.test(raw) ? 'evaluation' : /last(user|char)message/i.test(raw) ? 'conversation' : stability,
      lifetime: rule.lifetime, recorded: true, locked, lockReason, children, hash: contentHash, depth,
      changed: previous?.nodes?.find(n => n.id === id)?.hash !== contentHash }
    if (depth !== null && depth !== undefined) deferred.push(node)
    else nodes.push(node)
  }
  function addNative(kind, owner, locked = false) {
    if (!enabled(kind) || usedNative.has(kind)) return
    usedNative.add(kind)
    const messages = kind === 'native-system' ? nativeSystem : kind === 'history' ? history : input
    if (!messages.length) return
    const children = kind === 'native-system' ? (assets.officialSections ?? []).map((section, index) => ({ id: `official:${index}`, name: section.name, text: section.text, locked: true, lockReason: 'native-system-section', source: { plugin: section.plugin ?? section.source?.plugin ?? (section.name === 'rp:policy' || section.name?.startsWith('pmp-dsh-tavern:') ? 'pmp-dsh-tavern' : null), providedBy: 'DSH', section: section.name, generationRequiresPlugin: null, recordedContentSurvivesRemoval: true } }))
      : messages.map(m => ({ id: m.id, name: m.role, text: textOf(m), locked: true, lockReason: 'native-message', source: { plugin: m.source?.plugin ?? 'DSH', sourceKind: m.source?.kind ?? 'unknown', generationRequiresPlugin: Boolean(m.source?.plugin), recordedContentSurvivesRemoval: true } }))
    nodes.push({ id: `${owner}:${kind}`, module: kind, name: kind, role: 'preserve', messages, text: messages.map(textOf).join('\n\n'), source: source('native', null, kind), stability: kind === 'native-system' ? 'assembly' : 'conversation', lifetime: 'native', recorded: true, locked, lockReason: locked ? 'preset:chatHistory' : null, children, hash: hash(messages), changed: previous?.nodes?.find(n => n.module === kind)?.hash !== hash(messages) })
  }
  function addField(rule, key, owner, locked = false) {
    if (consumed.has(key)) return
    claimField(key, owner)
    add(rule, owner, fields[key], source(key === 'persona' ? 'user' : 'character', key === 'persona' ? user?.id : assets.character?.id, key), { locked, lockReason: locked ? `marker:${owner}` : null })
  }
  function addLore(rule, position, owner, locked = false) {
    const key = `lore:${position}`
    if (consumed.has(key)) return
    claimField(key, owner)
    for (const entry of lore.filter(e => (e.position ?? 'after') === position)) {
      const atDepth = preset.placement === 'st' && entry.requestedPosition === 'at_depth'
      add(rule, `worldbook:${entry.id ?? entry.uid}`, entry.content, source('world-book', entry.resourceId, String(entry.uid ?? entry.id)), { stability: entry.constant ? 'asset' : 'conversation', locked, lockReason: locked ? `marker:${owner}` : null, depth: atDepth ? entry.depth ?? 0 : rule.depth, role: entry.role ?? 'system' })
    }
  }
  // Process preset references before fallbacks, irrespective of the fallback's visual position.
  const presetRule = lookupRule('preset')
  const presetNodes = []
  if (presetRule) {
    for (const prompt of assets.preset?.prompts ?? []) {
      if (!prompt.enabled) continue
      const identifier = prompt.identifier, owner = `preset:${identifier}`
      if (prompt.marker) {
        if (preset.placement !== 'st') continue
        if (markerFields[identifier]) addField(presetRule, markerFields[identifier], owner, true)
        else if (identifier === 'chatHistory') { addNative('history', owner, true); addNative('input', owner, true) }
        else if (identifier === 'worldInfoBefore' || identifier === 'worldInfoAfter') { if (enabled('worldbook')) addLore(lookupRule('worldbook'), identifier === 'worldInfoBefore' ? 'before' : 'after', owner, true) }
        else diagnostics.push({ code: 'UNSUPPORTED_MARKER', owner })
        continue
      }
      let raw = prompt.content ?? ''
      if (identifier === 'main' && fields.system && !prompt.st?.forbid_overrides) { raw = fields.system.replace(/\{\{\s*original\s*\}\}/gi, raw); claimField('system', owner) }
      if (identifier === 'jailbreak' && fields.phi && !prompt.st?.forbid_overrides) { raw = fields.phi.replace(/\{\{\s*original\s*\}\}/gi, raw); claimField('phi', owner) }
      const references = [...raw.matchAll(/\{\{\s*(chatHistory|history|input|worldInfoBefore|worldInfoAfter|worldInfo)\s*\}\}/g)]
      if (references.length) {
        let offset = 0
        for (const ref of references) {
          add(presetRule, `${owner}:text:${offset}`, raw.slice(offset, ref.index), source('preset', assets.preset?.id, identifier), { role: prompt.role ?? 'system' })
          if (['chatHistory', 'history'].includes(ref[1])) { addNative('history', owner, true); if (ref[1] === 'chatHistory') addNative('input', owner, true) }
          else if (ref[1] === 'input') addNative('input', owner, true)
          else if (enabled('worldbook')) {
            if (ref[1] !== 'worldInfoAfter') addLore(lookupRule('worldbook'), 'before', owner, true)
            if (ref[1] !== 'worldInfoBefore') addLore(lookupRule('worldbook'), 'after', owner, true)
          }
          offset = ref.index + ref[0].length
        }
        add(presetRule, `${owner}:text:${offset}`, raw.slice(offset), source('preset', assets.preset?.id, identifier), { role: prompt.role ?? 'system' })
        continue
      }
      if (preset.placement !== 'st' && identifier === 'jailbreak' && enabled('phi')) {
        add(lookupRule('phi'), owner, raw, source('preset', assets.preset?.id, identifier), { role: prompt.role ?? 'system' })
        presetNodes.push(...nodes.splice(0)); continue
      }
      add(presetRule, owner, raw, source('preset', assets.preset?.id, identifier), { role: prompt.role ?? 'system', depth: preset.placement === 'st' && prompt.injectionPosition === 1 ? prompt.injectionDepth ?? 0 : presetRule.depth })
    }
  }
  const prebuilt = [...presetNodes, ...nodes.splice(0)]
  for (const rule of rules) {
    if (['native-system', 'history', 'input'].includes(rule.kind)) addNative(rule.kind, rule.id)
    else if (rule.kind === 'preset') nodes.push(...prebuilt.filter(n => n.module !== 'phi'))
    else if (rule.kind === 'persona') addField(rule, 'persona', 'persona')
    else if (rule.kind === 'character') {
      for (const key of ['system', 'description', 'personality', 'scenario', 'examples']) addField(rule, key, key)
      if (assets.includeGreetingReference) {
        const index = selection.greetingIndex ?? 0
        const greeting = index > 0 ? (data.alternateGreetings ?? data.alternate_greetings ?? [])[index - 1] : data.firstMessage ?? data.first_mes
        add(rule, 'greeting', greeting, source('character', assets.character?.id, 'greeting'), { role: 'assistant' })
      }
      const dp = data.extensions?.depth_prompt
      if (dp?.prompt) add(rule, 'depth_prompt', dp.prompt, source('character', assets.character?.id, 'depth_prompt'), { depth: preset.placement === 'st' ? dp.depth ?? 4 : rule.depth, role: dp.role ?? 'system' })
    } else if (rule.kind === 'worldbook') { addLore(rule, 'before', 'worldbook'); addLore(rule, 'after', 'worldbook') }
    else if (rule.kind === 'phi') { nodes.push(...prebuilt.filter(n => n.module === 'phi')); addField(rule, 'phi', 'phi'); add(rule, 'additional-phi', rule.text, source('custom', suppliedPreset.id, rule.id)) }
    else if (rule.kind === 'custom') add(rule, rule.name || 'custom', rule.text, source('custom', suppliedPreset.id, rule.id), { role: 'system' })
  }
  // Resolve placement before lifetime so depth rules and list rules share retention.
  for (const node of deferred) {
    const flat = nodes.flatMap(n => n.messages)
    const nativePositions = flat.flatMap((m, i) => nativeMessages.some(n => n.id === m.id) && m.role !== 'system' ? [i] : [])
    const requested = node.depth === 0 ? flat.length : nativePositions[Math.max(0, nativePositions.length - node.depth)] ?? flat.length
    const index = insertionIndex(flat, flat.length - requested)
    Object.assign(node, { locked: true, lockReason: 'depth', adjustedForTools: index !== requested })
    let offset = 0, inserted = false
    for (let i = 0; i < nodes.length; i++) {
      const current = nodes[i], count = current.messages.length
      if (index >= offset && index <= offset + count) {
        const within = index - offset
        const parts = []
        if (within > 0) parts.push({ ...current, messages: current.messages.slice(0, within), text: current.messages.slice(0, within).map(textOf).join('\n\n') })
        parts.push(node)
        if (within < count) parts.push({ ...current, id: `${current.id}:split:${within}`, messages: current.messages.slice(within), text: current.messages.slice(within).map(textOf).join('\n\n') })
        nodes.splice(i, 1, ...parts); inserted = true; break
      }
      offset += count
    }
    if (!inserted) nodes.push(node)
  }
  // Native markers are nested in the preset output, not dropped from the request.
  let messages = [], expanded = []
  const snapshotRules = rules.filter(r => r.lifetime === 'snapshot')
  const nextSnapshots = snapshots.filter(s => snapshotRules.some(r => r.id === s.ruleId))
  const handledSnapshots = new Set()
  for (const node of nodes) {
    if (node.lifetime === 'snapshot') {
      const rule = snapshotRules.find(r => r.id === node.ruleId)
      handledSnapshots.add(node.id)
      const payload = node.messages, contentHash = node.hash
      const last = nextSnapshots.findLast(s => s.id === node.id)
      if (last?.hash !== contentHash) nextSnapshots.push({ id: node.id, ruleId: rule.id, name: node.name, source: node.source, hash: contentHash, messages: payload.map(m => ({ ...m, id: randomUUID() })), afterId: messages.at(-1)?.id ?? null, nativeAfterId: messages.findLast(m => nativeMessages.some(n => n.id === m.id))?.id ?? null, module: node.module })
      continue
    }
    expanded.push({ ...node, start: messages.length, count: node.messages.length }); messages.push(...node.messages)
  }
  for (const id of new Set(nextSnapshots.map(s => s.id))) {
    if (handledSnapshots.has(id)) continue
    const last = nextSnapshots.findLast(s => s.id === id)
    if (last.hash !== 'empty') nextSnapshots.push({ ...last, hash: 'empty', messages: [message('system', `Current context is empty for entry ${last.name}. Its earlier snapshots are no longer current.`, `tavern-${randomUUID()}`)], afterId: nativeMessages.at(-1)?.id ?? null })
  }
  // Retained snapshots keep their original native-history anchor, before later replies.
  const anchors = new Map()
  for (const snapshot of nextSnapshots) {
    let anchor = snapshot.afterId
    let original = anchor === null ? -1 : messages.findIndex(m => m.id === anchor)
    if (original === -1 && anchor !== null) {
      anchor = snapshot.nativeAfterId ?? null
      original = anchor === null ? -1 : messages.findIndex(m => m.id === anchor)
      if (original === -1 && anchor !== null) { diagnostics.push({ code: 'SNAPSHOT_ANCHOR_NO_LONGER_ACTIVE', id: snapshot.id }); continue }
      diagnostics.push({ code: 'SNAPSHOT_ANCHORED_TO_NATIVE_HISTORY', id: snapshot.id })
    }
    const offset = anchors.get(anchor) ?? 0
    messages.splice(original + 1 + offset, 0, ...snapshot.messages)
    anchors.set(anchor, offset + snapshot.messages.length)
    expanded.push({ id: `${snapshot.id}:retained:${snapshot.messages[0].id}`, ruleId: snapshot.ruleId, module: snapshot.module, name: snapshot.name, source: snapshot.source,
      messages: snapshot.messages, text: snapshot.messages.map(textOf).join('\n\n'), role: snapshot.messages[0]?.role, stability: 'snapshot', lifetime: 'snapshot', recorded: true,
      locked: true, lockReason: 'retained-snapshot', hash: snapshot.hash, children: [] })
  }
  const seenNative = messages.filter(m => nativeMessages.some(n => n.id === m.id)).map(m => m.id)
  const required = nativeMessages.filter(m => enabled(m.role === 'system' ? 'native-system' : claimed.has(m.id) ? 'input' : 'history')).map(m => m.id)
  if (required.length !== seenNative.length || new Set(seenNative).size !== required.length) throw new Error('Assembly must include each enabled native message exactly once')
  const openCalls = new Set()
  for (const msg of messages) {
    if (openCalls.size && msg.role !== 'tool') throw new Error('Assembly cannot split a tool call and its results')
    for (const block of msg.content ?? []) if (block.type === 'tool-call') openCalls.add(block.id)
    if (msg.role === 'tool') {
      const id = msg.toolCallId ?? msg.source?.callId
      if (!openCalls.delete(id)) throw new Error('Tool result must follow its corresponding call')
    }
  }
  if (openCalls.size) throw new Error('Native tool transaction is incomplete')
  const extraBytes = Buffer.byteLength(JSON.stringify(messages.filter(m => !required.includes(m.id))))
  if (extraBytes > maxBytes) throw Object.assign(new Error(`Assembled content exceeds ${maxBytes} bytes`), { status: 413 })
  // Duplicate immutable snapshots can refer to the same content; ids must still be unique per request.
  const ids = new Set()
  messages = messages.map(m => { if (!ids.has(m.id)) { ids.add(m.id); return m }; return { ...m, id: randomUUID() } })
  expanded = expanded.map(node => ({ ...node, start: messages.findIndex(m => m.id === (node.messages?.[0]?.id)), count: node.messages?.length ?? node.count })).sort((a, b) => a.start - b.start)
  return { messages, nodes: expanded.map(({ messages: omitted, ...node }) => node), snapshots: nextSnapshots,
    diagnostics, extraBytes, preset: { id: suppliedPreset.id ?? null, name: preset.name, revision: hash(preset) },
    preview, toolsSeparate: true, evaluatedAt: 'request-assembly', compatibility: preset.placement === 'st' ? 'ST ordering, roles, supported macros and depths; not full ST runtime parity' : null }
}
