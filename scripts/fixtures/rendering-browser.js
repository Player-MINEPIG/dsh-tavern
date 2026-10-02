import React from 'react'
import {createRoot} from 'react-dom/client'
import {flushSync} from 'react-dom'
import {MessageContent,prepareCardDocument} from '../../packages/client/src/play/scripted-content.js'
import {renderingTrust as trust} from '../../packages/client/src/play/rendering-trust.js'
import {ConversationSettingsPanel} from '../../packages/client/src/conversation-panel.js'
import {setClientUiSettings} from '../../packages/client/src/i18n.js'
;(async()=>{
const results=[],check=(name,pass)=>results.push({name,pass:!!pass}),pause=ms=>new Promise(r=>setTimeout(r,ms))
const container=document.createElement('div');document.body.append(container);const root=createRoot(container)
const owner='character:fixture', url='https://example.com/card.html', script='https://example.com/button.js', moduleUrl='https://example.com/value.js'
const wrapper="```\n<body><script>$('body').load('"+url+"')</script></body>\n```"
const html='<button id="plus">Count</button><output id="count">0</output><script src="./button.js"></script><script type="module">import {value} from "./value.js";document.getElementById("count").textContent=value</script>'
const code='let n=3;$("#plus").on("click",()=>$("#count").text(String(++n)))'
const render=(text=wrapper,scope='one',extra={})=>flushSync(()=>root.render(React.createElement(MessageContent,{text,enabled:true,scopeKey:scope,context:{},owners:[owner],...extra})))
const stage=async(key,content,approve=true)=>{const digest=await trust.stage(owner,key,content);if(approve)trust.approve(owner,key,digest);await pause(20)}
const doc=()=>container.querySelector('iframe')?.contentDocument
try{
 setClientUiSettings({locale:'en',scale:1})
 render();await pause(100);check('remote HTML wrapper renders blocked without any automatic download',container.querySelector('[role=alert]')&&doc()?.querySelector('script')===null)
 await stage(url,html,false);render();await pause(60);check('importing bytes alone does not authorize execution',container.querySelector('[role=alert]'))
 trust.approve(owner,url,trust.inspect(owner,url).digest);await pause(80);check('nested script dependency remains independently blocked',container.querySelector('[role=alert]'))
 await stage(script,code);await stage(moduleUrl,'export const value="3"');render();for(let i=0;i<100&&!container.querySelector('[role=alert]')&&doc()?.getElementById('count')?.textContent!=='3';i++)await pause(20)
 check('reviewed remote HTML, external script and relative module run inside QuickJS',doc()?.getElementById('count')?.textContent==='3')
 doc().getElementById('plus').click();check('clean-room jquery subset uses the card DOM bridge',doc().getElementById('count').textContent==='4')
 const old=doc();render();await pause(30);doc().getElementById('plus').click();check('repeat rendering preserves approved dependency runtime',doc().getElementById('count').textContent==='5')
 trust.revoke(owner,script);await pause(100);old.getElementById('plus').click();check('revocation destroys old listeners and shows a blocked fallback',old.getElementById('count').textContent==='5'&&container.querySelector('[role=alert]'))
 await stage(script,code);render(wrapper,'two');await pause(160);check('scope switch starts a fresh approved runtime',doc().getElementById('count').textContent==='3')
 render(wrapper,'two',{enabled:false});await pause(80);check('global script disable never resolves remote HTML',!doc()?.getElementById('plus'))
 let listener=null,disposed=0
 const binding={getSnapshot:()=>({version:1,scope:{sessionId:'bound'},revision:1,status:'available',variables:{stat_data:{hp:7},schema:{}}}),subscribe:fn=>{listener=fn;return()=>{listener=null}},dispose:()=>{disposed++}}
 const variableHtml='<body><output id="hp"></output><script>document.getElementById("hp").textContent=String(getVariables({type:"message"}).stat_data.hp);TavernUI.onVariables(snapshot=>document.getElementById("hp").textContent=String(snapshot.variables.stat_data.hp));</script></body>'
 render(variableHtml,'variables',{createBinding:async()=>binding});await pause(160);check('Helper reads whole scoped variables without a Host handle',doc()?.getElementById('hp')?.textContent==='7')
 listener({...binding.getSnapshot(),revision:2,variables:{stat_data:{hp:8}}});check('committed variable notification crosses bounded JSON bridge',doc().getElementById('hp').textContent==='8')
 render('<body><script>getVariables({type:"global"})</script></body>','forged',{helperBinding:binding});await pause(80);check('forged Helper scope is rejected and prior subscription disposed',container.querySelector('[role=alert]')&&listener===null&&disposed===1)
 let resolveBinding,aborted=false
 render(variableHtml,'pending',{createBinding:signal=>new Promise(resolve=>{resolveBinding=resolve;signal.addEventListener('abort',()=>{aborted=true})})});await pause(50)
 render('Gone','other');resolveBinding(binding);await pause(80);check('switch during binding load aborts and disposes stale result',aborted&&disposed===2&&!container.querySelector('iframe'))
 trust.clear()
 let guard
 const character={source:{raw:{data:{extensions:{tavern_helper:[['scripts',[{name:'Fixture helper',content:'TavernUI.getContext()'}]],['variables',{}]],regex_scripts:[{replaceString:wrapper}]}}}}}
 const client={getCharacter:async()=>({character}),getFile:async()=>({content:'{"schemaVersion":1,"rules":[]}'})}
 flushSync(()=>root.render(React.createElement(ConversationSettingsPanel,{client,activeSnapshot:{selection:{characterCardId:'fixture'}},settings:{textScale:1,actionScale:1},status:{text:'Saved'},update:()=>{},reset:()=>{},close:()=>{},registerBeforeLeave:fn=>{guard=fn;return()=>{guard=null}}})))
 await pause(120);check('unified page mounts appearance regex and external controls',container.querySelectorAll('[role=tab]').length===3&&container.querySelector('.dtv-bubble-editor')&&container.querySelector('.dtv-regex-panel')&&container.querySelector('.dtv-rendering-settings'))
 container.querySelectorAll('[role=tab]')[2].click();await pause(20)
 const button=text=>[...container.querySelectorAll('button')].find(el=>el.textContent===text)
 button('Stage inline source for review').click();await pause(60);check('settings stages exact helper source and digest without approving',container.querySelector('.dtv-rendering-settings textarea')?.value==='TavernUI.getContext()'&&!trust.inspect(owner,owner+':scripts[0]').approved)
 button('Content reviewed: allow restricted execution').click();await pause(30);check('settings approval is reflected by exact source trust record',trust.inspect(owner,owner+':scripts[0]').approved)
 button('Revoke and clear').click();await pause(20);check('settings revoke clears approved content',trust.inspect(owner,owner+':scripts[0]')===null)
 container.querySelectorAll('[role=tab]')[1].click();await pause(20);button('New rule').click();await pause(20)
 const originalConfirm=window.confirm;window.confirm=()=>false;check('unified shell navigation protects unsaved regex changes',guard()===false);window.confirm=originalConfirm
 root.unmount();trust.clear();check('unmount clears all cards and unified controls',!container.children.length)
}catch(error){check('Unexpected: '+error.stack,false)}
const report=document.createElement('pre');report.id='results';report.textContent=JSON.stringify(results);document.body.append(report)
})()
