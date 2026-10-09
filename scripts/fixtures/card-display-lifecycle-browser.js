import React from 'react'
import {createRoot} from 'react-dom/client'
import {flushSync} from 'react-dom'
import {MessageContent} from '../../packages/client/src/play/scripted-content.js'
import {ScopedPlayChatView} from '../../packages/client/src/play/occupancy.js'
import {setClientUiSettings} from '../../packages/client/src/i18n.js'

// Self-authored panels and a read-only synthetic Host. No model or user data.
;(async()=>{
  setClientUiSettings({locale:'en',scale:1},{announce:false})
  const results=[],pause=ms=>new Promise(resolve=>setTimeout(resolve,ms))
  const check=(name,pass,detail)=>{results.push({name,pass:!!pass,detail});if(!pass)throw Error(name)}
  const until=async fn=>{for(let i=0;i<300&&!fn();i++)await pause(20);if(!fn())throw Error('Timed out')}
  const OriginalWorker=window.Worker,workers={created:0,terminated:0,active:0,inits:0}
  window.Worker=class extends OriginalWorker {
    constructor(...args){super(...args);workers.created++;workers.active++;this.ended=false}
    postMessage(message,...args){if(message.kind==='init')workers.inits++;return super.postMessage(message,...args)}
    terminate(){if(!this.ended){this.ended=true;workers.terminated++;workers.active--}return super.terminate()}
  }
  const source=index=>`<body><style>body{margin:0}#panel{height:54px;display:flex;align-items:center;gap:4px;overflow:hidden}input{width:90px;min-width:0}button{padding:4px}</style><div id="panel"><button id="plus">Panel ${index}</button><input id="field" value="initial"><output id="count">Loading</output><output id="tick">0</output></div><script>
    let count=0,ticks=0;document.getElementById('count').textContent=String(count);void window.innerWidth;
    document.getElementById('plus').addEventListener('click',()=>document.getElementById('count').textContent=String(++count));
    ${index===0?"setInterval(()=>document.getElementById('tick').textContent=String(++ticks),100);":''}
  </script></body>`
  const mount=document.createElement('main');mount.style.cssText='height:480px;overflow:auto;max-width:780px;margin:auto';document.body.append(mount)
  const root=createRoot(mount),frames=()=>[...mount.querySelectorAll('iframe')],doc=index=>frames()[index]?.contentDocument
  const ready=index=>doc(index)?.getElementById('count')?.textContent==='0'
  const nativeClick=async(index,id)=>{const frame=frames()[index],rect=doc(index).getElementById('plus').getBoundingClientRect(),bounds=frame.getBoundingClientRect();globalThis.__trustedClick={id,x:bounds.x+rect.x+rect.width/2,y:bounds.y+rect.y+rect.height/2};await until(()=>doc(index)?.getElementById('count')?.textContent==='1')}
  const state=()=>({...workers})
  try {
    const text=Array.from({length:6},(_,i)=>'```html\n'+source(i)+'\n```').join('\n\n')
    const render=()=>flushSync(()=>root.render(React.createElement('div',null,
      React.createElement(MessageContent,{text,enabled:true,scopeKey:'display-panels',context:{}}),
      React.createElement('div',{style:{height:800}}),
      React.createElement(MessageContent,{text:source(6),enabled:true,scopeKey:'initially-offscreen',context:{}}))))
    render();await until(()=>Array.from({length:6},(_,i)=>ready(i)).every(Boolean));await pause(200)
    check('six visible scripted blocks start without the former four-instance rejection',workers.active===6&&workers.inits===6&&!mount.querySelector('[role=alert]'),state())
    check('the initially offscreen panel retains static presentation without starting a Worker',frames().length===7&&!ready(6)&&workers.created===6,state())
    globalThis.__screenshot='six-panels';await until(()=>globalThis.__screenshots?.includes('six-panels'))
    const first=frames()[0],firstDoc=doc(0);await nativeClick(0,'six-panels-count')
    const field=firstDoc.getElementById('field');field.value='kept draft';field.dispatchEvent(new first.contentWindow.Event('input',{bubbles:true}));await pause(150)
    mount.scrollTop=mount.scrollHeight;await until(()=>ready(6));await pause(150)
    check('first visibility starts the seventh panel while previous instances remain alive',workers.active===7&&workers.inits===7,state())
    mount.scrollTop=0;render();await pause(250)
    check('scrolling away and back preserves the same VM, document, edited input and JS state',frames()[0]===first&&doc(0)===firstDoc&&doc(0).getElementById('field').value==='kept draft'&&doc(0).getElementById('count').textContent==='1'&&workers.inits===7&&workers.terminated===0,state())

    // Exercise the actual RP view owner with public Store/read seams.
    let displayActive=true,selectedView='rp',sessionId='session-a',playthroughId='playthrough-a',reads=0,sends=0,readGate
    const listeners=new Set()
    const subscribe=fn=>{listeners.add(fn);return()=>listeners.delete(fn)}
    let binding
    const client={
      getMessages:async()=>{if(readGate)await readGate;return{messages:[]}},getTimeline:async()=>({schemaVersion:1,nodes:[]}),
      getCharacterSelection:async()=>({selection:{characterCardId:'authored-character',character:{greetingIndex:0}}}),
      getCharacter:async()=>({character:{id:'authored-character',data:{name:'Guide',firstMessage:source(0)}}}),
      getMvuSnapshot:async scope=>{reads++;return{version:1,status:'unavailable',scope,revision:0,variables:{}}},
      postUserMessage:async()=>{sends++;throw Error('No sends authorized in lifecycle fixture')},
    }
    const sessionState={running:true,blank:true},chatState={legacy:{nodes:[],partial:null},timeline:{turnOrder:[],turns:new Map()}}
    const useSession=fn=>fn(sessionState),useChat=fn=>fn(chatState),useStore=fn=>fn({view:selectedView})
    const show=()=>{
      binding={sessionId,playthrough:{id:playthroughId,path:playthroughId+'/timeline.json',ext:{pmpDshTavern:{rootSessionId:'session-a',characterId:'authored-character'}}}}
      mount.style.display=displayActive?'block':'none'
      flushSync(()=>root.render(React.createElement(ScopedPlayChatView,{sessionId,playClient:client,useSession,useChat,useStore,getBinding:()=>binding,subscribeBindings:subscribe})))
      for(const listener of listeners)listener()
    }
    mount.scrollTop=0;show();await until(()=>ready(0));await pause(150)
    check('replacing the displayed content releases every previous panel Worker',workers.active===1&&workers.terminated===7,state())
    await nativeClick(0,'scoped-rp-count');const oldDoc=doc(0),oldFrame=frames()[0]
    displayActive=false;show();await until(()=>workers.active===0);const oldTick=oldDoc.getElementById('tick').textContent,oldReads=reads;await pause(1300)
    check('a task-retained background Session has no RP iframe, Worker, timer callbacks or MVU polling',!frames().length&&oldDoc.getElementById('tick').textContent===oldTick&&reads===oldReads&&workers.active===0,state())
    check('leaving the display preserves the supplied running Agent state without a message submission',sessionState.running===true&&sends===0)
    let releaseRead;readGate=new Promise(resolve=>releaseRead=resolve)
    const beforeReturn=workers.created
    displayActive=true;show();await until(()=>frames().length===1);await pause(350)
    check('returning cached presentation stays read-only until this mount completes its authoritative read',workers.active===0&&workers.created===beforeReturn&&doc(0).getElementById('count').textContent==='Loading',state())
    readGate=null;releaseRead();await until(()=>ready(0));await pause(100)
    check('returning to a displayed Session constructs a fresh runtime rather than reviving old clicks/state',doc(0)!==oldDoc&&frames()[0]!==oldFrame&&doc(0).getElementById('count').textContent==='0'&&workers.active===1,state())
    selectedView='chat';show();await until(()=>workers.active===0)
    check('selecting native Chat unmounts the RP content instead of hiding its running iframe',!frames().length,state())
    selectedView='rp';show();await until(()=>ready(0))
    const autoFrame=frames()[0],autoCreated=workers.created
    mount.style.height='auto';await pause(200)
    check('a content-sized visible RP surface keeps its layout and runtime',frames()[0]===autoFrame&&workers.created===autoCreated&&mount.getBoundingClientRect().height>1,state())
    displayActive=false;show();await until(()=>workers.active===0)
    displayActive=true;show();await until(()=>ready(0))
    check('a content-sized surface can reactivate from its child-independent sentinel',workers.active===1&&frames()[0]!==autoFrame,state())
    mount.style.height='480px'
    const beforePlaythrough=frames()[0],created=workers.created
    playthroughId='playthrough-b';show();await until(()=>frames()[0]!==beforePlaythrough&&ready(0))
    check('switching playthrough on the same Session releases its precise old scope and starts fresh',workers.active===1&&workers.created===created+1,state())
    const beforeSwipe=frames()[0],swipeCreated=workers.created
    sessionId='session-swipe';show();await until(()=>frames()[0]!==beforeSwipe&&ready(0))
    check('a swipe Session binds a fresh message runtime without retaining the previous write/event scope',workers.active===1&&workers.created===swipeCreated+1&&sends===0,state())
    globalThis.__screenshot='lifecycle-final';await until(()=>globalThis.__screenshots?.includes('lifecycle-final'))
    flushSync(()=>root.render(null));await until(()=>workers.active===0)
    check('final unmount releases every created Worker exactly once',workers.created===workers.terminated,state())
  } catch(error) {results.push({name:'Unexpected '+error.stack,pass:false,detail:{...state(),displayText:mount.textContent}})} finally {root.unmount()}
  const report=document.createElement('pre');report.id='results';report.textContent=JSON.stringify(results);document.body.append(report)
})()
