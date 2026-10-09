import test from 'node:test'
import assert from 'node:assert/strict'
import {boundGreetingView,claimGreetingSelection,greetingReadView,carryGreetingSelection} from '../packages/client/src/play/bound-greeting.js'
import {createClientProbe,inputFor} from '../scripts/fixtures/card-worker-probe.mjs'

const scope={mode:'greeting',playthroughId:'p',sessionId:'s',characterId:'c'}
const greeting={selectionReceipt:{},characterId:'c',sourceText:'Authored first message',index:1,messageCount:1}
const view=(overrides={})=>boundGreetingView({scope,state:{greeting:{...greeting,selectionReceipt:{},...overrides}}})
const snapshot=(overrides={})=>({version:1,status:'available',scope,revision:1,currentRevision:3,variables:{stat_data:{hp:7}},...overrides})
async function until(check){const end=Date.now()+10000;while(!check()){if(Date.now()>end)throw Error('Bound greeting fixture timed out');await new Promise(resolve=>setTimeout(resolve,10))}}
async function probe(t,code,{boundGreeting=view(),variables=snapshot(),onWrite}={}) {
 const p=createClientProbe({onWrite,onGreetingReady:()=>claimGreetingSelection(boundGreeting?.selectionReceipt)});t.after(()=>p.close())
 const runtime=p.start(inputFor(code,{context:{boundGreeting:greetingReadView(boundGreeting)},variables}))
 await until(()=>p.messages.some(message=>message.kind==='ready')||p.errors.length)
 return {p,runtime}
}

test('source greeting projection rejects missing/mismatched/history coordinates and never changes the source',()=>{
 const state={greeting:{...greeting,selectionReceipt:{}}},before=structuredClone(state)
 assert.equal(boundGreetingView({scope:{...scope,mode:'message'},state}),null)
 assert.equal(boundGreetingView({scope:{...scope,characterId:'other'},state}),null)
 assert.equal(boundGreetingView({scope,state,disabled:true}),null)
 assert.equal(view({sourceText:undefined}),null)
 assert.equal(view({sourceText:'x'.repeat(65537)}),null)
 const first=boundGreetingView({scope,state}),second=boundGreetingView({scope,state})
 assert.equal(claimGreetingSelection(first.selectionReceipt).swiped,true)
 assert.equal(claimGreetingSelection(second.selectionReceipt),null)
 assert.deepEqual(state,before)
})

test('selected first message is actually readable and listeners fire after scripts register',async t=>{
 const code=`const result=[];const callback=e=>{const first=getChatMessages(0)[0];const ctx=SillyTavern.getContext();result.push(e.input===first.mes&&ctx.chat[0].mes===first.mes&&ctx.chat.length===1?'selected':'bad');document.getElementById('o').textContent=result.join(',')};eventOn(tavern_events.CHARACTER_FIRST_MESSAGE_SELECTED,callback);eventOn('character_first_message_selected',callback);eventOn(tavern_events.MESSAGE_SWIPED,id=>{result.push('swiped:'+id);document.getElementById('o').textContent=result.join(',')});`
 const {p}=await probe(t,code,{boundGreeting:view({selectionReceipt:{}})})
 await until(()=>p.views.at(-1).html.includes('selected,swiped:0'));assert.equal(p.errors.length,0);assert.match(p.views.at(-1).html,/>selected,swiped:0<\/output>/)
})

test('a fresh mount does not fabricate a swipe and the chat length does not pretend that history is empty',async t=>{
 const {p}=await probe(t,`let selected=0,swiped=0;document.getElementById('o').textContent='0:0:'+SillyTavern.getContext().chat.length;eventOn('character_first_message_selected',()=>{selected++;document.getElementById('o').textContent=selected+':'+swiped+':'+SillyTavern.getContext().chat.length});eventOn('message_swiped',()=>swiped++);`,{boundGreeting:view({messageCount:8,selectionReceipt:undefined})})
 assert.equal(p.errors.length,0);assert.match(p.views.at(-1).html,/>0:0:8<\/output>/)
})

test('message zero aliases only the selected greeting; latest requires it to be the sole message',async t=>{
 for(const count of [1,8]){
  const {p}=await probe(t,`const result=[];for(const id of [0,'0','latest',-1,2]){try{result.push(Mvu.getMvuData({type:'message',message_id:id}).stat_data.hp)}catch{result.push('denied')}}try{getVariables({type:'message',message_id:0});result.push('bad')}catch{result.push('strict')}try{getChatMessages('0-1');result.push('bad')}catch{result.push('bounded')}document.getElementById('o').textContent=result.join(',')`,{boundGreeting:view({messageCount:count})})
  assert.equal(p.errors.length,0);assert.match(p.views.at(-1).html,count===1?/>7,7,7,denied,denied,strict,bounded<\/output>/:/>7,7,denied,denied,denied,strict,bounded<\/output>/)
 }
})

