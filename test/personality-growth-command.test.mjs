import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PersonalityStore } from '../packages/personality/src/store.js'
import { PersonalityEvolution } from '../packages/personality/src/evolution.js'
import { installEvolutionHost } from '../packages/personality/src/evolution-host.js'

function fixture(t, { enabled = true, assess = () => ({ change: null }) } = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'personality-grow-'))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  const cards = new PersonalityStore(directory), card = cards.create({ name: 'Bound personality' })
  let evolution = new PersonalityEvolution(cards.storageDir, cards), events = [], callback, command, native = true, host, judge = assess
  const session = { id: 'native', header: { id: 'native', createdAt: 7 }, snapshotEvents: () => events }
  cards.select(session.id, { characterCardId: card.id })
  const calls = [], errors = [], disposers = []
  if (!enabled) evolution.mutate(card.id, 'config', { operationId: 'off', expectedRevision: 0, enabled: false })
  const ctx = { effect: f => disposers.push(f()), provide() {},
    inject: (_, f) => f({ commands: { register: value => { command = value } } }),
    on: (_, f) => { callback = f }, get: () => ({ async *stream(request) {
      const input = JSON.parse(request.messages[0].content[0].text)
      calls.push(input)
      const answer = await judge(input)
      yield { type: 'block-end', block: { type: 'text', text: JSON.stringify(answer) } }
      yield { type: 'finish', reason: { kind: 'stop' } }
    } }) }
  function install() {
    host = installEvolutionHost(ctx, { cards, evolution, nativeLease: () => {
      if (!native) return null
      return () => native
    }, notify() {}, report: error => errors.push(error) })
  }
  install()
  t.after(() => disposers.forEach(dispose => dispose?.()))
  let number = 0
  const emit = (type, data) => {
    const event = { type, data, seq: events.length }
    events.push(event); callback(session, event)
  }
  return { cards, card, calls, errors, session,
    get evolution() { return evolution }, get host() { return host },
    invoke: (input = '') => command.handler({ agent: { session }, rawInput: input }),
    native(value) { native = value },
    assessor(value) { judge = value },
    async turn(text = 'Please verify the result before drawing a conclusion.', options = {}) {
      const turn = ++number
      emit('turn/start', { turn })
      emit('request/header', { header: { config: { provider: 'offline', model: 'fixture' } } })
      emit('user/message', { message: { source: { kind: options.source ?? 'user' }, content: [{ type: 'text', text }] } })
      emit('assistant/message', { turn, message: { content: [{ type: 'text', text: 'I checked the result.' }] } })
      emit('turn/end', { turn, reason: { kind: options.reason ?? 'completed' } })
      await host.idle()
    },
    restart() { evolution = new PersonalityEvolution(cards.storageDir, cards); install() },
    rows() { return structuredClone(events) },
  }
}

const revision = input => ({ change: { before: 'I trusted confident conclusions.', after: 'I verify conclusions against evidence.',
  reason: 'The user corrected my unsupported conclusion.', behavior: 'Check before concluding.', boundary: 'When evidence can be checked.' },
  basis: { kind: 'self-understanding', supports: [{ index: 1, quote: input.evidence.users[0] }], counterevidence: 'No contrary evidence supplied.' } })

test('/grow flushes a short native batch once without inserting model messages; status is read-only', async t => {
  const f = fixture(t)
  assert.match(f.invoke().text, /Complete a human turn/)
  await f.turn()
  const rows = f.rows()
  assert.equal(f.calls.length, 0)
  assert.match(f.invoke().text, /queued/)
  assert.match(f.invoke().text, /in progress/)
  await f.host.idle()
  assert.equal(f.calls.length, 1)
  assert.match(f.invoke('status').text, /no grounded revision was needed/)
  assert.match(f.invoke().text, /No unreviewed evidence/)
  assert.equal(f.calls.length, 1)
  assert.deepEqual(f.rows(), rows)
  assert.equal(f.evolution.view(f.card.id).pendingCount, 0)
  assert.match(f.invoke('unexpected').text, /Usage/)
  f.restart()
  assert.match(f.invoke().text, /No unreviewed evidence/)
  assert.match(f.invoke('status').text, /No manual assessment/)
  assert.equal(f.calls.length, 1)
})

test('/grow works with auto off, preserves its switch, persists grounding and will not relearn after restart or rollback', async t => {
  const f = fixture(t, { enabled: false, assess: revision })
  await f.turn()
  f.restart()
  assert.match(f.invoke().text, /queued/)
  await f.host.idle()
  assert.match(f.invoke('status').text, /grounded revision was saved/)
  assert.equal(f.evolution.view(f.card.id).config.enabled, false)
  assert.equal(f.evolution.current(f.card.id).evidence.sessionId, f.session.id)
  assert.equal(f.calls.length, 1)
  f.restart()
  assert.match(f.invoke().text, /No unreviewed evidence/)
  f.evolution.mutate(f.card.id, 'rollback', { operationId: 'undo', expectedRevision: f.evolution.view(f.card.id).revision, targetRevision: 0 })
  assert.match(f.invoke().text, /Complete a human turn/)
  assert.equal(f.evolution.current(f.card.id), null)
  assert.equal(f.calls.length, 1)
})

