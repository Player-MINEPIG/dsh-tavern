function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function clone(value) {
  return structuredClone(value)
}

function loaderPosition(position) {
  switch (position) {
    case 'before_character_definition':
      return { position: 'before', approximate: false }
    case 'after_character_definition':
      return { position: 'after', approximate: false }
    case 'before_example_messages':
    case 'before_author_note':
      return { position: 'before', approximate: true }
    case 'after_example_messages':
    case 'after_author_note':
    case 'at_depth':
      return { position: 'after', approximate: true }
    case 'outlet':
      return { position: null, approximate: true }
    default:
      return { position: 'after', approximate: true }
  }
}

function entryIdentity(entry, resourceId, candidateKey) {
  const uid = entry?.uid
  return {
    id: resourceId === '' ? candidateKey : `${resourceId}:${String(uid ?? candidateKey)}`,
    uid,
  }
}

function auditDecision(candidate, resourceId, decision, reason, projected = {}) {
  const entry = candidate.entry
  return {
    resourceId,
    entryId: entry?.uid,
    entryName: typeof entry?.comment === 'string' ? entry.comment : '',
    decision,
    reason,
    primaryKeys: clone(Array.isArray(entry?.keys) ? entry.keys : []),
    secondaryKeys: clone(Array.isArray(entry?.secondaryKeys) ? entry.secondaryKeys : []),
    primaryMatches: clone(candidate.primaryMatches ?? []),
    secondaryMatches: clone(candidate.secondaryMatches ?? []),
    secondaryLogic: entry?.selective === true ? entry.selectiveLogic : null,
    groupName: typeof entry?.group?.name === 'string' && entry.group.name !== '' ? entry.group.name : null,
    groupWeight: Number.isFinite(entry?.group?.weight) ? entry.group.weight : null,
    groupOverride: entry?.group?.override === true,
    probability: Number.isFinite(candidate.probability)
      ? candidate.probability
      : entry?.useProbability === false ? 100 : Number.isFinite(entry?.probability) ? entry.probability : null,
    probabilityRoll: Number.isFinite(candidate.probabilityRoll) ? candidate.probabilityRoll : null,
    tokenCost: Number.isFinite(candidate.tokenCost) ? candidate.tokenCost : null,
    requestedPosition: typeof entry?.position === 'string' ? entry.position : null,
    appliedPosition: projected.position ?? null,
    approximatePosition: projected.approximate === true,
  }
}

function invalidRegexDiagnostics(candidate, resourceId) {
  return (candidate.invalidKeys ?? []).map(item => ({
    code: item.code === 'unsafe-regex-disabled'
      ? 'WORLD_BOOK_REGEX_DISABLED'
      : item.code === 'regex-too-long'
        ? 'WORLD_BOOK_REGEX_TOO_LONG'
        : 'WORLD_BOOK_INVALID_REGEX',
    severity: 'warning',
    message: item.code === 'unsafe-regex-disabled'
      ? `World book regex key ${JSON.stringify(item.key)} was not executed because native regex matching is disabled`
      : item.code === 'regex-too-long'
        ? `World book regex key ${JSON.stringify(item.key)} exceeds the configured length limit`
        : `World book key ${JSON.stringify(item.key)} is not a valid JavaScript regular expression`,
    resourceId,
    entryId: candidate.entry?.uid,
    keySet: item.set,
    detail: item.error,
  }))
}

/**
 * Purely projects one normalized model and one deterministic match result onto
 * TavernProfileLoader's adapter result shape. It does not select resources,
 * inspect sessions, register an adapter, or compile a prompt.
 */
