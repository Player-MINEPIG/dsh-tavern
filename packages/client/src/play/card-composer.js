const MODE_KEY = 'pmp-dsh-tavern:card-composer-modes:v1'
const MAX_TEXT = 4000

function readModes(storage) {
  const raw = storage?.getItem(MODE_KEY)
  if (!raw) return []
  if (raw.length > 20000) throw Error('Card mode storage exceeds limit')
  const entries = JSON.parse(raw)
  if (!Array.isArray(entries) || entries.length > 128 || entries.some(item => !Array.isArray(item) || item.length !== 2 || !/^[a-f0-9]{64}$/.test(item[0]) || typeof item[1] !== 'boolean')) throw Error('Invalid card mode storage')
  return entries
}
export async function cardComposerIdentity(scopeKey, source) {
  const digest = await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify([scopeKey,source])))
  return [...new Uint8Array(digest)].map(value=>value.toString(16).padStart(2,'0')).join('')
}

// Trusted code holds the adapter. Its revision-guarded input actions are never
// transferred to the interpreter; a card receives only bounded JSON receipts.
export function createCardComposerBridge({identity, adapter, storage, onClose=()=>{}}) {
  if (!/^[a-f0-9]{64}$/.test(identity)) throw Error('Invalid card composer identity')
  let disposed=false, sending=false, sent=false, filled=null
  const lease=Symbol('card input request')
  let directSend=true,modeError
  try{directSend=readModes(storage).find(([key])=>key===identity)?.[1] ?? true}catch(error){modeError=error.message}
  const assertCurrent = signal => {
    signal?.throwIfAborted()
    if (disposed || !adapter?.isCurrent()) throw Error('Card input scope is unavailable or expired')
  }
  return {
    initial: Object.freeze({available:!!adapter,directSend}),
    modeError,
    dispose(){disposed=true;filled=null;adapter?.finishRequest?.(lease)},
    finishRequest(){adapter?.finishRequest?.(lease)},
    async request({operation,value,cause,taskId,signal}) {
      assertCurrent(signal)
      if (cause !== 'user-interaction') throw Error('Card input requires a trusted user click')
      if (operation === 'close') {
        if (!sent || filled?.taskId !== taskId) throw Error('Card may close only after its accepted send')
        onClose();adapter.finishRequest?.(lease);return {status:'closed'}
      }
      if (sending || sent) throw Error('This card already has a send request')
      if (operation === 'saveMode') {
        if (typeof value !== 'boolean') throw Error('Only XiaJin.directSend is supported')
        if (!storage) throw Error('Card mode storage is unavailable')
        const entries=readModes(storage).filter(([key])=>key!==identity)
        entries.push([identity,value]);storage.setItem(MODE_KEY,JSON.stringify(entries.slice(-128)))
        directSend=value;return {status:'saved',directSend}
      }
      if (operation === 'fill') {
        if (typeof value !== 'string' || !value.trim() || value.length > MAX_TEXT) throw Error('Card input text exceeds limit or is empty')
        const revision=adapter.fill(value)
        filled={text:value,revision,taskId}
        return {status:'filled'}
      }
      if (operation === 'send') {
        if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key=>!['mode','text'].includes(key)) || value.mode !== 'direct' || !directSend || filled?.taskId !== taskId || value.text !== filled.text) throw Error('Direct send requires this click\'s filled draft and direct mode')
        if (!adapter.matches(filled)) throw Error('The input draft changed before the send request')
        sending=true
        try {
          await adapter.send(filled.text,{signal,lease})
          // The server receipt means accepted, never model completion. A scope
          // switch after acceptance must not clear a newly addressed draft.
          sent=true;assertCurrent(signal)
          adapter.clear(filled)
          return {status:'accepted'}
        } finally {sending=false;if(!sent)adapter.finishRequest?.(lease)}
      }
      throw Error('Unsupported card input request')
    },
  }
}

export function createComposerAdapter({inputActions,getState,isCurrent,isReady=()=>true,send}) {
  const current=()=>{if(!isCurrent() || !inputActions?.insertText || !inputActions?.captureInsertion)throw Error('Session input is unavailable or expired')}
  return {
    isCurrent,
    fill(text) {
      current();if(!isReady())throw Error('Session input is busy');const state=getState()
      if (!state || state.phase !== 'plain' || state.attachmentIds?.length || state.occurrences?.length || !Number.isSafeInteger(state.draftRev) || typeof state.draft !== 'string') throw Error('Session input is busy or contains structured draft content')
      if (!inputActions.insertText(text,{start:0,end:state.draft.length,draftRev:state.draftRev})) throw Error('Session input changed before fill')
      return inputActions.captureInsertion().draftRev
    },
    matches({revision,text}) {current();return inputActions.captureInsertion().draftRev===revision&&getState()?.draft===text},
    send(text,options) {current();if(!isReady())throw Error('Session input is busy');return send(text,options)},
    clear({text,revision}) {
      current()
      if(inputActions.captureInsertion().draftRev===revision)inputActions.insertText('',{start:0,end:text.length,draftRev:revision})
    },
  }
}
