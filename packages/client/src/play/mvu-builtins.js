// Exact import aliases route to a bounded local contract, never to remote code.
export const MVU_ADAPTERS=Object.freeze([
 ...['testingcf','cdn'].map(host=>Object.freeze({url:`https://${host}.jsdelivr.net/gh/MagicalAstrogy/MagVarUpdate/artifact/bundle.js`,kind:'mvu-facade',version:1})),
 Object.freeze({url:'https://testingcf.jsdelivr.net/gh/StageDog/tavern_resource/dist/util/mvu_zod.js',kind:'backend-schema',version:1}),
])
export function mvuAdapter(url,version=1){return MVU_ADAPTERS.find(item=>item.url===url&&item.version===version)??null}
export function confirmMvuSchemas(declarations,snapshot){
 return declarations.map(item=>{
  const descriptor=snapshot?.variables?.mvu_schema
  if(snapshot?.status!=='available')throw Object.assign(Error('MVU snapshot is unavailable'),{code:'MVU_SNAPSHOT_UNAVAILABLE'})
  if(descriptor?.mvuSchema!==1||![1,2].includes(descriptor?.interpreterVersion)||descriptor?.source!==item.source)throw Object.assign(Error('Built-in MVU schema requires the exact complete schema source and supported interpreter version'),{code:'MVU_SCHEMA_MISMATCH'})
  return {...item,status:'source-registered',resourceId:snapshot.resourceId,revision:snapshot.revision,interpreterVersion:descriptor.interpreterVersion,confirmation:'Derived locally from the authoritative snapshot; original schema script was not executed in the card'}
 })
}

// A registration receipt confirms a source processor, never a state commit.
export function confirmMvuCommandHooks(declarations,snapshot){
 return declarations.map(item=>{
  const receipt=snapshot?.commandProcessor
  if(snapshot?.status!=='available')throw Object.assign(Error('MVU snapshot is unavailable'),{code:'MVU_SNAPSHOT_UNAVAILABLE'})
  if(receipt?.protocolVersion!==1||receipt?.registered!==true||receipt.source!==item.source||typeof receipt.registrationId!=='string'||!receipt.registrationId||!Number.isSafeInteger(receipt.listenerCount)||receipt.listenerCount<1)throw Error('MVU command Helper requires a matching successful source registration receipt')
  return {...item,status:'source-registered',resourceId:snapshot.resourceId,registrationId:receipt.registrationId,confirmation:'Source precommit registration; no state commit implied'}
 })
}
