import { projectTimelineQa } from './chat-model.js'
import { playthroughCharacterId } from './schema.js'

function parseJsonl(text) {
  const rows = text.split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line))
  if (rows.length === 0) throw new TypeError('play.import.empty')
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

function parseBundle(value) {
  if (value?.kind !== 'pmp-dsh-tavern-playthrough' || value.schemaVersion !== 1) {
    throw new TypeError('play.import.unsupported')
  }
  const turns = projectTimelineQa(value.timeline, value.messagesBySession)
  return {
    greeting: typeof value.resources?.greeting === 'string' ? value.resources.greeting : null,
    qa: turns.filter(turn => !turn.hidden).map(turn => ({ user: turn.userText, assistant: turn.originalAssistantText })),
    source: { format: 'pmp-dsh-tavern-bundle', playthroughId: value.playthrough?.id ?? null },
  }
}

export function parsePlaythroughImport(text, fileName = '') {
  if (typeof text !== 'string' || text.trim() === '') throw new TypeError('play.import.empty')
  const parsed = text.trimStart().startsWith('{') && !text.trimStart().includes('\n')
    ? parseBundle(JSON.parse(text))
    : (() => {
      try { return parseBundle(JSON.parse(text)) } catch (error) {
        if (text.includes('\n')) return parseJsonl(text)
        throw error
      }
    })()
  return { schemaVersion: 1, ...parsed, source: { ...parsed.source, fileName } }
}

function rootSessionId(playthrough) {
  const value = playthrough?.ext?.pmpDshTavern?.rootSessionId
  return typeof value === 'string' && value !== '' ? value : null
}

export async function importPlaythrough(client, playthrough, file, {
  now = () => new Date(),
  randomUUID = () => globalThis.crypto.randomUUID(),
} = {}) {
  const document = parsePlaythroughImport(await file.text(), file.name)
  const characterId = playthroughCharacterId(playthrough)
  if (characterId === null) throw new TypeError('play.import.characterRequired')
  const id = `playthrough-${randomUUID()}`
  const directory = `${characterId}/${id}`
  const path = `${directory}/timeline.json`
  const contextPath = `${directory}/import-context.json`
  await client.createDirs(directory)
  await client.putFile(contextPath, JSON.stringify(document, null, 2))
  const created = await client.postSession(rootSessionId(playthrough), { path: contextPath })
  const imported = {
    id,
    path,
    title: `${playthrough.title || characterId} · ${file.name}`,
    lastOpenedAt: now().toISOString(),
    ext: { pmpDshTavern: { characterId, rootSessionId: created.sessionId, importContextPath: contextPath } },
  }
  const catalog = await client.getCatalog()
  await client.putTimeline(imported, { nodes: [], ext: { pmpDshTavern: { importContextPath: contextPath } } })
  await client.putCatalog({ ...catalog, playthroughs: [...catalog.playthroughs, imported] })
  return { sessionId: created.sessionId, playthrough: imported, document }
}
