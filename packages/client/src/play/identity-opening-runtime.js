// Only the fixed identity adapter installs this promise RPC. Parent replies
// settle a VM promise; no interpreter waits synchronously for human approval.
export const IDENTITY_OPENING_RUNTIME=`
const __openingPromises=new Map();let __openingRequestId=0;
globalThis.__identityOpening=openingId=>new Promise((resolve,reject)=>{if(__openingPromises.size)throw Error('Opening selection pending');const requestId=++__openingRequestId;__openingPromises.set(requestId,{resolve,reject});try{__call('identityOpening',[requestId,openingId])}catch(error){__openingPromises.delete(requestId);reject(error)}});
globalThis.__identityOpeningResult=(requestId,result)=>{const pending=__openingPromises.get(requestId);if(!pending)return;__openingPromises.delete(requestId);if(result.error)pending.reject(Error(result.error));else pending.resolve(result.value)};
`
