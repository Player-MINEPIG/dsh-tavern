import React from 'react'
import {createRoot} from 'react-dom/client'
import {ConversationPresentation,MessageBubble} from '../../packages/client/src/play/presentation.js'
import {setClientConversationSettings} from '../../packages/client/src/conversation-settings.js'
import {installPlayChatStyles} from '../../packages/client/src/play/chat.js'
import {BUBBLE_STYLES} from '../../packages/presentation/bubble-style.js'
;(async()=>{
 const results=[],pause=ms=>new Promise(resolve=>setTimeout(resolve,ms)),check=(name,pass,detail)=>{results.push({name,pass:!!pass,detail});if(!pass)throw Error(name)}
 const style=document.createElement('style');style.textContent='html{color-scheme:dark}body{margin:8px;background:#151517;color:#eee;--dsw-alias-bg-layer-2:#202126}';document.head.append(style)
 installPlayChatStyles();setClientConversationSettings({interactiveCards:false})
 const mount=document.createElement('main');document.body.append(mount);const root=createRoot(mount)
 const html='```html\n<body><main style="height:40px;background:#ffe7c5">HTML content</main><button type="button">Option</button></body>\n```'
 const items=[['assistant','Plain reply'],['assistant','Before\n\n'+html+'\n\nAfter'],['assistant','Next reply'],['user','Plain choice'],['user',html],['user','Next choice']]
 try{
  for(const bubbleStyle of BUBBLE_STYLES){
   setClientConversationSettings({bubbleStyle})
   root.render(React.createElement(ConversationPresentation,{state:{timeline:{nodes:[]},display:{macros:{user:'Traveler',character:'Guide'}}},playthrough:{id:'shell'},playClient:{},sessionId:'shell'},items.map(([role,text],index)=>React.createElement(MessageBubble,{key:index,role,text,messageKey:'shell-'+index}))))
   await pause(250)
   const bubbles=[...mount.querySelectorAll('.dtv-play-chat-bubble')],records=[]
   check(bubbleStyle.name+': one configured shell per message, without nested bubbles',bubbles.length===items.length&&bubbles.every(bubble=>!bubble.querySelector('.dtv-play-chat-bubble')))
   for(const [index,bubble]of bubbles.entries()){
    const role=items[index][0],bounds=bubble.getBoundingClientRect(),lane=bubble.closest('.dtv-message-content').getBoundingClientRect(),computed=getComputedStyle(bubble),rgb=hex=>`rgb(${[1,3,5].map(offset=>parseInt(hex.slice(offset,offset+2),16)).join(', ')})`
    records.push({role,left:bounds.left,right:bounds.right,laneLeft:lane.left,laneRight:lane.right,width:bounds.width,textAlign:computed.textAlign})
    check(bubbleStyle.name+': message '+index+' retains the selected shell',computed.backgroundColor===rgb(bubbleStyle[role].background)&&computed.padding===bubbleStyle.padding+'px'&&computed.borderRadius===bubbleStyle.radius+'px')
    check(bubbleStyle.name+': message '+index+' uses the same role alignment with or without HTML',computed.textAlign===(role==='user'?'right':'left')&&Math.abs(role==='user'?bounds.right-lane.right:bounds.left-lane.left)<1&&bounds.width<=lane.width+1)
    check(bubbleStyle.name+': message '+index+' adds no inner prose frame',[...bubble.querySelector('.dtv-play-rich').children].filter(node=>!node.classList.contains('dtv-interactive-card')).every(node=>getComputedStyle(node).padding==='0px'&&getComputedStyle(node).backgroundColor==='rgba(0, 0, 0, 0)'))
   }
   check(bubbleStyle.name+': all rounds share one stable lane',records.every(record=>record.laneLeft===records[0].laneLeft&&record.laneRight===records[0].laneRight),records)
  }
 }catch(error){results.push({name:'Unexpected '+error.message,pass:false})}
 const report=document.createElement('pre');report.id='results';report.textContent=JSON.stringify(results);document.body.append(report)
})()
