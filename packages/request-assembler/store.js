import { mkdirSync, readFileSync, writeFileSync, renameSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { BUILTINS, normalizePreset } from './model.js'

export class AssemblyPresetStore {
  constructor(root) {
    mkdirSync(root, { recursive: true }); this.path = join(root, 'assembly-presets.json')
    this.state = { version: 1, presets: {}, selections: {} }
    try {
      const raw = readFileSync(this.path, 'utf8')
      if (Buffer.byteLength(raw) > 8 * 1024 * 1024) throw new Error('Assembly store exceeds limit')
      const state = JSON.parse(raw)
      if (state.version !== 1 || !state.presets || !state.selections) throw new Error('Invalid assembly store')
      const clean = { version: 1, presets: {}, selections: {} }
      for (const [id, preset] of Object.entries(state.presets)) {
        if (!/^[a-zA-Z0-9_-]{1,200}$/.test(id) || ['__proto__', 'constructor', 'prototype'].includes(id) || id.startsWith('builtin-')) throw new Error('Invalid stored preset id')
        clean.presets[id] = { ...normalizePreset(preset), id }
      }
      for (const [id, preset] of Object.entries(state.selections)) {
        if (!validSession(id) || (preset !== null && typeof preset?.id !== 'string')) throw new Error('Invalid stored selection')
        clean.selections[id] = preset === null ? null : { ...normalizePreset(preset), id: preset.id }
      }
      this.state = clean
    } catch (error) { if (error.code !== 'ENOENT') throw error }
  }
  persist(next) {
    const text = JSON.stringify(next)
    if (Buffer.byteLength(text) > 8 * 1024 * 1024) throw new TypeError('Assembly store exceeds limit')
    const temp = `${this.path}.${randomUUID()}.tmp`
    writeFileSync(temp, text, { mode: 0o600 })
    try { renameSync(temp, this.path) } catch (error) { unlinkSync(temp); throw error }
    this.state = next
  }
  list() { return structuredClone([...BUILTINS.map(p => ({ ...p, builtin: true })), ...Object.values(this.state.presets)]) }
  get(id) {
    const preset = this.list().find(p => p.id === id)
    if (!preset) throw Object.assign(new Error('Assembly preset not found'), { status: 404 })
    return preset
  }
  save(value, id) {
    if (id?.startsWith('builtin-')) throw new TypeError('Copy a built-in preset before editing')
    if (id !== undefined) this.get(id)
    const preset = { ...normalizePreset(value), id: id ?? randomUUID() }
    const next = structuredClone(this.state); next.presets[preset.id] = preset; this.persist(next); return preset
  }
  remove(id) {
    this.get(id)
    if (id.startsWith('builtin-')) throw new TypeError('Built-in presets cannot be deleted')
    if (Object.values(this.state.selections).some(s => s?.id === id)) throw Object.assign(new Error('Preset is applied to a session'), { status: 409 })
    const next = structuredClone(this.state); delete next.presets[id]; this.persist(next)
  }
  selection(sessionId) { return validSession(sessionId) ? structuredClone(this.state.selections[sessionId] ?? null) : null }
  apply(sessionId, id) {
    if (!validSession(sessionId)) throw new TypeError('Invalid session id')
    const next = structuredClone(this.state)
    if (id === null) next.selections[sessionId] = null
    else next.selections[sessionId] = this.get(id)
    this.persist(next); return this.selection(sessionId)
  }
  copySelection(from, to) {
    if (!validSession(to)) throw new TypeError('Invalid session id')
    const selected = this.selection(from)
    if (Object.hasOwn(this.state.selections, to)) return
    const next = structuredClone(this.state); next.selections[to] = selected; this.persist(next)
  }
}
const validSession = id => typeof id === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/.test(id) && !['__proto__', 'constructor', 'prototype'].includes(id)
