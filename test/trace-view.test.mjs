import test from 'node:test'
import assert from 'node:assert/strict'
import { TraceRecordContent } from '../packages/tavern-trace/src/client.js'
import { setClientUiSettings } from '../packages/client/src/i18n.js'

// Resolve the hook-free record body, including localized child components.
function tree(value) {
  if (Array.isArray(value)) return value.flatMap(item => { const next = tree(item); return Array.isArray(next) ? next : [next] }).filter(v => v != null && v !== false)
  if (value == null || typeof value !== 'object') return value
  if (typeof value.type === 'function') return tree(value.type(value.props))
  return { type: value.type, props: value.props, children: tree([value.props.children]) }
}
function text(node, visible = false) {
  if (Array.isArray(node)) return node.map(n => text(n, visible)).join(' ')
  if (node == null || node === false) return ''
  if (typeof node !== 'object') return String(node)
  const children = visible && node.type === 'details' && !node.props.open
    ? node.children.filter(child => child?.type === 'summary') : node.children
  return text(children, visible)
}
function body(record, locale = 'zh-CN') {
  setClientUiSettings({ locale, scale: 1 }, { announce: false })
  return tree(TraceRecordContent({ record }))
}
const record = {
  schemaVersion: 3, contentStatus: 'available', selection: { presetId: 'p', characterCardId: 'c', userId: 'u', character: { greetingIndex: 2 } },
  audit: {
    resources: { preset: { id: 'p', name: 'Historical preset' }, characterCard: { id: 'c', name: 'Historical card' },
      userProfile: { id: 'u', name: 'Historical user' }, worldBooks: [{ id: 'w', name: 'Historical lore' }] },
    assembly: { systemPromptMode: 'append', callConfig: { temperature: 0.7, maxTokens: 1024 } },
    worldBooks: [{ resource: { id: 'w', name: 'Historical lore' }, budget: { used: 3, limit: 10 }, decisions: [{
      entryId: 'entry', entryName: 'Castle', decision: 'included', reason: 'primary-key-match',
      primaryKeys: ['castle'], primaryMatches: ['castle'], probability: null, tokenCost: 3,
    }] }],
  },
  delivery: { provider: 'fixture', model: 'model', assemblyVerified: true },
  sections: [{ index: 0, name: 'preset:main', characters: 11, text: '<script>BODY</script>', hash: 'hash', provenance: 'section-contributors',
    sources: [{ kind: 'preset', resourceId: 'p', field: 'main', text: 'INPUT', characters: 5 }] }],
  contexts: [], systemMessages: ['ACTUAL SYSTEM'],
}

test('Trace leads with captured configuration and keeps lore and assembler details collapsed', () => {
  const result = body(record)
  const visible = text(result, true)
  for (const value of ['本次配置', 'Historical preset', 'Historical card', 'Historical user', 'Historical lore', 'fixture / model', 'temperature: 0.7', '1024', '保存的开场序号：2']) assert.ok(visible.includes(value), value)
  assert.ok(!visible.includes('<script>BODY</script>'))
  assert.ok(!visible.includes('ACTUAL SYSTEM'))
  assert.ok(!visible.includes('Castle'))
  const disclosures = result.children.filter(child => child.type === 'details')
  assert.deepEqual(disclosures.map(d => text(d.children[0])), ['世界书触发情况', 'assembler 装配情况'])
  assert.ok(disclosures.every(d => !d.props.open))
  assert.ok(text(disclosures[0]).includes('Castle'))
  assert.ok(text(disclosures[0]).includes('主关键词命中'))
  assert.ok(text(disclosures[1]).includes('<script>BODY</script>'))
  assert.ok(text(disclosures[1]).includes('INPUT'))
  assert.ok(text(disclosures[1]).includes('ACTUAL SYSTEM'))
})

