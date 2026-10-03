/** A candidate initial coordinate only; the source independently validates history and membership. */
export function initialCardScope({playthrough,sessionId,characterId,timeline,turns=[]}={}) {
 const ext=playthrough?.ext?.pmpDshTavern
 if(typeof playthrough?.id!=='string'||!playthrough.id||typeof sessionId!=='string'||!sessionId||typeof characterId!=='string'||!characterId
  ||ext?.rootSessionId!==sessionId||ext?.characterId!==characterId||!Array.isArray(timeline?.nodes)||timeline.nodes.length||turns.length)return null
 return {mode:'initial',playthroughId:playthrough.id,sessionId,characterId}
}

/** Current read-only greeting view. Turns do not turn it into a message snapshot. */
export function greetingCardScope({playthrough,sessionId,characterId}={}) {
 const ext=playthrough?.ext?.pmpDshTavern
 if(typeof playthrough?.id!=='string'||!playthrough.id||typeof sessionId!=='string'||!sessionId||typeof characterId!=='string'||!characterId
  ||ext?.rootSessionId!==sessionId||ext?.characterId!==characterId)return null
 return {mode:'greeting',playthroughId:playthrough.id,sessionId,characterId}
}
