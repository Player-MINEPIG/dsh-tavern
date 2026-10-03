import test from 'node:test'
import assert from 'node:assert/strict'
import {IdentityActionProposal} from '../packages/client/src/play/identity-action-view.js'
import {createIdentityActionBridge,prepareIdentityAction} from '../packages/client/src/play/identity-action-bridge.js'
import {normalizeVariables} from '../packages/mvu-adapter/src/updates.js'
import {compileMvuSchema} from '../packages/mvu-adapter/src/schema.js'

const clone=structuredClone,tick=()=>new Promise(resolve=>setImmediate(resolve))
const model={choices:[{id:'default',label:'Default',trigger:''},{id:'alisa_party',label:'Party',trigger:'party'}],perks:[{id:'authored-perk',label:'Authored perk',key:'value',value:20}],initialRoles:['fixture-role'],apply(root,identity){root=clone(root);root.systemYear=2024;if(identity['互斥开场ID']==='alisa_party')root['角色'].party={state:100};return root},message:identity=>'Opening '+identity['姓名']+' '+identity['互斥开场ID']}
function data({schema,perk=false}={}){
 const identity={'模板ID':'custom','难度':'自定义','姓名':'Authored','年龄':'20','班级':'Fixture','个人信息':'Authored description','照片':'','来源':'首楼学生证','已选择':true,'互斥开场':'Default','互斥开场ID':'default','互斥开场触发码':'',...(perk?{'开场选项':'Authored perk','开场选项说明':'已由首楼前端直接写入变量，AI不得二次发放或回退。'}:{})}
 const variables=normalizeVariables({stat_data:{'系统':{'_user身份':{...identity,'姓名':'Before'},value:perk?20:10},'角色':{'fixture-role':{state:1}}},schema:{type:'any'},...(schema?{mvu_schema:schema}:{})})
 const root=clone(variables.stat_data);root['系统']['_user身份']=identity
 return {packet:{version:1,operation:'replace',value:{...clone(variables),stat_data:model.apply(root,identity)},openingId:'default',perkIds:perk?['authored-perk']:[],prompt:model.message(identity),observedRevision:7},snapshot:{status:'available',resourceId:'mvu:review',scope:{mode:'initial',sessionId:'authored-view'},currentRevision:7,revision:1,variables}}
}
const buttons=node=>Array.isArray(node)?node.flatMap(buttons):node&&typeof node==='object'?[...(node.type==='button'?[node]:[]),...buttons(node.props?.children)]:[]
async function fixture(t,{lost=false}={}){
 const f=data(),writes=[];let proposal,attempt=0
 const bridge=createIdentityActionBridge({model,prepareBinding:async()=>({binding:{getSnapshot:()=>clone(f.snapshot),writeOperation:async request=>{writes.push(request);if(lost&&++attempt===1)throw Error('response lost');return {operationId:request.operationId,result:{...f.snapshot,revision:8,currentRevision:8,variables:prepareIdentityAction(f.packet,f.snapshot,model).normalized}}}},isCurrent:()=>true}),deliverMessage:async()=>{},onState:value=>{proposal=value}})
 t.after(()=>bridge.dispose());const token=bridge.beginOpening('default');bridge.completeOpening(token,{ok:true,method:'empty-selection'});const answer=bridge.request(f.packet);answer.catch(()=>{});await tick()
 const click=event=>buttons(IdentityActionProposal({proposal,bridge,onError:()=>{}}))[0].props.onClick(event)
 return {bridge,writes,answer,click,get proposal(){return proposal}}
}
const native=timeStamp=>({isTrusted:true,timeStamp,nativeEvent:{isTrusted:true,timeStamp}})
test('production view forwards the original native timestamp; stale, missing, future and synthetic events submit zero writes',async t=>{
 for(const event of [native(performance.now()-2000),native(performance.timeOrigin+performance.now()-2000),native(performance.now()+2000),native(undefined),native(NaN),native(Infinity),native('100'),{isTrusted:true,timeStamp:performance.now()}, {...native(performance.now()),isTrusted:false},{...native(performance.now()),nativeEvent:{isTrusted:false,timeStamp:performance.now()}}]){
  const f=await fixture(t);f.click(event);await tick();assert.equal(f.writes.length,0);assert.equal(f.proposal.state,'prepared');f.bridge.dispose()
 }
 for(const epoch of [false,true]){
  const f=await fixture(t);f.click(native((epoch?performance.timeOrigin:0)+performance.now()));await tick();assert.equal(f.writes.length,1);assert.equal((await f.answer).revision,8)
 }
})
test('unknown operation retry uses the new actual native timestamp without renewing an old event',async t=>{
 const f=await fixture(t,{lost:true});f.click(native(performance.now()));await tick();assert.equal(f.proposal.state,'unknown');assert.equal(f.writes.length,1)
 f.click(native(performance.now()-2000));await tick();assert.equal(f.writes.length,1);assert.equal(f.proposal.state,'unknown')
 f.click(native(performance.now()));await tick();assert.equal(f.writes.length,2);assert.equal(f.writes[0].operationId,f.writes[1].operationId);assert.equal((await f.answer).revision,8)
})
test('schema cannot change the completed opening or frozen identity controls; ordinary name transforms remain single-pass',()=>{
 const schemas=[
  '"互斥开场ID":z.string().transform(v=>"alisa_party"),"互斥开场":z.string().transform(v=>"Party"),"互斥开场触发码":z.string().transform(v=>"party")',
  '"模板ID":z.string().transform(v=>"easy"),"难度":z.string().transform(v=>"简单")',
  '"来源":z.string().transform(v=>"Other")',
  '"已选择":z.boolean().transform(v=>false)',
  '"开场选项":z.string().default("Authored perk"),"开场选项说明":z.string().default("Other")',
 ]
 for(const fields of schemas){const schema=compileMvuSchema('const Schema=z.object({"系统":z.object({"_user身份":z.object({'+fields+'}).passthrough()}).passthrough()}).passthrough();'),f=data({schema});assert.throws(()=>prepareIdentityAction(f.packet,f.snapshot,model),/schema changed selection controls/)}
 const schema=compileMvuSchema('const Schema=z.object({"系统":z.object({"value":z.number().transform(v=>0),"_user身份":z.object({}).passthrough()}).passthrough()}).passthrough();'),f=data({schema,perk:true});assert.throws(()=>prepareIdentityAction(f.packet,f.snapshot,model),/schema changed selection controls/)
 const nameSchema=compileMvuSchema('const Schema=z.object({"系统":z.object({"_user身份":z.object({"姓名":z.string().transform(v=>v+"!")}).passthrough()}).passthrough()}).passthrough();'),positive=data({schema:nameSchema}),intent=prepareIdentityAction(positive.packet,positive.snapshot,model)
 assert.equal(intent.value.stat_data['系统']['_user身份']['姓名'],'Authored');assert.equal(intent.identity['姓名'],'Authored!');assert.equal(intent.message,'Opening Authored! default')
})
