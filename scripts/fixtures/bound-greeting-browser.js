import React from 'react'
import {createRoot} from 'react-dom/client'
import {MessageContent} from '../../packages/client/src/play/scripted-content.js'
import {boundGreetingView,carryGreetingSelection} from '../../packages/client/src/play/bound-greeting.js'

// Authored renderer fixture. It does not connect to a profile or model.
const container=document.createElement('main');container.style.maxWidth='700px';document.body.append(container)
const root=createRoot(container),scope={mode:'greeting',playthroughId:'authored',sessionId:'authored',characterId:'authored'}
let previous,reads=0
const code=`let count=0;document.getElementById('o').textContent='awaiting';eventOn(tavern_events.CHARACTER_FIRST_MESSAGE_SELECTED,e=>{count++;const chat=SillyTavern.getContext().chat;document.getElementById('o').textContent=(Array.isArray(chat)&&e.input===getChatMessages(0)[0].mes?'selected:':'bad:')+count});`
window.renderGreetingCase=(kind,index=0)=>{
 const greeting={characterId:scope.characterId,index,sourceText:'Authored source '+index,messageCount:1}
 carryGreetingSelection(previous,greeting);previous=greeting
 const bound={...scope,greetingIndex:index}
 const createBinding=async()=>{reads++;if(kind==='ordinary')throw Error('MVU resource absent');return{getSnapshot:()=>({version:1,status:'available',scope:bound,revision:0,currentRevision:0,resourceId:'mvu:authored',variables:{stat_data:{hp:7},schema:{}},viewIdentity:{greetingIndex:index,selectionToken:'a'.repeat(64)}}),subscribe:()=>()=>{},dispose(){}}}
 const script=kind==='ordinary'?`document.getElementById('o').textContent='ordinary-ready'`:kind==='failed'?`throw Error('Authored startup failure')`:code
 root.render(React.createElement(MessageContent,{key:kind+':'+index,text:'<body><output id="o"></output><script>document.documentElement.dataset.started="true";'+script+'</script></body>',enabled:true,scopeKey:kind+':'+index,writeScope:{...bound,mode:'initial'},createBinding,context:{boundGreeting:boundGreetingView({scope:bound,state:{greeting}})}}))
}
window.greetingCaseState=()=>({reads,text:document.querySelector('iframe')?.contentDocument?.getElementById('o')?.textContent??null,errors:[...document.querySelectorAll('[role="alert"]')].map(node=>node.textContent),audit:!!document.querySelector('.dtv-card-audit')})
window.unmountGreetingCase=()=>root.unmount()
window.renderGreetingCase('ordinary')
