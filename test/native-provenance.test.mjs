import test from 'node:test'
import assert from 'node:assert/strict'
import { digest } from '../packages/prompt-metadata.js'
import { captureNativeSourceReferences, nativeRequestProvenance } from '../packages/tavern-trace/src/native-provenance.js'
import { AssemblyStore } from '../packages/tavern-trace/src/assembly-store.js'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
const msg = (id, role, text, source = {kind:'user'}) => ({ id, role, content:[{type:'text',text}], source })
const source = {plugin:'pmp-dsh-tavern',module:'preset',sourceId:'preset',resourceId:'preset-id',field:'main'}
const anchor = (m,start,end) => ({messageId:m.id,messageHash:digest(m.content),startUtf16:start,endUtf16:end})
function fixture() {
  const system = msg('sys','system','CORE\n\n😀CARD\n\nTAIL'), phi=msg('phi','user','PHI')
  const context = msg('ctx','user','[context]\nMEMORY',{kind:'runtime-context',form:'snapshot',sections:[{name:'memory',text:'MEMORY'}]})
  const messages=[system,context,phi]
  const section={name:'preset-main',hash:digest('😀CARD'),reference:{messageId:system.id,messageHash:digest(system.content),range:{startUtf16:6,endUtf16:12}},sources:[{...source,hash:digest('😀CARD')}]}
  const contexts=[{name:'memory',hash:digest('MEMORY'),reference:{messageId:context.id,messageHash:digest(context.content)}}]
  const nodes=[{id:'main',name:'Authored Main',module:'preset',text:'😀CARD',source,nativeSectionName:section.name,
    children:[{id:'macro',name:'description',text:'CARD',source:{...source,module:'character',field:'description'}}]},
    {id:'mem',name:'Memory item',module:'memory-manager.resources',text:'MEMORY',source:{plugin:'dsh-memory-manager',field:'m'},nativeContextName:'memory'},
    {id:'phi',name:'Authored PHI',module:'phi',role:'user',text:'PHI',source:{...source,field:'jailbreak'},nativeMessageId:'phi'}]
  return {messages,nodes,record:{sections:[section],contexts}}
}
test('native capture stores exact ranges and names for system, context, pre-step and nested references',()=>{
  const f=fixture(); const refs=captureNativeSourceReferences(f.record,{messages:f.messages,nodes:f.nodes},f.messages)
  assert.equal(refs.length,3);assert.equal(refs[0].children[0].reference.startUtf16,8)
  assert.ok(!JSON.stringify(refs).includes('😀CARD'));assert.ok(!JSON.stringify(refs).includes('MEMORY'))
  f.record.nativeSourceRefs=refs
  const result=nativeRequestProvenance(f.record,{messages:f.messages})
  assert.ok(result.nodes.some(n=>n.name==='Authored Main'&&n.children[0].text==='CARD'))
  assert.ok(result.nodes.some(n=>n.name==='Authored PHI'&&n.text==='PHI'&&n.role==='user'))
  assert.ok(result.nodes.some(n=>n.name==='Memory item'&&n.text==='MEMORY'))
  assert.ok(result.nodes.some(n=>n.name==='source-unrecorded'&&n.text==='CORE\n\n'))
  assert.ok(result.nodes.some(n=>n.name==='native-context-framing'))
  assert.deepEqual(result.nodes.map(n=>n.messageIndex),[0,0,0,1,1,2])
})
test('old recorded identifiers annotate only verified ranges without inventing current resource names',()=>{
  const f=fixture(); f.record.sections[0].contentStatus='available'
  const result=nativeRequestProvenance(f.record,{messages:f.messages})
  const node=result.nodes.find(n=>n.source.field==='main')
  assert.equal(node.name,'preset:main');assert.equal(node.sourceStatus,'name-unrecorded');assert.equal(node.text,'😀CARD')
  f.messages[0].content[0].text='TAMPERED'
  assert.ok(!nativeRequestProvenance(f.record,{messages:f.messages}).nodes.some(n=>n.source.field==='main'))
})
test('unobserved or ambiguous content never obtains guessed attribution',()=>{
  const f=fixture()
  assert.deepEqual(captureNativeSourceReferences(f.record,{messages:[],nodes:f.nodes},f.messages),[])
  f.messages[1].content[0].text='MEMORY MEMORY';f.record.contexts[0].reference.messageHash=digest(f.messages[1].content)
  assert.equal(captureNativeSourceReferences(f.record,{messages:f.messages,nodes:f.nodes},f.messages).length,2)
  f.record.sections[0].contentStatus='reference-unavailable'
  assert.ok(!nativeRequestProvenance(f.record,{messages:f.messages}).nodes.some(n=>n.source.field==='main'))
})
test('overlapping references and invalid child hashes remain unverified',()=>{
  const f=fixture(), refs=captureNativeSourceReferences(f.record,{messages:f.messages,nodes:f.nodes},f.messages)
  refs[0].children[0].hash=digest('WRONG')
  f.record.nativeSourceRefs=refs
  assert.equal(nativeRequestProvenance(f.record,{messages:f.messages}).nodes.find(n=>n.name==='Authored Main').children.length,0)
  f.record.nativeSourceRefs.push({...refs[0],id:'overlap',reference:{...refs[0].reference,startUtf16:8},hash:digest('CARD')})
  assert.ok(!nativeRequestProvenance(f.record,{messages:f.messages}).nodes.some(n=>n.name==='Authored Main'))
})
test('persistence strips hydrated provenance and child text without a second body store',()=>{
  const f=fixture(),directory=mkdtempSync(join(tmpdir(),'native-source-store-'))
  try {
    const refs=captureNativeSourceReferences(f.record,{messages:f.messages,nodes:f.nodes},f.messages)
    refs[0].text='LEAK BODY';refs[0].children[0].text='LEAK CHILD'
    const store=new AssemblyStore(directory);store.put({schemaVersion:4,id:'capture',sessionId:'session',...f.record,nativeSourceRefs:refs,nativeProvenance:{nodes:[{text:'LEAK PROVENANCE'}]}})
    const body=readFileSync(store.path,'utf8');assert.ok(!body.includes('LEAK'))
    assert.equal(store.list('session')[0].nativeSourceRefs,undefined)
    assert.equal(store.get('session','capture').nativeSourceRefs[0].name,'Authored Main')
  } finally {rmSync(directory,{recursive:true,force:true})}
})

