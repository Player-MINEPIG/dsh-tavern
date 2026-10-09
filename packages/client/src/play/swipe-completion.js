import {finishPendingSwipe} from './pending-swipe.js'
import {updateTimeline} from './mutations.js'
import {timelineWithHead} from '../../../play/src/timeline-tree.js'

const origin = message => message?.origin?.kind ?? (message?.role === 'user' ? 'user' : message?.role)
export function completedSwipePair(state, boundary) {
  if (state?.incompleteTurn !== false) return null
  const messages = (state.messages ?? []).filter(m => Number.isSafeInteger(m.seq) && m.seq > boundary).sort((a,b) => a.seq-b.seq)
  const user = messages.find(m => m.role === 'user' && ['user','steering'].includes(origin(m)))
  if (!user || state.stoppedRequest?.userEventId === user.seq) return null
  const assistant = messages.findLast(m => m.role === 'assistant' && m.seq > user.seq)
  return assistant ? {user, assistant, sessionFormatVersion: state.sessionFormatVersion} : null
}

// Commit only observed durable coordinates. In particular a failed UI wait must
// never resend the prompt, invent a reply, or move a separately selected head.
export async function commitSwipeReply(client, pending, pair, {
  variantId = `swipe-${pending.sessionId}-${pair.user.seq}-${pair.assistant.seq}`,
  writeTimeline = transform => updateTimeline(client, pending.playthrough, transform),
} = {}) {
  const variant = {id:variantId,sessionId:pending.sessionId,startEventId:pair.user.seq,endEventId:pair.assistant.seq,
    ...(Number.isSafeInteger(pair.sessionFormatVersion)?{ext:{pmpDshTavern:{sessionFormatVersion:pair.sessionFormatVersion}}}:{})}
  const next = await writeTimeline(timeline => {
    const node = timeline.nodes.find(n => n.id === pending.nodeId)
    if (!node || !node.variants.some(v => v.sessionId === pending.sourceSessionId && (!pending.sourceVariantId || v.id === pending.sourceVariantId))) throw Error('Swipe source reply is no longer in this playthrough')
    if (!Object.hasOwn(pending,'expectedHead') && timeline.head && ![pending.sourceSessionId,pending.sessionId].includes(timeline.head.sessionId)) throw Error('Active reply changed while the swipe was waiting')
    const existing = node.variants.find(v => v.sessionId === variant.sessionId && v.startEventId === variant.startEventId && v.endEventId === variant.endEventId)
    const saved = existing ?? variant
    const head = {sessionId:saved.sessionId,nodeId:node.id,variantId:saved.id}
    if (JSON.stringify(timeline.head ?? null) !== JSON.stringify(head)
      && Object.hasOwn(pending,'expectedHead') && JSON.stringify(timeline.head ?? null) !== JSON.stringify(pending.expectedHead)) throw Error('Active reply changed while the swipe was waiting')
    return timelineWithHead({...timeline,nodes:timeline.nodes.map(n=>n===node?{...n,adoptedVariantId:saved.id,variants:existing?n.variants:[...n.variants,saved]}:n)},head)
  })
  const focus = await client.getFocus(pending.playthrough)
  if (focus.sessionId !== pending.sessionId) throw Error('Saved swipe does not match derived focus')
  finishPendingSwipe(client,pending)
  return {timeline:next,sessionId:pending.sessionId,nodeId:pending.nodeId,variantId:next.head.variantId}
}

export async function recoverCompletedSwipe(client,pending) {
  // Request retries create a new QA, not a variant of an existing reply.
  if (!pending.error || pending.kind === 'request-retry') return null
  if (pending.recovery) return pending.recovery
  const work = (async()=>{
    // Legacy pending swipes already carry a verified prefix and source identity.
    const boundary = pending.boundary ?? Math.max(-1,...pending.timeline.nodes.flatMap(n=>n.variants.filter(v=>v.id===n.adoptedVariantId).map(v=>v.endEventId)))
    const pair = completedSwipePair(await client.getMessages(pending.sessionId),boundary)
    if (!pair) return null
    return commitSwipeReply(client,pending,pair)
  })()
  pending.recovery=work
  try{return await work}finally{if(pending.recovery===work)delete pending.recovery}
}