export function projectWorldBookForLoader(model, candidates, options = {}) {
  if (!isRecord(model) || model.kind !== 'world-book' || !Array.isArray(model.entries)) {
    throw new TypeError('Expected a WorldBookModel')
  }
  if (!isRecord(candidates) || !Array.isArray(candidates.accepted) || !Array.isArray(candidates.rejected)) {
    throw new TypeError('Expected computeWorldBookCandidates() output')
  }

  const providedResource = isRecord(options.resource) ? clone(options.resource) : {}
  const resourceId = String(providedResource.id ?? options.resourceId ?? model.name ?? '')
  const resourceName = String(providedResource.name ?? options.resourceName ?? model.name ?? '')
  const diagnostics = [
    ...clone(Array.isArray(model.diagnostics) ? model.diagnostics : []),
    ...clone(Array.isArray(options.diagnostics) ? options.diagnostics : []),
  ]
  for (const candidate of [...candidates.accepted, ...candidates.rejected]) {
    diagnostics.push(...invalidRegexDiagnostics(candidate, resourceId))
  }

  const loreEntries = []
  const decisions = candidates.rejected.map(candidate => auditDecision(
    candidate,
    resourceId,
    'rejected',
    candidate.reason,
  ))
  for (const candidate of candidates.accepted) {
    const entry = candidate.entry
    const identity = entryIdentity(entry, resourceId, candidate.key)
    if (typeof entry?.content !== 'string' || entry.content.trim() === '') {
      diagnostics.push({
        code: 'WORLD_BOOK_EMPTY_CONTENT_SKIPPED',
        severity: 'info',
        message: 'An activated world-book entry had no content and was not delivered to the loader',
        resourceId,
        entryId: entry?.uid,
      })
      decisions.push(auditDecision(candidate, resourceId, 'rejected', 'empty-content'))
      continue
    }

    const projected = loaderPosition(entry.position)
    if (projected.position === null) {
      diagnostics.push({
        code: 'WORLD_BOOK_OUTLET_SKIPPED',
        severity: 'info',
        message: 'Outlet entries require explicit macro placement and were not auto-injected',
        resourceId,
        entryId: entry.uid,
        originalPosition: entry.position,
      })
      decisions.push(auditDecision(candidate, resourceId, 'rejected', 'outlet-unsupported', projected))
      continue
    }
    if (projected.approximate) {
      diagnostics.push({
        code: 'WORLD_BOOK_POSITION_APPROXIMATED',
        severity: 'warning',
        message: `Mapped unsupported loader position ${entry.position} to ${projected.position}`,
        resourceId,
        entryId: entry.uid,
        originalPosition: entry.position,
        position: projected.position,
      })
    }
    loreEntries.push({
      id: identity.id,
      uid: identity.uid,
      content: entry.content,
      position: projected.position,
    })
    decisions.push(auditDecision(candidate, resourceId, 'included', candidate.reason, projected))
  }

  const activeEntryIds = loreEntries.map(entry => entry.id)
  const resource = {
    ...providedResource,
    id: resourceId,
    name: resourceName,
    format: model.source?.format ?? null,
    entryCount: model.entries.length,
    matchedEntryCount: candidates.accepted.length,
    activeEntryIds,
  }
  return {
    loreEntries,
    resources: [resource],
    diagnostics,
    audit: {
      resources: [{
        resource: clone(resource),
        budget: clone(candidates.budget ?? { limit: null, used: 0, remaining: null }),
        decisions,
      }],
    },
  }
}

/** Combines independently projected selected books without adding policy. */
export function mergeWorldBookLoaderResults(results) {
  if (!Array.isArray(results)) throw new TypeError('results must be an array')
  return results.reduce((merged, result) => {
    if (!isRecord(result)) return merged
    if (Array.isArray(result.loreEntries)) merged.loreEntries.push(...clone(result.loreEntries))
    if (Array.isArray(result.resources)) merged.resources.push(...clone(result.resources))
    if (Array.isArray(result.diagnostics)) merged.diagnostics.push(...clone(result.diagnostics))
    if (Array.isArray(result.audit?.resources)) merged.audit.resources.push(...clone(result.audit.resources))
    return merged
  }, { loreEntries: [], resources: [], diagnostics: [], audit: { resources: [] } })
}
