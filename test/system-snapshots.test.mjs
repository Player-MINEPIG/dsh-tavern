import test from 'node:test'
import assert from 'node:assert/strict'
import { projectSystemSnapshots as project } from '../packages/request-assembler/system-snapshots.js'
import { assembleRequest } from '../packages/request-assembler/assemble.js'
import { BUILTINS, moveRule } from '../packages/request-assembler/model.js'
const projectSystemSnapshots = (assembly, native, max) => project(assembly, native, max, { systemPromptUpdate: 'in-history' })

const m = (id, role = 'system') => ({ id, role, content: [{ type: 'text', text: id }], source: { kind: role === 'system' ? 'system-prompt' : 'user' } })
const assembly = messages => ({ messages, nodes: messages.map((m, start) => ({ id: m.id, text: m.content[0]?.text, start, count: 1 })) })
const texts = result => result.messages.map(m => m.content.map(b => b.text ?? b.type).join(''))
test('source systems accumulate at their boundaries, native snapshots replace only the native base', () => {
  const old = m('OLD'), current = m('CURRENT'), replacement = m('UPDATED'), user = m('INPUT', 'user'), answer = m('ANSWER', 'assistant')
  const logical = assembly([old, current, m('MAIN'), user, m('LORE'), answer, replacement, m('TAIL'), m('NEXT', 'user')])
  const before = structuredClone(logical)
  const result = projectSystemSnapshots(logical, [old, current, user, answer, replacement])
  assert.deepEqual(texts(result), ['CURRENT\n\nMAIN', 'INPUT', 'CURRENT\n\nMAIN\n\nLORE', 'ANSWER', 'UPDATED\n\nMAIN\n\nLORE\n\nTAIL', 'NEXT'])
  assert.equal(result.messages[1], user); assert.equal(result.messages[3], answer)
  assert.deepEqual(logical, before)
  assert.deepEqual(result.systemProjection.messages[0].replacedNativeIds, ['OLD'])
  assert.deepEqual(result.systemProjection.messages[0].contributorIds, ['CURRENT', 'MAIN'])
  assert.ok(result.nodes.slice(0, 3).every(node => node.start === 0 && node.count === 1 && node.requestMessageIds[0] === result.messages[0].id))
  assert.deepEqual(texts(projectSystemSnapshots(assembly([current, m('CHANGED'), user]), [current, user])), ['CURRENT\n\nCHANGED', 'INPUT'])
})
test('models without in-history support reject later systems; preview declares unresolved capability', () => {
  const base = m('BASE'), user = m('INPUT', 'user'), logical = assembly([base, user, m('TAIL')])
  assert.throws(() => project(logical, [base, user]), error => error.code === 'ASSEMBLY_SYSTEM_UPDATES_UNSUPPORTED')
  const preview = project(logical, [base, user], undefined, { preview: true })
  assert.equal(preview.systemProjection.capability, 'unverified')
  assert.ok(preview.diagnostics.some(d => d.code === 'SYSTEM_UPDATE_CAPABILITY_UNVERIFIED'))
  assert.deepEqual(texts(project(assembly([base, m('MAIN'), user]), [base, user])), ['BASE\n\nMAIN', 'INPUT'])
})
test('tool transactions, empty input and system-disabled layouts are unchanged', () => {
  const call = { id: 'call', role: 'assistant', content: [{ type: 'tool-call', id: 't', name: 'probe', arguments: '{}' }] }
  const result = { id: 'result', role: 'tool', toolCallId: 't', content: [] }
  const empty = { ...m('empty', 'user'), content: [] }
  const base = m('BASE'), messages = [base, call, result, m('LORE'), empty]
  const projected = projectSystemSnapshots(assembly(messages), [base, call, result, empty])
  assert.equal(projected.messages[1], call); assert.equal(projected.messages[2], result); assert.equal(projected.messages[4], empty)
  assert.equal(projected.messages[3].content[0].text, 'BASE\n\nLORE')
  assert.deepEqual(projectSystemSnapshots(assembly([call, result, empty]), [call, result, empty]).messages, [call, result, empty])
})
test('projection counts repeated system bytes and never drops unsupported blocks', () => {
  const base = m('BASE'), input = m('INPUT', 'user')
  const result = projectSystemSnapshots(assembly([base, m('LORE'), input, m('TAIL')]), [base, input])
  assert.throws(() => projectSystemSnapshots(assembly([base, m('LORE'), input, m('TAIL')]), [base, input], result.extraBytes - 1), error => error.status === 413)
  assert.throws(() => projectSystemSnapshots(assembly([{ ...base, content: [{ type: 'image' }] }]), [base]), /text-only/)
})
test('native updates keep their history anchors and base priority through the default assembler', () => {
  const native = [m('OLD'), m('FIRST', 'user'), m('ANSWER', 'assistant'), m('CURRENT'), m('NEXT', 'user')]
  const assets = { preset: { prompts: [{ identifier: 'main', role: 'system', enabled: true, content: 'MAIN' }] } }
  const logical = assembleRequest({ preset: BUILTINS[0], nativeMessages: native, inputIds: ['NEXT'], assets })
  const result = projectSystemSnapshots(logical, native)
  assert.deepEqual(texts(result), ['OLD\n\nMAIN', 'FIRST', 'ANSWER', 'CURRENT\n\nMAIN', 'NEXT'])
  assert.ok(!texts(result).at(-2).includes('OLD'))
  assert.deepEqual(result.nodes.find(n => n.module === 'history').requestMessageIds, ['FIRST', 'ANSWER'])
  assert.deepEqual(result.nodes.filter(n => n.module === 'native-system').map(n => n.requestMessageIds[0]), [result.messages[0].id, result.messages[3].id])
  const later = [...native, m('REPLY', 'assistant'), m('LAST', 'user')]
  const next = projectSystemSnapshots(assembleRequest({ preset: BUILTINS[0], nativeMessages: later, inputIds: ['LAST'], assets }), later)
  assert.deepEqual(next.nodes.filter(n => n.module === 'history').flatMap(n => n.requestMessageIds), ['FIRST', 'ANSWER', 'NEXT', 'REPLY'])
  const reordered = { ...BUILTINS[0], rules: moveRule(BUILTINS[0].rules, 'input', 'history') }
  assert.throws(() => assembleRequest({ preset: reordered, nativeMessages: native, inputIds: ['NEXT'], assets }), error => error.code === 'ASSEMBLY_NATIVE_SYSTEM_ORDER')
})
test('retained source snapshots keep originals and tombstones without accumulating prior carriers', () => {
  const firstNative = [m('BASE'), m('ONE', 'user')]
  const assets = { loreEntries: [{ id: 'lore', content: 'LORE_OLD' }] }
  const first = assembleRequest({ preset: BUILTINS[2], nativeMessages: firstNative, inputIds: ['ONE'], assets })
  const native = [...firstNative, m('ANSWER', 'assistant'), m('TWO', 'user')]
  const changed = assembleRequest({ preset: BUILTINS[2], nativeMessages: native, inputIds: ['TWO'], assets: { loreEntries: [{ id: 'lore', content: 'LORE_NEW' }] }, snapshots: first.snapshots })
  const projected = projectSystemSnapshots(changed, native)
  assert.deepEqual(texts(projected), ['BASE', 'ONE', 'BASE\n\nLORE_OLD', 'ANSWER', 'TWO', 'BASE\n\nLORE_OLD\n\nLORE_NEW'])
  assert.deepEqual(projected.nodes.find(n => n.module === 'history').requestMessageIds, ['ONE', 'ANSWER'])
  const again = assembleRequest({ preset: BUILTINS[2], nativeMessages: native, inputIds: ['TWO'], assets: { loreEntries: [{ id: 'lore', content: 'LORE_NEW' }] }, snapshots: projected.snapshots })
  assert.deepEqual(projectSystemSnapshots(again, native).messages, projected.messages)
  const cleared = assembleRequest({ preset: BUILTINS[2], nativeMessages: native, inputIds: ['TWO'], assets: {}, snapshots: changed.snapshots })
  assert.match(texts(projectSystemSnapshots(cleared, native)).at(-1), /^BASE\n\nLORE_OLD\n\nLORE_NEW\n\nCurrent context is empty/)
  const noSystem = [m('ONLY', 'user')]
  assert.deepEqual(texts(projectSystemSnapshots(assembleRequest({ preset: BUILTINS[0], nativeMessages: noSystem, previous: projected }), noSystem)), ['ONLY'])
})
