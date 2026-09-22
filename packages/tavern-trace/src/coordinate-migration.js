import { isDeepStrictEqual } from 'node:util'
import { digest } from '../../prompt-metadata.js'
import { createAssemblyBodyReader } from './body-references.js'

/** Offline upgrade only, supplied with fully verified official migration artifacts. */
export async function migrateTraceCoordinates(value, maps) {
  const result = structuredClone(value)
  const records = result.schemaVersion === 1 && result.sessions
    ? Object.values(result.sessions).flatMap(bucket => bucket.records ?? [])
    : [3, 4].includes(result.schemaVersion) && Array.isArray(result.records) ? result.records : null
  if (!records) throw new Error('Invalid Trace store')
  for (const record of records) {
    const map = maps.get(record.sessionId)
    if (!map) continue
    const version = record.sessionFormatVersion ?? record.sessionRef?.sessionFormatVersion ?? record.delivery?.sessionVersion
      ?? record.failureRef?.sessionRef?.sessionFormatVersion
    const versions = [record.sessionFormatVersion, record.sessionRef?.sessionFormatVersion, record.delivery?.sessionVersion,
      record.failureRef?.sessionRef?.sessionFormatVersion, record.audit?.sessionFormatVersion].filter(item => item != null)
    if (versions.some(item => item !== version)) throw new Error('Trace record contains inconsistent coordinate formats')
    if (version === map.targetVersion) continue
    if (version !== undefined && version !== map.sourceVersion) throw new Error('Trace coordinate format differs from retained source')
    const old = structuredClone(record)
    const coordinate = seq => {
      if (!Number.isSafeInteger(seq) || seq < 0 || !Number.isSafeInteger(map[seq])) throw new Error(`No verified Trace coordinate for ${record.sessionId} event ${seq}`)
      return map[seq]
    }
    const sessionRef = ref => {
      if (ref.sessionId !== record.sessionId || ref.sessionFormatVersion !== map.sourceVersion
        || ref.sessionCreatedAt !== map.sourceArtifact.header.createdAt) throw new Error('Trace Session identity differs from retained source')
      ref.logCutSeq = coordinate(ref.logCutSeq)
      ref.sessionFormatVersion = map.targetVersion
    }
    for (const ref of [record.sessionRef, record.failureRef?.sessionRef].filter(Boolean)) sessionRef(ref)
    const references = [...(record.sections ?? []).map(part => part.reference),
      ...(record.contexts ?? []).map(part => part.reference), ...(record.systemMessageRefs ?? []), record.failureRef].filter(Boolean)
    for (const ref of references) {
      const source = map.sourceArtifact.events[ref.eventSeq]
      const targetSeq = coordinate(ref.eventSeq)
      const target = map.targetArtifact.events[targetSeq]
      if (source?.type !== ref.eventType || target?.type !== ref.eventType) throw new Error('Trace event identity changed during migration')
      if (ref.kind === 'request-header-system') throw new Error('Legacy header body references require retained historical inspection; cannot upgrade them to V4')
      if (ref.eventHash !== undefined) {
        if (ref.eventHash !== digest(source.data)) throw new Error('Trace error reference hash differs from retained source')
        ref.eventHash = digest(target.data)
      }
      ref.eventSeq = targetSeq
    }
    if (record.delivery) {
      if (record.delivery.sessionVersion !== null && record.delivery.sessionVersion !== map.sourceVersion) throw new Error('Trace delivery format differs from retained source')
      if (record.delivery.logCutSeq !== null && record.delivery.logCutSeq !== undefined) record.delivery.logCutSeq = coordinate(record.delivery.logCutSeq)
      record.delivery.sessionVersion = map.targetVersion
    }
    for (const audit of [record, record.audit].filter(Boolean)) {
      if (audit.authority?.headerEventSeq != null) {
        const seq = audit.authority.headerEventSeq
        if (map.sourceArtifact.events[seq]?.type !== 'request/header') throw new Error('Trace header reference does not identify a request/header')
        audit.authority.headerEventSeq = coordinate(seq)
      }
      if (Array.isArray(audit.activation?.claimEventSeqs)) audit.activation.claimEventSeqs = audit.activation.claimEventSeqs.map(coordinate)
      audit.sessionFormatVersion = map.targetVersion
    }
    // Resolve both generations with the production cold reader. Preserve content,
    // message identities, section hashes and error meanings; never invent a body.
    if (old.bodyStorage === 'official-session' && references.length) {
      const read = artifact => createAssemblyBodyReader({ inspect: async () => ({ meta: artifact.header, events: artifact.events }) })
      const before = await read(map.sourceArtifact)(old)
      const after = await read(map.targetArtifact)(record)
      for (const key of ['sections', 'contexts']) for (let i = 0; i < (old[key] ?? []).length; i++) {
        if (!old[key][i].reference) continue
        if (before[key][i].contentStatus !== 'available' || after[key][i].contentStatus !== 'available'
          || before[key][i].text !== after[key][i].text) throw new Error('Trace body reference cannot be verified across migration')
      }
      if (old.systemMessageRefs?.some(Boolean) && (!before.systemMessages || !after.systemMessages
        || !isDeepStrictEqual(before.systemMessages, after.systemMessages))) throw new Error('Trace system references cannot be verified across migration')
      if (old.failureRef && (before.failureStatus !== 'available' || after.failureStatus !== 'available'
        || !isDeepStrictEqual(before.failure, after.failure))) throw new Error('Trace failure reference cannot be verified across migration')
    }
  }
  return result
}
