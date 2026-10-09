import React from 'react'
import {createRoot} from 'react-dom/client'
import {flushSync} from 'react-dom'
import {MessageContent} from '../../packages/client/src/play/scripted-content.js'
;(async()=>{
 const results=[],pause=ms=>new Promise(resolve=>setTimeout(resolve,ms))
 const container=document.createElement('div');container.style.width='640px';document.body.append(container)
 const root=createRoot(container),check=(name,pass,detail)=>{results.push({name,pass:!!pass,detail});if(!pass)throw Error(name)}
 const doc=()=>container.querySelector('iframe')?.contentDocument
 const until=async fn=>{for(let i=0;i<300&&!fn();i++)await pause(20);if(!fn())throw Error('Timed out: '+container.textContent)}
 const content=`<html class="initial-theme" style="--accent:rgb(3, 4, 5)"><head><style>
 html,body{margin:0;overflow:hidden}body.initial-body{font-size:15px}.surface{position:fixed;inset:0;height:var(--panel-height,100dvh);background:var(--accent)}
 html.narrow .surface{border-top:3px solid rgb(9, 8, 7)}
 </style></head><body class="initial-body" style="padding:0"><div class="surface" id="surface"><button id="change">Change theme</button><output id="result"></output></div><script>
 const surface=document.getElementById('surface'),result=document.getElementById('result');let resizes=0;
 function show(){document.documentElement.style.setProperty('--panel-height',Math.max(360,window.innerHeight)+'px');document.documentElement.classList.toggle('narrow',window.innerWidth<400);result.textContent=JSON.stringify({width:window.innerWidth,height:innerHeight,boxWidth:surface.getBoundingClientRect().width,boxHeight:surface.getBoundingClientRect().height,resizes,theme:document.documentElement.className})}
 window.addEventListener('resize',()=>{resizes++;show()});show();
 document.getElementById('change').addEventListener('click',()=>{document.documentElement.style.setProperty('--accent','rgb(11, 12, 13)');document.body.classList.add('changed');show()});
 </script></body></html>`
 const render=(text=content,scope='first')=>flushSync(()=>root.render(React.createElement(MessageContent,{text,scopeKey:scope,enabled:true,context:{}})))
 const state=()=>{try{return JSON.parse(doc()?.getElementById('result')?.textContent)}catch{return null}}
 const correct=()=>{const value=state();return value&&value.width===doc().defaultView.innerWidth&&value.height===doc().defaultView.innerHeight&&Math.abs(value.boxWidth-value.width)<1&&Math.abs(value.boxHeight-value.height)<1}
 try{
  render();await until(correct)
  check('fixed 100dvh uses actual card dimensions and keeps source html/body presentation',doc().defaultView.innerHeight>=360&&doc().documentElement.classList.contains('initial-theme')&&doc().body.classList.contains('initial-body')&&getComputedStyle(doc().getElementById('surface')).backgroundColor==='rgb(3, 4, 5)',state())
  doc().getElementById('change').click();await until(()=>doc()?.body.classList.contains('changed'))
  check('script root class/style changes project into the same script-disabled iframe',getComputedStyle(doc().getElementById('surface')).backgroundColor==='rgb(11, 12, 13)'&&!doc().querySelector('script')&&container.querySelector('iframe').sandbox.value==='allow-same-origin')
  container.style.width='320px';await until(()=>correct()&&state().width<400&&state().resizes>0)
  check('container width change updates readonly dimensions and dispatches resize',doc().documentElement.classList.contains('narrow')&&getComputedStyle(doc().getElementById('surface')).borderTopWidth==='3px',state())
  const before=state();globalThis.__browserViewport={id:'tall',width:390,height:844};await until(()=>correct()&&state().height!==before.height)
  check('browser resize changes the card panel and dvh without a height feedback loop',state().height>before.height&&state().resizes>before.resizes,state())
  const count=state().resizes;await pause(300);check('unchanged dimensions stop resize notifications',state().resizes===count)
  const previous=doc();render(content,'second');await until(correct);container.style.width='360px';await until(()=>correct()&&state().width===360)
  check('scope replacement disposes old resize binding',previous!==doc()&&!previous.defaultView?.frameElement?.isConnected, state())
  render('<body><div style="height:180px">Flow</div><output id="flow"></output><script>document.getElementById("flow").textContent=String(innerWidth)</script></body>','flow');await until(()=>doc()?.getElementById('flow')?.textContent)
  await pause(100);check('ordinary flow retains content height sizing without host padding',container.querySelector('iframe').clientHeight===doc().body.scrollHeight&&container.querySelector('iframe').clientHeight>=180&&container.querySelector('iframe').clientHeight<300)
  root.unmount();container.style.width='500px';await pause(80);check('unmount removes the card and resize lifecycle',!container.querySelector('iframe'))
 }catch(error){results.push({name:'Unexpected '+error.stack,pass:false})}finally{try{root.unmount()}catch{}}
 const report=document.createElement('pre');report.id='results';report.textContent=JSON.stringify(results);document.body.append(report)
})()
