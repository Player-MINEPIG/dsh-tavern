// Trusted caches share one byte budget. This is accounting, not execution or
// write approval. Guest code receives no reservation handle.
export function createRenderingCacheBudget(limit=64*1024*1024) {
  if(!Number.isSafeInteger(limit)||limit<1)throw Error('Invalid rendering cache budget')
  const reservations=new Map(),initializations=new Map(),failures=new Map()
  return Object.freeze({
    reserve(key,bytes){
      if(typeof key!=='string'||!key||key.length>200||!Number.isSafeInteger(bytes)||bytes<0)throw Error('Invalid rendering cache reservation')
      const total=[...reservations].reduce((sum,[name,size])=>sum+(name===key?0:size),bytes)
      if(total>limit)throw Error('Rendering code and opening data cache exceed the shared byte budget')
      if(bytes===0)reservations.delete(key);else reservations.set(key,bytes)
      return total
    },
    snapshot(){return Object.freeze({limit,total:[...reservations.values()].reduce((sum,size)=>sum+size,0),entries:Object.freeze([...reservations].map(row=>Object.freeze(row)))})},
    trackInitialization(key,promise){
      if(typeof key!=='string'||!key||key.length>200||initializations.has(key)||new Set([...initializations.keys(),...failures.keys()]).size>=16&&!failures.has(key)||!promise||typeof promise.then!=='function')throw Error('Invalid cache initialization')
      const pending=Promise.resolve(promise).then(()=>{failures.delete(key)},error=>{failures.set(key,error instanceof Error?error:Error(String(error)))}).finally(()=>{if(initializations.get(key)===pending)initializations.delete(key)})
      initializations.set(key,pending)
    },
    async ready(){while(initializations.size)await Promise.all([...initializations.values()]);if(failures.size)throw failures.values().next().value},
  })
}
export const renderingCacheBudget=createRenderingCacheBudget()
