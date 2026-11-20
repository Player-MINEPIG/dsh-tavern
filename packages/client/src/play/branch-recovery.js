import { creationRow, nextPlaythroughNumber } from '../../../play/src/creation-publication.js'
import { httpError } from '../../../play/src/http.js'
import { isPlaythroughArchived } from '../../../play/src/playthrough-state.js'
import { requireCoordinates, validateTimelineCoordinates, variantFormatVersion, withVariantFormat } from '../../../play/src/session-coordinates.js'
import { isSafeCatalogSegment } from '../../../play/src/timeline.js'
import { activeTimelineEntries, timelineHead, timelineWithHead } from '../../../play/src/timeline-tree.js'
import { creationRequest } from './creation-request.js'
import { sourceSha256 } from './source-sha256.js'

const conflict = () => httpError(409, 'The branch target or its saved evidence changed. Open Repair playthrough.', 'PLAY_FILE_REVISION_CONFLICT')
const pending = key => httpError(409, 'Branch outcome needs verification. Open Repair playthrough. Operation ' + key, 'PLAY_BRANCH_PENDING')
const root = row => row.ext?.pmpDshTavern?.rootSessionId ?? null
const character = row => row.ext?.pmpDshTavern?.characterId ?? row.path.split('/')[0]
const ownerFor = kind => 'tavern.' + kind
const targetId = key => 'playthrough-' + sourceSha256(key)

function activeAnchor(timeline) {
  const entries = activeTimelineEntries(timeline)
  return sourceSha256(JSON.stringify([timelineHead(timeline), entries.map(({node, variant}) =>
    [node.id, variant.id, variant.sessionId, variant.startEventId, variant.endEventId, variantFormatVersion(variant)])]))
}

async function fileAt(client, path) {
  try { return await client.getFile(path) }
  catch (error) { if (error.code === 'PLAY_PATH_NOT_FOUND') return null; throw error }
}

async function sourceRow(client, row) {
  const catalog = JSON.parse((await client.getFile('catalog.json')).content)
  const hits = catalog.playthroughs.filter(item => item.id === row.id || item.path === row.path)
  if (hits.length !== 1 || hits[0].id !== row.id || hits[0].path !== row.path || isPlaythroughArchived(hits[0])) throw conflict()
  return hits[0]
}

function endpoints(evidence, sessionId, start, end) {
  if (evidence.sessionId !== sessionId) throw conflict()
  const find = (seq, role) => {
    const found = evidence.endpoints.filter(item => item.seq === seq)
    if (found.length !== 1 || found[0].role !== role || !found[0].id) throw conflict()
    return found[0].id
  }
  return [find(start, 'user'), find(end, 'assistant')]
}

async function acquire(client, row, request, scope, key, signal) {
  const saved = await sourceRow(client, row)
  const file = await client.getFile(row.path)
  if (request.expectedRevision && file.revision !== request.expectedRevision) throw conflict()
  const timeline = JSON.parse(file.content)
  const target = activeTimelineEntries(timeline).find(entry => entry.node.id === request.nodeId)
  if (!target || (request.variantId != null && target.variant.id !== request.variantId)) throw conflict()
  const {variant} = target
  const start = variant.startEventId, end = variant.endEventId
  const evidence = await client.getSessionEvidence(variant.sessionId, {start, end})
  requireCoordinates(variantFormatVersion(variant), evidence)
  await validateTimelineCoordinates(timeline, id => id === variant.sessionId ? evidence : client.getSessionEvidence(id, {start: 0, end: 0}))
  const [questionId, answerId] = endpoints(evidence, variant.sessionId, start, end)
  const data = {path: row.path, scope, characterId: character(saved), rootSessionId: root(saved), nodeId: target.node.id,
    variantId: variant.id, source: variant.sessionId, start, end, version: evidence.sessionFormatVersion, questionId, answerId,
    anchor: activeAnchor(timeline), revision: file.revision, nativeKey: crypto.randomUUID(), createdAt: new Date().toISOString()}
  if (request.kind === 'fork') data.target = targetId(key)
  signal.throwIfAborted()
  return client.putCheckpoint(row, {key, owner: ownerFor(request.kind), data, expectedRevision: null,
    expectedWorkspaceScope: scope, expectedTimelineRevision: file.revision})
}

