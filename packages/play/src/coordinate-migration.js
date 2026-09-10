import { normalizeTimeline } from './timeline.js'
import { variantFormatVersion, withVariantFormat } from './session-coordinates.js'

function coordinate(maps, sessionId, seq) {
  const value = maps.get(sessionId)?.[seq]
  if (!Number.isSafeInteger(seq) || seq < 0 || !Number.isSafeInteger(value)) {
    throw new Error(`No verified historical→V3 coordinate for ${sessionId} event ${seq}`)
  }
  return value
}

export function migrateTimelineCoordinates(value, maps) {
  const timeline = normalizeTimeline(structuredClone(value))
  for (const node of timeline.nodes) {
    node.variants = node.variants.map(variant => {
      const version = variantFormatVersion(variant)
      if (version === 3) return variant
      if (!maps.has(variant.sessionId)) throw new Error(`Missing Session mapping for ${variant.sessionId}`)
      if (version !== undefined && version !== (maps.get(variant.sessionId).sourceVersion ?? 2)) throw new Error(`Unsupported coordinate format ${version}`)
      return withVariantFormat({ ...variant,
        startEventId: coordinate(maps, variant.sessionId, variant.startEventId),
        endEventId: coordinate(maps, variant.sessionId, variant.endEventId),
      }, 3)
    })
  }
  return timeline
}

function identity(maps, sessionId, value) {
  if (typeof value !== 'string' || !/^event-seqs:\d+(,\d+)*$/.test(value)) throw new Error('Invalid import claim identity')
  return 'event-seqs:' + value.slice('event-seqs:'.length).split(',').map(seq => coordinate(maps, sessionId, Number(seq))).join(',')
}

export function migrateImportCoordinates(value, maps) {
  const result = structuredClone(value)
  if (result.schemaVersion !== 1 || typeof result.sessions !== 'object' || result.sessions === null) throw new Error('Invalid import bindings')
  for (const [sessionId, binding] of Object.entries(result.sessions)) {
    if (!maps.has(sessionId) && maps.has(binding.lineage?.sourceSessionId) && binding.sessionFormatVersion !== 3) {
      throw new Error(`Missing Session mapping for import lineage owner ${sessionId}`)
    }
    if (binding.sessionFormatVersion === 3 || !maps.has(sessionId)) continue
    if (binding.sessionFormatVersion !== undefined && binding.sessionFormatVersion !== (maps.get(sessionId).sourceVersion ?? 2)) throw new Error('Unsupported import coordinate format')
    if (binding.claim) {
      const oldIdentity = 'event-seqs:' + binding.claim.eventSeqs.join(',')
      if (binding.claim.identity !== oldIdentity) throw new Error('Import claim identity does not match its coordinates')
      binding.claim.identity = identity(maps, sessionId, oldIdentity)
      binding.claim.eventSeqs = binding.claim.eventSeqs.map(seq => coordinate(maps, sessionId, seq))
    }
    if (binding.terminal) binding.terminal.endEventSeq = coordinate(maps, sessionId, binding.terminal.endEventSeq)
    if (binding.lineage) {
      const lineage = binding.lineage
      const source = lineage.sourceSessionId
      lineage.sourceEndEventSeq = coordinate(maps, source, lineage.sourceEndEventSeq)
      lineage.forkEventSeq = coordinate(maps, source, lineage.forkEventSeq)
      if (lineage.sourceClaimIdentity !== undefined) lineage.sourceClaimIdentity = identity(maps, source, lineage.sourceClaimIdentity)
    }
    binding.sessionFormatVersion = 3
  }
  return result
}
