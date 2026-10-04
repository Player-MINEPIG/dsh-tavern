import React from 'react'
import {createRoot} from 'react-dom/client'
import {flushSync} from 'react-dom'
import {MessageContent} from '../../packages/client/src/play/scripted-content.js'
import {RenderingSettings} from '../../packages/client/src/rendering-settings.js'
import {renderingWriteRequests} from '../../packages/client/src/play/rendering-write-requests.js'
import {createVirtualCardRuntime} from '../../packages/client/src/play/card-worker-client.js'
import {setClientUiSettings} from '../../packages/client/src/i18n.js'
;(async()=>{
 const results=[],pause=ms=>new Promise(r=>setTimeout(r,ms)),check=(name,pass)=>{results.push({name,pass:!!pass});if(!pass)throw Error(name)}
 const until=async predicate=>{for(let i=0;i<250&&!predicate();i++)await pause(20);if(!predicate())throw Error('Timed out')}
 const card=document.createElement('div'),settings=document.createElement('div');document.body.append(card,settings);const root=createRoot(card),settingsRoot=createRoot(settings)
 const scope={sessionId:'fixture',nodeId:'node',variantId:'variant',endEventId:2},writes=[],listeners=new Set(),revoked=[]
 let revision=1,hp=0,disposed=0,worker
 const snapshot=()=>({version:1,scope,revision,currentRevision:revision,status:'available',variables:{stat_data:{hp},schema:{},display_data:{},delta_data:{}}})
 const createBinding=async(signal,grant)=>({getSnapshot:snapshot,subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn)},dispose(){disposed++},async write(input){if(!grant)throw Error('No grant');if(signal.aborted)throw Error('Cancelled');if(input.expectedRevision!==revision)throw Error('CAS conflict');writes.push(input);hp=input.operation==='patch'?input.value[0].value:input.value.stat_data.hp;revision++;for(const fn of listeners)fn(snapshot());return snapshot()}})
 const oldFetch=globalThis.fetch
 globalThis.fetch=async(url,options)=>{if(!String(url).includes('/rendering-write-grants'))throw Error('Unexpected fixture transport');if(options.method==='DELETE'){revoked.push(url);return Response.json({ok:true})}const body=JSON.parse(options.body);if(body.downloaded!==true||body.enabled!==true||'reviewed'in body)throw Error('Unexpected execution contract');return Response.json({ok:true,grantId:body.executionId,sourceIdentity:body.sourceIdentity})}
 const text=`<body><button id="patch">Patch</button><button id="replace">Replace</button><button id="forged">Wrong scope</button><output id="hp">0</output><output id="events">0</output><script>
 let notices=0;eventOn(Mvu.events.VARIABLE_UPDATE_ENDED,()=>{document.getElementById('events').textContent=String(++notices);document.getElementById('hp').textContent=String(Mvu.getMvuData().stat_data.hp)});
 document.getElementById('patch').addEventListener('click',async()=>{try{await Mvu.updateVariablesWith([{op:'replace',path:'/hp',value:Mvu.getMvuData().stat_data.hp+1}])}catch(e){document.getElementById('hp').textContent=e.code||e.message}});
 document.getElementById('replace').addEventListener('click',async()=>{const data=Mvu.getMvuData();data.stat_data.hp=9;await Mvu.replaceMvuData(data,{type:'message'})});
 document.getElementById('forged').addEventListener('click',async()=>{try{await Mvu.replaceMvuData(Mvu.getMvuData(),{type:'global'})}catch(e){document.getElementById('hp').textContent='scope rejected'}});
 </script></body>`
 try{
  setClientUiSettings({locale:'en',scale:1})
  flushSync(()=>root.render(React.createElement(MessageContent,{text,enabled:true,scopeKey:'write',writeScope:scope,createBinding,context:{},owners:['character:fixture']})))
  const doc=()=>card.querySelector('iframe')?.contentDocument
  await until(()=>doc()?.getElementById('patch')?.dataset.dtvNode);await pause(100)
  doc().getElementById('patch').click();await until(()=>writes.length===1&&doc()?.getElementById('hp')?.textContent==='1');check('enabled code writes without a source review or write approval step',writes[0].cause==='script')
  const client={getFile:async()=>({content:'{"schemaVersion":1,"rules":[]}'})}
  flushSync(()=>settingsRoot.render(React.createElement(RenderingSettings,{client,activeSnapshot:{}})))
  check('appearance panel exposes downloads/switches with no permission panel',!settings.querySelector('.dtv-write-review')&&!settings.textContent.includes('Allow variable writes'))
  check('unset master switch defaults on',settings.querySelector('.dtv-script-control input').checked)
  const iframe=card.querySelector('iframe'),target=doc().getElementById('patch');target.scrollIntoView();const rect=target.getBoundingClientRect(),frame=iframe.getBoundingClientRect()
  globalThis.__trustedClick={id:'mvu-patch',x:frame.x+rect.x+rect.width/2,y:frame.y+rect.y+rect.height/2}
  await until(()=>writes.length===2);await until(()=>doc()?.getElementById('hp')?.textContent==='2')
  check('actual browser click maps to user-interaction with Host CAS and operation ID',writes[1].cause==='user-interaction'&&writes[1].expectedRevision===2&&typeof writes[1].operationId==='string'&&!('scope'in writes[1]))
  check('bound VARIABLE_UPDATE_ENDED runs only after the committed snapshot',doc().getElementById('events').textContent==='2')
  doc().getElementById('replace').click();await until(()=>writes.length===3&&doc()?.getElementById('hp')?.textContent==='9');check('synthetic click cannot claim user interaction; whole-object replace resolves',writes[2].cause==='script'&&writes[2].operation==='replace'&&writes[2].expectedRevision===3)
  doc().getElementById('forged').click();await until(()=>doc()?.getElementById('hp')?.textContent==='scope rejected');check('guest options cannot select global scope',writes.length===3)
  const render=enabled=>flushSync(()=>root.render(React.createElement(MessageContent,{text,enabled,scopeKey:'write',writeScope:scope,createBinding,context:{},owners:['character:fixture']})))
  render(false);await until(()=>revoked.length===1);await until(()=>doc()?.getElementById('patch'));doc().getElementById('patch').click();await pause(100)
  check('switching off stops execution and removes the old binding',writes.length===3&&disposed>=1)
  render(true);await until(()=>doc()?.getElementById('patch')?.dataset.dtvNode);await pause(100);doc().getElementById('patch').click();await until(()=>writes.length===4)
  check('switching on rebuilds a current binding without reapproval',writes[3].expectedRevision===4&&hp===10)
  root.unmount();await until(()=>revoked.length===2);check('unmount removes its internal binding',revoked.length===2)
  let cause,error=''
  worker=createVirtualCardRuntime({html:'<p>timer</p>',runs:[{name:'timer.js',code:"setInterval(()=>Mvu.updateVariablesWith([{op:'replace',path:'/hp',value:2}]).catch(()=>{}),30)"}],modules:{},context:{},variables:snapshot()},{onView(){},onProposal(){},onError:e=>{error=e.message},onWrite:async input=>{cause=input.cause;return snapshot()}})
  await until(()=>cause||error);check('native interval writes carry interval cause without guest-supplied authority',cause==='interval'&&!error);worker.dispose()
 }catch(error){results.push({name:'Unexpected '+error.stack,pass:false,detail:{writes:writes.length,card:card.textContent,frame:card.querySelector('iframe')?.contentDocument?.body?.textContent}})}finally{worker?.dispose();try{root.unmount()}catch{}settingsRoot.unmount();renderingWriteRequests.clear();globalThis.fetch=oldFetch}
 const report=document.createElement('pre');report.id='results';report.textContent=JSON.stringify(results);document.body.append(report)
})()
