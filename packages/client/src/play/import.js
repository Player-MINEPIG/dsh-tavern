function parseJsonl(text) {
  const rows = text.split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line))
  if (rows.length === 0) throw new TypeError('play.import.empty')
  if (rows[0]?.kind === 'pmp-dsh-tavern-playthrough') throw new TypeError('play.import.unsupported')
  const messages = rows.slice(1).filter(row => typeof row?.mes === 'string')
  let greeting = null
  const qa = []
  let pending = null
  for (const message of messages) {
    if (message.is_user === true) {
      if (pending !== null) throw new TypeError('play.import.unpaired')
      pending = message.mes
    } else if (pending === null && qa.length === 0 && greeting === null) {
      greeting = message.mes
    } else if (pending !== null) {
      qa.push({ user: pending, assistant: message.mes })
      pending = null
    }
  }
  if (pending !== null) throw new TypeError('play.import.unpaired')
  return { greeting, qa, source: { format: 'sillytavern-jsonl' } }
}

export function parsePlaythroughImport(text, fileName = '') {
  if (typeof text !== 'string' || text.trim() === '') throw new TypeError('play.import.empty')
  const parsed = parseJsonl(text)
  return { schemaVersion: 1, ...parsed, source: { ...parsed.source, fileName } }
}

function rootSessionId(playthrough) {
  const value = playthrough?.ext?.pmpDshTavern?.rootSessionId
  return typeof value === 'string' && value !== '' ? value : null
}

function playthroughDirectory(playthrough) {
  const path = typeof playthrough?.path === 'string' ? playthrough.path.replaceAll('\\', '/') : ''
  if (!path.endsWith('/timeline.json')) throw new TypeError('play.import.timelineRequired')
  return path.slice(0, -'/timeline.json'.length)
}

function fallbackImportPath(playthrough, timeline) {
  const direct = playthrough?.ext?.pmpDshTavern?.importContextPath
  if (typeof direct === 'string' && direct !== '') return direct
  const nested = timeline?.ext?.pmpDshTavern?.importContextPath
  return typeof nested === 'string' && nested !== '' ? nested : null
}

export async function getPlaythroughImportBinding(client, sessionId, playthrough, timeline) {
  if (typeof client.getImportContextBinding === 'function') {
    return client.getImportContextBinding(sessionId)
  }
  const path = fallbackImportPath(playthrough, timeline)
  return path === null ? null : { path, state: 'pending' }
}

export async function loadPlaythroughImportContext(client, sessionId, playthrough, timeline) {
  const binding = await getPlaythroughImportBinding(client, sessionId, playthrough, timeline)
  if (typeof binding?.path !== 'string' || binding.path === '') return { binding: null, document: null }
  const document = JSON.parse((await client.getFile(binding.path)).content)
  return { binding, document }
}

function assertLocallyMutable(timeline, messages) {
  if ((timeline?.nodes?.length ?? 0) > 0
    || messages?.incompleteTurn === true
    || (messages?.messages ?? []).some(message => message?.role === 'user' || message?.role === 'assistant')) {
    const error = new Error('play.import.locked')
    error.code = 'PLAY_IMPORT_CONTEXT_LOCKED'
    throw error
  }
}

export async function bindPlaythroughImport(client, playthrough, file, {
  randomUUID = () => globalThis.crypto.randomUUID(),
} = {}) {
  const document = parsePlaythroughImport(await file.text(), file.name)
  const sessionId = rootSessionId(playthrough)
  if (sessionId === null) throw new TypeError('play.import.sessionRequired')
  const [timeline, messages] = await Promise.all([
    client.getTimeline(playthrough),
    client.getMessages(sessionId),
  ])
  assertLocallyMutable(timeline, messages)
  const directory = playthroughDirectory(playthrough)
  const token = String(randomUUID())
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/.test(token)) throw new TypeError('play.import.idInvalid')
  const contextPath = `${directory}/import-context-${token}.json`
  await client.createDirs(directory)
  await client.putFile(contextPath, JSON.stringify(document, null, 2))
  const bound = await client.putImportContextBinding(sessionId, { path: contextPath })
  const [savedFile, savedBinding] = await Promise.all([
    client.getFile(contextPath),
    client.getImportContextBinding(sessionId),
  ])
  const savedDocument = JSON.parse(savedFile.content)
  if (bound?.path !== contextPath
    || savedBinding?.path !== contextPath
    || savedBinding?.state !== 'pending'
    || savedDocument.schemaVersion !== document.schemaVersion
    || savedDocument.qa?.length !== document.qa.length
  ) {
    throw new Error('play.import.verificationFailed')
  }
  return { sessionId, binding: savedBinding, document }
}

export async function unbindPlaythroughImport(client, playthrough) {
  const sessionId = rootSessionId(playthrough)
  if (sessionId === null) throw new TypeError('play.import.sessionRequired')
  const [timeline, messages] = await Promise.all([
    client.getTimeline(playthrough),
    client.getMessages(sessionId),
  ])
  assertLocallyMutable(timeline, messages)
  await client.deleteImportContextBinding(sessionId)
  const saved = await client.getImportContextBinding(sessionId)
  if (saved !== null) throw new Error('play.import.verificationFailed')
  return { sessionId, binding: null }
}