test('legacy audit keeps its configuration and world-book decisions without invented assembly bodies', () => {
  const result = body({ contentStatus: 'legacy-metadata-only', audit: record.audit })
  assert.ok(text(result, true).includes('Historical preset'))
  assert.ok(text(result).includes('Castle'))
  assert.ok(text(result).includes('未保存装配正文'))
  assert.ok(!text(result).includes('ACTUAL SYSTEM'))
})

test('omitted records distinguish unrecorded resources from explicitly unused resources', () => {
  const unavailable = text(body({ contentStatus: 'omitted-size-limit' }), true)
  assert.ok(unavailable.includes('未记录'))
  assert.ok(!unavailable.includes('未使用'))
  const unused = text(body({ audit: { resources: { preset: null, characterCard: null, userProfile: null, worldBooks: [] }, worldBooks: [] } }), true)
  assert.ok(unused.includes('未使用'))
})

test('configuration and collapsed detail labels also render in English', () => {
  const visible = text(body(record, 'en'), true)
  for (const label of ['Configuration for this request', 'World-book activation', 'Assembler assembly', 'Tavern sampling configuration']) assert.ok(visible.includes(label), label)
})

test('reference-backed records keep configuration visible and explain partial body availability', () => {
  const result = body({
    ...record,
    schemaVersion: 4,
    bodyStorage: 'official-session',
    sourceTextStored: false,
    contentStatus: 'partially-available',
    referenceError: 'event-unavailable',
    sections: [
      { ...record.sections[0], contentStatus: 'available', sources: [{
        kind: 'preset', relationship: 'input', resourceId: 'p', resourceRevision: 'r1', field: 'main',
        requestedRole: 'system', identifier: 'main', characters: 5, hash: 'source-hash', textStatus: 'not-stored',
      }] },
      { index: 1, name: 'character:description', characters: 12, hash: 'missing-hash', provenance: 'section-contributors',
        contentStatus: 'reference-unavailable', referenceError: 'hash-mismatch', sources: [] },
    ],
    systemMessages: undefined,
  })
  const visible = text(result, true)
  assert.ok(visible.includes('Historical preset'))
  assert.ok(visible.includes('部分正文引用不可用'))
  assert.ok(visible.includes('官方日志引用'))
  const all = text(result)
  assert.ok(all.includes('<script>BODY</script>'))
  assert.ok(all.includes('正文摘要校验失败'))
  assert.ok(all.includes('来源原文未由 Tavern 保存'))
  assert.ok(all.includes('请求的 ST 角色：system'))
  assert.ok(all.includes('并非实际 DSH 消息角色'))
  assert.ok(all.includes('identifier=main'))
  assert.ok(all.includes('source-hash'))
  assert.ok(all.includes('引用的事件不可用'))
  assert.ok(all.includes('未显示正文不代表当时没有提示词'))
  assert.ok(!all.includes('undefined'))
  assert.ok(!all.includes('INPUT'))
})

test('fully unavailable reference bodies render reasons without undefined pre blocks', () => {
  const result = body({
    schemaVersion: 4,
    bodyStorage: 'official-session',
    contentStatus: 'reference-unavailable',
    referenceError: 'history-unavailable',
    audit: record.audit,
    sections: [{ index: 0, name: 'preset:main', characters: 11, hash: 'hash', provenance: 'section-contributors',
      contentStatus: 'reference-unavailable', referenceError: 'history-unavailable', sources: [] }],
    contexts: [],
  })
  const all = text(result)
  assert.ok(all.includes('正文引用不可用'))
  assert.ok(all.includes('会话历史不可用'))
  assert.ok(all.includes('Historical preset'))
  assert.ok(!all.includes('undefined'))
  const preBodies = []
  const visit = node => {
    if (Array.isArray(node)) return node.forEach(visit)
    if (!node || typeof node !== 'object') return
    if (node.type === 'pre') preBodies.push(text(node))
    visit(node.children)
  }
  visit(result)
  assert.ok(preBodies.every(value => value !== 'undefined'))
})

