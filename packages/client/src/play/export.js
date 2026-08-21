import { characterGreetingOptions } from '../../../character/src/client-state.js'
import { projectTimelineQa, selectAssistantDisplay } from './chat-model.js'
import {
  applyDisplayRegex,
  getRegexDocument,
  resourceRegexRules,
} from './regex.js'
import { renderRichTextHtml } from './rich-text.js'
import { loadPlaythroughImportContext } from './import.js'

function rootSessionId(playthrough, timeline) {
  const root = playthrough?.ext?.pmpDshTavern?.rootSessionId
  if (typeof root === 'string' && root !== '') return root
  for (const node of timeline?.nodes ?? []) {
    const variant = node.variants?.find(item => item.id === node.adoptedVariantId)
    if (typeof variant?.sessionId === 'string') return variant.sessionId
  }
  return null
}

function allSessionIds(timeline) {
  const result = new Set()
  for (const node of timeline?.nodes ?? []) {
    for (const variant of node.variants ?? []) result.add(variant.sessionId)
  }
  return [...result]
}

async function loadMessages(client, sessionIds, concurrency = 4) {
  const result = {}
  let cursor = 0
  const worker = async () => {
    while (cursor < sessionIds.length) {
      const sessionId = sessionIds[cursor]
      cursor += 1
      result[sessionId] = await client.getMessages(sessionId)
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, sessionIds.length) }, worker))
  return result
}

function normalizeImportContext(value) {
  if (value === null) return null
  return {
    schemaVersion: value?.schemaVersion ?? 1,
    greeting: typeof value?.greeting === 'string' ? value.greeting : null,
    qa: Array.isArray(value?.qa) ? value.qa.map(item => ({
      user: typeof item?.user === 'string' ? item.user : '',
      assistant: typeof item?.assistant === 'string' ? item.assistant : '',
    })) : [],
    source: value?.source ?? null,
  }
}

function selectedGreeting(selectionResponse, characterResponse) {
  const selection = selectionResponse?.selection
  const character = characterResponse?.character
  if (character?.id !== selection?.characterCardId) return null
  const options = characterGreetingOptions(character)
  const index = Number(selection.character?.greetingIndex ?? 0)
  const option = options.find(item => item.index === index) ?? options[0]
  return option?.text ? option.text : null
}

export async function loadPlaythroughExport(client, playthrough) {
  const timeline = await client.getTimeline(playthrough)
  const sessionIds = allSessionIds(timeline)
  const messagesBySession = await loadMessages(client, sessionIds)
  const root = rootSessionId(playthrough, timeline)
  const importContext = root === null
    ? null
    : normalizeImportContext((await loadPlaythroughImportContext(client, root, playthrough, timeline)).document)
  const selectionResponse = root === null ? null : await client.getCharacterSelection(root)
  const characterId = selectionResponse?.selection?.characterCardId
  const characterResponse = typeof characterId === 'string' && characterId !== ''
    ? await client.getCharacter(characterId)
    : null
  const timelineTurns = projectTimelineQa(timeline, messagesBySession)
  const importedTurns = (importContext?.qa ?? []).map((qa, index) => ({
    id: `import-${index}`,
    imported: true,
    hidden: false,
    userText: qa.user,
    assistantText: qa.assistant,
    originalAssistantText: qa.assistant,
  }))
  const turns = [...importedTurns, ...timelineTurns].map(turn => ({
    ...turn,
    ...selectAssistantDisplay(turn),
  }))
  const hasImportedDisplay = importedTurns.length > 0 || (importContext?.greeting ?? '') !== ''
  const greeting = (importContext?.greeting ?? '') !== ''
    ? importContext.greeting
    : hasImportedDisplay ? null : selectedGreeting(selectionResponse, characterResponse)
  const [regexDocument, active] = await Promise.all([
    typeof client.getFile === 'function'
      ? getRegexDocument(client)
      : { schemaVersion: 1, rules: [] },
    root !== null && typeof client.getActive === 'function'
      ? client.getActive(root)
      : null,
  ])
  const bindings = {
    presetId: active?.selection?.presetId ?? null,
    characterId: characterId ?? active?.selection?.characterCardId ?? null,
  }
  const presetResponse = typeof bindings.presetId === 'string'
    && bindings.presetId !== ''
    && typeof client.getPreset === 'function'
    ? await client.getPreset(bindings.presetId)
    : null
  const rules = [
    ...regexDocument.rules,
    ...resourceRegexRules(presetResponse?.preset ?? presetResponse, {
      kind: 'preset',
      resourceId: bindings.presetId,
    }),
    ...resourceRegexRules(characterResponse?.character ?? characterResponse, {
      kind: 'character',
      resourceId: bindings.characterId,
    }),
  ]
  const render = (text, target) => applyDisplayRegex(text, rules, bindings, target).text
  return {
    playthrough,
    timeline,
    messagesBySession,
    turns,
    displayTurns: turns.map(turn => ({
      ...turn,
      userText: render(turn.userText, 'user'),
      ...selectAssistantDisplay(turn, text => render(text, 'assistant')),
    })),
    character: characterResponse?.character ?? null,
    importContext,
    greeting,
    displayGreeting: greeting === null ? null : render(greeting, 'assistant'),
    exportedAt: new Date().toISOString(),
  }
}

