// Read only the verified request returned by the existing Trace body reader.
// Activation decisions are candidates; current source configuration is irrelevant.
export function worldBookRequestOutcome(record, book) {
  const id = book.resource?.id, request = record.requestAssembly, assembly = request?.metadata?.assembly
  if (typeof id !== 'string' || !id || id.endsWith('…') || request?.metadata?.owner !== 'pmp-dsh-tavern' || !assembly || assembly.preview
    || request.turn !== record.turn || request.step !== record.step
    || (record.audit?.worldBooks ?? []).filter(row => row.resource?.id === id).length !== 1) return null
  const flatten = nodes => nodes.flatMap(node => [node, ...flatten(node.children ?? [])])
  const nodes = flatten(assembly.nodes ?? []), diagnostics = assembly.diagnostics ?? []
  const skips = diagnostics.filter(fact => fact.code === 'WORLD_BOOK_POLICY_SKIPPED' && fact.resourceId === `world-book:${id}`)
  const applied = record.status === 'request-observed' && diagnostics.some(fact => ['TAVERN_MEMORY_RESOURCE_VERSION', 'TAVERN_MEMORY_DEPENDENCY_VERSION'].includes(fact.code)
    && fact.adapterId === 'tavern.world-books' && fact.resourceId === `world-book:${id}`
    && nodes.some(node => node.source?.sourceId === fact.sourceId && node.source?.resourceId === (fact.consumerId ?? fact.blockResourceId ?? fact.resourceId)
      && (node.id?.endsWith(`:${fact.blockId}`) || node.name === fact.blockId)))
  return { applied, skipped: skips.length > 0, reasons: [...new Set(skips.map(fact => typeof fact.reason === 'string' && fact.reason ? fact.reason : null))] }
}
