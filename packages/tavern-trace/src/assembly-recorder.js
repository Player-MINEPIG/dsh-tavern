import { randomUUID } from 'node:crypto'
import { digest, counts } from '../../prompt-metadata.js'
import { captureBodyReferences, messageText } from './body-references.js'
import { captureFailureReference } from './failure-references.js'

// Equivalent simple references only. Unsupported/malformed input is not guessed;
// the official renderer still owns acceptance, and llm/stream verifies delivery.
function render(text, variables) {
  return text.replace(/\{\{([^{}]*)\}\}/g, (_, key) => {
    if (!/^[a-z][a-z0-9_]*$/.test(key) || !Object.hasOwn(variables, key) || typeof variables[key] !== 'string') throw new Error('Unresolved assembly variable')
    return variables[key]
  })
}
function sectionSnapshot(section, variables, known, index) {
  const text = render(section.text, variables)
  const origin = known.find(p => p.name === section.name && p.text === section.text)
  return { name: section.name, index, text, ...counts(text), hash: digest(text),
    provenance: origin?.provenance ?? 'unknown', sources: (origin?.sources ?? []).map(({ text, ...source }) => ({
      ...structuredClone(source), hash: digest(text ?? ''), textStatus: 'not-stored',
    })) }
}

export class AssemblyRecorder {
  constructor(store) { this.store = store; this.pending = new Map(); this.active = new Map() }
  track(record) {
    this.active.delete(record.sessionId)
    this.active.set(record.sessionId, { id: record.id, turn: record.turn, step: record.step })
    while (this.active.size > 128) {
      const id = this.active.keys().next().value
      this.finish(id, 'superseded-unconfirmed')
      this.active.delete(id)
    }
  }
  nextRequest(sessionId) {
    this.finish(sessionId, 'superseded-unconfirmed')
    this.active.delete(sessionId)
  }
  begin({ agent, turn, step, snapshot, legacyRecord }) {
    const id = agent?.id
    if (!id || !Number.isSafeInteger(turn) || !Number.isSafeInteger(step)) return
    const previous = this.pending.get(id)
    if (previous) this.finish(id, 'superseded-unconfirmed')
    const assembly = snapshot?.officialAssembly
    const record = { schemaVersion: 4, id: legacyRecord?.captureId ?? randomUUID(), sessionId: id, turn, step,
      attempt: Math.max(0, ...this.store.list(id).filter(r => r.id !== legacyRecord?.captureId && r.turn === turn && r.step === step).map(r => r.attempt)) + 1,
      recordedAt: Date.now(), status: 'assembled', contentStatus: 'reference-only',
      bodyStorage: 'official-session', sourceTextStored: false,
      sourceMapping: 'section-contributors', audit: structuredClone(legacyRecord ?? {}),
      selection: structuredClone(snapshot?.audit?.sessionSelection ?? {}),
      sections: [], contexts: [], captureStage: 'tavern-waterfall-return', entersModelHistory: false }
    try {
      if (!assembly) throw new Error('No captured assembly')
      record.sections = assembly.sections.map((s, i) => sectionSnapshot(s, assembly.variables, snapshot.sections ?? [], i)).filter(s => s.text !== '')
      record.contexts = assembly.contexts.map((s, i) => sectionSnapshot(s, assembly.variables, [], i)).filter(s => s.text !== '')
      record.assemblyHash = digest(record.sections.map(section => section.text).join('\n\n'))
      let offset = 0
      for (const section of record.sections) { section.offsetUtf16 = offset; offset += section.utf16Units + 2 }
      for (const section of [...record.sections, ...record.contexts]) delete section.text
    } catch { record.contentStatus = 'assembly-unavailable'; record.sections = []; record.contexts = [] }
    this.pending.set(id, record)
    while (this.pending.size > 128) this.finish(this.pending.keys().next().value, 'superseded-unconfirmed')
    this.store.put(record)
    this.track(record)
  }
  request(options, session) {
    const record = this.pending.get(options.sessionId)
    if (!record) return null
    const systems = typeof options.system === 'string' ? [options.system]
      : (options.messages ?? []).filter(m => m.role === 'system').map(messageText)
    const indices = systems.flatMap((text, index) => digest(text) === record.assemblyHash ? [index] : [])
    // Only an exact unique whole-message match establishes output offsets.
    const verified = record.contentStatus === 'reference-only' && indices.length === 1
    record.delivery = { stage: 'llm/stream',
      logCutSeq: Number.isSafeInteger(session?.seq) ? session.seq - 1 : null,
      sessionVersion: session?.header?.version ?? null, systemHashes: systems.map(digest),
      assemblyVerified: verified, systemMessageIndex: verified ? indices[0] : null,
      provider: options.provider, model: options.model, toolNames: (options.tools ?? []).map(t => t.name) }
    Object.assign(record, captureBodyReferences(session, options, record.sections, record.contexts, verified ? indices[0] : null))
    record.delivery.historyVerified = verified && Boolean(record.systemMessageRefs?.[indices[0]])
    record.status = 'request-observed'
    this.store.put(record)
    this.pending.delete(options.sessionId)
    return record.id
  }
  failure({ agent, turn, step }) {
    const id = agent?.id
    if (!id || !Number.isSafeInteger(turn) || !Number.isSafeInteger(step)) return
    if (this.pending.has(id)) return this.finish(id, 'request-failed-before-observation')
    const active = this.active.get(id)
    if (active?.turn === turn && active?.step === step) return
    const attempt = Math.max(0, ...this.store.list(id).filter(r => r.turn === turn && r.step === step).map(r => r.attempt)) + 1
    const record = this.store.put({ schemaVersion: 4, id: randomUUID(), sessionId: id, turn, step, attempt,
      bodyStorage: 'official-session', sourceTextStored: false,
      recordedAt: Date.now(), status: 'assembly-or-preparation-failed', contentStatus: 'assembly-unavailable', entersModelHistory: false })
    this.track(record)
  }
  observeSessionEvent(session, event) {
    if (!['assistant/attempt', 'assistant/message', 'turn/end'].includes(event?.type)) return
    const active = this.active.get(session?.id)
    if (!active || active.turn !== event.data?.turn
      || (event.type !== 'turn/end' && active.step !== event.data?.step)) return
    if (event.type === 'assistant/message') {
      this.finish(session.id, 'request-unconfirmed')
      this.active.delete(session.id)
      return
    }
    const record = this.store.get(session.id, active.id)
    if (record && !record.failureRef) {
      const failureRef = captureFailureReference(session, event)
      if (failureRef) {
        const patch = { failureRef, failureStatus: 'reference-only' }
        const pending = this.pending.get(session.id)
        if (pending?.id === record.id) Object.assign(pending, patch)
        this.store.put({ ...record, ...patch })
      }
    }
    if (event.type === 'turn/end') this.active.delete(session.id)
  }
  finish(sessionId, status) {
    const record = this.pending.get(sessionId)
    if (!record) return
    this.pending.delete(sessionId)
    this.store.put({ ...record, status })
  }
  dispose() { for (const id of this.pending.keys()) this.finish(id, 'unloaded-unconfirmed'); this.active.clear() }
}