function escapeHtml(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}

export function staticHtmlExport(snapshot) {
  const title = snapshot.playthrough.title || snapshot.character?.name || snapshot.playthrough.id
  const rows = (snapshot.displayTurns ?? snapshot.turns).filter(turn => !turn.hidden).map(turn => `
    <article class="turn">
      <div class="user rich">${renderRichTextHtml(turn.userText)}</div>
      <div class="assistant rich">${renderRichTextHtml(turn.assistantText)}</div>
    </article>`).join('')
  const displayGreeting = snapshot.displayGreeting ?? snapshot.greeting
  const greeting = displayGreeting === null || displayGreeting === undefined
    ? ''
    : `<div class="assistant greeting rich">${renderRichTextHtml(displayGreeting)}</div>`
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(title)}</title><style>body{max-width:800px;margin:32px auto;padding:0 18px;background:#101216;color:#e8eaf0;font:15px/1.65 system-ui}.turn{display:flex;flex-direction:column;gap:10px;margin:24px 0}.user,.assistant{padding:12px 15px;border-radius:14px}.user{align-self:flex-end;background:#1c3651}.assistant{align-self:flex-start;background:#24262d}.greeting{margin:24px 0}.rich>:first-child{margin-top:0}.rich>:last-child{margin-bottom:0}.rich pre{max-width:100%;overflow:auto;white-space:pre-wrap}.rich img,.rich video{max-width:100%;height:auto}.rich table{display:block;max-width:100%;overflow:auto;border-collapse:collapse}.rich th,.rich td{padding:6px 9px;border:1px solid #555}</style></head><body><h1>${escapeHtml(title)}</h1>${greeting}${rows}</body></html>`
}

export function sillyTavernJsonlExport(snapshot) {
  const characterName = snapshot.character?.data?.name || snapshot.character?.name || 'Assistant'
  const lines = [JSON.stringify({
    user_name: 'User',
    character_name: characterName,
    create_date: snapshot.exportedAt,
    chat_metadata: { source: 'pmp-dsh-tavern', playthroughId: snapshot.playthrough.id },
  })]
  if (snapshot.greeting !== null) {
    lines.push(JSON.stringify({ name: characterName, is_user: false, is_name: true, mes: snapshot.greeting }))
  }
  for (const turn of snapshot.turns) {
    if (turn.hidden) continue
    lines.push(JSON.stringify({ name: 'User', is_user: true, is_name: true, mes: turn.userText }))
    lines.push(JSON.stringify({ name: characterName, is_user: false, is_name: true, mes: turn.originalAssistantText }))
  }
  return `${lines.join('\n')}\n`
}

export function portableBundleExport(snapshot) {
  return JSON.stringify({
    kind: 'pmp-dsh-tavern-playthrough',
    schemaVersion: 1,
    exportedAt: snapshot.exportedAt,
    playthrough: snapshot.playthrough,
    timeline: snapshot.timeline,
    messagesBySession: snapshot.messagesBySession,
    resources: {
      characterId: snapshot.character?.id ?? null,
      greeting: snapshot.greeting,
      importContext: snapshot.importContext,
    },
  }, null, 2)
}

export function playthroughExportDocument(snapshot, format) {
  if (format === 'html') return { extension: 'html', mime: 'text/html;charset=utf-8', content: staticHtmlExport(snapshot) }
  if (format === 'st') return { extension: 'jsonl', mime: 'application/x-ndjson;charset=utf-8', content: sillyTavernJsonlExport(snapshot) }
  if (format === 'bundle') return { extension: 'json', mime: 'application/json;charset=utf-8', content: portableBundleExport(snapshot) }
  throw new TypeError(`Unknown export format ${format}`)
}
