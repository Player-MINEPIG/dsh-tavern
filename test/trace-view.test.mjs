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
  contentStatus: 'available', selection: { presetId: 'p', characterCardId: 'c', userId: 'u', character: { greetingIndex: 2 } },
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

test('Trace leads with captured configuration and keeps lore and loader details collapsed', () => {
  const result = body(record)
  const visible = text(result, true)
  for (const value of ['本次配置', 'Historical preset', 'Historical card', 'Historical user', 'Historical lore', 'fixture / model', 'temperature: 0.7', '1024', '保存的开场序号：2']) assert.ok(visible.includes(value), value)
  assert.ok(!visible.includes('<script>BODY</script>'))
  assert.ok(!visible.includes('ACTUAL SYSTEM'))
  assert.ok(!visible.includes('Castle'))
  const disclosures = result.children.filter(child => child.type === 'details')
  assert.deepEqual(disclosures.map(d => text(d.children[0])), ['世界书触发情况', 'Loader 装配情况'])
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
  for (const label of ['Configuration for this request', 'World-book activation', 'Loader assembly', 'Tavern sampling configuration']) assert.ok(visible.includes(label), label)
})
