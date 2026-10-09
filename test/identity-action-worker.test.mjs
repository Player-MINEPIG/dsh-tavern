import test from 'node:test'
import assert from 'node:assert/strict'
import {createClientProbe,inputFor} from '../scripts/fixtures/card-worker-probe.mjs'
import {readFile} from 'node:fs/promises'
import {adaptIdentityHtml,identityLoaderBootstrap,IDENTITY_HTML_LOADER} from '../packages/client/src/play/html-loader-adapters.js'
import {createFixedIdentityActionModel} from '../packages/client/src/play/identity-action-model.js'
import {prepareIdentityAction} from '../packages/client/src/play/identity-action-bridge.js'
import {normalizeVariables} from '../packages/mvu-adapter/src/updates.js'

const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms))
async function until(check){const end=Date.now()+10000;while(!check()){if(Date.now()>end)throw Error('Identity Worker fixture timed out');await pause(10)}}
const variables={version:1,status:'available',resourceId:'mvu:authored',scope:{mode:'initial',sessionId:'authored'},revision:2,currentRevision:7,variables:{stat_data:{value:1},schema:{type:'any'}}}

test('packaged identity receipt, shared outer Promise and timer observers never obtain a native write task',async t=>{
 const writes=[],actions=[];let reply
 const probe=createClientProbe({onIdentityAction:async(payload,{signal})=>{assert.equal(signal.aborted,false);actions.push(payload);await new Promise(resolve=>{reply=resolve});return {ok:true,operationId:'parent-owned',revision:8,proposalReady:true}},onWrite:async input=>{writes.push(input);return variables}});t.after(()=>probe.close())
 const code=`let release;const outer=new Promise(resolve=>release=resolve);const write=name=>Mvu.replaceMvuData({stat_data:{name}}).catch(()=>{});
 outer.then(()=>write('outer'));
 document.getElementById('b').addEventListener('click',async()=>{
  setTimeout(()=>write('timer-during'),20);
  const result=await __identityAction({version:1,operation:'replace',value:{stat_data:{name:'candidate'}},openingId:'default',perkIds:[],prompt:'Authored'});
  release();await write('identity-continuation');setTimeout(()=>write('timer-after'),20);
  document.getElementById('o').textContent=String(result.ok);
 });`
 const runtime=probe.start(inputFor(code,{identityAction:true,variables}));await probe.ready
 const target=Number(probe.views.at(-1).html.match(/<button[^>]*data-dtv-node="(\d+)"/)[1]);runtime.dispatch({type:'click',target},{trusted:true})
 await until(()=>actions.length===1&&writes.some(item=>item.value.stat_data.name==='timer-during'));assert.equal(actions[0].observedRevision,7);assert.equal(Object.hasOwn(actions[0],'cause'),false);assert.equal(Object.hasOwn(actions[0],'taskId'),false)
 reply();await until(()=>writes.length===4&&probe.views.at(-1).html.includes('>true<'))
 assert.deepEqual(writes.map(item=>[item.value.stat_data.name,item.cause]).sort(),[['identity-continuation','script'],['outer','script'],['timer-after','script'],['timer-during','script']]);assert.equal(probe.errors.length,0)
})
test('no currentRevision or a guest-forged observed counter produces no parent identity action',async t=>{
 for(const extra of [{variables:{...variables,currentRevision:undefined},payload:'{}'},{variables,payload:'{observedRevision:7}'}]){
  let calls=0;const probe=createClientProbe({onIdentityAction:()=>{calls++;return {ok:true}}});t.after(()=>probe.close())
  probe.start(inputFor(`__identityAction(${extra.payload}).catch(()=>document.getElementById('o').textContent='rejected')`,{identityAction:true,variables:extra.variables}));await probe.ready;await until(()=>probe.views.at(-1).html.includes('>rejected<'));assert.equal(calls,0);assert.equal(probe.errors.length,0)
 }
})
test('disposing a pending ordinary action aborts its trusted callback and suppresses late receipt',async t=>{
 let signal,release,called=false;const probe=createClientProbe({onIdentityAction:(_payload,options)=>{called=true;signal=options.signal;return new Promise(resolve=>{release=resolve})}});t.after(()=>probe.close())
 const runtime=probe.start(inputFor(`__identityAction({}).then(()=>document.getElementById('o').textContent='late')`,{identityAction:true,variables}));await probe.ready;await until(()=>called);const count=probe.views.length;runtime.dispose();assert.equal(signal.aborted,true);release({ok:true});await pause(30);assert.equal(probe.views.length,count);assert.equal(probe.errors.length,0)
})
test('the complete pinned public identity adapter produces a validated full candidate without a duplicate guest write',{skip:!process.env.FIXED_IDENTITY_HTML},async t=>{
 const original=await readFile(process.env.FIXED_IDENTITY_HTML,'utf8'),model=createFixedIdentityActionModel(original),adapted=adaptIdentityHtml(original,IDENTITY_HTML_LOADER),scripts=[...adapted.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(match=>match[1]),html=adapted.replace(/<script(?:\s[^>]*)?>[\s\S]*?<\/script>/gi,'').replace(/<!doctype[^>]*>|<meta\b[^>]*>/gi,'')
 const snapshot={...variables,scope:{mode:'initial',sessionId:'authored-public-adapter'},variables:normalizeVariables({stat_data:{'系统':{'持有零花钱':6000,'星光点':0,'MC能量上限':25},'角色':Object.fromEntries(model.initialRoles.map(name=>[name,{}]))},schema:{type:'any'}})},actions=[],writes=[]
 const probe=createClientProbe({onMeasure:async()=>({rect:{x:0,y:0,width:480,height:800,top:0,left:0,right:480,bottom:800},computed:{},scrollHeight:800,scrollWidth:480,offsetHeight:800,offsetWidth:480,clientHeight:800,clientWidth:480,offsetTop:0,offsetLeft:0}),onOpening:async()=>({ok:true,method:'empty-selection',skipped:true}),onIdentityAction:async packet=>{actions.push(prepareIdentityAction(packet,snapshot,model));return {ok:true,operationId:'authored-parent-receipt',revision:8,proposalReady:false}},onWrite:async request=>{writes.push(request);throw Error('Unexpected duplicate write')}});t.after(()=>probe.close())
 const runtime=probe.start(inputFor('',{html,runs:[{name:'identity-bootstrap.js',code:identityLoaderBootstrap(IDENTITY_HTML_LOADER)},...scripts.map(code=>({name:'identity-fixed.js',code}))],identityOpening:true,identityAction:true,variables:snapshot,context:{userName:'Authored user'}}));await until(()=>probe.messages.some(message=>message.kind==='ready')||probe.errors.length);assert.deepEqual(probe.errors,[])
 const tag=probe.views.at(-1).html.match(/<button\b[^>]*\bid="identitySelect"[^>]*>/)?.[0],match=tag?.match(/data-dtv-node="(\d+)"/);assert.ok(match);runtime.dispatch({type:'click',target:Number(match[1])},{trusted:true});await until(()=>actions.length===1||probe.errors.length)
 assert.deepEqual(probe.errors,[]);assert.equal(actions.length,1);assert.equal(actions[0].openingId,'default');assert.equal(actions[0].expectedRevision,7);assert.equal(writes.length,0);assert.equal(actions[0].value.stat_data['系统']['当前年份'],2024)
})
