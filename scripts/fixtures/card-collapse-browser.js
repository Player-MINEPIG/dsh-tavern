import React from 'react'
import {createRoot} from 'react-dom/client'
import {MessageContent} from '../../packages/client/src/play/scripted-content.js'
import {CardDiagnosticBoundary} from '../../packages/client/src/play/card-diagnostics.js'
;(async()=>{
 const results=[],pause=ms=>new Promise(resolve=>setTimeout(resolve,ms)),mount=document.createElement('main');document.body.append(mount)
 mount.style.cssText='width:min(900px,100%);margin:auto'
 const NativeWorker=globalThis.Worker,NativeObserver=globalThis.ResizeObserver,trace=[],observers=[];let drop=false,live=0
 globalThis.ResizeObserver=class extends NativeObserver{constructor(callback){super(callback);this.record={frame:false,disconnected:false};observers.push(this.record)}observe(node,...args){if(node.localName==='iframe')this.record.frame=true;return super.observe(node,...args)}disconnect(){this.record.disconnected=true;return super.disconnect()}}
 globalThis.Worker=class extends NativeWorker{
  constructor(...args){super(...args);live++;this.stopped=false;this.addEventListener('message',event=>{if(['measure','error'].includes(event.data?.kind))trace.push({kind:event.data.kind,requestId:event.data.value?.requestId,error:event.data.kind==='error'?event.data.value:undefined})})}
  terminate(){if(!this.stopped){this.stopped=true;live--}return super.terminate()}
  postMessage(value,...args){if(value?.kind==='measurement'&&drop){trace.push({kind:'fixtureDroppedMeasurement'});drop=false;return}return super.postMessage(value,...args)}
 }
 const root=createRoot(mount),check=(name,pass,detail)=>{results.push({name,pass:!!pass,detail});if(!pass)throw Error(name)}
 const until=async(fn,label='condition')=>{for(let i=0;i<200&&!fn();i++)await pause(20);if(!fn())throw Error('Timed out: '+label)}
 const source=`<body style="margin:0;padding:10px"><style>
 .top-bar{display:flex;width:280px;max-width:100%;overflow:hidden}.top-bar.stacked{flex-direction:column}#world-time,#world-location{white-space:nowrap;font-size:20px}.panel{padding:15px;border:1px solid pink;border-radius:12px}.content{height:320px}summary{cursor:pointer}
 </style><div class="top-bar"><div id="world-time">Neutral long world time</div><div id="world-location">Neutral long location</div></div><details class="panel" id="panel"><summary id="toggle">Neutral status panel</summary><div class="content">Neutral expanded content</div></details><script>
 function updateTopBarLayout(){const bar=document.querySelector('.top-bar'),timeEl=document.getElementById('world-time'),locEl=document.getElementById('world-location');bar.classList.remove('stacked');const barWidth=bar.clientWidth||0,timeW=timeEl.scrollWidth||0,locW=locEl.scrollWidth||0;bar.classList.toggle('stacked',(timeW+locW+40)>barWidth)}
 updateTopBarLayout();let timer=null;window.addEventListener('resize',()=>{clearTimeout(timer);timer=setTimeout(updateTopBarLayout,80)});
 </script></body>`
 const frame=()=>mount.querySelector('iframe'),doc=()=>frame()?.contentDocument,panel=()=>doc()?.getElementById('panel')
 const sibling='<body><button id="healthy">Healthy sibling 0</button><script>void innerHeight;let n=0;document.getElementById("healthy").addEventListener("click",()=>{document.getElementById("healthy").textContent="Healthy sibling "+(++n)})</script></body>'
 const render=text=>root.render(React.createElement(CardDiagnosticBoundary,null,React.createElement(MessageContent,{text:'```html\n'+text+'\n```\n\n```html\n'+sibling+'\n```',enabled:true,scopeKey:'collapse',context:{}})))
 const geometry=()=>({frame:frame().clientHeight,body:doc().body.scrollHeight,panel:panel().getBoundingClientRect().height,open:panel().open,errors:[...mount.querySelectorAll('[role=alert]')].map(node=>node.textContent),trace:[...trace],frames:[...mount.querySelectorAll('iframe')].map(f=>({healthy:!!f.contentDocument?.getElementById('healthy'),nodes:f.contentDocument?.querySelectorAll('[data-dtv-node]').length,body:f.contentDocument?.body?.textContent.slice(0,120),rect:{x:f.getBoundingClientRect().x,y:f.getBoundingClientRect().y,width:f.clientWidth,height:f.clientHeight}}))})
 const click=async id=>{const bounds=frame().getBoundingClientRect(),rect=doc().getElementById('toggle').getBoundingClientRect();globalThis.__trustedClick={id,x:bounds.x+rect.x+rect.width/2,y:bounds.y+rect.y+rect.height/2};await until(()=>globalThis.__clicked?.includes(id));await pause(300)}
 try{
  render(source)
  await until(()=>panel()?.dataset.dtvNode,'primary startup')
  mount.querySelectorAll('iframe')[1].scrollIntoView({block:'center'})
  await until(()=>mount.querySelectorAll('iframe')[1]?.contentDocument.getElementById('healthy')?.dataset.dtvNode,'sibling startup')
  frame().scrollIntoView({block:'start'});await pause(400)
  check('status fixture initializes using bounded owned native geometry',!mount.querySelector('[role=alert]'),geometry())
  await click('expand')
  check('native disclosure stays expanded through the authored resize layout callback',panel().open&&frame().clientHeight===doc().body.scrollHeight,geometry())
  await click('collapse')
  check('native collapse converges to content height without an execution error',!panel().open&&frame().clientHeight===doc().body.scrollHeight&&!mount.querySelector('[role=alert]'),geometry())
  await click('expand-before-error');drop=true
  mount.style.width='min(860px,100%)';frame().style.width='95%'
  await until(()=>mount.querySelector('[role=alert]'));await pause(100)
  check('the injected lost layout response is reported as JS bridge failure, not CPU interruption',/CARD_EXECUTION_JS/.test(mount.querySelector('[role=alert]').textContent)&&/phase=timer/.test(mount.querySelector('[role=alert]').textContent)&&/layoutFailure=response-deadline/.test(mount.querySelector('[role=alert]').textContent),geometry())
  check('the failed interpreter is terminated while its native sizing observer and sibling remain',live===1&&observers.some(item=>item.frame&&!item.disconnected))
  check('the outer error identifies this mounted card among siblings',mount.querySelector('[role=alert]').dataset.dtvCardInstance===frame().parentElement.dataset.dtvCardInstance&&frame().parentElement.dataset.dtvCardInstance!==mount.querySelectorAll('iframe')[1].parentElement.dataset.dtvCardInstance)
  // The guest is now terminated. Native details remain independently operable.
  panel().open=true;await pause(150);const expanded=frame().clientHeight
  await click('collapse-after-error');await pause(200)
  check('passive native geometry still shrinks after the VM has failed',!panel().open&&frame().clientHeight===doc().body.scrollHeight&&frame().clientHeight<expanded,geometry())
  const healthyFrame=mount.querySelectorAll('iframe')[1],healthy=healthyFrame.contentDocument.getElementById('healthy'),bounds=healthyFrame.getBoundingClientRect(),rect=healthy.getBoundingClientRect()
  globalThis.__trustedClick={id:'healthy-sibling',x:bounds.x+rect.x+rect.width/2,y:bounds.y+rect.y+rect.height/2}
  await until(()=>healthyFrame.contentDocument.getElementById('healthy').textContent==='Healthy sibling 1')
  check('a healthy sibling runtime remains interactive after another card fails',live===1&&mount.querySelector('[role=alert]')!==null)
  globalThis.__screenshot='collapsed-after-error';await until(()=>globalThis.__screenshots?.includes('collapsed-after-error'))
  const oldFrame=frame(),oldObserver=observers.find(item=>item.frame&&!item.disconnected)
  panel().open=true // Queue native sizing immediately before replacing this source.
  render('<body><details id="replacement"><summary>Replacement status</summary><output id="ready"></output>Neutral content</details><script>void innerHeight;document.getElementById("ready").textContent="Replacement ready"</script></body>')
  await until(()=>frame()?.contentDocument.getElementById('ready')?.textContent==='Replacement ready','replacement startup');await pause(100)
  check('source replacement releases the failed view and its pending native sizing callback',!oldFrame.isConnected&&oldObserver.disconnected&&!mount.querySelector('[role=alert]')&&live===2)
  frame().contentDocument.getElementById('replacement').open=true
  root.unmount();await pause(50)
  check('unmount releases passive sizing observers and keeps the interpreter stopped',live===0&&!mount.querySelector('iframe')&&observers.filter(item=>item.frame).every(item=>item.disconnected))
 }catch(error){results.push({name:'Unexpected '+error.message,pass:false,detail:panel()?geometry():undefined})}
 finally{root.unmount();globalThis.Worker=NativeWorker;globalThis.ResizeObserver=NativeObserver}
 const report=document.createElement('pre');report.id='results';report.textContent=JSON.stringify(results);document.body.append(report)
})()
