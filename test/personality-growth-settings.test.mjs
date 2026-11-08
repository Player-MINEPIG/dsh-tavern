import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { PersonalityStore } from '../packages/personality/src/store.js'
import { PersonalityEvolution } from '../packages/personality/src/evolution.js'
import { installEvolutionHost } from '../packages/personality/src/evolution-host.js'
import { requestAssessment } from '../packages/personality/src/turn-assessment.js'
import { DEFAULT_EVOLUTION_INSTRUCTIONS, EVOLUTION_ASSESSMENT_PROTOCOL, evolutionAssessmentSystem } from '../packages/personality/src/evolution-prompt.js'

function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), 'growth-settings-'))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  const cards = new PersonalityStore(directory), id = cards.create().id
  return { cards, id, evolution: new PersonalityEvolution(cards.storageDir, cards) }
}

test('growth settings persist independently per personality, reset, and preserve old receipt retries', t => {
  const { cards, id, evolution } = fixture(t), other = cards.create().id
  const legacy = { expectedRevision: 0, operationId: 'legacy', enabled: true, assessmentInterval: 2 }
  const state = evolution.record(id)
  const signature = createHash('sha256').update(JSON.stringify(['config', 0, true, undefined, 2, undefined, undefined])).digest('hex')
  evolution.save(id, { ...state, revision: 1, receipts: [{ id: 'legacy', signature }] })
  assert.equal(evolution.mutate(id, 'config', legacy).revision, 1)
  const config = { expectedRevision: 1, operationId: 'custom', enabled: true, assessmentModel: { provider: 'judge', model: 'reviewer' }, assessmentInstructions: 'Require a testable change.' }
  evolution.mutate(id, 'config', config)
  assert.equal(evolution.mutate(id, 'config', { ...config, assessmentModel: { model: 'reviewer', provider: 'judge' } }).revision, 2)
  const restored = new PersonalityEvolution(cards.storageDir, cards)
  assert.deepEqual(restored.view(id).config.assessmentModel, config.assessmentModel)
  assert.equal(restored.view(id).config.assessmentInstructions, config.assessmentInstructions)
  assert.equal(restored.view(other).config.assessmentModel, null)
  assert.equal(restored.view(other).config.assessmentInstructions, '')
  for (const fields of [{ assessmentModel: { provider: 'judge' } }, { assessmentModel: { provider: 'judge', model: 'reviewer', apiKey: 'forbidden' } }, { assessmentInstructions: 'x'.repeat(6001) }, { assessmentInstructions: null }]) {
    assert.throws(() => restored.mutate(id, 'config', { expectedRevision: 2, operationId: 'invalid', enabled: true, ...fields }), { code: 'INVALID_EVOLUTION' })
  }
  restored.mutate(id, 'config', { expectedRevision: 2, operationId: 'reset', enabled: true, assessmentModel: null, assessmentInstructions: '' })
  assert.equal(restored.view(id).config.assessmentModel, null)
  assert.equal(evolutionAssessmentSystem(restored.view(id).config.assessmentInstructions), evolutionAssessmentSystem(DEFAULT_EVOLUTION_INSTRUCTIONS))
})

test('custom criteria replace defaults while fixed evidence protocol remains; growth alone changes route', async t => {
  const { cards, id, evolution } = fixture(t)
  const events = [], requests = [], errors = [], session = { id: 'growth-settings', header: { id: 'growth-settings', createdAt: 1 }, snapshotEvents: () => events }
  cards.select(session.id, { characterCardId: id })
  let listener, dispose
  const llm = { async *stream(request) { requests.push(request); yield { type: 'block-end', block: { type: 'text', text: '{"change":null}' } }; yield { type: 'finish', reason: { kind: 'stop' } } } }
  const host = installEvolutionHost({ effect: fn => { dispose = fn() }, provide() {}, get: () => llm, on: (_, fn) => { listener = fn } }, { cards, evolution, nativeLease: () => () => true, notify() {}, report: error => errors.push(error) })
  t.after(() => dispose())
  const configure = fields => evolution.mutate(id, 'config', { expectedRevision: evolution.view(id).revision, operationId: String(evolution.view(id).revision), enabled: true, assessmentInterval: 1, ...fields })
  const emit = (type, data) => { const event = { type, data, seq: events.length }; events.push(event); listener(session, event) }
  const turn = async number => {
    emit('turn/start', { turn: number }); emit('user/message', { source: { kind: 'user' }, content: [{ type: 'text', text: 'Please check evidence ' + number }] })
    emit('request/header', { header: { config: { provider: 'foreground', model: 'chat' } } })
    emit('assistant/message', { turn: number, message: { content: [{ type: 'text', text: 'Checked.' }] } }); emit('turn/end', { turn: number, reason: { kind: 'completed' } })
    await host.idle()
  }
  configure({ assessmentModel: { provider: 'judge', model: 'reviewer' }, assessmentInstructions: 'Require a testable change.' })
  await turn(1)
  assert.deepEqual([requests[0].provider, requests[0].model], ['judge', 'reviewer'])
  assert.ok(requests[0].system.startsWith('Require a testable change.\n'))
  assert.ok(requests[0].system.endsWith(EVOLUTION_ASSESSMENT_PROTOCOL))
  assert.ok(!requests[0].system.includes(DEFAULT_EVOLUTION_INSTRUCTIONS))
  await requestAssessment(llm, { turn: { provider: 'foreground', model: 'chat', origin: { sessionId: session.id } }, system: 'mood', input: {}, signal: new AbortController().signal, purpose: 'tavern-personality-mood' })
  assert.deepEqual([requests[1].provider, requests[1].model], ['foreground', 'chat'])
  configure({ assessmentModel: null, assessmentInstructions: '' })
  await turn(2)
  assert.deepEqual([requests[2].provider, requests[2].model], ['foreground', 'chat'])
  assert.equal(requests[2].system, evolutionAssessmentSystem(''))
  assert.deepEqual(errors, [])
})

test('an unavailable explicit judge route fails without dispatch or fallback', async () => {
  const routes = [], llm = { async prepareCall(route) { routes.push(route); throw new Error('Selected judge unavailable') }, async *stream() { assert.fail('must not dispatch') } }
  await assert.rejects(requestAssessment(llm, { turn: { provider: 'chat', model: 'foreground', origin: { sessionId: 'x' } }, modelSelection: { provider: 'removed', model: 'reviewer' }, system: '', input: {}, signal: new AbortController().signal, purpose: 'tavern-personality-evolution' }), /Selected judge unavailable/)
  assert.deepEqual(routes, [{ provider: 'removed', model: 'reviewer', maxTokens: 1200 }])
})
