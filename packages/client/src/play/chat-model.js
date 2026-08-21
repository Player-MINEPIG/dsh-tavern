import { characterGreetingOptions } from '../../../character/src/client-state.js'
import {
  activeTimelineEntries,
  activeVariantEnd,
  timelineHead,
} from '../../../play/src/timeline-tree.js'

function normalizedPath(value) {
  return typeof value === 'string'
    ? value.replaceAll('\\', '/').replace(/\/+$/, '').toLocaleLowerCase()
    : ''
}

function rootSessionId(playthrough) {
  const value = playthrough?.ext?.pmpDshTavern?.rootSessionId
  return typeof value === 'string' && value !== '' ? value : null
}

function adoptedVariant(node) {
  return node?.variants?.find(variant => variant.id === node.adoptedVariantId) ?? null
}

function recordedEndSeq(timeline, sessionId) {
  let end = -1
  for (const node of timeline?.nodes ?? []) {
    for (const variant of node.variants ?? []) {
      if (variant.sessionId === sessionId && Number.isSafeInteger(variant.endEventId)) {
        end = Math.max(end, variant.endEventId)
      }
    }
  }
  return Math.max(end, activeVariantEnd(timeline, sessionId))
}

function contentText(content) {
  if (!Array.isArray(content)) return ''
  return content
    .filter(part => part?.type === 'text' && typeof part.text === 'string')
    .map(part => part.text)
    .join('')
}

function contentReasoning(content) {
  if (!Array.isArray(content)) return ''
  return content
    .filter(part => part?.type === 'reasoning' && typeof part.text === 'string')
    .map(part => part.text)
    .join('')
}

function assistantText(blocks) {
  if (!Array.isArray(blocks)) return ''
  return blocks
    .filter(block => block?.kind === 'text' && typeof block.text === 'string')
    .map(block => block.text)
    .join('')
}

function assistantReasoning(blocks) {
  if (!Array.isArray(blocks)) return ''
  return blocks
    .filter(block => block?.kind === 'reasoning' && typeof block.text === 'string')
    .map(block => block.text)
    .join('')
}

function renderedMessageText(message) {
  if (Array.isArray(message?.content) && message.content.length > 0) return contentText(message.content)
  return typeof message?.text === 'string' ? message.text : ''
}

function messageOriginKind(message) {
  const value = message?.origin?.kind
  if (typeof value === 'string' && value !== '') return value
  return message?.role === 'assistant' ? 'assistant' : message?.role === 'system' ? 'system' : 'user'
}

function contextProjection(message) {
  const origin = message?.origin ?? {}
  return {
    id: message?.id ?? `context-${message?.seq ?? 'unknown'}`,
    seq: message?.seq ?? null,
    text: renderedMessageText(message),
    producer: origin.producer ?? null,
    form: origin.form ?? null,
    summary: origin.summary ?? null,
  }
}

export function sessionIsInRpWorkspace(workspace, session) {
  if (workspace?.selected !== true || session == null) return false
  const root = normalizedPath(workspace.rootPath)
  return root !== '' && normalizedPath(session.cwd) === root
}

export function sessionHasConversationHistory(response) {
  return (response?.messages ?? []).some(message => message?.role === 'user' || message?.role === 'assistant')
}

export function findPlaythroughForSession(sessionId, catalog, timelines = {}) {
  if (typeof sessionId !== 'string' || sessionId === '') return null
  for (const playthrough of catalog?.playthroughs ?? []) {
    if (rootSessionId(playthrough) === sessionId) {
      return { playthrough, timeline: timelines[playthrough.path] ?? null }
    }
  }
  for (const playthrough of catalog?.playthroughs ?? []) {
    const timeline = timelines[playthrough.path]
    if (timelineHead(timeline)?.sessionId === sessionId) return { playthrough, timeline }
  }
  for (const playthrough of catalog?.playthroughs ?? []) {
    const timeline = timelines[playthrough.path]
    if (timeline?.nodes?.some(node => node.variants?.some(variant => variant.sessionId === sessionId))) {
      return { playthrough, timeline }
    }
  }
  return null
}

