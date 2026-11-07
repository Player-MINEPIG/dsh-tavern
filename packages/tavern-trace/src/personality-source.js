import { PERSONALITY_SOURCE_ID, PLUGIN_ID } from '../../identity.js'

/** Legacy Trace records used "personality" for the card source. The RP
 * character source can also have a field called "personality". */
export function isPersonalitySource(source) {
  if (!source?.field || (source.plugin && source.plugin !== PLUGIN_ID)) return false
  if (source.kind) return source.kind === 'personality'
  const id = source.module ?? source.sourceId
  return id === PERSONALITY_SOURCE_ID || id === 'personality'
}
