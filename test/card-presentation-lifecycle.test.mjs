import test from 'node:test'
import assert from 'node:assert/strict'
import {parseHTML} from 'linkedom'
import {createElement as h,act} from 'react'
import {createRoot} from 'react-dom/client'

test('greeting read frame survives generation and historical cards do no DOM parsing per streaming update',async t=>{
 const previous={window:globalThis.window,document:globalThis.document,IS_REACT_ACT_ENVIRONMENT:globalThis.IS_REACT_ACT_ENVIRONMENT}
 const {window,document}=parseHTML('<html><head></head><body><div id="root"></div></body></html>')
 Object.assign(globalThis,{window,document,IS_REACT_ACT_ENVIRONMENT:true})
 const {ConversationPresentation,MessageBubble}=await import('../packages/client/src/play/presentation.js')
 const root=createRoot(document.getElementById('root'))
 t.after(async()=>{await act(()=>root.unmount());for(const [key,value] of Object.entries(previous)){if(value===undefined)delete globalThis[key];else globalThis[key]=value}})
 const playthrough={id:'play',ext:{pmpDshTavern:{rootSessionId:'session',characterId:'card'}}},client={},composer={}
 const state={display:{bindings:{characterId:'card'},renderingSources:[],macros:{}},timeline:{nodes:[]},turns:[],greeting:{index:0}}
 const render=busy=>h(ConversationPresentation,{state,playthrough,playClient:client,sessionId:'session',composer,busy},h(MessageBubble,{text:'```html\n<button>Neutral status</button>\n```',messageKey:'greeting',initialBinding:true,greetingBinding:true}))
 await act(()=>root.render(render(false)))
 const frame=document.querySelector('iframe');assert.ok(frame)
 await act(()=>root.render(render(true)))
 assert.equal(document.querySelector('iframe'),frame,'generation must not replace the greeting read runtime')
 let templates=0;const create=document.createElement.bind(document)
 document.createElement=(tag,...args)=>{if(tag==='template')templates++;return create(tag,...args)}
 t.after(()=>{document.createElement=create})
 for(let index=0;index<30;index++)await act(()=>root.render(render(true)))
 assert.equal(templates,0,'unchanged history must not be parsed/sanitized on each token')
 await act(()=>root.render(render(false)));assert.equal(document.querySelector('iframe'),frame)
 state.turns=[{id:'first'}]
 await act(()=>root.render(render(false)));assert.equal(document.querySelector('iframe'),frame,'losing the initial write scope must retain the greeting read view')
 await act(()=>root.render(null));assert.equal(document.querySelector('iframe'),null)
})
