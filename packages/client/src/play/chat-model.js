import { characterGreetingOptions } from '../../../character/src/client-state.js'

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
  return end
}

function contentText(content) {
  if (!Array.isArray(content)) return ''
  return content
    .filter(part => part?.type === 'text' && typeof part.text === 'string')
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

export function sessionIsInRpWorkspace(workspace, session) {
  if (workspace?.selected !== true || session == null) return false
  const root = normalizedPath(workspace.rootPath)
  return root !== '' && normalizedPath(session.cwd) === root
}

export function findPlaythroughForSession(sessionId, catalog, timelines = {}) {
  if (typeof sessionId !== 'string' || sessionId === '') return null
  for (const playthrough of catalog?.playthroughs ?? []) {
    const timeline = timelines[playthrough.path]
    if (rootSessionId(playthrough) === sessionId) return { playthrough, timeline: timeline ?? null }
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
  for (const node of timeline?.nodes ?? []) {
    if (node.kind !== 'qa') continue
    const variant = adoptedVariant(node)
    if (variant === null) continue
    const messages = messagesBySession[variant.sessionId]?.messages
      ?? messagesBySession[variant.sessionId]
      ?? []
    const within = messages.filter(message => Number.isSafeInteger(message.seq)
      && message.seq >= variant.startEventId
      && message.seq <= variant.endEventId)
    const user = within.find(message => message.role === 'user') ?? null
    const assistant = [...within].reverse().find(message => message.role === 'assistant') ?? null
    result.push({
      id: node.id,
      hidden: node.hidden === true,
      userText: user?.text ?? '',
      assistantText: node.displayOverride ?? assistant?.text ?? '',
      originalAssistantText: assistant?.text ?? '',
      displayOverridden: node.displayOverride !== null,
      variant,
      variants: node.variants,
      variantCount: node.variants.length,
    })
  }
  return result
}

export function projectLiveTurns({
  timeline,
  sessionId,
  nodes,
  partial,
  running = false,
} = {}) {
  if (typeof sessionId !== 'string' || sessionId === '') return []
  const boundary = recordedEndSeq(timeline, sessionId)
  const pending = []
  let turn = null
  for (const node of nodes ?? []) {
    if (!Number.isFinite(node?.seq) || node.seq <= boundary) continue
    if (node.kind === 'user') {
      if (turn !== null) pending.push(turn)
      turn = {
        id: `live-${node.seq}`,
        transient: true,
        userText: contentText(node.content),
        assistantText: '',
        running: false,
      }
    } else if (node.kind === 'assistant' && turn !== null) {
      turn.assistantText = assistantText(node.blocks)
    }
  }
  if (turn !== null) pending.push(turn)
  if (pending.length === 0) return pending
  const tail = pending[pending.length - 1]
  if (running) {
    const streamed = assistantText(partial?.blocks)
    if (streamed !== '') tail.assistantText = streamed
    tail.running = true
  }
  return pending
}

export function projectGreeting({
  timeline,
  messages,
  selectionResponse,
  characterResponse,
} = {}) {
  if ((timeline?.nodes?.length ?? 0) !== 0 || (messages?.length ?? 0) !== 0) return null
  const selection = selectionResponse?.selection
  const character = characterResponse?.character
  if (typeof selection?.characterCardId !== 'string'
    || selection.characterCardId === ''
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

export function adjacentGreetingIndex(greeting, direction) {
  const options = greeting?.options ?? []
  if (options.length === 0) return null
  const cursor = Math.max(0, options.findIndex(option => option.index === greeting.index))
  const offset = direction === 'previous' ? -1 : 1
  return options[(cursor + offset + options.length) % options.length].index
}
