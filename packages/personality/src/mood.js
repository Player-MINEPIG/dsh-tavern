import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { rmSync } from 'node:fs'
import { atomicJson, readJsonFile } from '../../play/src/atomic-json.js'

// Manual changes follow the personality. Inferred feelings stay in the originating work context.
const LIMIT = 2 * 1024 * 1024
const HALF_LIFE_MS = 4 * 60 * 60 * 1000
const invalid = message => { throw new TypeError(message) }
const conflict = () => Object.assign(new Error('The personality mood changed. Refresh and retry.'), { status: 409, code: 'MOOD_REVISION_CONFLICT' })
function bounded(value, length, name) {
  if (typeof value !== 'string' || !value.trim() || value.length > length) invalid('Invalid ' + name)
  return value.trim()
}
function normalizeMood(input, source, now) {
  if (input === null) return null
  if (!input || !Number.isInteger(input.intensity) || input.intensity < 1 || input.intensity > 5) invalid('Intensity must be an integer from 1 to 5')
  return { feeling: bounded(input.feeling, 80, 'feeling'), intensity: input.intensity,
    reason: input.reason === '' && source === 'manual' ? '' : bounded(input.reason, 500, 'reason'), updatedAt: now, source }
}
export class PersonalityMood {
  constructor(directory, { contextFor = id => id, now = Date.now } = {}) {
    this.directory = directory
    this.contextFor = contextFor
    this.now = now
  }
  file(id) {
    if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(id)) invalid('Invalid personality id')
    return join(this.directory, 'moods', id + '.json')
  }
  remove(id) {
    rmSync(this.file(id), { force: true })
  }
  record(id) {
    try { return readJsonFile(this.file(id), LIMIT) }
    catch (e) { if (e.code !== 'ENOENT') throw e }
    return { revision: 0, automatic: false, slots: {}, reviewed: {} }
  }
  context(sessionId) {
    const key = this.contextFor(sessionId) || sessionId
    return createHash('sha256').update(key).digest('hex')
  }
  read(id, sessionId) {
    const record = this.record(id)
    const scope = this.context(sessionId)
    const local = record.slots[scope], global = record.slots.global
    const state = local && (!global || local.revision > global.revision) ? local : global
    const mood = state?.mood
    const strength = mood ? Math.round(mood.intensity * Math.pow(0.5, Math.max(0, this.now() - mood.updatedAt) / HALF_LIFE_MS)) : 0
    return { personalityId: id, revision: record.revision, automatic: record.automatic,
      mood: strength > 0 ? { ...mood, intensity: strength } : null }
  }
  change(id, sessionId, patch, source = 'manual') {
    const file = this.file(id), record = this.record(id)
    if (patch.expectedRevision !== record.revision) throw conflict()
    const hasMood = Object.hasOwn(patch, 'mood')
    if (!hasMood && patch.automatic === undefined) invalid('A mood or automatic setting is required')
    if (patch.automatic !== undefined && typeof patch.automatic !== 'boolean') invalid('Invalid automatic setting')
    const now = this.now()
    if (patch.automatic !== undefined) record.automatic = patch.automatic
    record.revision += 1
    if (hasMood) {
      const slot = source === 'manual' ? 'global' : this.context(sessionId)
      record.slots[slot] = { revision: record.revision, mood: normalizeMood(patch.mood, source, now) }
    }
    atomicJson(file, record, LIMIT)
    return this.read(id, sessionId)
  }
  // Reserve a completed event before spending a provider call; restarts/replays never judge it twice.
  reserve(id, sessionId, createdAt, endSeq, expectedRevision, signature, mode) {
    const record = this.record(id)
    if (record.revision !== expectedRevision || !record.automatic) return false
    const key = createHash('sha256').update(JSON.stringify([sessionId, createdAt])).digest('hex')
    if ((record.reviewed[key] ?? -1) >= endSeq) return false
    const now = this.now(), scope = this.context(sessionId)
    const recent = (record.assessments ?? []).filter(row => row.at > now - 3600000)
    // Sample bounds for the opt-in scheduler: four model calls/hour per card;
    // repeated user input in the same context is coalesced for fifteen minutes.
    const assesses = mode === 'assess' || mode === 'resolve'
    if (assesses && (recent.length >= 4 || recent.some(r => r.scope === scope && r.signature === signature && r.at > now - 900000))) return false
    record.assessments = assesses ? [...recent, { at: now, scope, signature }] : recent
    record.reviewed[key] = endSeq
    atomicJson(this.file(id), record, LIMIT)
    return true
  }
}
