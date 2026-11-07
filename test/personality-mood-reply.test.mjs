import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { PersonalityMoodReply, installMoodReplyHost } from '../packages/personality/src/mood-reply.js'
import { PersonalityMood } from '../packages/personality/src/mood.js'
import { PersonalityStore } from '../packages/personality/src/store.js'
import { moodApi } from '../packages/personality/src/mood-http.js'

const user = { source: { kind: 'user' } }
function session(id = 's', createdAt = 1) {
  const events = []
  return { id, header: { id, createdAt }, snapshotEvents: () => events, append(type, data) {
    const event = { type, data, seq: events.length }; events.push(event); return event
  } }
}
function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), 'mood-reply-'))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  return { directory, replies: new PersonalityMoodReply(directory) }
}

test('pending skip survives reload, is cancellable, and reads/previews/background do not consume it', t => {
  const { directory, replies } = fixture(t), s = session()
  replies.change(s, 'p', { skipNextReply: true, expectedReplyRevision: 0 })
  const restored = new PersonalityMoodReply(directory)
  assert.equal(restored.view(s, 'p').status, 'pending')
  assert.equal(restored.suppressed(s, 'p'), false)
  s.append('turn/start', { turn: 1 })
  assert.equal(restored.claim(s, 'p', 1, { source: { kind: 'runtime-context' } }), false)
  assert.equal(restored.suppressed(s, 'p', { preview: true }), false)
  assert.equal(restored.view(s, 'p').status, 'pending')
  restored.change(s, 'p', { skipNextReply: false, expectedReplyRevision: 1 })
  assert.equal(restored.view(s, 'p').status, 'idle')
  assert.equal(restored.claim(s, 'p', 1, user), false)
  assert.throws(() => restored.change(s, 'p', { skipNextReply: true, expectedReplyRevision: 1 }), { code: 'MOOD_REPLY_CONFLICT' })
})

test('one human reply includes tools and retries, excludes other cards/sessions, and resets on every terminal reason', t => {
  const { directory, replies } = fixture(t), s = session()
  for (const reason of ['completed', 'aborted', 'error', 'blocked']) {
    replies.change(s, 'p', { skipNextReply: true, expectedReplyRevision: replies.view(s, 'p').revision })
    const start = s.append('turn/start', { turn: s.snapshotEvents().length + 1 }), turn = start.data.turn
    replies.observe(s, start)
    assert.ok(replies.claim(s, 'p', turn, user))
    assert.equal(replies.suppressed(s, 'p'), true)
    assert.equal(replies.suppressed(s, 'other'), false)
    assert.equal(replies.suppressed(session('other'), 'p'), false)
    assert.equal(replies.suppressed(session('s', 2), 'p'), false)
    s.append('tool/result', { turn }); s.append('request/header', { turn })
    assert.equal(new PersonalityMoodReply(directory).suppressed(s, 'p'), true)
    assert.equal(replies.claim(s, 'p', turn, user), false)
    assert.throws(() => replies.change(s, 'p', { skipNextReply: false, expectedReplyRevision: replies.view(s, 'p').revision }), { code: 'MOOD_REPLY_ACTIVE' })
    replies.observe(s, s.append('turn/end', { turn, reason: { kind: reason } }))
    assert.equal(replies.view(s, 'p').status, 'idle')
  }
  replies.change(s, 'p', { skipNextReply: true, expectedReplyRevision: replies.view(s, 'p').revision })
  s.append('turn/start', { turn: 99 }); replies.claim(s, 'p', 99, user)
  // A crash without turn/end must not suppress a newly opened turn.
  replies.observe(s, s.append('turn/start', { turn: 100 }))
  assert.equal(replies.suppressed(s, 'p'), false)
})

test('binding changes, including unbind/rebind and deleting the card, clear a pending switch', t => {
  const { directory, replies } = fixture(t), cards = new PersonalityStore(directory), s = session()
  const p = cards.create({ name: 'P' }), q = cards.create({ name: 'Q' })
  const listeners = new Map()
  installMoodReplyHost({ on(name, fn) { listeners.set(name, fn) }, effect(fn) { const dispose = fn(); t.after(dispose) } },
    { cards, replies, notify() {}, report(error) { throw error } })
  cards.select(s.id, { characterCardId: p.id })
  const arm = () => replies.change(s, p.id, { skipNextReply: true, expectedReplyRevision: replies.view(s, p.id).revision })
  for (const choice of [p.id, q.id, null]) {
    cards.select(s.id, { characterCardId: p.id }); arm()
    cards.select(s.id, choice ? { characterCardId: choice } : null)
    assert.equal(replies.view(s, p.id).status, 'idle')
  }
  cards.select(s.id, { characterCardId: p.id }); arm(); cards.delete(p.id)
  assert.equal(replies.view(s, p.id).status, 'idle')
})

test('tool-step reads reuse the active turn and restart reads recover it once', t => {
  const { directory, replies } = fixture(t), s = session()
  let snapshots = 0
  const snapshot = s.snapshotEvents
  s.snapshotEvents = () => { snapshots++; return snapshot() }
  replies.change(s, 'p', { skipNextReply: true, expectedReplyRevision: 0 })
  replies.observe(s, s.append('turn/start', { turn: 1 }))
  replies.claim(s, 'p', 1, user)
  for (let step = 0; step < 100; step++) assert.equal(replies.suppressed(s, 'p'), true)
  assert.equal(snapshots, 0)
  const restored = new PersonalityMoodReply(directory)
  for (let step = 0; step < 100; step++) assert.equal(restored.suppressed(s, 'p'), true)
  assert.equal(snapshots, 1)
  restored.observe(s, s.append('turn/end', { turn: 1 }))
  assert.equal(restored.suppressed(s, 'p'), false)
  assert.equal(new PersonalityMoodReply(directory).suppressed(s, 'p'), false)
})

test('mood API changes reply state independently from the stored mood and automatic updates', async t => {
  const { directory, replies } = fixture(t), cards = new PersonalityStore(directory), moods = new PersonalityMood(directory), s = session()
  const p = cards.create({ name: 'P' }); cards.select(s.id, { characterCardId: p.id })
  moods.change(p.id, s.id, { expectedRevision: 0, automatic: true, mood: { feeling: 'calm', intensity: 3, reason: 'Verified' } })
  let running = false
  const api = moodApi(cards, moods, () => {}, { replies, sessionFor: id => id === s.id ? s : null, isRunning: () => running })
  const request = async body => {
    const req = Readable.from([Buffer.from(JSON.stringify({ sessionId: s.id, personalityId: p.id, ...body }))]); Object.assign(req, { method: 'POST' })
    let result
    await api(req, { setHeader() {}, end(data) { result = { status: this.statusCode, ...JSON.parse(data) } } })
    return result
  }
  const before = moods.read(p.id, s.id)
  assert.equal((await request({ skipNextReply: true, expectedReplyRevision: 0 })).reply.status, 'pending')
  assert.deepEqual(moods.read(p.id, s.id), before)
  assert.equal((await request({ skipNextReply: false, expectedReplyRevision: 0 })).status, 409)
  running = true
  assert.equal((await request({ skipNextReply: false, expectedReplyRevision: 1 })).status, 409)
  running = false
  assert.equal((await request({ skipNextReply: false, expectedReplyRevision: 1 })).reply.status, 'idle')
  assert.equal((await request({ skipNextReply: true, expectedReplyRevision: 2, automatic: false })).status, 400)
})
