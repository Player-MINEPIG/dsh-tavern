import { createAssemblyBodyReader } from './body-references.js'

/** Replay the recorded cut through public DSH Session primitives, never attach it. */
export function createNativeRequestReader({ assemblies, sessionController, sessions }) {
  const readBodies = createAssemblyBodyReader(sessionController, { deriveAtCut(inspection, cut) {
    const service = sessions(), id = inspection.meta.id
    const prefix = inspection.events.filter(event => event.seq <= cut)
    const inherited = Math.min(inspection.inheritedEventCount ?? 0, prefix.length)
    const live = service.get(id)
    const replay = live ? live.constructor.fromRestore(id, prefix, inspection.meta,
      inherited, 'detached', service.messageProjections) : service.prepare(id, { seed: prefix,
      meta: inspection.meta, inheritedEventCount: inherited, eventState: 'detached' })
    return replay.deriveMessages()
  } })
  return { readBodies, async readActual(sessionId) {
    const summary = assemblies.list(sessionId).filter(row => row.nativeRequestRef).at(-1)
    if (!summary) return null
    const record = await readBodies(assemblies.get(sessionId, summary.id))
    return { request: record.nativeRequest ?? null, backend: 'native', recordKind: 'native-request-reference',
      seq: record.sessionRef.logCutSeq }
  } }
}