test('schema-3 body copies are identified as historical snapshots', () => {
  const result = body(record)
  const all = text(result)
  assert.ok(all.includes('旧版记录中保存的历史正文快照'))
  assert.ok(all.includes('<script>BODY</script>'))
  assert.ok(all.includes('INPUT'))
  assert.ok(!text(result, true).includes('正文引用已解析'))
})

test('world-book activation candidates are separate from verified request policy skips, including old reasonless diagnostics',()=>{
 const same={...record,schemaVersion:4,status:'request-observed',turn:5,step:0,requestAssembly:{turn:5,step:0,metadata:{owner:'pmp-dsh-tavern',assembly:{nodes:[],diagnostics:[{code:'WORLD_BOOK_POLICY_SKIPPED',resourceId:'world-book:w'}]}}}}
 let all=text(body(same))
 assert.ok(all.includes('激活候选'));assert.ok(all.includes('策略跳过'));assert.ok(all.includes('具体原因未记录'));assert.ok(!all.includes('已插入'));assert.ok(!all.includes('已进入请求'))
 same.requestAssembly.metadata.assembly.diagnostics[0].reason='config-unavailable'
 all=text(body(same));assert.ok(all.includes('config-unavailable'));assert.ok(!all.includes('具体原因未记录'))
 const en=text(body(same,'en'));assert.ok(en.includes('Activation candidate'));assert.ok(en.includes('Skipped by policy'))
 for(const change of [value=>{delete value.requestAssembly},value=>{value.requestAssembly.turn++},value=>{value.requestAssembly.metadata.owner='other'},value=>{value.requestAssembly.metadata.assembly.preview=true},value=>{value.requestAssembly.metadata.assembly.diagnostics[0].resourceId='world-book:other'}]){
  const bad=structuredClone(same);change(bad);const output=text(body(bad));assert.ok(!output.includes('策略跳过'));assert.ok(output.includes('最终使用情况未记录'))
 }
})

test('world-book applied display requires the same observed request source diagnostic and matching node',()=>{
 const same={...record,schemaVersion:4,status:'request-observed',turn:5,step:0,requestAssembly:{turn:5,step:0,metadata:{owner:'pmp-dsh-tavern',assembly:{nodes:[{id:'worldbook:block',source:{sourceId:'worldbook',resourceId:'w'}}],diagnostics:[{code:'TAVERN_MEMORY_RESOURCE_VERSION',adapterId:'tavern.world-books',sourceId:'worldbook',resourceId:'world-book:w',blockResourceId:'w',blockId:'block'}]}}}}
 assert.ok(text(body(same)).includes('已进入请求'))
 for(const change of [value=>{value.status='assembled'},value=>{value.requestAssembly.metadata.assembly.nodes=[]},value=>{value.requestAssembly.metadata.assembly.diagnostics=[]},value=>{value.requestAssembly.metadata.assembly.nodes[0].source.resourceId='different'}]){
  const bad=structuredClone(same);change(bad);assert.ok(!text(body(bad)).includes('已进入请求'))
 }
})

test('world-book request correlation refuses duplicate or truncated audit IDs and preserves dependency application',()=>{
 const make=()=>({...record,status:'request-observed',turn:5,step:0,requestAssembly:{turn:5,step:0,metadata:{owner:'pmp-dsh-tavern',assembly:{nodes:[],diagnostics:[{code:'WORLD_BOOK_POLICY_SKIPPED',resourceId:'world-book:w'}]}}}})
 const duplicate=make();duplicate.audit=structuredClone(record.audit);duplicate.audit.worldBooks.push(duplicate.audit.worldBooks[0]);assert.ok(!text(body(duplicate)).includes('策略跳过'))
 const clipped=make();clipped.audit=structuredClone(record.audit);clipped.audit.worldBooks[0].resource.id='w…';clipped.requestAssembly.metadata.assembly.diagnostics[0].resourceId='world-book:w…';assert.ok(!text(body(clipped)).includes('策略跳过'))
 const dependency=make();dependency.requestAssembly.metadata.assembly.nodes=[{id:'template:block',source:{sourceId:'prompt-template',resourceId:'prompt-template:fixture'}}]
 dependency.requestAssembly.metadata.assembly.diagnostics.push({code:'TAVERN_MEMORY_DEPENDENCY_VERSION',adapterId:'tavern.world-books',resourceId:'world-book:w',sourceId:'prompt-template',consumerId:'prompt-template:fixture',blockId:'block'})
 const output=text(body(dependency));assert.ok(output.includes('已进入请求'));assert.ok(output.includes('策略跳过'))
})

