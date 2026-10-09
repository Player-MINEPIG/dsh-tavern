/** Durable evidence for a cancelled human request with no assistant body. */
export function stoppedRequestFromEvents(entries) {
 const events=(entries??[]).map(entry=>entry?.event??entry)
 const end=events.findLast(event=>event.type==='turn/end')
 const start=events.findLast(event=>event.type==='turn/start')
 if(!end||end.data?.reason?.kind!=='aborted'||!start||start.seq>=end.seq||start.data?.turn!==end.data?.turn)return null
 const turn=events.filter(event=>event.seq>start.seq&&event.seq<end.seq)
 const user=turn.findLast(event=>{
  const message=event.data?.message??event.data
  return event.type==='user/message'&&['user','steering'].includes(message?.source?.kind??'user')
 })
 if(!user||events.some(event=>event.seq>end.seq&&['user/message','assistant/message'].includes(event.type)))return null
 if(turn.some(event=>event.type==='assistant/message'&&((event.data?.message??event.data)?.content??[]).some(block=>block.type==='text'&&block.text?.trim())))return null
 if(![user.seq,start.seq,end.seq].every(seq=>Number.isSafeInteger(seq)&&seq>=0))return null
 return {userEventId:user.seq,turnStartEventId:start.seq,turnEndEventId:end.seq}
}

/** Exactly one source coordinate; state itself is never accepted from callers. */
export function stateSourceTarget(source) {
 if(!source||typeof source!=='object'||Array.isArray(source)
  ||Object.keys(source).some(key=>!['sessionId','beforeReplyEventId','beforeUserEventId'].includes(key)))return null
 const retry=Object.hasOwn(source,'beforeUserEventId')
 if(retry===Object.hasOwn(source,'beforeReplyEventId'))return null
 const atEventId=retry?source.beforeUserEventId:source.beforeReplyEventId
 return Number.isSafeInteger(atEventId)&&atEventId>=0?{kind:retry?'request-retry':'reply-swipe',atEventId}:null
}
