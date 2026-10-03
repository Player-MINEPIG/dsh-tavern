import React from 'react'
import {createRoot} from 'react-dom/client'
import {flushSync} from 'react-dom'
import {MessageContent} from '../../packages/client/src/play/scripted-content.js'
import {OPENING_CARD_VIEWPORT_CSS} from '../../packages/client/src/play/card-viewport.js'
;(async()=>{
 const results=[],pause=ms=>new Promise(resolve=>setTimeout(resolve,ms))
 const style=document.createElement('style');style.textContent=`body{margin:8px}.fixture-dock{width:min(947px,100%);overflow:hidden;border:1px solid #777}.fixture-heading,.fixture-footer{height:36px}.dtv-play-opening-body{box-sizing:border-box;max-height:45dvh;overflow:hidden auto;padding:13px 15px}${OPENING_CARD_VIEWPORT_CSS}`;document.head.append(style)
 const dock=document.createElement('section');dock.className='fixture-dock';dock.innerHTML='<header class="fixture-heading">Opening</header><div class="dtv-play-opening-body" data-dtv-card-viewport-boundary="opening"></div><footer class="fixture-footer">Composer remains outside this dock</footer>';document.body.append(dock)
 const pane=dock.querySelector('.dtv-play-opening-body'),root=createRoot(pane)
 const check=(name,pass,detail)=>{results.push({name,pass:!!pass,detail});if(!pass)throw Error(name)}
 const until=async fn=>{for(let i=0;i<350&&!fn();i++)await pause(20);if(!fn())throw Error('Timed out: '+pane.textContent)}
 const doc=()=>pane.querySelector('iframe')?.contentDocument
 const value=()=>{try{return JSON.parse(doc()?.getElementById('value')?.textContent)}catch{return null}}
 const settled=()=>{const v=value(),frame=pane.querySelector('iframe');return v&&v.width===frame.clientWidth&&v.height===frame.clientHeight}
 const text=`<body><style>html,body{margin:0}.surface{position:fixed;inset:0;height:100dvh;overflow:auto;background:#eee}.heading{height:120px;box-sizing:border-box;padding:16px}.books{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));grid-template-rows:repeat(2,minmax(0,1fr));height:500px;box-sizing:border-box;padding:10px;gap:10px}.book{background:#bcd;border:1px solid #567;font:20px system-ui}@media(max-width:520px){.books{height:600px;grid-template-columns:repeat(2,minmax(0,1fr));grid-template-rows:repeat(3,minmax(0,1fr))}}</style><main class="surface"><header class="heading"><output id="value"></output><output id="selection"></output></header><section class="books">${Array.from({length:6},(_,i)=>`<button class="book" id="book${i+1}">Book ${i+1}</button>`).join('')}</section></main><script>
 function size(){document.getElementById('value').textContent=JSON.stringify({width:innerWidth,height:innerHeight})}size();window.addEventListener('resize',size);
 for(let i=1;i<=6;i++)document.getElementById('book'+i).addEventListener('click',()=>document.getElementById('selection').textContent=String(i));
 </script></body>`
 const render=(content=text,scope='dock')=>flushSync(()=>root.render(React.createElement(MessageContent,{text:content,scopeKey:scope,enabled:true,context:{}})))
 try{
  globalThis.__browserViewport={id:'desktop-dock',width:1728,height:907};await until(()=>window.innerWidth===1728&&window.innerHeight===907)
  render();await until(settled);await pause(100);await until(settled)
  const frame=pane.querySelector('iframe'),bounds=pane.getBoundingClientRect(),frameBounds=frame.getBoundingClientRect(),books=[...doc().querySelectorAll('.book')]
  check('six desktop books fit inside the actual visible Tavern pane',books.every(book=>{const r=book.getBoundingClientRect();return r.top>=0&&r.bottom<=frame.clientHeight&&frameBounds.top+frame.clientTop+r.bottom<=bounds.bottom+1}),{pane:pane.clientHeight,frame:frame.clientHeight,reported:value().height})
  check('viewport report matches grid area and opening pane has no second scrollbar',settled()&&pane.scrollHeight<=pane.clientHeight+1&&frameBounds.bottom<=bounds.bottom+1,{scroll:pane.scrollHeight,client:pane.clientHeight})
  const last=books.at(-1).getBoundingClientRect();globalThis.__trustedClick={id:'sixth-book',x:frameBounds.left+frame.clientLeft+last.x+last.width/2,y:frameBounds.top+frame.clientTop+last.y+last.height/2};await until(()=>doc()?.getElementById('selection')?.textContent==='6')
  check('sixth visible book receives actual browser input',true)
  globalThis.__browserViewport={id:'phone-dock',width:390,height:844};await until(()=>window.innerWidth===390&&settled()&&value().width<400)
  const surface=doc().querySelector('.surface');check('narrow layout scrolls inside the card while the outer pane stays fixed',surface.scrollHeight>surface.clientHeight&&pane.scrollHeight<=pane.clientHeight+1,{cardScroll:surface.scrollHeight,cardClient:surface.clientHeight,paneScroll:pane.scrollHeight,paneClient:pane.clientHeight})
  pane.style.height='480px';await until(()=>settled()&&value().height<480);check('local container height changes update the guest without resizing Host UI',pane.clientHeight===480&&pane.scrollHeight<=481&&window.innerHeight===844,value())
  pane.style.height='';render('Ordinary opening text','plain');await until(()=>!pane.querySelector('iframe'));check('leaving the viewport card restores ordinary opening layout',getComputedStyle(pane).maxHeight!=='none'&&getComputedStyle(pane).paddingTop==='13px')
  render('```html\n'+text+'\n```\n\n```html\n'+text+'\n```','multiple');await until(()=>pane.querySelectorAll('iframe').length===2&&[...pane.querySelectorAll('iframe')].every(frame=>frame.contentDocument?.getElementById('value')?.textContent))
  check('multiple cards retain the original opening scroll layout',getComputedStyle(pane).maxHeight!=='none'&&getComputedStyle(pane).paddingTop==='13px')
  root.unmount();dock.remove();await pause(40);check('dock unmount removes the frame and its resize binding',!document.querySelector('iframe'))
 }catch(error){results.push({name:'Unexpected '+error.stack,pass:false})}finally{try{root.unmount()}catch{}}
 const report=document.createElement('pre');report.id='results';report.textContent=JSON.stringify(results);document.body.append(report)
})()
