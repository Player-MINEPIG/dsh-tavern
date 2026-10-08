import { MODULE_ORDER } from './fixtures/assembly-references.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { assembleRequest, textOf } from '../packages/request-assembler/assemble.js'
import { BUILTINS, normalizePreset, moveRule } from '../packages/request-assembler/model.js'
import { AssemblyPresetStore } from '../packages/request-assembler/store.js'
import { defaultAssemblyFailureInput } from './fixtures/default-assembly-failure.mjs'
const m = (id, role = 'user', text = id) => ({ id, role, source: { kind: role === 'user' ? 'user' : 'model' }, content: [{ type: 'text', text }] })
const native = [m('s', 'system'), m('u1'), m('a1', 'assistant'), m('u2')]
const assets = { character: { id: 'card', data: { description: 'CHAR', post_history_instructions: 'PHI' } }, preset: { id: 'preset', prompts: [{ identifier: 'main', enabled: true, role: 'system', content: 'MAIN' }] }, loreEntries: [{ id: 'w1', content: 'LORE', position: 'after', resourceId: 'book' }] }
const snapshotPreset = { ...MODULE_ORDER, name: 'Snapshot fixture', rules: MODULE_ORDER.rules.map(r => r.kind === 'worldbook' ? { ...r, lifetime: 'snapshot' } : r) }
const texts = result => result.messages.map(textOf)

test('first-turn greeting precedes marker-owned input and retains trailing depth lore', () => {
  const input = defaultAssemblyFailureInput()
  const original = structuredClone(input.nativeMessages)
  const result = assembleRequest({ preset: BUILTINS[0], ...input })
  assert.deepEqual(texts(result), ['official', 'MAIN', 'BEFORE_0', 'BEFORE_1', 'BEFORE_2', 'BEFORE_3',
    'LORE_BEFORE_0', 'LORE_BEFORE_1', 'LORE_BEFORE_2', 'BEFORE_INPUT', 'GREETING', 'input', 'context',
    ...Array.from({ length: 15 }, (_, i) => `AFTER_${i}`), 'LORE_DEPTH_0', 'LORE_DEPTH_1', 'LORE_DEPTH_2'])
  assert.equal(result.messages[10].role, 'assistant')
  assert.ok(result.messages.slice(-3).every(m => m.role === 'system'))
  assert.deepEqual(input.nativeMessages, original)
  assert.equal(result.nodes.find(n => n.id === 'character:greeting').start, 10)
  for (const preset of BUILTINS) {
    const assembled = assembleRequest({ preset, ...input })
    assert.ok(texts(assembled).indexOf('GREETING') < texts(assembled).indexOf('input'))
    assert.equal(texts(assembled).filter(t => t === 'GREETING').length, 1)
  }
})