test('guest first-message aliases never choose a different session or historical resource',async t=>{
 for(const variables of [snapshot({scope:{...scope,sessionId:'other'}}),snapshot({scope:{sessionId:'s',nodeId:'n',variantId:'v',messageId:5}}),snapshot({status:'unavailable'})]){
  const {p}=await probe(t,`let count=0;eventOn('character_first_message_selected',()=>count++);window.addEventListener('load',()=>{for(const action of [()=>getChatMessages(0),()=>SillyTavern.getContext(),()=>Mvu.getMvuData({type:'message',message_id:0})])try{action();count+=10}catch{}document.getElementById('o').textContent=String(count)});`,{variables})
  assert.equal(p.errors.length,0);assert.match(p.views.at(-1).html,/>0<\/output>/)
 }
})

test('delayed first-message writes keep script cause and the observed CAS; denial propagates',async t=>{
 const writes=[]
 const {p}=await probe(t,`eventOn('character_first_message_selected',()=>setTimeout(async()=>{try{await Mvu.replaceMvuData({stat_data:{hp:4}},{type:'message',message_id:0});document.getElementById('o').textContent='bad'}catch(e){document.getElementById('o').textContent=e.code}},0));`,{onWrite:async input=>{writes.push(input);throw Object.assign(Error('Source policy denied'),{code:'MVU_USAGE_DENIED'})}})
 await until(()=>p.views.at(-1).html.includes('MVU_USAGE_DENIED'))
 assert.equal(writes.length,1);assert.equal(writes[0].cause,'script');assert.equal(writes[0].observedRevision,3);assert.equal(writes[0].options,null);assert.equal(p.errors.length,0)
})

test('disposing the binding aborts a pending first-message write and suppresses its late reply',async t=>{
 let signal,release
 const {p,runtime}=await probe(t,`eventOn('character_first_message_selected',()=>Mvu.replaceMvuData({stat_data:{hp:4}},{type:'message',message_id:'0'}));`,{onWrite:input=>{signal=input.signal;return new Promise(resolve=>release=resolve)}})
 await until(()=>signal);const count=p.views.length;runtime.dispose();assert.equal(signal.aborted,true);release(snapshot());await new Promise(resolve=>setTimeout(resolve,30));assert.equal(p.views.length,count)
})

test('unsupported events are rejected; disposers and duplicate listeners retain real variable commit semantics',async t=>{
 const {p,runtime}=await probe(t,`let count=0;const cb=()=>count++;const stop=eventOn('message_swiped',cb);stop();eventOn('VARIABLE_UPDATE_ENDED',()=>{count++;document.getElementById('o').textContent=String(count)});let unknown=false;try{eventOn('CHAT_COMPLETION_PROMPT_READY',cb)}catch{unknown=true}document.getElementById('o').textContent=unknown?'bounded':'bad';`)
 assert.match(p.views.at(-1).html,/>bounded<\/output>/);runtime.notifyVariables(snapshot({revision:2,currentRevision:4}));await until(()=>p.views.at(-1).html.includes('>1<'));assert.equal(p.errors.length,0)
})

test('refresh and restart preserve a delivered choice, while failed startup leaves the choice undelivered',async t=>{
 const initial={...greeting,selectionReceipt:undefined},selected={...greeting,index:2}
 carryGreetingSelection(initial,selected)
 assert.ok(selected.selectionReceipt)
 const descriptor=view({index:2,selectionReceipt:selected.selectionReceipt})
 const failed=await probe(t,`throw Error('Authored startup failure')`,{boundGreeting:descriptor})
 assert.equal(failed.p.errors.length,1)
 const code=`let count=0;eventOn('character_first_message_selected',()=>{count++;document.getElementById('o').textContent=String(count)});document.getElementById('o').textContent='0';`
 const successful=await probe(t,code,{boundGreeting:descriptor});await until(()=>successful.p.views.at(-1).html.includes('>1<'))
 const refreshed={...selected};carryGreetingSelection(selected,refreshed)
 const restarted=await probe(t,code,{boundGreeting:view({index:2,selectionReceipt:refreshed.selectionReceipt})})
 assert.match(restarted.p.views.at(-1).html,/>0<\/output>/)
 // Calling the guest DOM-ready function cannot mint a native choice event.
 const forged=await probe(t,code+`__ready()`,{boundGreeting:view({selectionReceipt:undefined})})
 assert.match(forged.p.views.at(-1).html,/>0<\/output>/)
})
