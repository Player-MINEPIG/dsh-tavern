import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {parse} from 'acorn'
import {runInNewContext} from 'node:vm'
import {createFixedIdentityActionModel} from '../packages/client/src/play/identity-action-model.js'
import {prepareIdentityAction,createIdentityActionBridge} from '../packages/client/src/play/identity-action-bridge.js'
import {normalizeVariables} from '../packages/mvu-adapter/src/updates.js'
import {compileMvuSchema} from '../packages/mvu-adapter/src/schema.js'

const clone=structuredClone,scope={mode:'initial',sessionId:'authored-session',playthroughId:'authored-play',characterId:'authored-card'}
const model={choices:[{id:'default',label:'Default',trigger:''},{id:'alisa_party',label:'Party',trigger:'party'}],perks:[],initialRoles:['fixture-role'],apply(root,identity){root=clone(root);root['系统'].year=2024;if(identity['互斥开场ID']==='alisa_party')root['角色'].party={state:100};return root},message:identity=>'Opening '+identity['姓名']+' '+identity['互斥开场ID']}
function data({opening='default',revision=7,schema}={}){
 const choice=model.choices.find(item=>item.id===opening),identity={'模板ID':'custom','难度':'自定义','姓名':'Authored','年龄':'20','班级':'Fixture','个人信息':'Fixture description','照片':'','来源':'首楼学生证','已选择':true,'互斥开场':choice.label,'互斥开场ID':opening,'互斥开场触发码':choice.trigger}
 const variables=normalizeVariables({stat_data:{'系统':{'_user身份':{...identity,'姓名':'Before'},value:10},'角色':{'fixture-role':{state:1}}},schema:{type:'any'},...(schema?{mvu_schema:schema}:{})})
 const root=clone(variables.stat_data);root['系统']['_user身份']=identity
 const packet={version:1,operation:'replace',value:{...clone(variables),stat_data:model.apply(root,identity)},openingId:opening,perkIds:[],prompt:model.message(identity),observedRevision:revision}
 const snapshot={version:1,status:'available',resourceId:'mvu:fixture',scope,revision:1,currentRevision:revision,variables}
 return {packet,snapshot}
}
const defer=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no});return {promise,resolve,reject}}
const tick=()=>new Promise(resolve=>setImmediate(resolve))
async function fixture(t,{write,deliver,prepare,schema}={}){
 const f=data({schema});let state,valid=true,now=100,version=0;const writes=[],messages=[]
 const binding={getSnapshot:()=>clone(f.snapshot),writeOperation:async request=>{writes.push(clone({...request,signal:undefined}));if(write)return write(request,f);const intent=prepareIdentityAction(f.packet,f.snapshot,model),result={...clone(f.snapshot),revision:8,currentRevision:8,variables:clone(intent.normalized)};f.snapshot=result;return {operationId:request.operationId,result}}}
 const authorization={binding,isCurrent:()=>valid,messageLease:{version}}
 const bridge=createIdentityActionBridge({model,prepareBinding:prepare??(async()=>authorization),clock:()=>now,wall:()=>1000,uuid:(()=>{let id=0;return ()=>'authored-'+ ++id})(),onState:value=>{state=value},deliverMessage:async(message,lease)=>{if(lease.version!==version)throw Error('newer proposal');if(deliver)return deliver(message);messages.push(message)}})
 t.after(()=>bridge.dispose())
 const token=bridge.beginOpening('default');assert.equal(bridge.completeOpening(token,{ok:true,method:'empty-selection'}),true)
 const answer=bridge.request(f.packet);answer.catch(()=>{});await tick()
 return {...f,bridge,binding,writes,messages,answer,get state(){return state},leave:()=>{valid=false},advance:ms=>{now+=ms},newProposal:()=>{version++},authorization}
}

