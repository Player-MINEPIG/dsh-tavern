// Self-authored fixture: no imported card code or data.
import React from 'react'
import {createRoot} from 'react-dom/client'
import {flushSync} from 'react-dom'
import {MessageContent,prepareCardDocument} from '../../packages/client/src/play/scripted-content.js'
import {setClientUiSettings} from '../../packages/client/src/i18n.js'
;(async()=>{
 const results=[],pause=ms=>new Promise(r=>setTimeout(r,ms)),check=(name,pass)=>{results.push({name,pass:!!pass});if(!pass)throw Error(name)}
 const until=async predicate=>{for(let i=0;i<350&&!predicate();i++)await pause(20);if(!predicate())throw Error('Timed out: '+host.textContent)}
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host),listeners=new Set()
 const scope={mode:'greeting',playthroughId:'fixture-play',sessionId:'fixture-session',characterId:'fixture-character'}
 let revision=0,location='Atrium',disposeCount=0
 const snapshot=()=>({version:1,status:'available',resourceId:'fixture-resource',scope,revision,currentRevision:revision,variables:{stat_data:{location,progress:37,items:{map:'ready'},visible:true}}})
 const binding={getSnapshot:snapshot,subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn)},dispose(){disposeCount++}}
 const script=`
 function render(){
  const data=getAllVariables();$('#place').text(_.get(data,'stat_data.location','missing'));
  $('#progress').css('width',_.get(data,['stat_data','progress'])+'%');
  $('#panel').show().addClass('active extra').removeClass('extra');
  $('#hidden-panel').hide();$('#items').empty();
  if(!_.isEmpty(_.get(data,'stat_data.items',{})))$('#items').html('<li>map ready</li>');
  $('#fallback').text(_.get(data,'stat_data.unknown','fallback'));
 }
 async function init(){await waitGlobalInitialized('Mvu');render();eventOn(Mvu.events.VARIABLE_UPDATE_ENDED,render)}
 $(errorCatched(init));`
 const text='<body><style>#panel{display:none}</style><p id="place">Loading...</p><div id="progress"></div><div id="panel">panel</div><div id="hidden-panel">hidden</div><ul id="items"><li>old</li></ul><output id="fallback"></output><script type="module">'+script+'</script></body>'
 const doc=()=>host.querySelector('iframe')?.contentDocument
 try{
  setClientUiSettings({locale:'en',scale:1})
  check('legacy simple cards keep their runtime and quota',prepareCardDocument('<body><script>$(document).ready(()=>$("body").text(getAllVariables().stat_data.hp))</script></body>').virtual===false)
  flushSync(()=>root.render(React.createElement(MessageContent,{text,enabled:true,scopeKey:'greeting-fixture',createBinding:async()=>binding,owners:[],helpers:[],context:{}})))
  await until(()=>doc()?.getElementById('fallback')?.textContent==='fallback')
  check('greeting initializer reads the bound whole-variable snapshot',doc().getElementById('fallback').textContent==='fallback')
  check('finite display helpers fill lists, classes and progress',doc().getElementById('items').textContent==='map ready'&&doc().getElementById('progress').style.width==='37%'&&doc().getElementById('panel').className==='active')
  check('show overrides stylesheet hiding and hide sets display',doc().defaultView.getComputedStyle(doc().getElementById('panel')).display!=='none'&&doc().getElementById('hidden-panel').style.display==='none')
  revision++;location='Garden';for(const fn of listeners)fn(snapshot())
  await until(()=>doc()?.getElementById('place')?.textContent==='Garden');check('committed snapshot notification refreshes the existing greeting',listeners.size===1)
  flushSync(()=>root.render(React.createElement(MessageContent,{text:'<body><p>Loading...</p><script>$(errorCatched(async()=>{await waitGlobalInitialized("Mvu");throw Error("fixture initialization failed")}))</script></body>',enabled:true,scopeKey:'error-fixture',createBinding:async()=>binding,owners:[],helpers:[],context:{}})))
  await until(()=>host.textContent.includes('fixture initialization failed'));check('async initialization errors become visible renderer errors',true)
  flushSync(()=>root.render(React.createElement(MessageContent,{text:'<body><output id="simple">Loading...</output><script>$(errorCatched(()=>{$("#simple").text(_.get(getAllVariables(),"stat_data.location"))}))</script></body>',enabled:true,scopeKey:'simple-fixture',createBinding:async()=>binding,owners:[],helpers:[],context:{}})))
  await until(()=>doc()?.getElementById('simple')?.textContent==='Garden');check('convenience-only inline cards select the compatible runtime',true)
  flushSync(()=>root.render(React.createElement(MessageContent,{text:'<body><output id="ready-count">Loading...</output><script>$(document).ready(errorCatched(()=>$("#ready-count").text($("output").length)))</script></body>',enabled:true,scopeKey:'ready-fixture',owners:[],helpers:[],context:{}})))
  await until(()=>doc()?.getElementById('ready-count')?.textContent==='1');check('legacy ready and length helpers survive runtime selection',true)
  flushSync(()=>root.render(React.createElement(MessageContent,{text:'<body><p>Loading...</p><script>$(errorCatched(()=>getAllVariables()))</script></body>',enabled:true,scopeKey:'missing-fixture',createBinding:async()=>{throw Error('source absent')},owners:[],helpers:[],context:{}})))
  await until(()=>host.textContent.includes('Variable snapshot unavailable'));check('missing state surfaces an error without fabricated defaults',true)
  root.unmount();await pause(30);check('unmount cleans subscriptions and bindings',listeners.size===0&&disposeCount>=3)
 }catch(error){results.push({name:'Unexpected '+error.stack,pass:false})}finally{try{root.unmount()}catch{}}
 const report=document.createElement('pre');report.id='results';report.textContent=JSON.stringify(results);document.body.append(report)
})()