async function loadTimelines(client, playthroughs, concurrency = 4) {
  const result = {}
  let cursor = 0
  const worker = async () => {
    while (cursor < playthroughs.length) {
      const playthrough = playthroughs[cursor]
      cursor += 1
      result[playthrough.path] = await client.getTimeline(playthrough)
    }
  }
  await Promise.all(Array.from(
    { length: Math.min(Math.max(1, concurrency), playthroughs.length) },
    worker,
  ))
  return result
}

export async function loadCurrentPlaythrough(client, session, options = {}) {
  if (client == null) throw new TypeError('playClient.required')
  const workspace = await client.getWorkspace()
  if (!sessionIsInRpWorkspace(workspace, session)) return null
  const catalog = await client.getCatalog()
  const playthroughs = catalog.playthroughs ?? []
  const sessionId = session.id ?? session.sessionId
  const preferred = typeof options.preferredPlaythroughId === 'string'
    ? playthroughs.find(item => item.id === options.preferredPlaythroughId)
    : undefined
  if (preferred !== undefined) {
    const timeline = await client.getTimeline(preferred)
    if (rootSessionId(preferred) === sessionId || timelineHead(timeline)?.sessionId === sessionId) {
      return { workspace, playthrough: preferred, timeline }
    }
  }
  const root = playthroughs.find(item => rootSessionId(item) === sessionId)
  if (root !== undefined) {
    return { workspace, playthrough: root, timeline: await client.getTimeline(root) }
  }
  const timelines = await loadTimelines(client, playthroughs, options.concurrency)
  const match = findPlaythroughForSession(sessionId, catalog, timelines)
  return match === null ? null : { workspace, ...match }
}

export function projectTimelineQa(timeline, messagesBySession = {}) {
  const result = []
  for (const { node, variant } of activeTimelineEntries(timeline)) {
    if (node.kind !== 'qa') continue
    const messages = messagesBySession[variant.sessionId]?.messages
      ?? messagesBySession[variant.sessionId]
      ?? []
    const within = messages.filter(message => Number.isSafeInteger(message.seq)
      && message.seq >= variant.startEventId
      && message.seq <= variant.endEventId)
    const trigger = within.find(message => message.role === 'user') ?? null
    const user = within.find(message => message.role === 'user'
      && (messageOriginKind(message) === 'user' || messageOriginKind(message) === 'steering')) ?? null
    const contexts = within
      .filter(message => message.role === 'user' && messageOriginKind(message) === 'context')
      .map(contextProjection)
    const assistants = within.filter(message => message.role === 'assistant')
    const assistant = assistants.at(-1) ?? null
    const displayOverridden = typeof node.displayOverride === 'string'
    const projected = {
      id: node.id,
      hidden: node.hidden === true,
      userText: renderedMessageText(user),
      contexts,
      triggerKind: messageOriginKind(trigger),
      reasoningText: contentReasoning(assistant?.content),
      assistantText: displayOverridden ? node.displayOverride : renderedMessageText(assistant),
      originalAssistantText: renderedMessageText(assistant),
      assistantCandidates: assistants.map(renderedMessageText),
      displayOverridden,
      variant,
      variants: node.variants,
      variantCount: node.variants.length,
    }
    const previous = result.at(-1)
    if (user === null && previous !== undefined && previous.variant.sessionId === variant.sessionId) {
      previous.contexts.push(...projected.contexts)
      previous.assistantCandidates.push(...projected.assistantCandidates)
      if (displayOverridden) {
        previous.assistantText = projected.assistantText
        previous.displayOverridden = true
      } else if (!previous.displayOverridden && projected.assistantCandidates.length > 0) {
        previous.assistantText = projected.assistantText
      }
      if (projected.originalAssistantText !== '') previous.originalAssistantText = projected.originalAssistantText
      if (projected.reasoningText !== '') previous.reasoningText = projected.reasoningText
    } else {
      result.push(projected)
    }
  }
  return result
}

export function selectAssistantDisplay(turn, render = value => value) {
  if (turn.displayOverridden === true) {
    return {
      assistantText: turn.assistantText,
      originalAssistantText: turn.originalAssistantText,
      assistantTexts: turn.assistantText === '' ? [] : [turn.assistantText],
    }
  }
  const candidates = Array.isArray(turn.assistantCandidates) && turn.assistantCandidates.length > 0
    ? turn.assistantCandidates
    : [turn.assistantText]
  const rawTexts = []
  const renderedTexts = []
  for (const candidate of candidates) {
    const rendered = render(candidate)
    if (rendered !== '') {
      rawTexts.push(candidate)
      renderedTexts.push(rendered)
    }
  }
  return {
    assistantText: renderedTexts.join('\n\n'),
    originalAssistantText: rawTexts.join('\n\n'),
    assistantTexts: renderedTexts,
  }
}

