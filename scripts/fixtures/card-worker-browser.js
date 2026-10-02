import React from 'react'
import {createRoot} from 'react-dom/client'
import {flushSync} from 'react-dom'
import {createVirtualCardRuntime} from '../../packages/client/src/play/card-worker-client.js'
import {MessageContent} from '../../packages/client/src/play/scripted-content.js'
import {renderingTrust as trust} from '../../packages/client/src/play/rendering-trust.js'
;(async()=>{
 const results=[],check=(name,pass,detail)=>{results.push({name,pass:!!pass,...(detail?{detail}:{})});if(!pass)throw Error(name)},pause=ms=>new Promise(r=>setTimeout(r,ms))
 const sources=globalThis.__frameworkSources,container=document.createElement('div');document.body.append(container);const root=createRoot(container)
 const owner='character:framework-fixture',audits=[];let active=[],error=''
 const library=name=>({code:sources[name],name:'https://example.com/'+name,module:false})
 const start=(runs,html='<div id="root"></div>')=>{let view={html:''};const runtime=createVirtualCardRuntime({runs,html,modules:{},context:{},variables:{status:'available',scope:{messageId:'one'},variables:{stat_data:{hp:7}}}},{onView:value=>{view=value},onError:value=>{error=value.message},onProposal:()=>{},onAudit:value=>audits.push(value)});active.push(runtime);return {runtime,view:()=>view}}
 const until=async predicate=>{for(let i=0;i<150&&!predicate()&&!error;i++)await pause(20);if(error)throw Error(error);if(!predicate())throw Error('Timed out')}
 const target=(view,selector)=>{const template=document.createElement('template');template.innerHTML=view.html;return Number(template.content.querySelector(selector)?.dataset.dtvNode)}
 try{
  let item=start([library('jquery-3.6.0.js'),{name:'jquery-card.js',code:`$('#root').append('<button id="count">0</button>');let n=0;$('#count').on('click',()=>$('#count').text(String(++n)));`}])
  await until(()=>item.view().html.includes('id="count"'));item.runtime.dispatch({type:'click',target:target(item.view(),'button')});await until(()=>item.view().html.includes('>1</button>'));check('official jquery 3.6.0 appends and handles real delegated DOM state',true);item.runtime.dispose()
  item=start([library('react-18.3.1.js'),library('react-dom-18.3.1.js'),{name:'react-card.jsx',type:'text/babel',code:`function Counter(){const [n,setN]=React.useState(0);return <button id="counter" onClick={()=>setN(n+1)}>{n}</button>}ReactDOM.createRoot(document.getElementById('root')).render(<Counter/>);`}])
  await until(()=>item.view().html.includes('>0</button>'));item.runtime.dispatch({type:'click',target:target(item.view(),'button')});await until(()=>item.view().html.includes('>1</button>'));check('official React 18 with fixed JSX compiler preserves hook state and events',true);item.runtime.dispose()
  check('compiler audit records fixed version, inputs, output hashes and measured heap',audits.some(a=>a.compiled.length&&a.compiled[0].output.length===64&&a.memory.memory_used_size>0),audits.map(a=>({coldStartMs:a.coldStartMs,heapBytes:a.memory.memory_used_size,compiled:a.compiled})))
  item=start([library('vue-3.5.13.js'),{name:'vue-card.js',code:`Vue.createApp({template:'<button @click="n++">{{n}}</button>',data(){return {n:0}}}).mount(document.getElementById('root'))`}])
  await until(()=>item.view().html.includes('>0</button>'));item.runtime.dispatch({type:'click',target:target(item.view(),'button')});await until(()=>item.view().html.includes('>1</button>'));check('official Vue 3 template reactivity responds to a click',true);item.runtime.dispose()
  const first=start([{name:'first.js',code:`globalThis.privateValue='one';document.getElementById('root').textContent=privateValue`}]),second=start([{name:'second.js',code:`document.getElementById('root').textContent=typeof privateValue`}]);await until(()=>second.view().html.includes('undefined'));check('cards cannot share interpreter globals',first.view().html.includes('one'));first.runtime.dispose();second.runtime.dispose()
  item=start([{name:'interval.js',code:`let n=0;setInterval(()=>document.getElementById('root').textContent=String(++n),20)`}]);await until(()=>/>[3-9]</.test(item.view().html));item.runtime.dispose();const stopped=item.view().html;await pause(100);check('intervals continue across ticks and disposal stops output',item.view().html===stopped)
  error='';item=start([{name:'infinite.js',code:'while(true){}'}]);await until(()=>!!error).catch(()=>{});check('runaway code terminates with an explicit budget failure',/interrupted|deadline|execution/i.test(error));item.runtime.dispose();error=''
  item=start([{name:'boundary.js',code:`document.getElementById('root').textContent=[typeof fetch,typeof XMLHttpRequest,typeof WebSocket,typeof RTCPeerConnection,typeof Worker,typeof process,typeof require].join(',')`}]);await until(()=>item.view().html.includes('undefined'));check('native network, workers, Node and Host capabilities are absent',item.view().html.includes('undefined,undefined,undefined,undefined,undefined,undefined,undefined'));item.runtime.dispose()
  const key='https://example.com/react.js',domKey='https://example.com/react-dom.js'
  for(const [url,code]of [[key,sources['react-18.3.1.js']],[domKey,sources['react-dom-18.3.1.js']]])trust.approve(owner,url,await trust.stage(owner,url,code))
  const text=`<body><div id="root"></div><script src="${key}"></script><script src="${domKey}"></script><script type="text/babel">function Card(){const[n,s]=React.useState(0);return <button onClick={()=>s(n+1)}>{n}</button>}ReactDOM.createRoot(document.getElementById('root')).render(<Card/>);</script></body>`
  const render=scope=>flushSync(()=>root.render(React.createElement(MessageContent,{text,enabled:true,scopeKey:scope,owners:[owner],context:{}})))
  const doc=()=>container.querySelector('iframe')?.contentDocument
  render('one');await until(()=>doc()?.querySelector('button')?.textContent==='0');doc().querySelector('button').click();await until(()=>doc()?.querySelector('button')?.textContent==='1');check('React event travels through actual sanitized iframe and Worker',!doc().querySelector('script'))
  render('two');await until(()=>doc()?.querySelector('button')?.textContent==='0');check('scope switch remounts fresh framework state',true)
  trust.revoke(owner,key);await pause(100);check('revocation destroys framework and shows blocked fallback',container.querySelector('[role=alert]'))
  const shared='https://example.com/shared.js',child='https://example.com/child.js'
  const helpers=['character:A','preset:B'].map(owner=>({owner,key:owner+':helper',enabled:true,content:`import {value} from '${shared}';`}))
  const approve=async(owner,key,code)=>trust.approve(owner,key,await trust.stage(owner,key,code))
  for(const helper of helpers){await approve(helper.owner,helper.key,helper.content);await approve(helper.owner,shared,`export {value} from '${child}'`)}
  await approve(helpers[0].owner,child,'export const value=1')
  const graphText='<body><output id="graph">blocked</output><script>document.getElementById("graph").textContent="executed"</script></body>'
  flushSync(()=>root.render(React.createElement(MessageContent,{text:graphText,enabled:true,scopeKey:'graph',helpers,owners:helpers.map(x=>x.owner),context:{}})))
  await pause(100);check('Worker pipeline refuses B reusing an A-only transitive approval',container.querySelector('[role=alert]')&&doc()?.getElementById('graph')?.textContent==='blocked')
  await approve(helpers[1].owner,child,'export const value=1');await until(()=>doc()?.getElementById('graph')?.textContent==='executed');check('Worker pipeline starts only after both owners approve the full closure',true)
  root.unmount();check('component unmount removes display frames',!container.querySelector('iframe'))
 }catch(error){results.push({name:'Unexpected '+error.stack,pass:false})}finally{for(const runtime of active)runtime.dispose();trust.clear();try{root.unmount()}catch{}}
 const report=document.createElement('pre');report.id='results';report.textContent=JSON.stringify(results);document.body.append(report)
})()
