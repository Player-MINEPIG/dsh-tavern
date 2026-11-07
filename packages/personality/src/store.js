import { join } from 'node:path'
import { readFileSync } from 'node:fs'
import { CharacterStore } from '../../character/src/store.js'

/** CC resources and session bindings live in a separate library from RP characters. */
export class PersonalityStore extends CharacterStore {
  #bindings = new Map()
  #edits = new Map()
  #decisions = new Set()
  #defaults = new Set()
  #bindingListeners = new Set()
  constructor(storageDir) {
    super(join(storageDir, 'personality'))
    let saved
    try { saved = JSON.parse(readFileSync(this.statePath, 'utf8')) } catch (error) {
      if (error.code !== 'ENOENT') throw error
    }
    for (const id of Array.isArray(saved?.personalityDecidedSessions) ? saved.personalityDecidedSessions : []) {
      try { this.binding(id); this.#decisions.add(id) } catch {}
    }
    for (const id of Array.isArray(saved?.personalityDefaultSessions) ? saved.personalityDefaultSessions : []) {
      try { this.binding(id); if (!this.#decisions.has(id)) this.#defaults.add(id) } catch {}
    }
  }
  saveState() {
    this.state.personalityDecidedSessions = [...this.#decisions]
    this.state.personalityDefaultSessions = [...this.#defaults]
    super.saveState()
  }
  select(sessionId, patch) {
    this.binding(sessionId)
    if (patch !== null && patch?.characterCardId !== null) this.normalizeSelection(patch?.characterCardId, patch)
    this.#decisions.add(sessionId)
    this.#defaults.delete(sessionId)
    const result = super.select(sessionId, patch)
    this.#bindings.set(sessionId, (this.#bindings.get(sessionId) ?? 0) + 1)
    for (const listener of this.#bindingListeners) listener(sessionId)
    return result
  }
  selectDefault(sessionId, personalityId) {
    if (this.#decisions.has(sessionId) || (this.binding(sessionId) && !this.#defaults.has(sessionId))) return false
    if (personalityId !== null) {
      try { this.get(personalityId) } catch (error) {
        if (error.code !== 'CHARACTER_NOT_FOUND') throw error
        personalityId = null
      }
    }
    this.#defaults.add(sessionId)
    super.select(sessionId, personalityId === null ? null : { characterCardId: personalityId })
    this.#bindings.set(sessionId, (this.#bindings.get(sessionId) ?? 0) + 1)
    for (const listener of this.#bindingListeners) listener(sessionId)
    return true
  }
  update(id, patch, options) {
    const result = super.update(id, patch, options)
    this.#edits.set(id, (this.#edits.get(id) ?? 0) + 1)
    return result
  }
  delete(id) {
    const sessions = Object.entries(this.state.selectedBySessionId).filter(([, selection]) => selection.characterCardId === id).map(([sessionId]) => sessionId)
    super.delete(id)
    this.#edits.set(id, (this.#edits.get(id) ?? 0) + 1)
    for (const sessionId of sessions) for (const listener of this.#bindingListeners) listener(sessionId)
  }
  onBindingChange(listener) {
    this.#bindingListeners.add(listener)
    return () => this.#bindingListeners.delete(listener)
  }
  selectedSummary(sessionId) {
    const id = this.binding(sessionId)?.characterCardId
    if (!id) return null
    const indexed = this.scopeIndex.summary(id)
    if (indexed) return indexed
    const card = this.selectedCharacter(sessionId)?.character
    return card ? { id, name: card.name } : null
  }
  bindingLease(sessionId, id) {
    const binding = this.#bindings.get(sessionId), edit = this.#edits.get(id)
    return () => this.#bindings.get(sessionId) === binding && this.#edits.get(id) === edit
      && this.selection(sessionId)?.characterCardId === id
  }
}