test('Assembler trace displays frozen core messages and filters stale history provenance', () => {
  const messages = [{ id: 'system', role: 'system', content: [{ type: 'text', text: 'FINAL SYSTEM' }] },
    { id: 'history', role: 'user', content: [{ type: 'text', text: 'FILTERED HISTORY' }] },
    { id: 'input', role: 'user', content: [{ type: 'text', text: 'ACTUAL INPUT' }] }]
  const value = { ...record, turn: 2, step: 0, requestContentStatus: 'available', requestAssembly: { turn: 2, step: 0, messages,
    metadata: { owner: 'dsh-prompt-assembler', assembly: { diagnostics: [{ code: 'RECORDED_DIAGNOSTIC' }], nodes: [
      { id: 'preset:main', name: 'Readable saved preset title', role: 'system', text: 'FINAL SYSTEM', source: { field: 'main' } },
      { id: 'history', name: 'user', role: 'user', messages: [{ ...messages[1], content: [{ type: 'text', text: 'STALE BEFORE FILTER' }] }], text: 'STALE BEFORE FILTER' },
    ] }, historyPolicy: { decisions: [{ action: 'replace', messageId: 'history' }] } } } }
  const output = text(body(value))
  for (const part of ['FINAL SYSTEM', 'FILTERED HISTORY', 'ACTUAL INPUT', 'Readable saved preset title', '当次历史过滤结果', 'RECORDED_DIAGNOSTIC', '装配阶段的系统段落与上下文']) assert.ok(output.includes(part), part)
  assert.ok(!output.includes('STALE BEFORE FILTER'))
  assert.ok(!text(body(value), true).includes('ACTUAL INPUT'))
  for (const change of [v => v.requestAssembly.turn++, v => v.requestAssembly.metadata.assembly.preview = true, v => v.requestContentStatus = 'reference-unavailable']) {
    const unavailable = structuredClone(value); change(unavailable)
    const result = text(body(unavailable)); assert.ok(result.includes('没有可核验的完整请求')); assert.ok(!result.includes('ACTUAL INPUT'))
  }
})

test('native Trace uses per-record verified provenance and explicitly labels current or missing names', () => {
  const value = { ...record, schemaVersion: 4, nativeRequest: { messages: [{ id: 'native', role: 'user', content: [{ type: 'text', text: 'NATIVE FINAL INPUT' }] }], metadata: { backend: 'native' } },
    nativeProvenance: { nodes: [
      { id: 'named', name: 'Saved custom item', sourceStatus: 'recorded', role: 'system', text: 'SAVED BODY', source: { resourceId: 'p', field: 'main' } },
      { id: 'current', name: 'Current friendly name', sourceStatus: 'current-name', role: 'system', text: 'OLD BODY', source: { resourceId: 'p', field: 'extra' } },
      { id: 'unknown', name: 'source-unrecorded', sourceStatus: 'unrecorded', role: 'system', text: 'UNKNOWN BODY' },
      { id: 'unnamed', name: 'preset:opaque-id', sourceStatus: 'name-unrecorded', role: 'system', text: 'UNNAMED BODY', source: { field: 'opaque-id' } },
    ], diagnostics: [] } }
  const all = text(body(value))
  for (const part of ['NATIVE FINAL INPUT', 'Saved custom item', 'Current friendly name', '名称来自当前预设；正文来自当时请求', '来源未记录', '当时的条目名称未记录', '来源条目 4']) assert.ok(all.includes(part), part)
  assert.ok(!all.includes('preset:opaque-id'))
  const sources = body(value).children.find(n => n.type === 'details' && text(n.children[0]).includes('assembler')).children.find(n => n.type === 'div').children.find(n => n.props?.['data-trace-request']).children.find(n => n.type === 'details' && text(n.children[0]).includes('当时的来源'))
  assert.ok(text(sources.children[2], true).includes('名称来自当前预设'))
  value.nativeProvenance.nodes[0].name = 'preset:My literal title'
  assert.ok(text(body(value)).includes('preset:My literal title'))
  const en = text(body(value, 'en')); assert.ok(en.includes('Source not recorded')); assert.ok(en.includes('Name from the current preset; body from the recorded request.'))
})

