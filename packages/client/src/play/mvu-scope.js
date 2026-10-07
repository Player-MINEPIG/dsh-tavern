/** A candidate initial coordinate only; the source independently validates history and membership. */
export function initialCardScope({playthrough,sessionId,characterId,timeline,turns=[],greetingIndex}={}) {
 const ext=playthrough?.ext?.pmpDshTavern
 if(!ext?.rootSessionId&&ext?.draftId===playthrough?.id&&ext?.characterId===characterId&&Number.isSafeInteger(greetingIndex)&&greetingIndex>=0&&Array.isArray(timeline?.nodes)&&!timeline.nodes.length&&!turns.length)return {mode:'draft',playthroughId:playthrough.id,characterId,greetingIndex}
 if(typeof playthrough?.id!=='string'||!playthrough.id||typeof sessionId!=='string'||!sessionId||typeof characterId!=='string'||!characterId
  ||ext?.rootSessionId!==sessionId||ext?.characterId!==characterId||!Array.isArray(timeline?.nodes)||timeline.nodes.length||turns.length)return null
 return {mode:'initial',playthroughId:playthrough.id,sessionId,characterId,...(Number.isSafeInteger(greetingIndex)&&greetingIndex>=0?{greetingIndex}:{})}
}

/** Read-only opening view, frozen at the first persisted pre-turn checkpoint. */
export function greetingCardScope({playthrough,sessionId,characterId,greetingIndex,timeline}={}) {
 const ext=playthrough?.ext?.pmpDshTavern
 if(!ext?.rootSessionId&&ext?.draftId===playthrough?.id&&ext?.characterId===characterId&&Number.isSafeInteger(greetingIndex)&&greetingIndex>=0)return {mode:'draft',playthroughId:playthrough.id,characterId,greetingIndex}
 const member=ext?.rootSessionId===sessionId||timeline?.nodes?.some(node=>node.variants?.some(variant=>variant.sessionId===sessionId))
 if(typeof playthrough?.id!=='string'||!playthrough.id||typeof sessionId!=='string'||!sessionId||typeof characterId!=='string'||!characterId
  ||!member||ext?.characterId!==characterId)return null
 return {mode:'greeting',playthroughId:playthrough.id,sessionId,characterId,...(Number.isSafeInteger(greetingIndex)&&greetingIndex>=0?{greetingIndex}:{})}
}

/** Bind an initial write to the source-verified selection seen by this view. */
export function initialWriteViewScope(scope,snapshot) {
 if(!['initial','draft'].includes(scope?.mode)||scope.greetingIndex===undefined)return scope
 const view=snapshot?.viewIdentity
 if(view?.greetingIndex!==scope.greetingIndex||!/^[a-f0-9]{64}$/.test(view?.selectionToken??''))throw Error('Current greeting selection proof unavailable')
 return {...scope,selectionToken:view.selectionToken}
}
export function writeGrantScope(scope,grant) {
 if(!['initial','draft'].includes(scope?.mode)||scope.greetingIndex===undefined)return scope
 const bound=grant?.sourceIdentity?.scope
 if(!bound||Object.entries(scope).some(([key,value])=>bound[key]!==value)
  ||Object.keys(bound).some(key=>!Object.hasOwn(scope,key)&&key!=='selectionToken')
  ||!/^[a-f0-9]{64}$/.test(bound.selectionToken??''))throw Error('Write grant belongs to a different greeting selection')
 return {...scope,selectionToken:bound.selectionToken}
}