test('cache layout wraps intact native history with current lore and PHI, without duplicating history', () => {
  const result = assembleRequest({ preset: MODULE_ORDER, nativeMessages: native, inputIds: ['u2'], assets })
  assert.deepEqual(texts(result), ['s', 'MAIN', 'CHAR', 'u1', 'a1', 'u2', 'LORE', 'PHI'])
  assert.equal(result.snapshots.length, 0)
  assert.deepEqual(native.map(textOf), ['s', 'u1', 'a1', 'u2'])
  const next = assembleRequest({ preset: MODULE_ORDER, nativeMessages: [...native, m('a2', 'assistant'), m('u3')], inputIds: ['u3'], assets: { ...assets, loreEntries: [] }, previous: result })
  assert.ok(!texts(next).includes('LORE'))
  assert.equal(next.nodes.find(n => n.name === 'description').changed, false)
})
test('ST history marker owns native blocks and authored role/depth is executed', () => {
  const result = assembleRequest({ preset: BUILTINS[0], nativeMessages: native, inputIds: ['u2'], assets: { preset: { prompts: [
    { identifier: 'main', enabled: true, role: 'user', content: 'MAIN' },
    { identifier: 'chatHistory', enabled: true, marker: true },
    { identifier: 'depth', enabled: true, content: 'DEPTH', role: 'assistant', injectionPosition: 1, injectionDepth: 1 },
    { identifier: 'jailbreak', enabled: true, content: 'PHI', role: 'system' },
  ] } } })
  assert.deepEqual(texts(result), ['s', 'MAIN', 'u1', 'a1', 'DEPTH', 'u2', 'PHI'])
  assert.equal(result.messages[1].role, 'user'); assert.equal(result.messages[4].role, 'assistant')
  assert.ok(result.nodes.some(n => n.module === 'history' && n.locked))
})
test('macro references consume fallback fields and expose locked source children', () => {
  const result = assembleRequest({ preset: { ...MODULE_ORDER, rules: MODULE_ORDER.rules.filter(r => r.kind !== 'character') }, nativeMessages: native, assets: { ...assets, preset: { prompts: [{ enabled: true, identifier: 'main', content: 'Before {{description}} after {{lastusermessage}}' }] } } })
  assert.equal(texts(result).filter(t => t.includes('CHAR')).length, 1)
  const child = result.nodes.find(n => n.module === 'preset').children[0]
  assert.equal(child.locked, true); assert.equal(child.source.resourceId, 'card')
  assert.ok(texts(result).some(t => t.endsWith('after u2')))
})
test('inline history and input references occupy their authored positions exactly once', () => {
  const result = assembleRequest({ preset: BUILTINS[0], nativeMessages: native, inputIds: ['u2'], assets: {
    preset: { prompts: [{ enabled: true, identifier: 'main', content: 'BEFORE{{history}}MIDDLE{{input}}AFTER', role: 'system' }] },
  } })
  assert.deepEqual(texts(result), ['s', 'BEFORE', 'u1', 'a1', 'MIDDLE', 'u2', 'AFTER'])
  assert.ok(result.nodes.filter(n => ['history', 'input'].includes(n.module)).every(n => n.locked))
  const disabledLore = structuredClone(BUILTINS[0]); disabledLore.rules.find(r => r.kind === 'worldbook').enabled = false
  const omitted = assembleRequest({ preset: disabledLore, nativeMessages: native, assets: { ...assets, preset: { prompts: [{ enabled: true, marker: true, identifier: 'worldInfoAfter' }] } } })
  assert.ok(!texts(omitted).includes('LORE'))
})
test('snapshot mode retains original placement before later replies and deduplicates unchanged content', () => {
  const first = assembleRequest({ preset: snapshotPreset, nativeMessages: native, inputIds: ['u2'], assets })
  const nextNative = [...native, m('a2', 'assistant'), m('u3')]
  const second = assembleRequest({ preset: snapshotPreset, nativeMessages: nextNative, inputIds: ['u3'], assets, snapshots: first.snapshots })
  assert.equal(second.snapshots.length, 1)
  assert.ok(texts(second).indexOf('LORE') < texts(second).indexOf('a2'))
  const third = assembleRequest({ preset: snapshotPreset, nativeMessages: nextNative, assets: { ...assets, loreEntries: [{ ...assets.loreEntries[0], content: 'NEW' }] }, snapshots: second.snapshots })
  assert.equal(third.snapshots.length, 2); assert.ok(texts(third).includes('NEW'))
  const clear = assembleRequest({ preset: snapshotPreset, nativeMessages: nextNative, assets: { ...assets, loreEntries: [] }, snapshots: third.snapshots })
  assert.ok(texts(clear).some(t => t.includes('context is empty')))
})
test('depth insertion cannot split native tool calls and their results', () => {
  const tool = { id: 'tc', role: 'assistant', content: [{ type: 'tool-call', id: 'call', name: 'lookup', arguments: '{}' }] }
  const result = { id: 'tr', role: 'tool', toolCallId: 'call', source: { kind: 'tool', callId: 'call' }, content: [{ type: 'text', text: 'RESULT' }] }
  const preset = structuredClone(MODULE_ORDER); preset.rules.push({ id: 'extra', kind: 'custom', role: 'system', depth: 1, text: 'EXTRA' })
  const assembled = assembleRequest({ preset, nativeMessages: [m('s', 'system'), m('u'), tool, result] })
  assert.deepEqual(assembled.messages.map(m => m.id).slice(0, 4), ['s', 'u', 'tc', 'tr'])
  assert.equal(texts(assembled).at(-1), 'EXTRA')
})
test('separate custom snapshot rules retain independent anchors across turns', () => {
  const preset = { ...MODULE_ORDER, rules: [
    { id: 's', kind: 'native-system' }, { id: 'a', kind: 'custom', text: 'ALPHA', lifetime: 'snapshot' },
    { id: 'h', kind: 'history' }, { id: 'i', kind: 'input' }, { id: 'b', kind: 'custom', text: 'BETA', lifetime: 'snapshot' },
  ] }
  const first = assembleRequest({ preset, nativeMessages: [m('s', 'system'), m('u')], inputIds: ['u'] })
  assert.deepEqual(texts(first), ['s', 'ALPHA', 'u', 'BETA'])
  assert.deepEqual(first.snapshots.map(s => [s.ruleId, s.afterId]), [['a', 's'], ['b', 'u']])
  const second = assembleRequest({ preset, nativeMessages: [m('s', 'system'), m('u'), m('a', 'assistant'), m('u2')], inputIds: ['u2'], snapshots: first.snapshots })
  assert.deepEqual(texts(second), ['s', 'ALPHA', 'u', 'BETA', 'a', 'u2'])
})
test('depth-based snapshot rules retain changes across turns without splitting a tool transaction', () => {
  const preset = { ...MODULE_ORDER, rules: [...MODULE_ORDER.rules, { id: 'c', kind: 'custom', text: 'FIRST', lifetime: 'snapshot', depth: 0 }] }
  const first = assembleRequest({ preset, nativeMessages: native, inputIds: ['u2'] })
  assert.equal(first.snapshots.length, 1)
  preset.rules.at(-1).text = 'SECOND'
  const second = assembleRequest({ preset, nativeMessages: [...native, m('a2', 'assistant'), m('u3')], inputIds: ['u3'], snapshots: first.snapshots })
  assert.equal(second.snapshots.length, 2)
  assert.deepEqual(texts(second), ['s', 'u1', 'a1', 'u2', 'FIRST', 'a2', 'u3', 'SECOND'])
})
test('world-book entries at distinct depths retain their own positions and expiry', () => {
  const preset = { ...BUILTINS[0], rules: [{ id: 's', kind: 'native-system' }, { id: 'w', kind: 'worldbook', lifetime: 'snapshot' }, { id: 'h', kind: 'history' }, { id: 'i', kind: 'input' }] }
  const loreEntries = [{ id: 'l1', position: 'before', requestedPosition: 'at_depth', depth: 1, content: 'DEPTH1' }, { id: 'l2', position: 'after', requestedPosition: 'at_depth', depth: 0, content: 'DEPTH0' }]
  const first = assembleRequest({ preset, nativeMessages: [m('s', 'system'), m('u')], inputIds: ['u'], assets: { loreEntries } })
  assert.deepEqual(texts(first), ['s', 'DEPTH1', 'u', 'DEPTH0'])
  const second = assembleRequest({ preset, nativeMessages: [m('s', 'system'), m('u'), m('a', 'assistant'), m('u2')], inputIds: ['u2'], assets: { loreEntries: [{ ...loreEntries[1], content: 'NEW' }] }, snapshots: first.snapshots })
  assert.deepEqual(texts(second).slice(0, 5), ['s', 'DEPTH1', 'u', 'DEPTH0', 'a'])
  assert.ok(texts(second).includes('NEW'))
  assert.ok(texts(second).some(t => t.includes('context is empty for entry worldbook:l1')))
})
test('native blocks can be reordered while complete output budgets and built-in protection are enforced', () => {
  const preset = structuredClone(MODULE_ORDER); preset.rules = moveRule(preset.rules, 'input', 'history')
  const reordered = assembleRequest({ preset, nativeMessages: native, inputIds: ['u2'], assets })
  assert.ok(texts(reordered).indexOf('u2') < texts(reordered).indexOf('u1'))
  assert.throws(() => assembleRequest({ preset: MODULE_ORDER, assets, maxBytes: 10 }), /exceeds/)
  assert.deepEqual(normalizePreset({ ...MODULE_ORDER, rules: [] }).rules, [])
})
test('applied presets are immutable snapshots and survive resource edits and restart', () => {
  const root = mkdtempSync(join(tmpdir(), 'assembly-presets-'))
  try {
    const store = new AssemblyPresetStore(root), created = store.save(MODULE_ORDER)
    store.apply('session', created.id)
    store.save({ ...created, name: 'Changed' }, created.id)
    assert.equal(new AssemblyPresetStore(root).selection('session').name, created.name)
    assert.throws(() => store.remove(created.id), /applied/)
    assert.throws(() => store.save(created, 'builtin-native-roles'), /Copy/)
    store.apply('session', null); store.remove(created.id)
    store.apply('parent', 'builtin-native-roles'); store.copySelection('parent', 'child')
    assert.equal(store.selection('child').id, 'builtin-native-roles')
    store.apply('child', null)
    const restarted = new AssemblyPresetStore(root)
    restarted.apply('parent', 'builtin-st'); restarted.copySelection('parent', 'child')
    assert.equal(restarted.selection('child'), null)
    restarted.copySelection('no-layout-parent', 'default-child')
    restarted.apply('no-layout-parent', 'builtin-native-roles'); restarted.copySelection('no-layout-parent', 'default-child')
    assert.equal(restarted.selection('default-child'), null)
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('native modules can be omitted independently, including inside ST markers and macros', () => {
  for (const marker of [true, false]) {
    const preset = structuredClone(BUILTINS[0])
    for (const r of preset.rules) if (['native-system', 'history', 'input'].includes(r.kind)) r.enabled = false
    preset.rules.push({ id: 'fresh', kind: 'custom', text: 'ONLY FRESH' })
    const result = assembleRequest({ preset, nativeMessages: native, inputIds: ['u2'], assets: { preset: { prompts: [{ identifier: 'chatHistory', enabled: true, marker, content: '{{history}}{{input}}' }] } } })
    assert.deepEqual(texts(result), ['ONLY FRESH'])
    assert.deepEqual(native.map(textOf), ['s', 'u1', 'a1', 'u2'])
  }
  const preset = structuredClone(BUILTINS[0]); preset.rules.find(r => r.kind === 'history').enabled = false
  assert.deepEqual(texts(assembleRequest({ preset, nativeMessages: native, inputIds: ['u2'] })), ['s', 'u2'])
})
test('PHI additions and authored preview names survive assembly', () => {
  const preset = structuredClone(BUILTINS[0]); preset.rules.find(r => r.kind === 'phi').text = 'EXTRA PHI'
  const result = assembleRequest({ preset, assets: { ...assets, preset: { prompts: [{ enabled: true, identifier: 'opaque-uuid', name: 'Writing guide', content: 'TEXT' }] } } })
  assert.equal(result.nodes.find(n => n.source.field === 'opaque-uuid').name, 'Writing guide')
  assert.equal(texts(result).at(-1), 'EXTRA PHI')
})
test('mode defaults and explicit strategy overrides persist independently', () => {
  const root = mkdtempSync(join(tmpdir(), 'assembly-modes-'))
  let mode = 'play'
  try {
    const store = new AssemblyPresetStore(root, { mode: () => mode })
    assert.equal(store.selection('session').id, 'builtin-native-slots')
    store.apply('session', 'builtin-native-roles'); mode = 'native'
    assert.equal(store.selection('session'), null)
    const savedSnapshot = store.save(snapshotPreset)
    store.apply('session', savedSnapshot.id); mode = 'play'
    assert.equal(store.selection('session').id, 'builtin-native-roles')
    store.apply('session', null)
    assert.equal(new AssemblyPresetStore(root, { mode: () => mode }).selection('session'), null)
    store.copySelection('session', 'swipe-child')
    assert.equal(store.selection('swipe-child'), null)
    mode = 'native'
    assert.equal(new AssemblyPresetStore(root, { mode: () => mode }).selection('session').id, savedSnapshot.id)
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('custom-only requests use an explicit role without restoring disabled native input', () => {
  const preset = { ...BUILTINS[0], rules: [...BUILTINS[0].rules.map(r => ({ ...r, enabled: false })), { id: 'only', kind: 'custom', enabled: true, text: 'Reply OK' }] }
  const normalized = normalizePreset(preset)
  assert.equal(normalized.rules.at(-1).role, 'user')
  const result = assembleRequest({ preset, nativeMessages: native, inputIds: ['u2'] })
  assert.deepEqual(texts(result), ['Reply OK'])
  assert.equal(result.messages[0].role, 'user')
  assert.ok(!result.diagnostics.some(d => d.code.startsWith('ASSEMBLY_')))
  const legacy = { ...preset, rules: preset.rules.map(r => r.kind === 'custom' ? { ...r, role: 'preserve' } : r) }
  assert.equal(normalizePreset(legacy).rules.at(-1).role, 'system')
  const old = assembleRequest({ preset: legacy, nativeMessages: native })
  assert.equal(old.messages[0].role, 'system')
  assert.ok(old.diagnostics.some(d => d.code === 'ASSEMBLY_SYSTEM_ONLY'))
  const empty = assembleRequest({ preset: { ...preset, rules: preset.rules.map(r => ({ ...r, text: '' })) } })
  assert.equal(empty.messages.length, 0)
  assert.ok(empty.diagnostics.some(d => d.code === 'ASSEMBLY_EMPTY'))
})

test('retained depth snapshots keep depth metadata in subsequent previews', () => {
  const preset = { ...MODULE_ORDER, rules: [...MODULE_ORDER.rules, { id: 'depth-note', kind: 'custom', text: 'Note', lifetime: 'snapshot', role: 'user', depth: 1 }] }
  const first = assembleRequest({ preset, nativeMessages: native })
  const second = assembleRequest({ preset, nativeMessages: [...native, m('a2', 'assistant')], snapshots: first.snapshots })
  assert.equal(first.nodes.find(n => n.ruleId === 'depth-note').depth, 1)
  assert.equal(second.nodes.find(n => n.ruleId === 'depth-note').depth, 1)
})

test('explicit character depth remains authoritative and late greetings are diagnosed', () => {
  const input = defaultAssemblyFailureInput(), preset = structuredClone(BUILTINS[0])
  preset.rules.find(r => r.kind === 'character').depth = 0
  const before = structuredClone({ input, preset })
  const result = assembleRequest({ ...input, preset })
  const greeting = result.nodes.find(n => n.source?.field === 'greeting')
  assert.equal(greeting.depth, 0)
  assert.ok(result.messages.findIndex(m => textOf(m) === 'GREETING') > result.messages.findIndex(m => m.id === 'input'))
  assert.ok(result.diagnostics.some(d => d.code === 'GREETING_AFTER_INPUT'))
  assert.deepEqual({ input, preset }, before)
  preset.rules.find(r => r.kind === 'character').role = 'user'
  const userGreeting = assembleRequest({ ...input, preset })
  assert.ok(!userGreeting.diagnostics.some(d => d.code === 'GREETING_AFTER_INPUT'))
})

// A list rule governs placement only when the source is explicitly listed.
test('listed sources retain list position across slots, macros and disabled rules', () => {
  const preset = structuredClone(MODULE_ORDER)
  const input = { preset, nativeMessages: native, inputIds: ['u2'], assets: { ...assets, preset: { prompts: [{ enabled: true, identifier: 'main', content: 'P{{description}}{{history}}{{input}}Q' }] } } }
  assert.deepEqual(texts(assembleRequest(input)), ['s', 'P', 'Q', 'CHAR', 'u1', 'a1', 'u2', 'LORE', 'PHI'])
  preset.rules.find(r => r.kind === 'character').enabled = false
  assert.ok(!texts(assembleRequest(input)).some(t => t.includes('CHAR')))
  preset.rules = preset.rules.filter(r => r.kind !== 'character' && r.kind !== 'history' && r.kind !== 'input')
  assert.deepEqual(texts(assembleRequest(input)), ['s', 'PCHAR', 'u1', 'a1', 'u2', 'Q', 'LORE', 'PHI'])
})
test('custom Tavern text uses preset reference parsing for unlisted dependencies', () => {
  const preset = { ...MODULE_ORDER, rules: [{ id: 's', kind: 'native-system' }, { id: 'c', kind: 'custom', text: 'A{{history}}B{{input}}C', role: 'user' }] }
  const result = assembleRequest({ preset, nativeMessages: native, inputIds: ['u2'] })
  assert.deepEqual(texts(result), ['s', 'A', 'u1', 'a1', 'B', 'u2', 'C'])
  assert.ok(result.nodes.filter(n => n.module === 'history' || n.module === 'input').every(n => n.locked))
})
test('authored depth order is ascending and list mode overrides authored depth', () => {
  const prompt = (identifier, order) => ({ identifier, enabled: true, role: 'user', content: identifier, injectionPosition: 1, injectionDepth: 0, st: { injection_order: order } })
  const input = { nativeMessages: native, inputIds: ['u2'], assets: { preset: { prompts: [prompt('LOW', 10), prompt('HIGH', 200)] } } }
  assert.deepEqual(texts(assembleRequest({ ...input, preset: BUILTINS[0] })).slice(-2), ['LOW', 'HIGH'])
  assert.deepEqual(texts(assembleRequest({ ...input, preset: MODULE_ORDER })).slice(0, 3), ['s', 'LOW', 'HIGH'])
})
