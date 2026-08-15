import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { apply, PendingInputProjection } from '../packages/tavern-loader/src/index.js'

function message(id, text) {
  return { id, role: 'user', source: { kind: 'user' }, content: [{ type: 'text', text }] }
}

function session(id, durable = []) {
  return { id, header: {}, events: [], deriveMessages: () => durable }
}

function append(sessionValue, type, data) {
  const event = { seq: sessionValue.events.length, type, data }
  sessionValue.events.push(event)
  return event
}

test('projection reconstructs public splices, distinguishes cancellation from claim, and consumes once', () => {
  const projection = new PendingInputProjection()
  const value = session('projection')
  const inserted = append(value, 'agent/inbox/spliced', {
    target: 'next-turn', start: 0, inserted: [message('original', 'old keyword')],
  })
  projection.observeSessionEvent(value, inserted)
  const replaced = append(value, 'agent/inbox/spliced', {
    target: 'next-turn', start: 0, removedCount: 1,
    inserted: [message('replacement', 'clocktower')], outcome: 'canceled',
  })
  projection.observeSessionEvent(value, replaced)
  const claimed = append(value, 'agent/inbox/spliced', {
    target: 'next-turn', start: 0, removedCount: 1, inserted: [],
  })
  projection.observeSessionEvent(value, claimed)

  const first = projection.activationContext({ id: value.id, session: value })
  assert.equal(first.text, 'clocktower')
  assert.equal(first.metadata.pendingMessageCount, 1)
  assert.deepEqual(first.metadata.claimEventSeqs, [claimed.seq])
  assert.equal(first.text.includes('old keyword'), false)

  const second = projection.activationContext({ id: value.id, session: value })
  assert.equal(second.metadata.pendingMessageCount, 0)
  assert.equal(second.text, '')
})

test('projection deduplicates stable message identities against durable history', () => {
  const accepted = message('same-message', 'clocktower')
  const projection = new PendingInputProjection()
  const value = session('dedupe', [accepted])
  projection.observeSessionEvent(value, append(value, 'agent/inbox/spliced', {
    target: 'next-step', start: 0, inserted: [accepted],
  }))
  projection.observeSessionEvent(value, append(value, 'agent/inbox/spliced', {
    target: 'next-step', start: 0, removedCount: 1, inserted: [],
  }))

  const activation = projection.activationContext({ id: value.id, session: value })
  assert.equal(activation.text, 'clocktower')
  assert.equal(activation.metadata.pendingMessageCount, 0)
  assert.equal(activation.metadata.duplicatePendingMessageCount, 1)
  assert.equal(activation.metadata.scannedMessageCount, 1)
})

test('projection combines next-step steering before the claimed next-turn message', () => {
  const projection = new PendingInputProjection()
  const value = session('two-targets')
  for (const [target, input] of [
    ['next-turn', message('turn', 'turn input')],
    ['next-step', message('steer', 'steering input')],
  ]) projection.observeSessionEvent(value, append(value, 'agent/inbox/spliced', { target, start: 0, inserted: [input] }))
  for (const target of ['next-step', 'next-turn']) projection.observeSessionEvent(value, append(value, 'agent/inbox/spliced', {
    target, start: 0, removedCount: 1, inserted: [],
  }))

  const activation = projection.activationContext({ id: value.id, session: value })
  assert.equal(activation.text, 'steering input\nturn input')
  assert.equal(activation.metadata.pendingMessageCount, 2)
  assert.equal(activation.metadata.claimEventSeqs.length, 2)
})

test('projection keeps sessions isolated and enforces message and character scan limits', () => {
  const projection = new PendingInputProjection({ maxScanMessages: 2, maxScanCharacters: 8 })
  const first = session('first')
  const second = session('second')
  for (const [value, messages] of [
    [first, [message('a1', 'discard'), message('a2', '1234'), message('a3', '5678')]],
    [second, [message('b1', 'separate')]],
  ]) {
    projection.observeSessionEvent(value, append(value, 'agent/inbox/spliced', {
      target: 'next-step', start: 0, inserted: messages,
    }))
    projection.observeSessionEvent(value, append(value, 'agent/inbox/spliced', {
      target: 'next-step', start: 0, removedCount: messages.length, inserted: [],
    }))
  }

  const firstActivation = projection.activationContext({ id: first.id, session: first })
  assert.equal(firstActivation.text, '234\n5678')
  assert.equal(firstActivation.metadata.pendingMessageCount, 3)
  assert.equal(firstActivation.metadata.scannedMessageCount, 2)
  assert.equal(firstActivation.metadata.truncated, true)
  const secondActivation = projection.activationContext({ id: second.id, session: second })
  assert.equal(secondActivation.text, 'separate')
  assert.equal(secondActivation.metadata.pendingMessageCount, 1)
})

test('a single first agent step matches claimed input before profile assembly and traces that exact step', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'dsh-tavern-pending-first-step-'))
  const sections = []
  const listeners = new Map()
  const ctx = {
    systemPrompt: { section: section => sections.push(section) },
    on: (name, listener) => listeners.set(name, listener),
    emit: () => {},
    get: () => undefined,
    effect: () => {},
    logger: { info: () => {}, warn: () => {} },
  }
  const value = session('first-step')
  const agent = { id: value.id, session: value }
  try {
    const store = apply(ctx, { storageDir: directory })
    store.worldBookStore.import(JSON.stringify({
      name: 'Early activation',
      entries: { one: { uid: 1, key: ['clocktower'], content: 'EARLY_LORE', order: 100, position: 0 } },
    }), { id: 'early-book' })
    store.sessionSelections.set(agent.id, { worldBookIds: ['early-book'] })
    listeners.get('agent/session-start')({ agent })

    const insertion = append(value, 'agent/inbox/spliced', {
      target: 'next-turn', start: 0, inserted: [message('current-input', 'visit the clocktower')],
    })
    listeners.get('session/event')(value, insertion)
    const claim = append(value, 'agent/inbox/spliced', {
      target: 'next-turn', start: 0, removedCount: 1, inserted: [],
    })
    listeners.get('session/event')(value, claim)

    const context = { agent }
    const profile = sections[0].text(context)
    assert.match(profile, /EARLY_LORE/)
    assert.equal(value.events.some(event => event.type === 'user/message'), false)
    await listeners.get('agent/request')({ agent, turn: 1, step: 1 }, async () => ({ provider: 'test', model: 'model' }))

    const trace = store.traceStore.list(agent.id)[0]
    assert.equal(trace.turn, 1)
    assert.equal(trace.step, 1)
    assert.equal(trace.activation.pendingMessageCount, 1)
    assert.equal(trace.activation.includedPendingMessageCount, 1)
    assert.deepEqual(trace.activation.claimEventSeqs, [claim.seq])
    assert.equal(JSON.stringify(trace).includes('visit the clocktower'), false)

    const nextContext = { agent }
    assert.doesNotMatch(sections[0].text(nextContext), /EARLY_LORE/)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
