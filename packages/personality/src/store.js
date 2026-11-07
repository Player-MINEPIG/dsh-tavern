import { join } from 'node:path'
import { CharacterStore } from '../../character/src/store.js'

/** CC resources and session bindings live in a separate library from RP characters. */
export class PersonalityStore extends CharacterStore {
  #bindings = new Map()
  #edits = new Map()
  constructor(storageDir) { super(join(storageDir, 'personality')) }
  select(sessionId, patch) {
    const result = super.select(sessionId, patch)
    this.#bindings.set(sessionId, (this.#bindings.get(sessionId) ?? 0) + 1)
    return result
  }
  update(id, patch, options) {
    const result = super.update(id, patch, options)
    this.#edits.set(id, (this.#edits.get(id) ?? 0) + 1)
    return result
  }
  delete(id) {
    super.delete(id)
    this.#edits.set(id, (this.#edits.get(id) ?? 0) + 1)
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
