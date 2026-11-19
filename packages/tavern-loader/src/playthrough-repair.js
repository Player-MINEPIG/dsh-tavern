import { readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { appendCompletedTurns } from '../../client/src/play/turns.js'
import { automaticStampBounds, automaticStampRefusal, uniqueMessageCoordinates } from '../../play/src/coordinate-recovery.js'
import { referencedPlaythroughSessions } from '../../play/src/maintenance.js'
import { resolvePlayPath } from '../../play/src/paths.js'
import { isPlaythroughArchived } from '../../play/src/playthrough-state.js'
import { requireCoordinates, sessionCoordinates, variantFormatVersion, withVariantFormat } from '../../play/src/session-coordinates.js'
import { hasOpenTurn, projectMessages } from '../../play/src/sessions.js'
import { stoppedRequestFromEvents } from '../../play/src/stopped-request.js'
import { timelineHead } from '../../play/src/timeline-tree.js'
import { parseCatalogJson, validatePlayDocument } from '../../play/src/timeline.js'

function backupTimeline(root, path, file) {
  const relative = path + '.pre-repair-' + file.revision
  const target = resolvePlayPath(root, relative)
  const bytes = readFileSync(resolvePlayPath(root, path, { mustExist: true }))
  if (createHash('sha256').update(bytes).digest('hex') !== file.revision) {
    throw Object.assign(new Error('Timeline changed'), { code: 'PLAY_FILE_REVISION_CONFLICT' })
  }
  try {
    writeFileSync(target, bytes, { flag: 'wx', mode: 0o600, flush: true })
  } catch (error) {
    if (error.code !== 'EEXIST') throw error
    if (!readFileSync(target).equals(bytes)) {
      throw Object.assign(new Error('Backup differs from the original'), { code: 'backup-conflict' })
    }
  }
  return relative
}

// A live projection can contain an older interrupted or aborted reply. Only the
// latest bodyless cancellation has enough evidence for the stopped-leaf repair.
function unverifiedTail(timeline, record, stopped) {
  let boundary = record.inheritedEventCount - 1
  for (const node of timeline.nodes) {
    for (const variant of node.variants) {
      if (variant.sessionId === record.meta.id) boundary = Math.max(boundary, variant.endEventId)
    }
  }
  let turn, hasNewMessage = false
  for (const event of record.events) {
    if (event.type === 'turn/start') {
      if (hasNewMessage) return true
      turn = event.data.turn
    } else if (event.seq > boundary && ['user/message', 'steering/message', 'assistant/message'].includes(event.type)) {
      if (turn === undefined) return true
      hasNewMessage = true
    } else if (event.type === 'turn/end') {
      if (hasNewMessage && (event.data.turn !== turn
        || (event.data.reason?.kind !== 'completed' && stopped?.turnEndEventId !== event.seq))) return true
      turn = undefined
      hasNewMessage = false
    }
  }
  return hasNewMessage
}

async function reconcileHead(timeline, cut, host, deriveMessages, result) {
  const sessionId = cut.meta.id
  const keep = reason => {
    result.remaining.push({ reason, sessionId })
    return timeline
  }
  if (hasOpenTurn(cut.events)) return keep('turn-in-progress')
  const coordinates = sessionCoordinates(cut)
  if (coordinates.sessionFormatVersion == null) return keep('PLAY_COORDINATES_UNAVAILABLE')
  const stoppedRequest = stoppedRequestFromEvents(cut.events)
  if (unverifiedTail(timeline, cut, stoppedRequest)) return keep('unverified-turn')

  const projected = projectMessages(deriveMessages(cut), cut.events)
  if (projected.some(message => ['user', 'steering', 'assistant'].includes(message.origin.kind)
    && cut.identities.get(message.id)?.seq !== message.seq)) return keep('unverified-message-range')
  const messages = projected.filter(message => Number.isSafeInteger(message.seq) && message.seq >= cut.inheritedEventCount)
  const next = appendCompletedTurns(timeline, { ...coordinates, messages, stoppedRequest }, sessionId)
  if (!next.changed) return timeline
  const latest = await host.inspectSession(sessionId)
  if (latest?.meta?.id !== sessionId || latest.meta.version !== cut.meta.version
    || latest.events?.at(-1)?.seq !== cut.events.at(-1)?.seq) return keep('session-changed')

  const originalHead = timelineHead(timeline)
  const headEnd = value => value.nodes.find(node => node.id === originalHead?.nodeId)
    ?.variants.find(variant => variant.id === originalHead?.variantId)?.endEventId
  const removed = timeline.nodes.length + next.added.length - next.timeline.nodes.length
  result.changes.push({ kind: 'reconcile-turns', added: next.added.length, removed,
    extended: headEnd(next.timeline) > headEnd(timeline), sessionId })
  return next.timeline
}

// Inspect durable references directly so a locked timeline can be repaired.
// Use the same message projection and reconciliation as opening a playthrough.
async function repairRow(row, { store, host, isDraftProtected, getCharacter, deriveMessages }, options) {
  const { signal, apply, v3v4, scope, binding, checkCatalog, owners } = options
  const result = { id: row.id, changes: [], remaining: [] }
  const issue = (reason, details = {}) => result.remaining.push({ reason, ...details })
  if (isDraftProtected(row) || isPlaythroughArchived(row)) {
    issue(isPlaythroughArchived(row) ? 'archived' : 'pending-draft')
    return result
  }
  const known = row.ext?.pmpDshTavern
  const characterId = known?.characterId
  if (characterId) {
    try { getCharacter(characterId) } catch (error) { issue(error.code ?? 'character-unavailable', { characterId }) }
  }
  const file = store.readFile(row.path, { validate: validatePlayDocument })
  if (owners.get(realpathSync.native(resolvePlayPath(binding.rootPath, row.path, { mustExist: true }))) !== 1) {
    issue('shared-timeline')
    return result
  }
  const lease = store.captureReadLease([row.path])
  let timeline = JSON.parse(file.content)
  const headId = timelineHead(timeline)?.sessionId ?? known?.rootSessionId
  const variantsBySession = new Map()
  for (const node of timeline.nodes) {
    for (const [index, variant] of node.variants.entries()) {
      if (!variantsBySession.has(variant.sessionId)) variantsBySession.set(variant.sessionId, [])
      variantsBySession.get(variant.sessionId).push({ node, index, variant })
    }
  }
  let headCut, unresolved = false
  for (const sessionId of referencedPlaythroughSessions(row, timeline)) {
    signal?.throwIfAborted()
    let inspection
    try {
      inspection = await host.inspectSession(sessionId)
      if (inspection?.meta?.id !== sessionId || !Array.isArray(inspection.events)
        || !Number.isSafeInteger(inspection.inheritedEventCount) || inspection.inheritedEventCount < 0
        || inspection.inheritedEventCount > inspection.events.length
        || !inspection.events.every((event, offset) => event?.seq === offset)) {
        throw Object.assign(new Error('Incomplete Session snapshot'), { code: 'missing-session-log' })
      }
    } catch (error) {
      issue(error.code ?? 'session-unavailable', { sessionId })
      unresolved = true
      continue
    }
    const coords = sessionCoordinates(inspection)
    const references = variantsBySession.get(sessionId) ?? []
    const older = coords.migratedFromV2 || references.some(({ variant }) => variantFormatVersion(variant) < 3)
    const identities = uniqueMessageCoordinates(inspection.events)
    if (sessionId === headId) headCut = { ...inspection, identities }
    const bounds = automaticStampBounds(inspection, identities)
    for (const { node, index, variant } of references) {
      const version = variantFormatVersion(variant)
      let reason
      if (version === undefined && coords.sessionFormatVersion === 4) {
        if (!v3v4) reason = 'unknown-coordinate-origin'
        else if (older) reason = 'earlier-format'
        else reason = automaticStampRefusal(variant, bounds)
        if (!reason) {
          node.variants[index] = withVariantFormat(variant, 4)
          result.changes.push({ kind: 'format-marker', nodeId: node.id, variantId: variant.id })
        }
      } else {
        try { requireCoordinates(version, coords) } catch (error) { reason = error.code }
        if (!reason && (bounds.endpoints.get(variant.startEventId) !== 'user'
          || bounds.endpoints.get(variant.endEventId) !== 'assistant')) reason = 'unverified-message-range'
      }
      if (reason) {
        issue(reason, { sessionId, nodeId: node.id, variantId: variant.id })
        unresolved = true
      }
    }
    const imported = await host.getImportContextBinding?.(sessionId)
    if (imported?.claim || imported?.terminal || imported?.lineage) {
      try { requireCoordinates(imported.sessionFormatVersion, coords) }
      catch (error) { issue('import-coordinates', { sessionId, code: error.code }) }
    }
  }

  // A missing or ambiguous ancestor cannot establish the boundary for new QA ranges.
  if (!unresolved && headCut) timeline = await reconcileHead(timeline, headCut, host, deriveMessages, result)
  signal?.throwIfAborted()
  checkCatalog()
  if (!lease() || store.readFile(row.path).revision !== file.revision || isDraftProtected(row)) throw Object.assign(new Error('Timeline changed'), { code: 'PLAY_FILE_REVISION_CONFLICT' })
  if (apply && result.changes.length) {
    const content = JSON.stringify(timeline, null, 2) + '\n'
    validatePlayDocument(row.path, content)
    result.backup = backupTimeline(binding.rootPath, row.path, file)
    store.writeFile(row.path, content, { validate: validatePlayDocument, expectedRevision: file.revision,
      expectedRevisionPresent: true, expectedWorkspaceScope: scope })
  }
  return result
}

export async function repairPlaythroughs(dependencies, { agent, signal, apply = true, v3v4 = false, id } = {}) {
  if (v3v4 && !id) throw new Error('Specify the playthrough ID with v3-v4.')
  const { store } = dependencies
  const binding = store.get()
  if (!binding.rootPath) throw new Error('请先绑定 Tavern 扮演工作区。')
  const cwd = agent?.session?.header?.cwd
  if (!cwd || realpathSync(cwd) !== realpathSync(binding.rootPath)) throw new Error('请在已绑定的 Tavern 扮演工作区会话中运行。')
  const scope = JSON.stringify([binding.workspaceId, binding.rootPath])
  let file
  try { file = store.readFile('catalog.json') } catch (error) {
    if (!id && error.code === 'PLAY_PATH_NOT_FOUND') return { applied: apply, checked: 0, items: [] }
    throw error
  }
  const { playthroughs } = parseCatalogJson(file.content)
  const targets = id === undefined ? playthroughs : playthroughs.filter(row => row.id === id)
  if (!targets.length && id) throw new Error('找不到指定的周目 ID。')
  const lease = store.captureReadLease(['catalog.json'])
  const checkCatalog = () => {
    signal?.throwIfAborted()
    if (!lease() || store.readFile('catalog.json').revision !== file.revision) throw Object.assign(new Error('工作区或周目目录已变更，请重新执行。'), { code: 'PLAY_FILE_REVISION_CONFLICT' })
  }
  const owners = new Map()
  for (const row of playthroughs) {
    try {
      const path = realpathSync.native(resolvePlayPath(binding.rootPath, row.path, { mustExist: true }))
      owners.set(path, 1 + (owners.get(path) ?? 0))
    } catch { /* The per-row read reports missing and invalid paths. */ }
  }
  const items = []
  for (const row of targets) {
    try {
      checkCatalog()
      items.push(await repairRow(row, dependencies, { signal, apply, v3v4, scope, binding, owners, checkCatalog }))
    } catch (error) {
      signal?.throwIfAborted()
      items.push({ id: row.id, changes: [], remaining: [{ reason: error.code ?? 'repair-unavailable' }] })
    }
  }
  return { applied: apply, checked: items.length, items: items.filter(item => item.changes.length || item.remaining.length) }
}
