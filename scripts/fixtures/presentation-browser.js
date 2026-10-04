import React from 'react'
import {createRoot} from 'react-dom/client'
import {flushSync} from 'react-dom'
import {MessageContent,cardDocument} from '../../packages/client/src/play/scripted-content.js'
import {ConversationPresentation,MessageBubble} from '../../packages/client/src/play/presentation.js'
import {MessageRow} from '../../packages/client/src/play/message-layout.js'
import {PlayTurnActionsPreview} from '../../packages/client/src/play/turn-actions.js'
import {Greeting,ChatFailureNotice,installPlayChatStyles} from '../../packages/client/src/play/chat.js'
import {setClientConversationSettings} from '../../packages/client/src/conversation-settings.js'
import {BUBBLE_STYLES} from '../../packages/presentation/bubble-style.js'
;(async()=>{
const results=[]
const check=(name,pass)=>results.push({name,pass:Boolean(pass)})
const pause=ms=>new Promise(r=>setTimeout(r,ms))
const container=document.createElement('div');document.body.append(container);const root=createRoot(container)
const source='<html><body><style>body{background:#faf5ea}button{padding:12px}</style><h2 id="count">0</h2><button id="plus">Count</button><input id="traveler-name" value="traveler"><input type="checkbox" id="card-check"><button id="send">Suggest</button><script>let n=0;document.getElementById("plus").addEventListener("click",()=>document.getElementById("count").textContent=String(++n));document.getElementById("send").addEventListener("click",()=>TavernUI.proposeMessage(document.getElementById("traveler-name").value));</script></body></html>'
const duplicateWarnings=cardDocument('<script src="one.js"></script><script src="two.js"></script><script type="module">import x from "three.js"</script>');check('script diagnostics are deduplicated and distinguish external scripts from modules',duplicateWarnings.unsupported.length===2&&duplicateWarnings.scripts.length===0)
const context={version:1,role:'assistant',userName:'Test',characterName:'Guide'}
let sends=[]
const render=(text=source,scope='a',enabled=true)=>flushSync(()=>root.render(React.createElement(MessageContent,{text,scopeKey:scope,enabled,context,onSend:text=>sends.push(text)})))
async function frameReady(){for(let i=0;i<100;i++){const doc=container.querySelector('iframe')?.contentDocument;if(doc?.getElementById('plus'))return doc;await pause(20)}throw Error('Frame missing')}
try{
 render();let doc=await frameReady();await pause(350);doc.getElementById('plus').click();check('script handles DOM click through metered bridge',doc.getElementById('count').textContent==='1')
 doc.getElementById('card-check').click();check('card inputs retain native checkbox interaction',doc.getElementById('card-check').checked)
 render();await pause(30);doc.getElementById('plus').click();check('unchanged rerender preserves runtime and DOM state',doc.getElementById('count').textContent==='2')
 doc.getElementById('traveler-name').value='A choice';doc.getElementById('send').click();await pause(20);check('script proposal cannot send automatically',sends.length===0&&container.textContent.includes('A choice'))
 const confirm=container.querySelector('.dtv-card-proposal button').getBoundingClientRect();globalThis.__trustedClick={id:'presentation-proposal',x:confirm.x+confirm.width/2,y:confirm.y+confirm.height/2};for(let i=0;i<100&&!sends.length;i++)await pause(20);check('trusted outside-card confirmation sends exact proposal',sends[0]==='A choice')
 const old=doc;render(source,'b');doc=await frameReady();await pause(120);doc.getElementById('plus').click();check('switching playthrough resets interpreter state',doc.getElementById('count').textContent==='1');old.getElementById('send').click();check('disposed document listeners cannot propose',!container.querySelector('.dtv-card-proposal'))
 render(source,'stream',false);doc=await frameReady();await pause(80);doc.getElementById('plus').click();check('streaming/disabled card renders without running JS',doc.getElementById('count').textContent==='0')
 render('<html><body><button id="plus">Try</button><script>document.getElementById("plus").addEventListener("click",()=>parent.document.body.innerHTML="escaped")</script></body></html>','attack');doc=await frameReady();await pause(120);doc.getElementById('plus').click();await pause(20);check('parent access raises a visible error; Host survives',container.querySelector('[role=alert]')&&document.body.contains(container))
 render('<html><body><button id="plus" onclick="parent.__escaped=1">Try</button><img src="https://example.com/leak"><form action="https://example.com"><input type="file"></form><iframe src="file:///etc/passwd"></iframe><script src="https://example.com/library.js"></script></body></html>','markup');doc=await frameReady();await pause(40);doc.getElementById('plus').click();check('active attributes, direct remote resources and nested frames are removed; file input remains restricted to approved photo types',!doc.querySelector('[onclick],form,iframe,[src^="https:"]')&&!window.__escaped&&doc.querySelector('[type=file]')?.accept==='image/png,image/jpeg,image/webp');check('unsupported APIs and external scripts explicitly reported',Boolean(container.querySelector('[role=alert]')?.textContent))
 check('iframe disallows native script execution and has network-denying CSP',container.querySelector('iframe').sandbox.value==='allow-same-origin'&&doc.querySelector('meta[http-equiv]').content.includes("connect-src 'none'"))
 render('<html><body><button id="plus">Try</button><script>while(true){}</script></body></html>','loop');await frameReady();await pause(160);check('runaway script stops with visible error',container.querySelector('[role=alert]'))
 setClientConversationSettings({textScale:1,actionScale:1,bubbleStyle:BUBBLE_STYLES[1]},{announce:false})
 const avatar='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII='
 flushSync(()=>root.render(React.createElement(ConversationPresentation,{state:{timeline:{nodes:[]},avatars:{user:avatar},display:{macros:{user:'Traveler',character:'Guide'}}},playthrough:{id:'a'},playClient:{},sessionId:'a'},React.createElement(MessageBubble,{text:'Hello',role:'user',messageKey:'one'}))))
 check('bound avatar and selected bubble style render',container.querySelector('.dtv-message-avatar img')?.src===avatar&&getComputedStyle(container.querySelector('.dtv-play-chat-bubble')).borderRadius==='4px')
 container.querySelector('.dtv-message-avatar').click();await pause(20);check('clicking avatar opens scoped editing choices',container.querySelector('[role=dialog] select')?.options.length===2)
 container.style.width='320px'
 flushSync(()=>root.render(React.createElement(React.Fragment,null,
   React.createElement(MessageBubble,{key:'layout-user',text:'Hello',role:'user',editable:false}),
   React.createElement(MessageBubble,{key:'layout-assistant',text:'A reply',editable:false}),
   React.createElement(MessageRow,null,React.createElement(PlayTurnActionsPreview,{scale:1.5})),
 )))
 const columns=[...container.querySelectorAll('.dtv-message-content')].map(el=>el.getBoundingClientRect())
 const avatars=[...container.querySelectorAll('.dtv-message-avatar')].map(el=>el.getBoundingClientRect())
 check('both avatars stay outside the shared body and action column',columns.every(rect=>rect.x===columns[0].x&&rect.width===columns[0].width)&&avatars[0].left>=columns[0].right&&avatars[1].right<=columns[1].left)
 check('large action buttons wrap within the center column on narrow screens',[...container.querySelectorAll('.dtv-play-turn-action')].every(el=>{const rect=el.getBoundingClientRect();return rect.left>=columns[2].left&&rect.right<=columns[2].right}))
 const shortUser=container.querySelector('.dtv-play-chat-user').getBoundingClientRect()
 check('short user bubbles shrink to their text and align to the right',shortUser.width<columns[0].width&&Math.abs(shortUser.right-columns[0].right)<1&&getComputedStyle(container.querySelector('.dtv-play-chat-user')).textAlign==='right')
 const shortAssistant=container.querySelector('.dtv-play-chat-assistant').getBoundingClientRect()
 check('short assistant bubbles shrink to their text and align to the left',shortAssistant.width<columns[1].width&&Math.abs(shortAssistant.left-columns[1].left)<1)
 flushSync(()=>root.render(React.createElement(MessageBubble,{text:'LongUnbrokenText'.repeat(80),role:'user',editable:false})))
 const longBubble=container.querySelector('.dtv-play-chat-user')
 check('long text wraps at the center-column maximum without overflowing',longBubble.getBoundingClientRect().width<=container.querySelector('.dtv-message-content').getBoundingClientRect().width&&longBubble.scrollWidth<=longBubble.clientWidth)
 flushSync(()=>root.render(React.createElement(MessageBubble,{text:'Before the card\n\n```html\n<body><button>Card content</button></body>\n```\n\nAfter the card',editable:false})))
 const cardBubble=container.querySelector('.dtv-play-chat-bubble'),textParts=[...container.querySelector('.dtv-play-rich').children].filter(element=>!element.classList.contains('dtv-interactive-card'))
 check('card presentation has no host bubble background or padding while mixed prose retains the selected style',getComputedStyle(cardBubble).backgroundColor==='rgba(0, 0, 0, 0)'&&getComputedStyle(cardBubble).padding==='0px'&&textParts.length===2&&textParts.every(element=>getComputedStyle(element).backgroundColor==='rgb(255, 250, 240)'&&getComputedStyle(element).padding==='20px')&&container.textContent.includes('Before the card')&&container.textContent.includes('After the card'))
 installPlayChatStyles()
 const greetingText='Greeting text that should share the same maximum width as ordinary message text. '.repeat(10)
 const greeting={text:greetingText,index:1,options:[{index:0},{index:1},{index:2}],characterName:'Guide'}
 const changes=[]
 for(const locked of [false,true]){
   flushSync(()=>root.render(React.createElement(React.Fragment,null,
     React.createElement(Greeting,{greeting,locked,busy:false,change:direction=>changes.push(direction)}),
     React.createElement(MessageBubble,{text:greetingText,editable:false}),
   )))
   const bubbles=[...container.querySelectorAll('.dtv-play-chat-bubble')].map(el=>el.getBoundingClientRect())
   check(`greeting and ordinary bubbles share alignment and maximum width (locked=${locked})`,bubbles.length===2&&bubbles[0].left===bubbles[1].left&&bubbles[0].width===bubbles[1].width)
   const navigation=container.querySelector('.dtv-play-greeting-navigation')
   check(`greeting navigation stays below the bubble or disappears when locked (${locked})`,locked?navigation===null:navigation.getBoundingClientRect().top>=bubbles[0].bottom)
   if(!locked)navigation.querySelectorAll('button')[1].click()
 }
 check('unlocked greeting navigation still selects the next greeting',changes.join(',')==='next')
 const failure = 'session "test" is already owned by an active write handle'
 flushSync(()=>root.render(React.createElement(ChatFailureNotice,{detail:failure})))
 check('RP error notice displays the exact Host error and recovery guidance',container.querySelector('[role=alert]')?.textContent.includes(failure)&&container.querySelector('[role=alert] p'))
 flushSync(()=>container.querySelector('.dtv-play-chat-failure-toggle').click())
 check('closing details retains the visible failure state and a reopen button',!container.querySelector('[role=alert]')&&container.querySelector('[role=status][data-error=true]')&&!container.textContent.includes(failure)&&container.querySelector('button[aria-expanded=false]'))
 flushSync(()=>container.querySelector('.dtv-play-chat-failure-toggle').click())
 check('reopening details restores the exact failure',container.querySelector('[role=alert]')?.textContent.includes(failure))
 flushSync(()=>container.querySelector('.dtv-play-chat-failure-toggle').click())
 flushSync(()=>root.render(React.createElement(ChatFailureNotice,{detail:failure,noticeKey:'next-turn'})))
 check('the same error in a new turn is expanded again',container.querySelector('[role=alert]')?.textContent.includes(failure))
 for(const intermediate of [null,'Different error']){
   flushSync(()=>root.render(React.createElement(ChatFailureNotice,{detail:failure})))
   flushSync(()=>container.querySelector('.dtv-play-chat-failure-toggle').click())
   flushSync(()=>root.render(React.createElement(ChatFailureNotice,{detail:intermediate})))
   flushSync(()=>root.render(React.createElement(ChatFailureNotice,{detail:failure})))
   check(`the same error expands after ${intermediate===null?'clearing':'another failure'}`,container.querySelector('[role=alert]')?.textContent.includes(failure))
 }
 flushSync(()=>root.render(React.createElement(ChatFailureNotice,{detail:failure,noticeKey:{op:'send'}})))
 flushSync(()=>container.querySelector('.dtv-play-chat-failure-toggle').click())
 flushSync(()=>root.render(React.createElement(ChatFailureNotice,{detail:failure,noticeKey:{op:'send'}})))
 check('a new Host operation object expands identical error details',container.querySelector('[role=alert]')?.textContent.includes(failure))
 flushSync(()=>root.render(React.createElement(ChatFailureNotice,{detail:'<img src=x onerror=alert(1)>'})))
 check('Host error details are rendered as text, never HTML',container.textContent.includes('<img')&&!container.querySelector('img'))
 flushSync(()=>root.render(React.createElement(ChatFailureNotice,{detail:''})))
 check('missing error details still produce a visible fallback',container.querySelector('[role=alert] div')?.textContent.length>0)
 flushSync(()=>root.render(React.createElement(ChatFailureNotice,{detail:null})))
 check('cleared Host error removes the notice',!container.querySelector('[role=alert]'))
 root.unmount();check('unmount removes cards and editing UI',container.children.length===0)
}catch(error){check(`Unexpected: ${error.stack}`,false)}
const report=document.createElement('pre');report.id='results';report.textContent=JSON.stringify(results);document.body.append(report)

})()
