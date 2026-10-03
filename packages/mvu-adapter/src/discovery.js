import { createHash } from 'node:crypto'
import { mvuResourceFromCharacter } from './character.js'

export const characterMvuId = characterId => `mvu:character-${createHash('sha256').update(characterId).digest('hex').slice(0, 32)}`

/** Host-only discovery. No card execution, automatic enablement or wildcard grants. */
export function createCharacterDiscovery({ characters, selections, service }) {
  return async sessionId => {
    const selected = sessionId ? selections.get(sessionId)?.characterCardId : null
    for (const summary of characters.list()) {
      const id = characterMvuId(summary.id)
      const existing = service().templates.find(r => r.id === id)
      // Initialization belongs to resource creation, never to each turn or selection.
      if (existing && !existing.sourceError) {
        continue
      }
      const options = { id, name: summary.name, characterId: summary.id, sessionIds: [], managementMode: 'managed' }
      let definition
      try { definition = mvuResourceFromCharacter(characters.get(summary.id), options) }
      catch (error) {
        if (error.code === 'MVU_INITIALIZATION_MISSING') continue
        definition = { ...options, sourceError: error.code ?? 'MVU_INITIALIZATION_INVALID', initial: { stat_data: {} } }
      }
      await service().discover({ definition })
    }
    if (sessionId) await service().syncDiscoveredSelection(sessionId, selected ? characterMvuId(selected) : null)
  }
}
