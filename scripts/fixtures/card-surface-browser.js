import React from 'react'
import {createRoot} from 'react-dom/client'
import {ConversationPresentation,MessageBubble} from '../../packages/client/src/play/presentation.js'
import {setClientConversationSettings} from '../../packages/client/src/conversation-settings.js'
import {installPlayChatStyles} from '../../packages/client/src/play/chat.js'
;(async()=>{
 const results=[],pause=ms=>new Promise(resolve=>setTimeout(resolve,ms)),check=(name,pass,detail)=>{results.push({name,pass:!!pass,detail});if(!pass)throw Error(name)}
 const hostStyle=document.createElement('style');hostStyle.textContent='html{color-scheme:dark}body{margin:8px;background:#151517;color:#eee;--dsw-alias-bg-layer-2:#202126}';document.head.append(hostStyle)
 installPlayChatStyles();setClientConversationSettings({interactiveCards:true})
 const container=document.createElement('main');document.body.append(container);const root=createRoot(container)
 const staticPanel='<html><head><style>.panel{height:90px;border-radius:14px;background:#f8e7ef;padding:12px;color:#543449}</style></head><body><main class="panel">Status panel</main></body></html>'
 const card='<body><main id="surface" style="height:96px;margin:12px;border-radius:14px;background:#ffe7c5;padding:12px;color:#794720"><button id="choice">Choice</button><output id="count">0</output></main><script>document.getElementById("choice").addEventListener("click",()=>document.getElementById("count").textContent="1")</script></body>'
 const text='Before\n\n```html\n'+staticPanel+'\n```\n\nBetween\n\n```html\n'+card+'\n```\n\nAfter'
 try{
  root.render(React.createElement(ConversationPresentation,{state:{timeline:{nodes:[]},display:{macros:{character:'Guide'}}},playthrough:{id:'surface'},playClient:{},sessionId:'surface'},React.createElement(MessageBubble,{text,messageKey:'surface'})))
  for(let i=0;i<200&&!container.querySelector('iframe')?.contentDocument?.getElementById('choice');i++)await pause(20)
  await pause(250)
  const bubble=container.querySelector('.dtv-play-chat-bubble'),rich=bubble.querySelector('.dtv-play-rich'),boundary=rich.querySelector('[data-dtv-style-boundary]'),frame=rich.querySelector('iframe'),doc=frame.contentDocument
  check('static status and interactive option card stay inside the original RP message shell',bubble.contains(boundary)&&bubble.contains(frame)&&getComputedStyle(bubble).borderRadius==='18px'&&container.querySelectorAll('.dtv-play-chat-bubble').length===1)
  check('message shell retains its selected background and padding without a second Host surface',getComputedStyle(bubble).backgroundColor==='rgb(241, 243, 246)'&&getComputedStyle(bubble).padding==='14px'&&getComputedStyle(frame).borderWidth==='0px')
  const plain=[...rich.querySelector('[data-dtv-rich-text]').children].filter(node=>!node.matches('[data-dtv-html-document], [data-dtv-style-boundary]'))
  check('static HTML and surrounding prose add no nested message bubble',boundary.parentElement.matches('[data-dtv-html-document]')&&getComputedStyle(boundary.parentElement).padding==='0px'&&plain.length===2&&plain.every(node=>getComputedStyle(node).padding==='0px'&&getComputedStyle(node).backgroundColor==='rgba(0, 0, 0, 0)'),{plain:plain.length})
  check('transparent iframe root matches its embedding color scheme',getComputedStyle(doc.documentElement).colorScheme===getComputedStyle(frame).colorScheme&&getComputedStyle(doc.body).backgroundColor==='rgba(0, 0, 0, 0)')
  const surfaceRect=doc.getElementById('surface').getBoundingClientRect();check('flow height includes card margins and preserves the complete panel',surfaceRect.top>=0&&surfaceRect.bottom<=frame.clientHeight,{frame:frame.clientHeight,body:doc.body.scrollHeight,top:surfaceRect.top,bottom:surfaceRect.bottom})
  const frameRect=frame.getBoundingClientRect();globalThis.__surfacePixel={x:Math.round(frameRect.left+3),y:Math.round(frameRect.top+3),expected:[241,243,246]}
  const button=doc.getElementById('choice').getBoundingClientRect();globalThis.__trustedClick={id:'surface-choice',x:frameRect.left+button.x+button.width/2,y:frameRect.top+button.y+button.height/2}
  for(let i=0;i<100&&doc.getElementById('count').textContent!=='1';i++)await pause(20)
  check('native option input still reaches the isolated runtime',doc.getElementById('count').textContent==='1')
  const controlRow=document.createElement('div');controlRow.style.background='#202126';const control=document.createElement('iframe');control.style.cssText='width:240px;height:60px;border:0;background:transparent';control.sandbox='allow-same-origin';document.body.append(controlRow)
  await new Promise(resolve=>{control.onload=resolve;control.srcdoc='<style>body{margin:0;background:transparent}</style><body><div style="height:36px;margin:12px;background:#ffe7c5">Mismatched canvas control</div>';controlRow.append(control)})
  const controlRect=control.getBoundingClientRect();globalThis.__surfaceControlPixel={x:Math.round(controlRect.left+3),y:Math.round(controlRect.top+3),expected:[255,255,255]}
  check('control preserves the dark embed / normal child scheme mismatch for pixel comparison',getComputedStyle(control).colorScheme==='dark'&&getComputedStyle(control.contentDocument.documentElement).colorScheme==='normal')
 }catch(error){results.push({name:'Unexpected '+error.stack,pass:false})}
 const report=document.createElement('pre');report.id='results';report.textContent=JSON.stringify(results);document.body.append(report)
})()
