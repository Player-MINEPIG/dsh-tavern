/** Read-only source projection for this selected, local greeting. */
export function boundGreetingView({state,scope,disabled=false}={}) {
 const greeting=state?.greeting
 if(disabled||!scope||scope.mode!=='greeting'||greeting?.characterId!==scope.characterId
  ||typeof greeting.sourceText!=='string'||greeting.sourceText.length>64*1024
  ||!Number.isSafeInteger(greeting.index)||greeting.index<0
  ||!Number.isSafeInteger(greeting.messageCount)||greeting.messageCount<1)return null
 return {version:1,scope:{...scope},messageCount:greeting.messageCount,
  message:{message_id:0,mes:greeting.sourceText,is_user:false,is_system:false,swipe_id:greeting.index},
  selectionReceipt:greeting.selectionReceipt}
}
/** Carry the observed choice across refreshes; only a new choice gets an event. */
export function carryGreetingSelection(previous,next) {
 if(!next)return
 if(previous?.characterId===next.characterId&&previous.index===next.index&&previous.sourceText===next.sourceText)next.selectionReceipt=previous.selectionReceipt
 else if(previous?.characterId===next.characterId&&previous.index!==next.index)next.selectionReceipt={}
}
const deliveredSelections=new WeakSet()
/** Called by the native client only after successful Worker startup. */
export function claimGreetingSelection(receipt) {
 if(!receipt||typeof receipt!=='object'||deliveredSelections.has(receipt))return null
 deliveredSelections.add(receipt)
 return {swiped:true}
}
export function greetingReadView(view) {
 if(!view)return null
 const {selectionReceipt,...snapshot}=view
 return snapshot
}
