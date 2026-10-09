import test from 'node:test'
import assert from 'node:assert/strict'
import {parseHTML} from 'linkedom'
import {createElement as h,act,useState} from 'react'
import {createRoot} from 'react-dom/client'
import {PlayTurnActions,StoppedRequestActions} from '../packages/client/src/play/turn-actions.js'

test('saved, interrupted and empty stopped swipes release the parent UI lock',async t=>{
 const previous={window:globalThis.window,document:globalThis.document,Event:globalThis.Event,IS_REACT_ACT_ENVIRONMENT:globalThis.IS_REACT_ACT_ENVIRONMENT}
 const {window,document}=parseHTML('<html><head></head><body><div id="root"></div></body></html>')
 Object.assign(globalThis,{window,document,Event:window.Event,IS_REACT_ACT_ENVIRONMENT:true})
 const container=document.getElementById('root'),root=createRoot(container)
 t.after(async()=>{await act(()=>root.unmount());for(const [key,value] of Object.entries(previous)){if(value===undefined)delete globalThis[key];else globalThis[key]=value}})
 for(const outcome of ['completed','interrupted','empty']){
  const variant={id:'v',sessionId:'old',startEventId:1,endEventId:2}
  const node={id:'n',kind:'qa',adoptedVariantId:'v',parentVariantId:null,variants:[variant]}
  let timeline={nodes:[node],head:{sessionId:'old',nodeId:'n',variantId:'v'}}
  const playthrough={id:outcome,path:`${outcome}/timeline.json`},flags=[],errors=[],opened=[]
  const client={getTimeline:async()=>structuredClone(timeline),putTimeline:async(_p,value)=>{timeline=value},getFocus:async()=>timeline.head,
   getCharacterSelection:async()=>({selection:null}),postSession:async()=>({sessionId:'new'}),postUserMessage:async()=>({accepted:true}),
   getMessages:async id=>({incompleteTurn:false,messages:[{role:'user',seq:1,text:'Neutral question'},...(id==='old'||outcome!=='empty'?[{role:'assistant',seq:2,text:'Neutral reply',interrupted:id==='new'&&outcome==='interrupted'}]:[])]})}
  function Parent(){const [pending,setPending]=useState(false);return h(PlayTurnActions,{turn:{...node,variant,assistantText:'Neutral reply'},playthrough,playClient:client,running:pending,openSession:id=>opened.push(id),onChanged:()=>{},onError:value=>errors.push(value),onSwipePending:(_id,value)=>{flags.push(value);setPending(value)}})}
  await act(()=>root.render(h(Parent,{key:outcome})))
  const next=()=>[...container.querySelectorAll('button')].find(button=>button.textContent==='›')
  assert.equal(next().disabled,false)
  await act(async()=>{next().click();await new Promise(resolve=>setImmediate(resolve))})
  assert.deepEqual(flags,[true,false],outcome)
  assert.equal(next().disabled,false,outcome)
  assert.deepEqual(opened,['new'])
  assert.equal(timeline.nodes[0].variants.length,outcome==='empty'?1:2)
  if(outcome==='empty')assert.match(errors.at(-1),/stopped without a saved/)
 }
})

test('a cancelled ordinary request has a working retry button before any reply exists',async t=>{
 const previous={window:globalThis.window,document:globalThis.document,Event:globalThis.Event,IS_REACT_ACT_ENVIRONMENT:globalThis.IS_REACT_ACT_ENVIRONMENT}
 const {window,document}=parseHTML('<html><head></head><body><div id="root"></div></body></html>')
 Object.assign(globalThis,{window,document,Event:window.Event,IS_REACT_ACT_ENVIRONMENT:true})
 const container=document.getElementById('root'),root=createRoot(container)
 t.after(async()=>{await act(()=>root.unmount());for(const [key,value] of Object.entries(previous)){if(value===undefined)delete globalThis[key];else globalThis[key]=value}})
 const playthrough={id:'stopped',path:'stopped/timeline.json',ext:{pmpDshTavern:{rootSessionId:'old'}}},flags=[],opened=[]
 let timeline={nodes:[],head:null}
 const request={sessionId:'old',userEventId:1,turnStartEventId:0,turnEndEventId:3}
 const client={getTimeline:async()=>structuredClone(timeline),putTimeline:async(_p,value)=>{timeline=value},getFocus:async()=>timeline.head,
  postSession:async(_source,_import,stateSource)=>{assert.deepEqual(stateSource,{sessionId:'old',beforeUserEventId:1});return {sessionId:'new'}},postUserMessage:async()=>({accepted:true}),
  getMessages:async id=>({incompleteTurn:false,stoppedRequest:id==='old'?request:null,messages:[{role:'user',seq:1,text:'Neutral question'},...(id==='new'?[{role:'assistant',seq:2,text:'Neutral answer'}]:[])]})}
 function Parent(){const [pending,setPending]=useState(false);return h(StoppedRequestActions,{request,nodeId:'live-1',playthrough,playClient:client,running:pending,openSession:id=>opened.push(id),onChanged:()=>{},onError:value=>{if(value)assert.fail(value)},onSwipePending:(_id,value)=>{flags.push(value);setPending(value)}})}
 await act(()=>root.render(h(Parent)))
 const button=container.querySelector('button');assert.equal(button.textContent,'›');assert.equal(button.disabled,false)
 await act(async()=>{button.click();await new Promise(resolve=>setImmediate(resolve))})
 assert.deepEqual(opened,['new']);assert.deepEqual(flags,[true,false]);assert.equal(timeline.nodes.length,1)
 assert.equal(container.querySelector('button').disabled,false)
})
