import test from 'node:test'
import assert from 'node:assert/strict'
import { parseHTML } from 'linkedom'
import { createElement as h, act } from 'react'
import { CLIENT_REFRESH_EVENT } from '../packages/identity.js'
import { Simulate } from 'react-dom/test-utils'
import { createRoot } from 'react-dom/client'
import { renderingDependencies } from '../packages/client/src/play/rendering-dependencies.js'
import { DraftOpening } from '../packages/client/src/play/draft-opening.js'

test('draft opening renders and edits without Session hooks, then admits the first input once', async t => {
 const previous=Object.fromEntries(['window','document','Event','fetch','IS_REACT_ACT_ENVIRONMENT'].map(key=>[key,globalThis[key]]))
 const {window,document}=parseHTML('<html><head></head><body><div id="root"></div></body></html>')
 Object.assign(globalThis,{window,document,Event:window.Event,IS_REACT_ACT_ENVIRONMENT:true,fetch:async url=>Response.json(url.endsWith('/presets')?{presets:[]}:url.endsWith('/users')?{users:[]}:url.endsWith('/world-books')?{worldBooks:[]}:{presets:[]})})
 const root=createRoot(document.getElementById('root'));t.after(async()=>{await act(()=>root.unmount());renderingDependencies.dispose();for(const [key,value] of Object.entries(previous)){if(value===undefined)delete globalThis[key];else globalThis[key]=value}})
 const playthrough={id:'draft',path:'draft/timeline.json',title:'New opening',ext:{pmpDshTavern:{draftId:'draft',characterId:'card'}}}
 let draft={id:'draft',phase:'draft',revision:0,variables:{stat_data:{hp:100}},selection:{characterCardId:'card',presetId:null,userId:null,worldBookIds:[],character:{greetingIndex:0}},claim:null}, sent=0,prepared=0, failure=null, cancelled=0
 const opened=[], client={getDraft:async()=>({draft:structuredClone(draft),playthrough}),getCharacter:async()=>({character:{id:'card',name:'Character',data:{firstMessage:'Opening A',alternateGreetings:['Opening B']}}}),getWorkspace:async()=>({rootPath:'/fixture'}),getTimeline:async()=>({nodes:[]}),getFile:async()=>({content:'{"schemaVersion":1,"rules":[]}'}),
  putDraft:async(_id,patch)=>{assert.equal(patch.expectedRevision,draft.revision);draft={...draft,...patch,revision:draft.revision+1};return{draft,playthrough}},cancelDraft:async()=>{cancelled++;draft={...draft,lastInput:draft.claim?.text??'FIRST INPUT',phase:'draft',claim:null,revision:draft.revision+1};return{draft,sessionId:null}},materializeDraft:async(_id,payload)=>{prepared++;if(failure==='materialize')throw Error('fixture initialization failed');assert.equal(payload.text,'FIRST INPUT');return{sessionId:'real-session',requestId:'stable-request',accepted:false}},postUserMessage:async(id,text,options)=>{assert.equal(id,'real-session');assert.equal(text,'FIRST INPUT');assert.equal(options.requestId,'stable-request');sent++;if(failure==='lost-response'){draft={...draft,phase:'started',claim:{sessionId:id}};throw Error('response lost')}if(failure==='post')throw Error('fixture admission failed');return{accepted:true}}}
 await act(async()=>{root.render(h(DraftOpening,{draftId:'draft',playClient:client,openSession:id=>opened.push(id),switchToNative(){}}));await new Promise(resolve=>setImmediate(resolve))})
 const container=document.getElementById('root')
 assert.match(container.textContent,/Opening A/);assert(!container.textContent.includes('Error'))
 assert.equal(container.querySelectorAll('textarea').length,2)
 const next=[...container.querySelectorAll('button')].find(button=>button.textContent==='›')
 await act(async()=>{next.click();await new Promise(resolve=>setImmediate(resolve))})
 assert.match(container.textContent,/Opening B/);assert.equal(draft.selection.character.greetingIndex,1)
 // External launcher updates refresh the greeting and preserve unsent text.
 await act(()=>Simulate.change(container.querySelector('form textarea'),{target:{value:'UNSENT INPUT'}}))
 draft.selection.character.greetingIndex=0;draft.revision++
 await act(async()=>{window.dispatchEvent(new window.Event(CLIENT_REFRESH_EVENT));await new Promise(resolve=>setImmediate(resolve))})
 assert.match(container.textContent,/Opening A/);assert.equal(container.querySelector('form textarea').value,'UNSENT INPUT')
 assert.equal(container.querySelectorAll('select').length,0,'no duplicate resource selectors in the opening page')
 draft.claim={operationId:'same-first-send',text:'FIRST INPUT'};draft.phase='preparing'
 await act(async()=>{root.render(h(DraftOpening,{key:'retry',draftId:'draft',playClient:client,openSession:id=>opened.push(id),switchToNative(){}}));await new Promise(resolve=>setImmediate(resolve))})
 assert.equal(container.querySelector('button[type="submit"]').disabled,false)
 await act(async()=>{container.querySelector('form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));container.querySelector('form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));await new Promise(resolve=>setTimeout(resolve,10))})
 assert.equal(prepared,1);assert.equal(sent,1);assert.deepEqual(opened,['real-session']);assert.equal(cancelled,1)
 // A rejected send restores the same opening and typed input, without phase UI.
 for(const mode of ['materialize','post']) {
  failure=mode;draft.phase='draft';draft.claim=null;opened.length=0
  await act(async()=>{container.querySelector('form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));await new Promise(resolve=>setTimeout(resolve,10))})
  assert.deepEqual(opened,[]);assert.equal(draft.phase,'draft');assert.equal(draft.claim,null)
  assert.equal(container.querySelector('form textarea').value,'FIRST INPUT')
  assert.equal(container.querySelector('form textarea').hasAttribute('readonly'),false)
  assert.equal(container.querySelector('button[type="submit"]').disabled,false)
  assert.match(container.textContent,/fixture (initialization|admission) failed/)
  assert.doesNotMatch(container.textContent,/准备|preparation|request identity|请求编号|重试首次/)
 }

 // A later mount keeps the input even after the failed reservation is gone.
 await act(async()=>{root.render(h(DraftOpening,{key:'after-failure',draftId:'draft',playClient:client,openSession:id=>opened.push(id),switchToNative(){}}));await new Promise(resolve=>setImmediate(resolve))})
 assert.equal(container.querySelector('form textarea').value,'FIRST INPUT')
 const beforeCancel=cancelled;failure='lost-response';opened.length=0
 await act(async()=>{container.querySelector('form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));await new Promise(resolve=>setTimeout(resolve,10))})
 assert.deepEqual(opened,['real-session']);assert.equal(cancelled,beforeCancel,'accepted send with a lost response is not cancelled or repeated')

})
