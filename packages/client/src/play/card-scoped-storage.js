import {sourceSha256} from './source-sha256.js'
export const CARD_STORAGE_LIMIT=128*1024
export const CARD_STORAGE_VALUE_LIMIT=64*1024
export const cardStorageBytes=value=>new TextEncoder().encode(value).byteLength
export function validateCardStorage(entries) {
  if(!Array.isArray(entries)||entries.length>32)throw Error('Card storage entry limit exceeded')
  const keys=new Set()
  for(const row of entries){
    if(!Array.isArray(row)||row.length!==2||typeof row[0]!=='string'||!row[0]||row[0].length>512||typeof row[1]!=='string'||row[1].length>CARD_STORAGE_VALUE_LIMIT||cardStorageBytes(row[1])>CARD_STORAGE_VALUE_LIMIT||keys.has(row[0]))throw Error('Invalid card storage entry')
    keys.add(row[0])
  }
  if(cardStorageBytes(JSON.stringify(entries))>CARD_STORAGE_LIMIT)throw Error('Card storage exceeds 128 KiB')
  return entries.map(row=>[...row])
}
export function createCardScopedStorage({storage,owners,scopeKey,sourceIdentity}) {
  if(typeof scopeKey!=='string'||!scopeKey||!Array.isArray(owners)||!owners.length||typeof sourceIdentity!=='string'||!sourceIdentity)throw Error('Card storage requires an explicit source and session scope')
  const identity=sourceSha256(JSON.stringify([owners,scopeKey,sourceIdentity])),key='pmp-dsh-tavern:card-storage:v1:'+identity
  let entries=[],disposed=false,revision=0
  if(storage){const saved=storage.getItem(key);if(saved!==null){if(typeof saved!=='string'||saved.length>CARD_STORAGE_LIMIT||cardStorageBytes(saved)>CARD_STORAGE_LIMIT)throw Error('Card storage exceeds 128 KiB');entries=validateCardStorage(JSON.parse(saved))}}
  return {
    initial:{scope:identity,entries},
    request(request){
      if(disposed)throw Error('Card storage generation expired')
      if(!request||request.revision!==revision+1||!['set','remove','clear'].includes(request.operation))throw Error('Invalid card storage revision')
      revision=request.revision
      const map=new Map(entries)
      if(request.operation==='clear')map.clear()
      else {if(typeof request.key!=='string'||!request.key||request.key.length>512)throw Error('Invalid card storage key');if(request.operation==='set')map.set(request.key,request.value);else map.delete(request.key)}
      const next=validateCardStorage([...map])
      if(!storage)throw Error('Card draft persistence is unavailable')
      storage.setItem(key,JSON.stringify(next))
      entries=next
      return {revision}
    },
    dispose(){disposed=true},
  }
}
export const CARD_STORAGE_RUNTIME=`
const __stored=new Map(__call('cardStorageSnapshot'));
const __storeChange=(operation,key,value)=>{const result=JSON.parse(__cardStorage(JSON.stringify({operation,key,value})));if(result.error)throw Error(result.error);if(operation==='clear')__stored.clear();else if(operation==='set')__stored.set(key,value);else __stored.delete(key)};
globalThis.localStorage=Object.freeze({getItem:key=>__stored.get(String(key))??null,setItem:(key,value)=>__storeChange('set',String(key),String(value)),removeItem:key=>__storeChange('remove',String(key)),clear:()=>__storeChange('clear'),key:index=>[...__stored.keys()][Number(index)]??null,get length(){return __stored.size}});
window.localStorage=localStorage;
`