test('world-book evidence accepts current Assembler ownership without weakening legacy checks', () => {
  const value = { ...record, status: 'request-observed', turn: 1, step: 0, requestAssembly: { turn: 1, step: 0,
    metadata: { owner: 'dsh-prompt-assembler', assembly: { nodes: [], diagnostics: [{ code: 'WORLD_BOOK_POLICY_SKIPPED', resourceId: 'world-book:w', reason: 'disabled' }] } } } }
  assert.ok(text(body(value)).includes('策略跳过'))
  value.requestAssembly.metadata.owner = 'unrelated'
  assert.ok(!text(body(value)).includes('策略跳过'))
})

test('expanding assembly exposes every message card in request order without a second list disclosure', () => {
  const messages = [
    { id: 's', role: 'system', content: [{ type: 'text', text: 'SYSTEM' }] },
    { id: 'u', role: 'user', content: [{ type: 'text', text: 'USER' }] },
    { id: 'a', role: 'assistant', content: [{ type: 'tool-call', id: 'call', name: 'probe', arguments: '{}' }] },
    { id: 't', role: 'tool', content: [{ type: 'text', text: 'TOOL RESULT' }] },
  ]
  const value = { nativeRequest: { messages }, nativeProvenance: { nodes: [
    { id: 'preset', name: 'Saved readable name', role: 'system', sourceStatus: 'recorded', reference: { messageId: 's' }, text: 'SYSTEM' },
    { id: 'unmapped', name: 'Unmapped source', role: 'user', text: 'USER' },
  ], diagnostics: [] } }
  const find = (node, predicate) => Array.isArray(node) ? node.flatMap(n => find(n, predicate))
    : !node || typeof node !== 'object' ? [] : [...predicate(node) ? [node] : [], ...find(node.children, predicate)]
  const result = body(value)
  const cards = find(result, node => node.props['data-message-index'] !== undefined)
  assert.equal(cards.length, 4)
  assert.deepEqual(cards.map(card => card.props['data-role']), ['system', 'user', 'assistant', 'tool'])
  assert.deepEqual(cards.map(card => text(card.children[0]).split(' ').slice(0,3).join(' ')), ['1 · system', '2 · user', '3 · assistant', '4 · tool'])
  assert.ok(text(cards[0], true).includes('Saved readable name'))
  assert.ok(!text(cards[1], true).includes('Unmapped source'), 'matching body text does not establish source coordinates')
  assert.ok(text(cards[2]).includes('tool-call')); assert.ok(text(cards[2]).includes('probe'))
  assert.ok(text(cards[3]).includes('TOOL RESULT'))
  const list = find(result, node => node.props.className === 'dttrace-messages')[0]
  const overview = text(list, true)
  for (const role of ['system','user','assistant','tool']) assert.ok(overview.includes(role), role)
  assert.ok(!overview.includes('TOOL RESULT'), 'individual bodies remain expandable')
  assert.ok(!find(result, node => node.type === 'details').some(node => text(node.children[0]).includes('发送时的完整消息顺序')))
})
