import React from 'react'
import {createRoot} from 'react-dom/client'
import {flushSync} from 'react-dom'
import {MessageContent} from '../../packages/client/src/play/scripted-content.js'
;(async()=>{
 const results=[],pause=ms=>new Promise(r=>setTimeout(r,ms)),container=document.createElement('div');document.body.append(container);const root=createRoot(container)
 const check=(name,pass)=>{results.push({name,pass:!!pass});if(!pass)throw Error(name)},until=async fn=>{for(let i=0;i<250&&!fn();i++)await pause(20);if(!fn())throw Error('Timed out: '+container.textContent)}
 const text=`<body><div id="box" style="width:123px;height:45px;overflow:auto;color:rgb(1,2,3)"><div style="height:90px">x</div></div><button id="change">Change</button><output id="result"></output><script>
 const box=document.getElementById('box'),out=document.getElementById('result');
 out.textContent=[box.getBoundingClientRect().width,box.scrollHeight,getComputedStyle(box).color].join('|');
 document.getElementById('change').addEventListener('click',async()=>{box.style.width='211px';await Promise.resolve();out.textContent=String(box.getBoundingClientRect().width);await Promise.resolve().then(()=>{out.textContent+='|'+box.scrollHeight});setTimeout(()=>out.textContent+='|'+box.offsetHeight,20)});
 </script></body>`
 const render=(content=text,scope='one')=>flushSync(()=>root.render(React.createElement(MessageContent,{text:content,enabled:true,scopeKey:scope,context:{}})))
 const doc=()=>container.querySelector('iframe')?.contentDocument
 try{
  render();await until(()=>doc()?.getElementById('result')?.textContent==='123|90|rgb(1, 2, 3)');check('synchronous geometry and computed style use the current sanitized card view',true)
  doc().getElementById('change').click();await until(()=>doc()?.getElementById('result')?.textContent==='211|90|45');check('click, await, nested Promise and timer getters preserve ordered results',true)
  const old=doc();render(text,'two');await until(()=>doc()?.getElementById('result')?.textContent==='123|90|rgb(1, 2, 3)');old.getElementById('change').click();await pause(50);check('scope switch disposes old events and starts a new measured view',doc().getElementById('result').textContent==='123|90|rgb(1, 2, 3)')
  render('<body><div id="x"></div><script>for(let i=0;i<17;i++)document.getElementById("x").scrollHeight</script></body>','budget');await until(()=>container.querySelector('[role=alert]'));check('excess synchronous layout requests stop with an outside-card error',!!container.querySelector('[role=alert]'))
  render();await until(()=>doc()?.getElementById('result')?.textContent==='123|90|rgb(1, 2, 3)');root.unmount();await pause(30);check('unmount removes measured iframe and Worker',!container.querySelector('iframe'))
 }catch(error){results.push({name:'Unexpected '+error.stack,pass:false})}finally{try{root.unmount()}catch{}}
 const report=document.createElement('pre');report.id='results';report.textContent=JSON.stringify(results);document.body.append(report)
})()
