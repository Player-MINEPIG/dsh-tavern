import React from 'react'
import {createRoot} from 'react-dom/client'
import {flushSync} from 'react-dom'
import {MessageContent,cardDocument} from '../../packages/client/src/play/scripted-content.js'

// Self-authored cards differ only in a script literal. Their static srcDoc is
// identical, so the fixture exposes the source-only runtime lifecycle edge.
const virtual=!location.pathname.includes('direct')
const card=version=>`<html><body><button id="run">Run</button><input id="field" value="">${virtual?'<input type="file" hidden>':''}<output id="status">Ready</output><script>
let count=0;document.getElementById('run').addEventListener('click',()=>document.getElementById('status').textContent='${version}-'+(++count));
</script></body></html>`
const OriginalWorker=window.Worker,workers={created:0,terminated:0,active:0}
window.Worker=class extends OriginalWorker {
 constructor(...args){super(...args);workers.created++;workers.active++;this.ended=false}
 terminate(){if(!this.ended){this.ended=true;workers.terminated++;workers.active--}return super.terminate()}
}
const container=document.createElement('main');document.body.append(container)
const root=createRoot(container),identities=new WeakMap();let next=0,version='A',revision=0
const token=value=>{if(!identities.has(value))identities.set(value,++next);return identities.get(value)}
const render=()=>flushSync(()=>root.render(React.createElement(MessageContent,{text:card(version),enabled:true,scopeKey:'authored-source-lifecycle',context:{revision}})))
window.__sourceVariant=value=>{version=value;render()}
window.__sameSourceRender=()=>{revision++;render()}
window.__sourceState=()=>{
 const frame=document.querySelector('iframe'),doc=frame?.contentDocument,input=doc?.getElementById('field')
 return {workers:{...workers},frame:frame?token(frame):null,document:doc?token(doc):null,input:input?token(input):null,inputValue:input?.value,status:doc?.getElementById('status')?.textContent,srcdoc:frame?.srcdoc,sandbox:frame?.getAttribute('sandbox')}
}
window.__sourceUnmount=()=>root.unmount()
window.__staticSourceEqual=cardDocument(card('A')).html===cardDocument(card('B')).html
render();window.__sourceReady=true
