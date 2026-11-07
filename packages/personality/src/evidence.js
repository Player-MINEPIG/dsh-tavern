import { readOriginalTurn, evidenceHash } from './turn-assessment.js'

/** Resolve a saved reference only; the client never supplies coordinates, a source id, or text. */
export async function readRevisionEvidence(store, id, revision, inspectSession, signal) {
  const row = store.view(id).history.find(item => item.revision === revision)
  if (!row) throw Object.assign(new Error('Unknown personality revision'), { status: 404, code: 'EVOLUTION_REVISION_NOT_FOUND' })
  const refs = row.evidence?.items ?? [row.evidence]
  const results = []
  for (const ref of refs) results.push(await readReference(store, id, ref, inspectSession, signal))
  // Do not return the readable subset of a partially revoked batch as if it were complete.
  for (const item of results) {
    if (item.revalidate) {
      try { if (await item.revalidate() !== true) item.available = false }
      catch { item.available = false }
    }
  }
  const missing = results.find(r => !r.available || r.checkCurrent?.() === false)
  if (missing) return { available: false, text: null, kind: missing.kind, reason: missing.reason ?? 'source-version-unavailable' }
  return { available: true, kind: results[0].kind, text: results.map(r => r.text).join('\n\n') }
}

async function readReference(store, id, ref, inspectSession, signal) {
  const missing = reason => ({ available: false, kind: ref?.kind ?? null, text: null, reason })
  if (!ref) return missing('no-evidence')
  if (ref.kind === 'external') {
    const source = store.sources.get(ref.source)
    if (!source?.read || (source.supports && source.supports(id) !== true)) return missing('source-unavailable')
    let value
    try {
      value = await source.read({ personalityId: id, id: ref.id, version: ref.version, origin: structuredClone(ref.origin), signal })
      if (store.sources.get(ref.source) !== source || !value || value.id !== ref.id || value.version !== ref.version ||
        typeof value.text !== 'string' || value.text.length > 24000 || evidenceHash(value.text) !== ref.textHash ||
        value.checkCurrent?.() !== true) return missing('source-version-unavailable')
    } catch { return missing('source-unavailable') }
    return { available: true, kind: 'external', text: value.text, revalidate: value.revalidate?.bind(value), checkCurrent: () => store.sources.get(ref.source) === source && (!source.supports || source.supports(id) === true) && value.checkCurrent() === true }
  }
  if (typeof inspectSession !== 'function') return missing('session-unavailable')
  let record
  try { record = await inspectSession(ref.sessionId,signal) } catch { return missing('session-unavailable') }
  if (record?.meta?.id !== ref.sessionId || record.meta.createdAt !== ref.sessionCreatedAt || !Array.isArray(record.events)) return missing('session-unavailable')
  const turn = readOriginalTurn({ id: record.meta.id, header: record.meta, inheritedEventCount: record.inheritedEventCount,
    snapshotEvents: () => record.events }, ref)
  if (!turn) return missing('source-version-unavailable')
  const selectedTools = turn.tools?.filter(tool => ref.toolEvidence?.some(reference => reference.seq === tool.seq)) ?? []
  return { available: true, kind: 'original', text: [...turn.users.map(t => `user: ${t}`), ...selectedTools.map(tool => `tool ${tool.name} (event ${tool.seq}): ${tool.text}`), `assistant: ${turn.assistant}`].join('\n\n') }
}
