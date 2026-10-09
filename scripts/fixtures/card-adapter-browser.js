import React from 'react'
import {createRoot} from 'react-dom/client'
import {flushSync} from 'react-dom'
import {MessageContent,prepareCardDocument,cleanCardHtml} from '../../packages/client/src/play/scripted-content.js'
import {createVirtualCardRuntime} from '../../packages/client/src/play/card-worker-client.js'
import {confirmMvuSchemas,MVU_BUILTINS} from '../../packages/client/src/play/mvu-builtins.js'
import {setClientUiSettings} from '../../packages/client/src/i18n.js'
;(async()=>{
 const results=[],pause=ms=>new Promise(r=>setTimeout(r,ms)),check=(name,pass)=>{results.push({name,pass:!!pass});if(!pass)throw Error(name)},until=async fn=>{for(let i=0;i<250&&!fn();i++)await pause(20);if(!fn())throw Error('Timed out')}
 const container=document.createElement('div');document.body.append(container);const root=createRoot(container);let runtime
 try{
  setClientUiSettings({locale:'en',scale:1})
  const svg=document.createElement('div');svg.innerHTML=cleanCardHtml('<svg viewBox="0 0 100 100"><path d="M0 0 L100 100" stroke="red"/><script>window.escape=1</script><foreignObject><iframe src="https://example.com"></iframe></foreignObject><use href="https://example.com/icon.svg#x"/></svg>')
  check('safe SVG geometry survives while active SVG embedding and external references are removed',svg.querySelector('svg path')?.getAttribute('d')==='M0 0 L100 100'&&!svg.querySelector('script,foreignObject,iframe,use,[href]'))
  const owner='character:synthetic',entry=MVU_BUILTINS[0],schemaEntry=MVU_BUILTINS[2]
  const helper={owner,key:owner+':helper',enabled:true,content:`import '${entry.url}';`}
  const schema={owner,key:owner+':schema',enabled:true,content:`import {registerMvuSchema} from '${schemaEntry.url}'; registerMvuSchema(z.object({hp:z.number()}));`}
  // Attested records are synthetic. The real hash verification is tested separately;
  // no downloaded module bytes or user card are executed by this fixture.
  const trust={read:(o,k)=>k===helper.key?helper.content:k===schema.key?schema.content:'throw Error("ORIGINAL MODULE MUST NOT EXECUTE")',inspect:(o,k)=>({approved:true,builtin:true,digest:k===entry.url?entry.sha256:k===schemaEntry.url?schemaEntry.sha256:'synthetic-helper-hash'})}
  const prepared=prepareCardDocument('<body><output id="result"></output><script>document.getElementById("result").textContent=String(Mvu.getMvuData().stat_data.hp)</script></body>',[owner],[helper,schema],trust)
  const snapshot={version:1,scope:{mode:'initial',playthroughId:'p',sessionId:'s',characterId:'c'},revision:1,currentRevision:1,status:'available',resourceId:'fixture',variables:{stat_data:{hp:7},mvu_schema:{mvuSchema:1,interpreterVersion:1,source:schema.content}}}
  const evidence=confirmMvuSchemas(prepared.schemaDeclarations,snapshot)
  let view='',error=''
  runtime=createVirtualCardRuntime({...prepared,variables:snapshot},{onView:value=>{view=value.html},onProposal(){},onError:e=>{error=e.message}})
  await until(()=>view.includes('>7</output>')||error);check('explicit MVU replacement reads initial snapshot without running original module or schema declaration',!error&&view.includes('>7</output>')&&evidence[0].status==='source-registered'&&prepared.adapters.length===2);runtime.dispose()
  let rejected=false;try{confirmMvuSchemas(prepared.schemaDeclarations,{...snapshot,status:'unavailable'})}catch{rejected=true}check('unavailable schema authority cannot be reported as registered',rejected)
  const text='<body><output id="counter"></output><script>document.getElementById("counter").textContent=String(Mvu.getMvuData().stat_data.hp)</script></body>'
  flushSync(()=>root.render(React.createElement('div',null,...Array.from({length:5},(_,index)=>React.createElement(MessageContent,{key:index,text,enabled:true,scopeKey:'card-'+index,context:{},helperBinding:{getSnapshot:()=>snapshot,subscribe:()=>()=>{}}})))))
  await until(()=>container.querySelector('[role=alert]')&&[...container.querySelectorAll('iframe')].filter(frame=>frame.contentDocument?.getElementById('counter')?.textContent==='7').length===4)
  const cards=[...container.querySelectorAll('.dtv-interactive-card')],blocked=cards.find(card=>card.querySelector('[role=alert]')),active=cards.find(card=>card!==blocked)
  const button=(card,text)=>[...card.querySelectorAll('button')].find(b=>b.textContent===text)
  button(active,'Pause card').click();await pause(40);button(blocked,'Start / restart card').click()
  await until(()=>blocked.querySelector('iframe')?.contentDocument?.getElementById('counter')?.textContent==='7')
  check('five-card UI can pause an older card and start the previously capacity-blocked card',button(active,'Pause card').disabled&&!blocked.querySelector('[role=alert]'))
 }catch(error){results.push({name:'Unexpected '+error.stack,pass:false})}finally{runtime?.dispose();root.unmount()}
 const report=document.createElement('pre');report.id='results';report.textContent=JSON.stringify(results);document.body.append(report)
})()