test('complete fixed shape, currentRevision only, immutable raw input and effective schema preview',()=>{
 for(const opening of ['default','alisa_party']){
  const f=data({opening}),intent=prepareIdentityAction(f.packet,f.snapshot,model)
  assert.equal(intent.expectedRevision,7);assert.ok(Object.isFrozen(intent.value.stat_data));assert.equal(intent.normalized.stat_data['系统'].year,2024)
  assert.equal(!!intent.value.stat_data['角色'].party,opening==='alisa_party')
  const changed=clone(f.packet);changed.value.stat_data['角色']['fixture-role'].state=999;assert.throws(()=>prepareIdentityAction(changed,f.snapshot,model),/fixed transformation/)
  changed.value=clone(f.packet.value);changed.value.schema={type:'number'};assert.deepEqual(prepareIdentityAction(changed,f.snapshot,model).value.schema,f.snapshot.variables.schema)
  for(const currentRevision of [undefined,-1,1.2,NaN])assert.throws(()=>prepareIdentityAction(f.packet,{...f.snapshot,currentRevision},model),/current revision/)
  assert.throws(()=>prepareIdentityAction({...f.packet,observedRevision:1},f.snapshot,model),/current revision/)
 }
})
test('getter, thenable, prototype pollution and combined UTF-8 packet limits fail before retaining a proposal',()=>{
 const f=data();let getterCalls=0;Object.defineProperty(f.packet,'prompt',{get(){getterCalls++;return 'x'},enumerable:true});assert.throws(()=>prepareIdentityAction(f.packet,f.snapshot,model),/accessors/);assert.equal(getterCalls,0)
 for(const mutate of [packet=>{packet.value.then=()=>{}},packet=>{Object.setPrototypeOf(packet.value,{inherited:true})},packet=>{packet.value.extra=JSON.parse('{"__proto__":1}')},packet=>{packet.prompt='汉'.repeat(50000)}]){const next=data();mutate(next.packet);assert.throws(()=>prepareIdentityAction(next.packet,next.snapshot,model))}
})
test('schema changes a builder dependency once; preview message uses effective identity, submit keeps raw input',()=>{
 const schema=compileMvuSchema('const Schema=z.object({"系统":z.object({"_user身份":z.object({"姓名":z.string().transform(v=>v+"!")}).passthrough()}).passthrough()}).passthrough();')
 const f=data({schema}),intent=prepareIdentityAction(f.packet,f.snapshot,model)
 assert.equal(intent.value.stat_data['系统']['_user身份']['姓名'],'Authored');assert.equal(intent.normalized.stat_data['系统']['_user身份']['姓名'],'Authored!');assert.equal(intent.message,'Opening Authored! default')
 const twice={...f.packet,value:clone(intent.normalized),prompt:intent.message};assert.throws(()=>prepareIdentityAction(twice,f.snapshot,model),/fixed transformation/)
})
test('duplicate confirmation consumes the ticket synchronously and returns one exact receipt',async t=>{
 const gate=defer(),f=await fixture(t,{write:async(request,ctx)=>{await gate.promise;const intent=prepareIdentityAction(ctx.packet,ctx.snapshot,model);return {operationId:request.operationId,result:{...ctx.snapshot,revision:8,currentRevision:8,variables:intent.normalized}}}})
 const id=f.state.proposalId,first=f.bridge.confirm(id,{trusted:true,at:100});await assert.rejects(f.bridge.confirm(id,{trusted:true,at:100}),/native confirmation/);assert.equal(f.writes.length,1)
 gate.resolve();await first;assert.equal((await f.answer).revision,8);assert.equal(f.messages.length,1);assert.equal(f.state.state,'committed');assert.equal(f.state.messagePresented,true)
 await assert.rejects(f.bridge.request(f.packet),/current completed opening/)
})
test('late native dispatch, revoked grant/scope and changed resource counter reject without a write',async t=>{
 for(const action of ['delay','revoke','counter']){
  const f=await fixture(t);if(action==='delay')f.advance(1500);if(action==='revoke')f.leave();if(action==='counter')f.snapshot.currentRevision=8
  await f.bridge.confirm(f.state.proposalId,{trusted:true,at:100});await assert.rejects(f.answer);assert.equal(f.writes.length,0)
 }
})
test('wrong/newer opening completion and selection edits invalidate the prepared intent',async t=>{
 const f=await fixture(t);f.bridge.invalidate('edited');await assert.rejects(f.answer,/edited/);assert.equal(f.writes.length,0)
 const old=f.bridge.beginOpening('default'),next=f.bridge.beginOpening('alisa_party');assert.equal(f.bridge.completeOpening(old,{ok:true,method:'empty-selection'}),false)
 f.bridge.failOpening(old,'old request failed')
 assert.equal(f.bridge.completeOpening(next,{ok:true,method:'empty-selection'}),true);await assert.rejects(f.bridge.request(f.packet),/current completed opening/)
})
test('late operation receipt after scope revocation remains old evidence and cannot present or retry a message',async t=>{
 const gate=defer(),f=await fixture(t,{write:async(request,ctx)=>{await gate.promise;const intent=prepareIdentityAction(ctx.packet,ctx.snapshot,model);return {operationId:request.operationId,result:{...ctx.snapshot,revision:8,currentRevision:8,variables:intent.normalized}}}})
 const id=f.state.proposalId,first=f.bridge.confirm(id,{trusted:true,at:100});f.leave();gate.resolve();await first;await assert.rejects(f.answer,/cancelled/);assert.equal(f.state.state,'committed');assert.equal(f.state.revision,8);assert.equal(f.messages.length,0);await assert.rejects(f.bridge.retryMessage(id,{trusted:true}),/current committed identity/);assert.equal(f.writes.length,1)
})
test('cancel before admission is zero writes; lost accepted response retries only the identical operation',async t=>{
 const before=await fixture(t);before.bridge.cancel(before.state.proposalId);await assert.rejects(before.answer,/cancelled/);assert.equal(before.writes.length,0)
 let attempts=0,receipt
 const gate=defer(),f=await fixture(t,{write:async(request,ctx)=>{if(++attempts===1){const intent=prepareIdentityAction(ctx.packet,ctx.snapshot,model);receipt={operationId:request.operationId,result:{...ctx.snapshot,revision:8,currentRevision:8,variables:intent.normalized}};ctx.snapshot.currentRevision=8;await gate.promise;throw Error('response lost after save')}return receipt}})
 const id=f.state.proposalId,first=f.bridge.confirm(id,{trusted:true,at:100});f.bridge.cancel(id);await assert.rejects(f.bridge.retryOperation(id,{trusted:true,at:100}),/cannot be retried/);gate.resolve();await first;await assert.rejects(f.answer);assert.equal(f.state.state,'unknown');assert.equal(f.messages.length,0)
 await f.bridge.retryOperation(id,{trusted:true,at:100});assert.equal(f.writes.length,2);assert.deepEqual(f.writes[0],f.writes[1]);assert.equal(f.state.state,'committed');assert.equal(f.messages.length,1)
})
test('known receipt after cancellation remains committed, without late message presentation',async t=>{
 const gate=defer(),f=await fixture(t,{write:async(request,ctx)=>{await gate.promise;const intent=prepareIdentityAction(ctx.packet,ctx.snapshot,model);throw Object.assign(Error('aborted after save'),{operationReceipt:{operationId:request.operationId,result:{...ctx.snapshot,revision:8,currentRevision:8,variables:intent.normalized}}})}})
 const first=f.bridge.confirm(f.state.proposalId,{trusted:true,at:100});f.bridge.cancel(f.state.proposalId);gate.resolve();await first;await assert.rejects(f.answer);assert.equal(f.state.state,'committed');assert.equal(f.state.revision,8);assert.equal(f.messages.length,0)
})
test('known commit with message failure retries presentation only, preserving a newer proposal',async t=>{
 let failing=true;const f=await fixture(t,{deliver:()=>{if(failing)throw Error('presentation failed')}})
 const id=f.state.proposalId;await f.bridge.confirm(id,{trusted:true,at:100});assert.equal((await f.answer).proposalReady,false);assert.equal(f.writes.length,1)
 failing=false;await f.bridge.retryMessage(id,{trusted:true});assert.equal(f.writes.length,1);assert.equal(f.state.messagePresented,true)
 const newer=await fixture(t,{deliver:()=>{throw Error('presentation failed')}});const newId=newer.state.proposalId;await newer.bridge.confirm(newId,{trusted:true,at:100});await newer.answer;newer.newProposal();await assert.rejects(newer.bridge.retryMessage(newId,{trusted:true}),/newer proposal/);assert.equal(newer.writes.length,1)
})
test('incoherent server result is an honest partial commit with no stale message or repeated write',async t=>{
 const f=await fixture(t,{write:async(request,ctx)=>({operationId:request.operationId,result:{...ctx.snapshot,revision:8,currentRevision:8,variables:ctx.snapshot.variables}})})
 await f.bridge.confirm(f.state.proposalId,{trusted:true,at:100});assert.equal((await f.answer).proposalReady,false);assert.equal(f.state.coherent,false);assert.equal(f.messages.length,0);await assert.rejects(f.bridge.retryMessage(f.state.proposalId,{trusted:true}));assert.equal(f.writes.length,1)
})
test('fixed public source model agrees with only its extracted pure functions for five openings', {skip:!process.env.FIXED_IDENTITY_HTML},async()=>{
 const source=await readFile(process.env.FIXED_IDENTITY_HTML,'utf8'),fixed=createFixedIdentityActionModel(source),script=[...source.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).find(code=>code.includes('function buildOpeningPrompt'))
 const functions=['defaultCrimeRecord','defaultFemaleSensitivity','openingBaselineItems','emptyProfileExtras','openingRoleSeed','openingRoleTemplates','setRoleState','setPoolRoleAppearance','applyOpeningStateToRoot','openingPromptBlock','openingSceneInstruction','buildOpeningPrompt','identityValue','openingChoiceById','isPlainObject','cloneJson'],constants=['DEFAULT_CLASS','OPENING_CHOICES','OPENING_PERKS','INITIAL_ROLE_NAMES'],segments=[]
 const walk=node=>{if(!node||typeof node!=='object')return;if(node.type==='FunctionDeclaration'&&functions.includes(node.id?.name))segments.push(script.slice(node.start,node.end));if(node.type==='VariableDeclarator'&&constants.includes(node.id?.name))segments.push('const '+script.slice(node.start,node.end)+';');for(const value of Object.values(node))if(Array.isArray(value))value.forEach(walk);else if(value&&typeof value==='object')walk(value)};walk(parse(script,{ecmaVersion:'latest'}))
 for(const choice of fixed.choices){const identity={...data().packet.value.stat_data['系统']['_user身份'],'互斥开场ID':choice.id,'互斥开场':choice.label,'互斥开场触发码':choice.trigger},root={'系统':{fixture:1},'角色':Object.fromEntries(fixed.initialRoles.map(name=>[name,{fixture:true}]))};const actual=runInNewContext(segments.join('\n')+'\napplyOpeningStateToRoot(root,identity);JSON.stringify({root,message:buildOpeningPrompt(identity)})',{root:clone(root),identity:clone(identity)},{timeout:1000});assert.deepEqual({root:fixed.apply(root,identity),message:fixed.message(identity)},JSON.parse(actual));const baseline=normalizeVariables({stat_data:root,schema:{type:'any'}}),candidate=clone(baseline);candidate.stat_data['系统']['_user身份']=clone(identity);candidate.stat_data=fixed.apply(candidate.stat_data,identity);assert.equal(prepareIdentityAction({version:1,operation:'replace',value:candidate,openingId:choice.id,perkIds:[],prompt:fixed.message(identity),observedRevision:0},{status:'available',scope,resourceId:'mvu:public-proof',revision:0,currentRevision:0,variables:baseline},fixed).openingId,choice.id)}
 assert.throws(()=>createFixedIdentityActionModel(source+'changed'),/source changed/)
})