function forkTimeline(timeline, data, child) {
  const entries = activeTimelineEntries(timeline)
  const index = entries.findIndex(({node, variant}) => node.id === data.nodeId && variant.id === data.variantId)
  if (index < 0) throw conflict()
  const nodes = entries.slice(0, index + 1).map(({node, variant}, i) => ({
    ...node, parentVariantId: entries[i - 1]?.variant.id ?? null, adoptedVariantId: variant.id,
    variants: node.variants.map(item => item.id === data.variantId ? withVariantFormat({...item, sessionId: child}, data.version) : item),
  }))
  return {...timeline, nodes, head: {sessionId: child, nodeId: data.nodeId, variantId: data.variantId}}
}

async function publishFork(client, checkpoint, source, child, write) {
  const data = checkpoint.data
  if (data.target !== targetId(checkpoint.key) || !isSafeCatalogSegment(data.characterId)) throw conflict()
  const path = data.characterId + '/' + data.target + '/timeline.json'
  const meta = {characterId: data.characterId, rootSessionId: child}
  const timeline = forkTimeline(source, data, child)
  const content = JSON.stringify(timeline)
  const file = await fileAt(client, path)
  const catalogFile = await client.getFile('catalog.json')
  const catalog = JSON.parse(catalogFile.content)
  let playthrough = creationRow(catalog, data.target, path, meta)
  if (file && file.content !== content || playthrough && !file) throw conflict()
  if (!file) await write(path, null, content)
  if (!playthrough) {
    const number = nextPlaythroughNumber(catalog, data.characterId)
    playthrough = {id: data.target, path, title: number + '周目', lastOpenedAt: data.createdAt,
      ext: {pmpDshTavern: {...meta, playthroughNumber: number, autoTitle: true}}}
    await write('catalog.json', catalogFile, JSON.stringify({...catalog, playthroughs: [...catalog.playthroughs, playthrough]}))
  }
  return {ok: true, playthrough, timeline, sessionId: child}
}

async function publish(client, row, checkpoint, {signal, beforeWrite, preview, allowBranch}) {
  const {key, owner, data} = checkpoint
  const scope = data.scope
  const rowNow = await sourceRow(client, row)
  if (data.path !== row.path || data.rootSessionId !== root(rowNow) || data.characterId !== character(rowNow)) throw conflict()
  const ownership = {expectedWorkspaceScope: scope, checkpointId: row.id, checkpointKey: key}
  let receipt = await client.getSessionReceipt(data.nativeKey, scope)
  if (receipt.state === 'missing' && allowBranch) {
    const source = JSON.parse((await client.getFile(row.path)).content)
    if (activeAnchor(source) !== data.anchor) throw conflict()
    signal.throwIfAborted()
    await client.postBranch(data.source, data.end, data.version, undefined, {...ownership, operationKey: data.nativeKey, signal})
    receipt = await client.getSessionReceipt(data.nativeKey, scope)
  }
  if (receipt.state !== 'done') throw pending(key)
  const child = receipt.result?.sessionId
  if (!child || child === data.source) throw conflict()
  const evidence = await client.getSessionEvidence(child, {start: data.start, end: data.end})
  requireCoordinates(data.version, evidence)
  const [question, answer] = endpoints(evidence, child, data.start, data.end)
  if (question !== data.questionId || answer !== data.answerId || evidence.inheritedEventCount !== data.end + 1 || evidence.hasOwnTurns) throw conflict()
  const file = await client.getFile(row.path)
  let timeline = JSON.parse(file.content)
  const head = {sessionId: child, nodeId: data.nodeId, variantId: data.variantId}
  const matches = view => view?.sessionId === child && view.nodeId === data.nodeId && view.variantId === data.variantId
  const done = owner === 'tavern.rollback' && matches(timeline.head)
  if (!done && activeAnchor(timeline) !== data.anchor) throw conflict()
  async function write(path, previous, content) {
    if (preview) return
    signal.throwIfAborted()
    beforeWrite?.(previous, path)
    await client.putFile(path, content, {...ownership, expectedRevision: previous?.revision ?? null, signal})
  }
  let result
  if (owner === 'tavern.fork') result = await publishFork(client, checkpoint, timeline, child, write)
  else {
    if (!done) {
      timeline = timelineWithHead({...timeline, nodes: timeline.nodes.map(node => node.id === data.nodeId
        ? {...node, adoptedVariantId: data.variantId} : node)}, head)
      await write(row.path, file, JSON.stringify(timeline))
    }
    result = {ok: true, sessionId: child, timeline}
  }
  if (!preview) {
    const focus = await client.getFocus(result.playthrough ?? row)
    if (!matches(focus)) throw conflict()
    signal.throwIfAborted()
    await client.putCheckpoint(row, {key, owner, data: {...data, child}, released: true,
      expectedRevision: checkpoint.revision, expectedWorkspaceScope: scope})
  }
  return result
}

