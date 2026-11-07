import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { atomicJson, readJsonFile } from '../../play/src/atomic-json.js'

const LIMIT = 16384
const conflict = () => Object.assign(new Error('The next-reply setting changed. Refresh and retry.'), { status: 409, code: 'MOOD_REPLY_CONFLICT' })
const identity = session => session?.header?.createdAt

/** A reply is one native human turn, including every tool step and request retry. */
export class PersonalityMoodReply {
  #cache = new Map()
  #turns = new WeakMap()
  constructor(directory) { this.directory = directory }
  file(sessionId) {
    if (typeof sessionId !== 'string' || !sessionId.trim() || sessionId.length > 512) throw new TypeError('Invalid session id')
    return join(this.directory, 'mood-replies', createHash('sha256').update(sessionId).digest('hex') + '.json')
  }
  record(sessionId) {
    if (this.#cache.has(sessionId)) {
      const value = this.#cache.get(sessionId)
      this.#cache.delete(sessionId); this.#cache.set(sessionId, value)
      return value
    }
    let record
    try { record = readJsonFile(this.file(sessionId), LIMIT) }
    catch (error) { if (error.code !== 'ENOENT') throw error }
    return this.cache(sessionId, record ?? { revision: 0, status: 'idle' })
  }
  cache(sessionId, record) {
    this.#cache.delete(sessionId); this.#cache.set(sessionId, record)
    if (this.#cache.size > 256) this.#cache.delete(this.#cache.keys().next().value)
    return record
  }
  save(sessionId, record) {
    atomicJson(this.file(sessionId), record, LIMIT)
    this.cache(sessionId, record)
  }
  activeTurn(session) {
    if (!this.#turns.has(session)) {
      const events = session.snapshotEvents(), start = events.findLast(event => event.type === 'turn/start')
      const ended = start && events.some(event => event.type === 'turn/end' && event.seq > start.seq && event.data.turn === start.data.turn)
      this.#turns.set(session, start && !ended ? start : null)
    }
    return this.#turns.get(session)
  }
  current(session, personalityId) {
    const record = this.record(session.id)
    if (record.personalityId !== personalityId || record.createdAt !== identity(session)) return { revision: record.revision, status: 'idle' }
    if (record.status === 'active') {
      const start = this.activeTurn(session)
      if (start?.seq !== record.startSeq || start.data.turn !== record.turn) {
        return { revision: record.revision, status: 'idle' }
      }
    }
    return record
  }
  view(session, personalityId) {
    const { revision, status } = this.current(session, personalityId)
    return { revision, status, skipNextReply: status === 'pending' }
  }
  change(session, personalityId, { skipNextReply, expectedReplyRevision }) {
    if (typeof skipNextReply !== 'boolean') throw new TypeError('skipNextReply must be a boolean')
    if (!['string', 'number'].includes(typeof identity(session))) throw new TypeError('A native session is required')
    const record = this.record(session.id)
    if (expectedReplyRevision !== record.revision) throw conflict()
    if (this.current(session, personalityId).status === 'active') throw Object.assign(new Error('The current reply has already started.'), { status: 409, code: 'MOOD_REPLY_ACTIVE' })
    this.save(session.id, { revision: record.revision + 1, personalityId, createdAt: identity(session), status: skipNextReply ? 'pending' : 'idle' })
    return this.view(session, personalityId)
  }
  clear(sessionId) {
    const record = this.record(sessionId)
    if (record.status === 'idle') return false
    this.save(sessionId, { revision: record.revision + 1, status: 'idle' })
    return true
  }
  claim(session, personalityId, turn, message) {
    if (message?.source?.kind !== 'user') return false
    const record = this.current(session, personalityId), start = this.activeTurn(session)
    if (record.status !== 'pending' || !start || start.data.turn !== turn) return false
    this.save(session.id, { ...record, revision: record.revision + 1, status: 'active', turn, startSeq: start.seq })
    return true
  }
  observe(session, event) {
    if (!['turn/start', 'turn/end'].includes(event.type)) return false
    if (event.type === 'turn/start') this.#turns.set(session, event)
    else if (this.#turns.get(session)?.data.turn === event.data.turn) this.#turns.set(session, null)
    const record = this.record(session.id)
    if (record.status !== 'active' || record.createdAt !== identity(session)) return false
    if (event.type === 'turn/end' && event.data.turn !== record.turn) return false
    if (event.type === 'turn/start' && event.seq === record.startSeq) return false
    return this.clear(session.id)
  }
  // Reading previews/background assemblies never claims a pending switch.
  suppressed(session, personalityId, { preview = false } = {}) {
    return !!session && !preview && this.current(session, personalityId).status === 'active'
  }
}

export function installMoodReplyHost(ctx, { cards, replies, notify, report }) {
  ctx.on('agent/inbox/claimed', ({ agent, message, turn }) => {
    try {
      const id = cards.selection(agent.session.id)?.characterCardId
      if (id && replies.claim(agent.session, id, turn, message)) notify()
    } catch (error) { report(error, agent.session.id) }
  })
  ctx.on('session/event', (session, event) => {
    try { if (cards.selection(session.id)?.characterCardId && replies.observe(session, event)) notify() }
    catch (error) { report(error, session.id) }
  })
  ctx.effect(() => cards.onBindingChange(sessionId => { if (replies.clear(sessionId)) notify() }))
}