export function projectLiveTurns({
  timeline,
  sessionId,
  nodes,
  partial,
  running = false,
} = {}) {
  if (typeof sessionId !== 'string' || sessionId === '') return []
  const head = timelineHead(timeline)
  if (head !== null && head.sessionId !== sessionId) return []
  const boundary = recordedEndSeq(timeline, sessionId)
  const pending = []
  let turn = null
  const appendTurn = () => {
    if (turn !== null) pending.push(turn)
    turn = null
  }
  const createTurn = (node, triggerKind, userText = '') => ({
    id: `live-${node.seq}`,
    transient: true,
    userText,
    contexts: [],
    triggerKind,
    reasoningText: '',
    assistantText: '',
    running: false,
  })
  for (const node of nodes ?? []) {
    if (!Number.isFinite(node?.seq) || node.seq <= boundary) continue
    if (node.kind === 'user' || node.kind === 'steering') {
      appendTurn()
      turn = createTurn(node, node.kind, contentText(node.content))
    } else if (node.kind === 'context') {
      if (turn === null || turn.assistantText !== '' || turn.reasoningText !== '') {
        appendTurn()
        turn = createTurn(node, 'context')
      }
      turn.contexts.push({
        id: `context-${node.seq}`,
        seq: node.seq,
        text: contentText(node.content),
        producer: node.provenance?.label ?? node.source?.kind ?? null,
        form: node.form ?? node.source?.form ?? null,
        summary: typeof node.source?.summary === 'string' ? node.source.summary : null,
      })
    } else if (node.kind === 'assistant' && turn !== null) {
      turn.reasoningText = assistantReasoning(node.blocks)
      turn.assistantText = assistantText(node.blocks)
    }
  }
  appendTurn()
  if (pending.length === 0) return pending
  const tail = pending[pending.length - 1]
  if (running) {
    const reasoning = assistantReasoning(partial?.blocks)
    const streamed = assistantText(partial?.blocks)
    if (reasoning !== '') tail.reasoningText = reasoning
    if (streamed !== '') tail.assistantText = streamed
    tail.running = true
  }
  return pending
}

export function latestUserNodeSeq(nodes) {
  let latest = -1
  for (const node of nodes ?? []) {
    if (node?.kind === 'user' && Number.isFinite(node.seq)) latest = Math.max(latest, node.seq)
  }
  return latest
}

export function projectGreeting({
  openingCharacterId,
  selectionResponse,
  characterResponse,
} = {}) {
  const selection = selectionResponse?.selection
  const character = characterResponse?.character
  if (typeof selection?.characterCardId !== 'string'
    || selection.characterCardId === ''
    || selection.characterCardId !== openingCharacterId
    || character?.id !== selection.characterCardId) return null
  const options = characterGreetingOptions(character)
  if (options.length === 0) return null
  const requested = Number(selection.character?.greetingIndex ?? 0)
  const selected = options.find(option => option.index === requested) ?? options[0]
  if (selected.text === '') return null
  return {
    characterId: character.id,
    characterName: character.data?.nickname || character.data?.name || character.name || character.id,
    index: selected.index,
    text: selected.text,
    options,
  }
}

export function applyDisplayNameMacros(text, {
  user = 'User',
  character = 'Assistant',
} = {}) {
  const names = {
    user: typeof user === 'string' && user !== '' ? user : 'User',
    char: typeof character === 'string' && character !== '' ? character : 'Assistant',
  }
  return String(text ?? '').replace(/\{\{\s*(user|char)\s*\}\}/gi, (_match, name) => names[name.toLowerCase()])
}

export function adjacentGreetingIndex(greeting, direction) {
  const options = greeting?.options ?? []
  if (options.length === 0) return null
  const cursor = Math.max(0, options.findIndex(option => option.index === greeting.index))
  const offset = direction === 'previous' ? -1 : 1
  return options[(cursor + offset + options.length) % options.length].index
}