test('manual assessment rejects other personalities, RP, inherited and incomplete turns', async t => {
  const f = fixture(t, { enabled: false })
  await f.turn()
  const other = f.cards.create({ name: 'Other personality' })
  f.cards.select(f.session.id, { characterCardId: other.id })
  assert.match(f.invoke().text, /Complete a human turn/)
  f.cards.select(f.session.id, { characterCardId: f.card.id })
  f.native(false)
  assert.match(f.invoke().text, /native DSH session/)
  f.native(true)
  const isolated = fixture(t, { enabled: false })
  await isolated.turn('Ignore non-human input.', { source: 'automation' })
  assert.match(isolated.invoke().text, /Complete a human turn/)
  await isolated.turn('Incomplete turn.', { reason: 'aborted' })
  assert.match(isolated.invoke().text, /Complete a human turn/)
  isolated.session.inheritedEventCount = 999
  await isolated.turn()
  assert.match(isolated.invoke().text, /Complete a human turn/)
  f.cards.select(f.session.id, null)
  assert.match(f.invoke().text, /Select a personality/)
  assert.equal(f.calls.length + isolated.calls.length, 0)
})

test('manual source/model failures have inspectable outcomes and no autonomous retry', async t => {
  const f = fixture(t, { enabled: false, assess: () => { throw new Error('Offline assessor failed') } })
  await f.turn()
  f.invoke(); await f.host.idle()
  assert.match(f.invoke('status').text, /Model assessment failed/)
  assert.equal(f.calls.length, 1)
  f.invoke('status'); await f.host.idle()
  assert.equal(f.calls.length, 1)
  const state = f.evolution.record(f.card.id)
  f.evolution.sources.register({ id: 'offline-source', resolve: async () => null })
  f.evolution.mutate(f.card.id, 'config', { operationId: 'external', expectedRevision: state.revision, enabled: false, referenceSource: 'offline-source' })
  f.invoke(); await f.host.idle()
  assert.match(f.invoke('status').text, /Evidence source unavailable/)
  assert.equal(f.calls.length, 1)
})

test('fixing a disabled assessment model preserves pending evidence and permits one explicit retry', async t => {
  const f = fixture(t, { enabled: false, assess: () => { throw new Error('Model unavailable') } })
  await f.turn()
  f.invoke(); await f.host.idle()
  const before = f.evolution.view(f.card.id)
  assert.equal(before.pendingCount, 1)
  f.evolution.mutate(f.card.id, 'config', { operationId: 'fix-route', expectedRevision: before.revision,
    enabled: false, assessmentModel: { provider: 'offline', model: 'corrected' }, assessmentInstructions: 'Check concrete responsibility.' })
  assert.equal(f.evolution.view(f.card.id).pendingCount, 1)
  f.assessor(() => ({ change: null }))
  f.invoke(); await f.host.idle()
  assert.match(f.invoke('status').text, /no grounded revision was needed/)
  assert.equal(f.calls.length, 2)
  assert.equal(f.evolution.view(f.card.id).config.enabled, false)
  assert.match(f.invoke().text, /No unreviewed evidence/)
  assert.equal(f.calls.length, 2)
})

test('original evidence is checked again before committing a manual revision', async t => {
  let started, release
  const ready = new Promise(resolve => { started = resolve })
  const f = fixture(t, { enabled: false, assess: async input => {
    started(); await new Promise(resolve => { release = resolve }); return revision(input)
  } })
  await f.turn()
  f.invoke(); await ready
  f.session.snapshotEvents().find(row => row.type === 'user/message').data.message.content[0].text = 'Changed durable evidence'
  release(); await f.host.idle()
  assert.equal(f.evolution.current(f.card.id), null)
  assert.match(f.invoke('status').text, /Evidence source unavailable/)
})

test('status reports the manual job outcome even if an earlier automatic job saved a revision', async t => {
  let started, release
  const ready = new Promise(resolve => { started = resolve })
  const f = fixture(t, { assess: async input => {
    started(); await new Promise(resolve => { release = resolve }); return revision(input)
  } })
  f.evolution.mutate(f.card.id, 'config', { operationId: 'every-turn', expectedRevision: 0, enabled: true, assessmentInterval: 1 })
  const foreground = f.turn()
  await ready
  assert.match(f.invoke().text, /queued/)
  release(); await foreground; await f.host.idle()
  assert.ok(f.evolution.current(f.card.id))
  assert.match(f.invoke('status').text, /Evidence already reviewed/)
  assert.equal(f.calls.length, 1)
})

test('rollback and rebinding revoke an in-flight manual write', async t => {
  for (const interfere of ['rollback', 'rebind', 'delete']) {
    let release, started
    const ready = new Promise(resolve => { started = resolve })
    const f = fixture(t, { enabled: false, assess: async input => {
      started(); await new Promise(resolve => { release = resolve }); return revision(input)
    } })
    await f.turn()
    f.invoke(); await ready
    if (interfere === 'rollback') f.evolution.mutate(f.card.id, 'rollback', { operationId: 'cancel', expectedRevision: 1, targetRevision: 0 })
    else if (interfere === 'delete') { f.cards.delete(f.card.id); f.evolution.remove(f.card.id) }
    else { f.cards.select(f.session.id, null); f.cards.select(f.session.id, { characterCardId: f.card.id }) }
    release(); await f.host.idle(); await new Promise(resolve => setImmediate(resolve))
    if (interfere !== 'delete') {
      assert.equal(f.evolution.current(f.card.id), null)
      assert.match(f.invoke('status').text, /stopped/)
    }
    assert.equal(f.calls.length, 1)
  }
})
