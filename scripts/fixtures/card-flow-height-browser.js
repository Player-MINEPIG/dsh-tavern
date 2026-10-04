import React from 'react'
import {createRoot} from 'react-dom/client'
import {MessageContent} from '../../packages/client/src/play/scripted-content.js'
;(async()=>{
 const results=[],pause=ms=>new Promise(resolve=>setTimeout(resolve,ms)),mount=document.createElement('main');document.body.append(mount)
 const root=createRoot(mount),check=(name,pass,detail)=>{results.push({name,pass:!!pass,detail});if(!pass)throw Error(name)}
 const until=async fn=>{for(let i=0;i<200&&!fn();i++)await pause(20);if(!fn())throw Error('Timed out')}
 const source=`<body><main id="panel" style="height:120px;overflow:hidden"><button id="shrink" type="button"><span class="option-text">Shrink</span></button></main><script>
 const panel=document.getElementById('panel');
 document.getElementById('shrink').addEventListener('click',()=>{panel.style.height='24px';requestAnimationFrame(()=>window.parent.postMessage({type:'resizeIframe',height:document.body.scrollHeight},'*'))});
 </script></body>`
 const frame=()=>mount.querySelector('iframe'),doc=()=>frame()?.contentDocument,geometry=()=>({frame:frame().clientHeight,body:doc().body.scrollHeight,panel:doc().getElementById('panel').getBoundingClientRect().height,min:getComputedStyle(frame()).minHeight,padding:getComputedStyle(frame()).padding,viewport:frame().parentElement.dataset.dtvViewport})
 try{
  root.render(React.createElement(MessageContent,{text:source,enabled:true,scopeKey:'flow-height',context:{}}))
  await until(()=>doc()?.getElementById('shrink')?.dataset.dtvNode);await pause(200)
  check('initial ordinary flow has no reserved option placeholder',frame().clientHeight===120&&doc().body.scrollHeight===120,geometry())
  const rect=doc().querySelector('.option-text').getBoundingClientRect(),bounds=frame().getBoundingClientRect();globalThis.__trustedClick={id:'flow-shrink',x:bounds.x+rect.x+rect.width/2,y:bounds.y+rect.y+rect.height/2}
  await until(()=>doc()?.getElementById('panel')?.style.height==='24px');await pause(250)
  check('native click and body measurement resize the same frame to its shorter content',frame().clientHeight===24&&doc().body.scrollHeight===24,geometry())
  check('iframe has no padding, minimum height or viewport panel reservation',getComputedStyle(frame()).padding==='0px'&&getComputedStyle(frame()).minHeight==='0px'&&frame().parentElement.dataset.dtvViewport==='false',geometry())
 }catch(error){results.push({name:'Unexpected '+error.message,pass:false,detail:frame()&&doc()?geometry():undefined})}
 const report=document.createElement('pre');report.id='results';report.textContent=JSON.stringify(results);document.body.append(report)
})()
