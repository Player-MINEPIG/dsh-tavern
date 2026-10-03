import React from 'react'
import {createRoot} from 'react-dom/client'
import {flushSync} from 'react-dom'
import {MessageContent} from '../../packages/client/src/play/scripted-content.js'
import {renderingTrust as trust} from '../../packages/client/src/play/rendering-trust.js'
import {updateScriptEnablement} from '../../packages/presentation/script-enablement.js'
;(async()=>{
const results=[],check=(name,pass)=>results.push({name,pass:!!pass}),pause=ms=>new Promise(r=>setTimeout(r,ms))
const owner='character:synthetic-script-list',key=owner+':scripts[0]',preferenceKey='helper:id:button'
const helper={owner,key,preferenceKey,enabled:false,content:'let count=0;document.getElementById("count").textContent="ready";document.getElementById("plus").addEventListener("click",()=>{document.getElementById("count").textContent=String(++count)})'}
const host=document.createElement('div');document.body.append(host);const root=createRoot(host)
const source='<body><button id="plus">Increment</button><output id="count">static</output><script>/* Authored synthetic card only. */</script></body>'
const render=(scope='one',helpers=[helper])=>flushSync(()=>root.render(React.createElement(MessageContent,{text:source,enabled:true,scopeKey:scope,owners:[owner],helpers,context:{}})))
const doc=()=>host.querySelector('iframe')?.contentDocument
const ready=async()=>{for(let i=0;i<100&&doc()?.getElementById('count')?.textContent!=='ready';i++)await pause(20)}
try{
 render();await pause(100);check('disabled original helper stays inactive',doc()?.getElementById('count')?.textContent==='static')
 trust.setEnablement(updateScriptEnablement(undefined,owner,preferenceKey,true));await pause(80)
 check('enabling an unreviewed helper does not grant execution',host.querySelector('[role=alert]')&&doc()?.getElementById('count')?.textContent==='static')
 trust.approve(owner,key,await trust.stage(owner,key,helper.content));await ready()
 check('separate exact-content review enables the selected helper',doc()?.getElementById('count')?.textContent==='ready')
 doc().getElementById('plus').click();await pause(50);check('synthetic helper listener executes',doc()?.getElementById('count')?.textContent==='1')
 const old=doc();trust.setEnablement(updateScriptEnablement(undefined,owner,preferenceKey,false));await pause(100);old.getElementById('plus').click();await pause(30)
 check('unchecking remounts and disposes the old runtime listeners',old.getElementById('count').textContent==='1'&&doc()?.getElementById('count')?.textContent==='static')
 trust.setEnablement(updateScriptEnablement(undefined,owner,preferenceKey,true));await ready();render('two');await ready()
 check('scope remount starts a fresh runtime',doc()?.getElementById('count')?.textContent==='ready')
 render('two',[{...helper,content:helper.content+';/* changed */'}]);await pause(80)
 check('persisted enablement cannot authorize changed source',!!host.querySelector('[role=alert]'))
 render('two');await ready();trust.revoke(owner,key);await pause(80)
 check('revoke keeps enablement choice while blocking runtime',trust.isEnabled(owner,preferenceKey,false)&&!!host.querySelector('[role=alert]'))
 check('another owner never inherits the entry choice',!trust.isEnabled('character:other',preferenceKey,false))
 root.unmount();trust.clear();trust.setEnablement();check('unmount disposes the card',!host.children.length)
}catch(error){check('Unexpected: '+error.stack,false)}
const report=document.createElement('pre');report.id='results';report.textContent=JSON.stringify(results);document.body.append(report)

})()
