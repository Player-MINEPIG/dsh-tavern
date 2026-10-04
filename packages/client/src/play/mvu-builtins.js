// Explicit replacements for these reviewed byte identities only. No URL pattern matching.
const bundleHash='378e7c2bca24619a97717dd6eb963e5fef43461a8bd16a9591b9c8b06e08010c'
export const MVU_BUILTINS=Object.freeze([
 ...['testingcf','cdn'].map(host=>Object.freeze({url:`https://${host}.jsdelivr.net/gh/MagicalAstrogy/MagVarUpdate/artifact/bundle.js`,sha256:bundleHash,kind:'mvu-facade',version:1})),
 // The mutable upstream URL has two statically reviewed registration revisions.
 ...['78c40f52d81022d9d769a923a49e673b8babb562656051a7d0410b6b19f45184','e540ab99589ad83de1495056a84693bda00af92f8848926bcb9a53b9263a0302'].map(sha256=>Object.freeze({url:'https://testingcf.jsdelivr.net/gh/StageDog/tavern_resource/dist/util/mvu_zod.js',sha256,kind:'backend-schema',version:1})),
])
export function mvuBuiltin(url,digest){return MVU_BUILTINS.find(item=>item.url===url&&item.sha256===digest)??null}
export function confirmMvuSchemas(declarations,snapshot){
 return declarations.map(item=>{
  const descriptor=snapshot?.variables?.mvu_schema
  if(snapshot?.status!=='available'||descriptor?.mvuSchema!==1||![1,2].includes(descriptor?.interpreterVersion)||descriptor?.source!==item.source)throw Error('Built-in MVU schema requires an available backend snapshot with the exact complete schema source and supported interpreter version')
  return {...item,status:'source-registered',resourceId:snapshot.resourceId,revision:snapshot.revision,interpreterVersion:descriptor.interpreterVersion,confirmation:'Derived locally from the authoritative snapshot; original schema script was not executed in the card'}
 })
}
