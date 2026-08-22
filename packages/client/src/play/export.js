import { characterGreetingOptions } from '../../../character/src/client-state.js'
import {
  applyDisplayNameMacros,
  projectTimelineQa,
  projectTimelineVariant,
  selectAssistantDisplay,
} from './chat-model.js'
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

function selectedGreetingState(selectionResponse, characterResponse) {
  const selection = selectionResponse?.selection
  const character = characterResponse?.character
  if (selection == null || character == null || character.id !== selection.characterCardId) return null
  const options = characterGreetingOptions(character)
  const requested = Number(selection.character?.greetingIndex ?? 0)
  const selectedIndex = Math.max(0, options.findIndex(item => item.index === requested))
  const option = options[selectedIndex] ?? options[0]
  if (typeof option?.text !== 'string' || option.text === '') return null
  return {
    text: option.text,
    swipes: options.map(item => item.text),
    selectedIndex,
  }
}

function timelineSwipeState(turn, timeline, messagesBySession) {
  const node = timeline?.nodes?.find(item => item.id === turn.id)
  if (node?.kind !== 'qa' || !Array.isArray(node.variants) || node.variants.length === 0) {
    return { assistantSwipes: [turn.originalAssistantText], assistantSwipeId: 0 }
  }
  const selectedIndex = Math.max(0, node.variants.findIndex(item => item.id === node.adoptedVariantId))
  const swipes = node.variants.map(variant => selectAssistantDisplay(
    projectTimelineVariant(node, variant, messagesBySession),
  ).originalAssistantText)
  // Context-triggered stages can be merged into the active logical QA. Keep the
  // active transcript authoritative while retaining sibling variant outputs.
  swipes[selectedIndex] = turn.originalAssistantText
  return { assistantSwipes: swipes, assistantSwipeId: selectedIndex }
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
  const turns = [...importedTurns, ...timelineTurns].map(turn => {
    const selected = { ...turn, ...selectAssistantDisplay(turn) }
    return { ...selected, ...timelineSwipeState(selected, timeline, messagesBySession) }
  })
  const hasImportedDisplay = importedTurns.length > 0 || (importContext?.greeting ?? '') !== ''
  const greetingState = selectedGreetingState(selectionResponse, characterResponse)
  const greeting = (importContext?.greeting ?? '') !== ''
    ? importContext.greeting
    : hasImportedDisplay ? null : greetingState?.text ?? null
  const greetingSwipes = greeting === null
    ? []
    : (importContext?.greeting ?? '') !== '' ? [greeting] : greetingState?.swipes ?? [greeting]
  const greetingSwipeId = (importContext?.greeting ?? '') !== '' ? 0 : greetingState?.selectedIndex ?? 0
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
  const character = characterResponse?.character ?? null
  const characterData = character?.data ?? character
  const greetingMacros = {
    user: active?.resources?.user?.name || 'User',
    character: characterData?.nickname || characterData?.name || character?.name || 'Assistant',
  }
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
    character,
    importContext,
    greeting,
    greetingSwipes,
    greetingSwipeId,
    // Greeting is card metadata, not model output. Keep static export aligned
    // with the RP view: expand names, but do not run output-only regex rules.
    displayGreeting: greeting === null ? null : applyDisplayNameMacros(greeting, greetingMacros),
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

function stSwipeFields(values, selectedIndex, sendDate) {
  const swipes = Array.isArray(values) && values.length > 0
    ? values.map(value => String(value ?? ''))
    : ['']
  const swipeId = Number.isSafeInteger(selectedIndex)
    && selectedIndex >= 0
    && selectedIndex < swipes.length
    ? selectedIndex
    : 0
  return {
    mes: swipes[swipeId],
    swipes,
    swipe_id: swipeId,
    swipe_info: swipes.map(() => ({ send_date: sendDate })),
  }
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
    lines.push(JSON.stringify({
      name: characterName,
      is_user: false,
      is_name: true,
      send_date: snapshot.exportedAt,
      ...stSwipeFields(snapshot.greetingSwipes ?? [snapshot.greeting], snapshot.greetingSwipeId, snapshot.exportedAt),
    }))
  }
  for (const turn of snapshot.turns) {
    if (turn.hidden) continue
    lines.push(JSON.stringify({
      name: 'User',
      is_user: true,
      is_name: true,
      send_date: snapshot.exportedAt,
      mes: turn.userText,
    }))
    lines.push(JSON.stringify({
      name: characterName,
      is_user: false,
      is_name: true,
      send_date: snapshot.exportedAt,
      ...stSwipeFields(turn.assistantSwipes ?? [turn.originalAssistantText], turn.assistantSwipeId, snapshot.exportedAt),
    }))
  }
  return `${lines.join('\n')}\n`
}

export function playthroughExportDocument(snapshot, format) {
  if (format === 'html') return { extension: 'html', mime: 'text/html;charset=utf-8', content: staticHtmlExport(snapshot) }
  if (format === 'st') return { extension: 'jsonl', mime: 'application/x-ndjson;charset=utf-8', content: sillyTavernJsonlExport(snapshot) }
  throw new TypeError(`Unknown export format ${format}`)
}