async function returned(client, row, checkpoint) {
  const {data} = checkpoint
  if (data.dismissed || !data.child) throw httpError(409, 'This branch operation was dismissed.', 'PLAY_CREATION_DISMISSED')
  let playthrough
  if (checkpoint.owner === 'tavern.fork') {
    if (data.target !== targetId(checkpoint.key)) throw conflict()
    const catalog = JSON.parse((await client.getFile('catalog.json')).content)
    playthrough = creationRow(catalog, data.target, data.characterId + '/' + data.target + '/timeline.json',
      {characterId: data.characterId, rootSessionId: data.child})
    if (!playthrough || isPlaythroughArchived(playthrough)) throw conflict()
  }
  const timeline = JSON.parse((await client.getFile(playthrough?.path ?? row.path)).content)
  return {ok: true, ...(playthrough ? {playthrough} : {}), sessionId: data.child, timeline}
}

async function bounded(options, work) {
  const deadline = AbortSignal.timeout(35_000)
  const signal = options?.signal ? AbortSignal.any([options.signal, deadline]) : deadline
  signal.throwIfAborted()
  let abort
  const timeout = new Promise((_, reject) => {
    abort = () => reject(signal.reason)
    signal.addEventListener('abort', abort, {once: true})
  })
  try { return await Promise.race([timeout, work(signal)]) }
  finally { signal.removeEventListener('abort', abort) }
}

export function runBranchOperation(client, row, request, options) {
  return bounded(options, async signal => {
    if (!['fork', 'rollback'].includes(request.kind)) throw new TypeError('Unknown branch operation')
    const workspace = await client.getWorkspace()
    const scope = JSON.stringify([workspace.workspaceId, workspace.rootPath])
    if (request.expectedWorkspaceScope && request.expectedWorkspaceScope !== scope) throw conflict()
    const current = await client.getCheckpoint(row, scope)
    const owner = ownerFor(request.kind)
    const key = request.creationId ?? (current && !current.released && current.owner === owner ? current.key : crypto.randomUUID())
    let checkpoint = current?.key === key ? current : await client.getCheckpoint(row, scope, key)
    if (!checkpoint) {
      if (current && !current.released) throw pending(current.key)
      checkpoint = await acquire(client, row, request, scope, key, signal)
    }
    const data = checkpoint.data
    if (checkpoint.owner !== owner || data.scope !== scope || data.nodeId !== request.nodeId || data.path !== row.path
      || (request.variantId != null && data.variantId !== request.variantId)) throw conflict()
    if (checkpoint.released) return returned(client, row, checkpoint)
    return publish(client, row, checkpoint, {signal, allowBranch: true})
  })
}

export function rollbackAtNode(client, row, nodeId, variantId) {
  return creationRequest(client, ['rollback', row.id, row.path, nodeId, variantId], undefined,
    (identity, options) => runBranchOperation(client, row, {...identity, kind: 'rollback', nodeId, variantId}, options))
}

export async function repairBranchOperation(client, row, checkpoint, options = {}) {
  if (!checkpoint || checkpoint.released || !['tavern.rollback', 'tavern.fork'].includes(checkpoint.owner)) return null
  const fork = checkpoint.owner === 'tavern.fork'
  const details = {operationId: checkpoint.key, nodeId: checkpoint.data.nodeId, stage: 'branch', sessionId: checkpoint.data.source}
  try {
    const workspace = await client.getWorkspace()
    if (checkpoint.data.scope !== JSON.stringify([workspace.workspaceId, workspace.rootPath])) throw conflict()
    const result = await bounded(options, signal => publish(client, row, checkpoint, {...options, signal, preview: !options.apply, allowBranch: false}))
    return {changes: [{kind: fork ? 'fork-creation-recovered' : 'rollback-recovered', ...details, sessionId: result.sessionId}], remaining: []}
  } catch (error) {
    options.signal?.throwIfAborted()
    return {changes: [], remaining: [{reason: fork ? 'fork-creation-pending' : 'rollback-pending', ...details, code: error.code ?? 'repair-unavailable'}]}
  }
}
