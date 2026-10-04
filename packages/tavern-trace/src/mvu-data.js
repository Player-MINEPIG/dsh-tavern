import { API_V1 } from '../../identity.js'
import { tavernFetch } from '../../client/src/api-fetch.js'

const pointer = key => String(key).replace(/~/g, '~0').replace(/\//g, '~1')
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b)
export const variableType = value => value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value
export function flattenVariables(value, parts = [], result = []) {
  if (value !== null && typeof value === 'object' && Object.keys(value).length) {
    for (const key of Object.keys(value)) flattenVariables(value[key], [...parts, key], result)
  } else result.push({ path: '/stat_data' + parts.map(key => '/' + pointer(key)).join(''), parts, value, type: variableType(value) })
  return result
}
export function variableChanges(before, after, available = true) {
  const old = new Map(available ? flattenVariables(before).map(row => [row.path, row.value]) : [])
  const next = new Map(flattenVariables(after).map(row => [row.path, row.value]))
  return [...new Set([...old.keys(), ...next.keys()])].filter(path => !available || !old.has(path) || !next.has(path) || !equal(old.get(path), next.get(path)))
    .map(path => ({ path, beforeKnown: available, beforePresent: old.has(path), afterPresent: next.has(path), before: old.get(path), after: next.get(path) }))
}
export function editVariable(content, parts, text) {
  const value = JSON.parse(text), copy = structuredClone(content)
  if (parts.some(key => ['__proto__', 'prototype', 'constructor'].includes(key))) throw new Error('Invalid variable path')
  if (!parts.length) copy.stat_data = value
  else {
    let parent = copy.stat_data
    for (const key of parts.slice(0, -1)) {
      if (!parent || !Object.hasOwn(parent, key)) throw new Error('Variable path changed')
      parent = parent[key]
    }
    const key = parts.at(-1)
    if (!parent || !Object.hasOwn(parent, key)) throw new Error('Variable path changed')
    parent[key] = value
  }
  return copy
}
export const versionTurn = version => version.action ? version.action.turn : version.source.turn
export function roundSnapshot(versions, turn) {
  // A version key identifies the exact source receipt. Current content is never
  // substituted for a missing historical turn, including after card selection.
  return versions.filter(version => versionTurn(version) === turn).at(-1) ?? null
}
export function rowsAt(content, versions, selected) {
  const boundary = selected ? versions.findIndex(version => version.key === selected.key) : versions.length - 1
  const updates = new Map()
  for (const version of versions.slice(0, boundary + 1)) {
    if (version.error || !version.beforeAvailable) continue
    for (const change of variableChanges(version.before, version.variables.stat_data)) updates.set(change.path, { ...version.source, turn: versionTurn(version) })
  }
  return flattenVariables(content.stat_data).map(row => ({ ...row, updated: updates.get(row.path) ?? null }))
}
export function roundEvents(versions, facts, turn) {
  const events = [], current = new Map()
  const inRound = source => source.turn === turn || turn === 1 && source.turn === 0
  for (const fact of facts.filter(inRound)) {
    let row = current.get(fact.eventId)
    if (!row || fact.phase === 'started') {
      row = { key: `${fact.eventId}:${events.length}`, eventId: fact.eventId, phases: [], changes: [] }
      events.push(row); current.set(fact.eventId, row)
    }
    Object.assign(row, fact, { phases: [...new Set([...row.phases, fact.phase])],
      reason: fact.reason ?? (['failed', 'skipped'].includes(fact.phase) ? fact.detail : row.reason) })
  }
  for (const version of versions.filter(version => inRound({ turn: versionTurn(version) }))) {
    const eventId = version.source.card ? version.operationId : version.key
    // A retry and an idempotent replay are distinct attempts. Only the actual
    // committing/failing attempt receives this version's state comparison.
    let row = events.findLast(event => event.eventId === eventId && event.revision === version.revision
      && event.detail !== 'idempotent-replay' && (version.error ? event.phases.includes('failed') : event.phases.includes('completed') || event.phases.includes('applied')))
    if (!row) { row = { key: `${eventId}:receipt`, eventId, phases: [], changes: [] }; events.push(row) }
    Object.assign(row, { version, on: version.source.inherited ? 'inherited_snapshot' : version.source.card ? 'card_variable_update' : version.source.manual ? 'manual_update' : 'assistant_message_committed',
      turn: versionTurn(version), revision: version.revision, reason: version.error ?? (version.variables.update_diagnostics?.map(item => item.code).join(', ') || row.reason),
      changes: version.beforeAvailable ? variableChanges(version.before, version.variables.stat_data) : [], comparisonAvailable: !!version.beforeAvailable })
  }
  return events.reverse()
}

export async function mvuRequest(action, { scope, id, signal, body } = {}, fetchImpl = tavernFetch) {
  const params = new URLSearchParams({ scope: JSON.stringify(scope) })
  if (id) params.set('id', id)
  const response = await fetchImpl(`${API_V1}/mvu/${action}${body ? '' : '?' + params}`, {
    signal, cache: 'no-store', ...(body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
  })
  const data = await response.json()
  if (!response.ok) throw Object.assign(new Error(data.error ?? `HTTP ${response.status}`), { code: data.code })
  return data
}
