import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {SessionSelectionStore} from '../packages/tavern-loader/src/session-policy.js'
import {installMvu} from '../packages/mvu-adapter/src/host.js'
import {createMvuCardBinding} from '../packages/client/src/play/mvu-bridge.js'
import {createIdentityActionBridge,prepareIdentityAction} from '../packages/client/src/play/identity-action-bridge.js'

test('actual card-write service applies a non-idempotent builder dependency exactly once and preserves its receipt',async t=>{
 const storageDir=mkdtempSync(join(tmpdir(),'identity-action-service-'));t.after(()=>rmSync(storageDir,{recursive:true,force:true}))
 const scope={mode:'initial',playthroughId:'authored-play',sessionId:'authored-session',characterId:'authored-card',sessionFormatVersion:4},selection=new SessionSelectionStore(storageDir);selection.set(scope.sessionId,{characterCardId:scope.characterId})
 const session={id:scope.sessionId,header:{id:scope.sessionId,version:4,createdAt:'authored-fixed'},snapshotEvents:()=>[]},playthrough={id:scope.playthroughId,ext:{pmpDshTavern:{rootSessionId:scope.sessionId,characterId:scope.characterId}}},services=new Map([['sessions',new Map([[scope.sessionId,session]])],['tavernRenderingAuthority',{resolve:async()=>({valid:true,write:true,scope}),isCurrent:()=>true}]])
 const ctx={get:name=>services.get(name),provide:(name,value)=>services.set(name,value),on(){},effect:fn=>fn()}
 const service=installMvu(ctx,{storageDir,sources:{register:()=>()=>{}},resources:[{sharing:'shared',id:'mvu:authored-identity',characterId:scope.characterId,sessionIds:[scope.sessionId],managementMode:'native',initial:{schema:{type:'any'},stat_data:{'系统':{'_user身份':{'姓名':'Before'}},'角色':{'authored-role':{state:1}}}},schemaSource:'const Schema=z.object({"系统":z.object({"_user身份":z.object({"姓名":z.string().transform(v=>v+"!")}).passthrough()}).passthrough()}).passthrough();'}],memberships:{captureLease:()=>()=>true,readCatalog:()=>({catalog:{playthroughs:[playthrough]}}),readTimeline:()=>({timeline:{nodes:[],head:null}})},getSelection:id=>selection.get(id),getSelectionToken:id=>selection.selectionRevision(id),isActive:resource=>resource.characterId===selection.get(scope.sessionId).characterCardId})
 t.after(()=>service.dispose());const facts=[];service.observe(fact=>facts.push(fact));service.registerUsage(request=>({enabled:request.event.cause==='user-interaction',checkCurrent:()=>true,configRevision:1}))
 const sourceIdentity={version:1,sha256:'a'.repeat(64),scope},posts=[]
 const binding=await createMvuCardBinding({scope,writeGrant:{grantId:'authored-grant',sourceIdentity},client:{getMvuSnapshot:bound=>service.snapshot(bound),postMvuOperation:(path,body,options)=>{posts.push(path);if(path==='card-binding')return service.createCardBinding({...body,sourceIdentity});if(path==='card-binding/revoke'){service.revokeCardBinding(body.capability);return {ok:true}}return service.cardWrite({...body,signal:options.signal})}}});t.after(()=>binding.dispose())
 const model={initialRoles:['authored-role'],choices:[{id:'default',label:'Authored default',trigger:''}],perks:[],apply:root=>root,message:identity=>'Unsent '+identity['姓名']}
 const identity={'模板ID':'custom','难度':'自定义','姓名':'Authored','年龄':'20','班级':'Fixture','个人信息':'Authored info','照片':'','来源':'首楼学生证','已选择':true,'互斥开场':'Authored default','互斥开场ID':'default','互斥开场触发码':''},snapshot=binding.getSnapshot(),value=structuredClone(snapshot.variables);value.stat_data['系统']['_user身份']=identity
 const packet={version:1,operation:'replace',openingId:'default',perkIds:[],value,prompt:model.message(identity),observedRevision:snapshot.currentRevision},intent=prepareIdentityAction(packet,snapshot,model)
 assert.equal(intent.value.stat_data['系统']['_user身份']['姓名'],'Authored');assert.equal(intent.normalized.stat_data['系统']['_user身份']['姓名'],'Authored!')
 let state,delivered;const bridge=createIdentityActionBridge({model,prepareBinding:async()=>({binding,isCurrent:()=>true,messageLease:{}}),onState:value=>{state=value},deliverMessage:message=>{delivered=message}});t.after(()=>bridge.dispose())
 const token=bridge.beginOpening('default');bridge.completeOpening(token,{ok:true,method:'empty-selection'});const response=bridge.request(packet);await new Promise(resolve=>setImmediate(resolve));assert.equal(state.state,'prepared')
 await bridge.confirm(state.proposalId,{trusted:true,at:performance.now()});const receipt=await response
 assert.equal(receipt.proposalReady,true);assert.equal(receipt.revision,snapshot.currentRevision+1);assert.equal(delivered,'Unsent Authored!');assert.equal(posts.filter(path=>path==='card-write').length,1);assert.equal((await service.snapshot(scope)).variables.stat_data['系统']['_user身份']['姓名'],'Authored!');assert.equal(facts.filter(fact=>fact.phase==='applied').length,1)
})
