import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,rmSync} from 'node:fs'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {createMemorySources} from '../packages/memory-sources/index.js'
import {WorldBookStore} from '../packages/world-book-library/src/store.js'
import {hash} from '../packages/memory-sources/policy.js'

test('source policy skip carries the evaluated identity/reason and emits only for its matching actual request',async t=>{
 const storageDir=mkdtempSync(join(tmpdir(),'worldbook-skip-'));t.after(()=>rmSync(storageDir,{recursive:true,force:true}))
 const store=new WorldBookStore(storageDir),doc=store.import({entries:{0:{uid:0,constant:true,content:'CANDIDATE_ONLY'}}})
 const service=createMemorySources({storageDir,store});t.after(()=>service.dispose())
 const id='world-book:'+doc.id,original=service.worldBooks.read({id})
 service.worldBooks.setManagementMode({id,mode:'managed',expectedRevision:original.revision,operationId:'explicit-fixture-management'})
 service.worldBooks.registerUsage(()=>({enabled:false,reason:'config-unavailable'}),{providerId:'dsh-memory-manager'})
 const revision=service.worldBooks.read({id}).revision
 const output=await service.worldBooks.filter({sessionId:'s',assets:{worldBookRevisions:{[doc.id]:hash(doc)}}},{blocks:[{id:'entry',text:'CANDIDATE_ONLY',source:{resourceId:doc.id}}]})
 assert.deepEqual(output.blocks,[])
 assert.deepEqual(output.diagnostics,[{code:'WORLD_BOOK_POLICY_SKIPPED',adapterId:'tavern.world-books',sourceId:'worldbook',resourceId:id,revision,managementMode:'managed',configRevision:null,reason:'config-unavailable'}])
 const facts=[];service.worldBooks.observe(fact=>facts.push(fact))
 const messages=[{role:'user',content:[{type:'text',text:'HELLO'}]}],assembly={nodes:[],diagnostics:output.diagnostics}
 const event={type:'request/assembly',seq:6,data:{turn:1,step:0,messages,metadata:{owner:'pmp-dsh-tavern',assembly}}}
 const session={id:'s',snapshotEvents:()=>[event]},request={sessionId:'s',messages}
 service.observeRequest(request,undefined);service.observeRequest(request,{snapshotEvents:()=>[event]})
 service.observeRequest({...request,sessionId:'another'},session);service.observeRequest({...request,messages:[]},session)
 assembly.preview=true;service.observeRequest(request,session);delete assembly.preview
 event.data.metadata.owner='another';service.observeRequest(request,session);event.data.metadata.owner='pmp-dsh-tavern'
 const current=assembly.diagnostics;assembly.diagnostics=[{code:'WORLD_BOOK_POLICY_SKIPPED',resourceId:id}];service.observeRequest(request,session);assembly.diagnostics=current
 assert.equal(facts.length,0)
 service.observeRequest(request,session)
 assert.equal(facts.length,1);assert.equal(facts[0].phase,'skipped');assert.equal(facts[0].reason,'config-unavailable');assert.equal(facts[0].id,id);assert.equal(facts[0].revision,revision);assert.equal(facts[0].requestId,'s:6');assert.equal(facts[0].turn,1)
 assert.equal(service.worldBooks.read({id}).managementMode,'managed')
 assert.equal(service.worldBooks.read({id}).revision,revision)
})


test('draft defaults bind only selected books and expire with draft, selection and source',async t=>{
 const storageDir=mkdtempSync(join(tmpdir(),'worldbook-draft-'));t.after(()=>rmSync(storageDir,{recursive:true,force:true}))
 const store=new WorldBookStore(storageDir),book=store.import({entries:{0:{uid:0,constant:true,content:'SELECTED'}}}),other=store.import({entries:{0:{uid:0,constant:true,content:'UNSELECTED'}}})
 let active=true,selected={worldBookIds:[book.id],characterId:'character',presetId:'preset',userId:null}
 const service=createMemorySources({storageDir,store,getSelection:()=>selected,getPreviewLease:()=>active?{checkCurrent:()=>active}:null});t.after(()=>service.dispose())
 const source=service.worldBooks,id='world-book:'+book.id
 assert.equal(source.getManagementDefaults({id:'world-book:'+other.id}),null)
 const first=source.getManagementDefaults({id});assert.deepEqual(first.previewScope,{characterId:'character',presetId:'preset'});assert.equal(first.checkCurrent(),true)
 selected={...selected,presetId:'changed'};assert.equal(first.checkCurrent(),false)
 const second=source.getManagementDefaults({id});active=false;assert.equal(second.checkCurrent(),false)
 assert.equal(source.getManagementDefaults({id}).previewScope,undefined,'library inspection must not grant preview scope')
 active=true;const third=source.getManagementDefaults({id});service.dispose();assert.equal(third.checkCurrent(),false)
})