test('legacy current labels preserve recorded bodies and prefer recorded names',()=>{
  const f=fixture(), original=structuredClone(f.record), request={messages:f.messages}
  const resolveSourceName=s=>s.resourceId==='preset-id'&&s.field==='main'?'Readable current name':null
  const current=nativeRequestProvenance(f.record,request,{resolveSourceName}).nodes.find(n=>n.source.field==='main')
  assert.equal(current.name,'Readable current name');assert.equal(current.sourceStatus,'current-name')
  assert.equal(current.nameRecorded,false);assert.equal(current.text,'😀CARD')
  assert.deepEqual(f.record,original);assert.deepEqual(request.messages,f.messages)
  f.record.nativeSourceRefs=captureNativeSourceReferences(f.record,{messages:f.messages,nodes:f.nodes},f.messages)
  const recorded=nativeRequestProvenance(f.record,request,{resolveSourceName}).nodes.find(n=>n.source.field==='main')
  assert.equal(recorded.name,'Authored Main');assert.equal(recorded.sourceStatus,'recorded')
  f.record.nativeSourceRefs=[]
  assert.equal(nativeRequestProvenance(f.record,request,{resolveSourceName:()=>{throw new Error('deleted')}}).nodes.find(n=>n.source.field==='main').sourceStatus,'name-unrecorded')
})
