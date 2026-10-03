// Concrete proposals are untrusted data. Confirmation and writes stay in React.
export const IDENTITY_ACTION_RUNTIME=`
let __identityActionId=0;const __identityActions=new Map();
globalThis.__identityAction=payload=>new Promise((resolve,reject)=>{if(__identityActions.size)throw Error('Identity action pending');const requestId=++__identityActionId;__identityActions.set(requestId,{resolve,reject});try{__call('identityAction',[requestId,payload])}catch(error){__identityActions.delete(requestId);reject(error)}});
globalThis.__identityActionResult=(requestId,result)=>{const pending=__identityActions.get(requestId);if(!pending)return;__identityActions.delete(requestId);if(result.error)pending.reject(Error(result.error));else pending.resolve(result.value)};
`
