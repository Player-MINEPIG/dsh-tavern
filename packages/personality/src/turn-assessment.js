import { createHash } from 'node:crypto'

const MAX_INPUT_CHARS = 24000
const assessmentFailure = (code, message) => Object.assign(new Error(message), { code })

const textOf = message => (message?.content ?? []).filter(b => b.type === 'text').map(b => b.text).join('\n')

/** Only completed, non-inherited human turns authorize background personality work. */
export function completedHumanTurn(session, end) {
  if (end?.type !== 'turn/end' || end.data?.reason?.kind !== 'completed' || !Number.isSafeInteger(end.seq)) return null
  const events = session.snapshotEvents()
  if (session.header?.id !== session.id || !['string','number'].includes(typeof session.header.createdAt)) return null
  const turn = end.data.turn
  const start = events.findLast(e => e.type === 'turn/start' && e.data.turn === turn && e.seq < end.seq)
  if (!start || start.seq < (session.inheritedEventCount ?? 0)) return null
  const rows = events.filter(e => e.seq > start.seq && e.seq < end.seq)
  const reply = rows.findLast(e => e.type === 'assistant/message' && e.data?.turn === turn)
  if (!reply || reply.data.interrupted || reply.data.message?.content.some(b => b.type === 'tool-call')) return null
  const users = rows.filter(e => e.seq < reply.seq && e.type === 'user/message' && (e.data?.message?.source?.kind ?? e.data?.source?.kind) === 'user')
  if (!users.length) return null
  const route = events.findLast(e => e.seq < end.seq && e.type === 'request/header')?.data?.header?.config
    ?? events.findLast(e => e.seq < end.seq && e.type === 'request/context')?.data
  if (!route?.provider || !route?.model) return null
  const assistant = textOf(reply.data.message), texts = users.map(e => textOf(e.data.message ?? e.data))
  if (!assistant || !texts.some(Boolean) || texts.reduce((n,t) => n + t.length,assistant.length) > MAX_INPUT_CHARS) return null
  return { origin: { kind: 'original', sessionId: session.id, sessionCreatedAt: session.header.createdAt, startSeq: start.seq, endSeq: end.seq,
    userSeqs: users.map(e => e.seq), assistantSeq: reply.seq, textHash: evidenceHash([texts, assistant]) }, users: texts, assistant, provider: route.provider, model: route.model }
}

/** An auxiliary provider call leaves the foreground session log and request Trace untouched. */
export async function requestAssessment(llm, { turn, system, input, signal, purpose }) {
  if (!llm || !turn?.provider || !turn.model) throw assessmentFailure('PERSONALITY_ASSESSMENT_MODEL', 'Personality assessment model unavailable')
  const deadline = AbortSignal.any([signal, AbortSignal.timeout(90000)])
  const route = { provider: turn.provider, model: turn.model, maxTokens: 1200 }
  // DSH orders supported reasoning efforts from least to greatest for this exact model.
  const call = llm.prepareCall ? await llm.prepareCall(route, deadline, (controls, model) => {
    const effort = model.reasoning?.efforts?.[0]?.id
    return effort === undefined ? controls : { ...controls, reasoningEffort: effort }
  }) : null
  const options = { ...(call?.config ?? route), sessionId: turn.origin.sessionId, purpose, system,
    messages: [{ role: 'user', content: [{ type: 'text', text: JSON.stringify(input) }] }], signal: deadline }
  let delta = '', final = '', finish
  for await (const part of (call ?? llm).stream(options)) {
    options.signal.throwIfAborted()
    if (part.type === 'block-end' && part.block?.type === 'text') final += part.block.text
    if (part.type === 'text-delta') delta += part.text
    if (delta.length > 16000 || final.length > 16000) throw assessmentFailure('PERSONALITY_ASSESSMENT_SIZE', 'Personality assessment response too large')
    if (part.type === 'finish') finish = part.reason
  }
  if (finish?.kind !== 'stop') {
    const kind = ({ 'max-tokens': 'MAX_TOKENS', aborted: 'ABORTED', error: 'PROVIDER_ERROR' })[finish?.kind] ?? 'INCOMPLETE'
    const providerCode = String(finish?.failure?.code ?? '').replace(/[^a-zA-Z0-9_.-]/g, '').slice(0, 60)
    throw assessmentFailure(`PERSONALITY_ASSESSMENT_${kind}`, `Assessment ended with ${kind}${providerCode ? ' (' + providerCode + ')' : ''}`)
  }
  const answer = (final || delta).trim()
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(answer)
  try { return JSON.parse(fenced ? fenced[1] : answer) }
  catch { throw assessmentFailure('PERSONALITY_ASSESSMENT_JSON', 'Assessment response was not JSON') }
}

export const evidenceHash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')

/** Match the exact historical user and assistant text, not just a reused session or turn number. */
export function readOriginalTurn(session, ref) {
  if (!session || session.id !== ref.sessionId || session.header.createdAt !== ref.sessionCreatedAt) return null
  const end = session.snapshotEvents().find(e => e.seq === ref.endSeq)
  const turn = completedHumanTurn(session, end)
  if (!turn || turn.origin.textHash !== ref.textHash || turn.origin.startSeq !== ref.startSeq ||
    turn.origin.assistantSeq !== ref.assistantSeq || turn.origin.userSeqs.join(',') !== ref.userSeqs.join(',')) return null
  return turn
}
