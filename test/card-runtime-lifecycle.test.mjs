import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {parseHTML} from 'linkedom'
import * as React from 'react'
import {createRoot} from 'react-dom/client'
import {initialWriteViewScope} from '../packages/client/src/play/mvu-scope.js'

// Mount the real component with a neutral Worker boundary. Transport, VM and
// sanitization have separate tests; here we observe ownership and UI lifecycle.
const raw=readFileSync(new URL('../packages/client/src/play/scripted-content.js',import.meta.url),'utf8')
const component=raw.slice(raw.indexOf('const InteractiveCard ='),raw.indexOf('export const MessageContent'))
test('MVU card retry, generation revocation and accepted close preserve the right runtime',async t=>{
 const previous={window:globalThis.window,document:globalThis.document,IS_REACT_ACT_ENVIRONMENT:globalThis.IS_REACT_ACT_ENVIRONMENT}
 const {window,document}=parseHTML('<!doctype html><html><body><div id="root"></div></body></html>')
 Object.assign(globalThis,{window,document,IS_REACT_ACT_ENVIRONMENT:true})
 const root=createRoot(document.getElementById('root'))
 t.after(async()=>{await React.act(()=>root.unmount());for(const [key,value] of Object.entries(previous)){if(value===undefined)delete globalThis[key];else globalThis[key]=value}})
 let handlers,close,vmDisposals=0,reads=0,writes=0,revokes=0,resolveGrant,mode='unavailable',grantPending=true
 const scope={sessionId:'neutral',nodeId:'node'},snap=()=>({version:1,status:mode,scope,revision:1,variables:{stat_data:{hp:7},schema:{}}})
 const createBinding=async(_signal,grant)=>{reads++;return{getSnapshot:snap,subscribe:()=>()=>{},dispose(){},write:async()=>{writes++;return snap()}}}
 const data={html:'<button>Neutral choice</button>',scripts:[],runs:[{code:'fixture'}],modules:{},virtual:true,unsupported:[],adapters:[{kind:'mvu-facade'}]}
 const dependencies={...React,h:React.createElement,renderingTrust:{revision:()=>0,subscribe:()=>()=>{}},prepareCardDocument:()=>data,cardDocument:()=>data,cleanCardHtml:html=>html,CARD_CSP:'',
  translate:key=>key,useCardDiagnostics:()=>false,IdentityActionProposal:()=>null,CardDiagnosticNotice:({message})=>React.createElement('p',{role:'alert'},message),
  cardRootPresentation:()=>({html:{className:'',style:''},body:{className:'',style:''}}),imageCss:value=>value,usesCardViewport:()=>false,cardViewport:()=>({width:480,height:300}),
  getComputedStyle:()=>({color:'#000',colorScheme:'light'}),ResizeObserver:class{observe(){}disconnect(){}},requestAnimationFrame:()=>1,cancelAnimationFrame(){},observeImages:()=>({dispose(){},refresh(){}}),firstCardVisibility:async()=>true,
  cardComposerIdentity:async()=>({id:'neutral'}),createCardComposerBridge:options=>{close=options.onClose;return{initial:{},dispose(){}}},greetingReadView:value=>value,
  confirmMvuSchemas(){},confirmMvuCommandHooks(){},initialWriteViewScope,
  renderingWriteRequests:{register:options=>{let disposed=false;return{getGrant:()=>grantPending?new Promise(resolve=>{resolveGrant=resolve}):Promise.resolve({grantId:'grant'}),dispose(){if(disposed)return;disposed=true;revokes++;options.onRevoke()}}}},
  createVirtualCardRuntime:(_data,options)=>{handlers=options;return{dispose(){vmDisposals++},notifyVariables(){}}},
 }
 const Card=new Function('dependencies',`const {${Object.keys(dependencies).filter(key=>key!=='default').join(',')}}=dependencies;${component};return InteractiveCard`)(dependencies)
 const render=busy=>React.createElement('div',null,React.createElement(Card,{source:'neutral source',enabled:true,scopeKey:'neutral scope',context:{},createBinding,writeScope:scope,writesBlocked:busy}))
 const load=async()=>{
  const frame=document.querySelector('iframe'),doc=parseHTML('<!doctype html><html><head></head><body><button>Neutral choice</button></body></html>').document
  Object.defineProperty(frame,'contentDocument',{value:doc,configurable:true})
  await React.act(async()=>{frame.dispatchEvent(new window.Event('load'));await new Promise(resolve=>setImmediate(resolve))})
  return frame
 }
 await React.act(()=>root.render(render(true)));const first=await load()
 assert.match(document.body.textContent,/appearance.mvuLoading/);assert.equal(document.querySelector('[role="alert"]'),null)
 mode='available';await React.act(()=>root.render(render(false)))
 assert.notEqual(document.querySelector('iframe'),first,'a failed startup retries once generation ends')
 const frame=await load();assert.ok(handlers);assert.equal(document.querySelector('[role="alert"]'),null);assert.equal(document.querySelector('button')?.textContent,undefined)
 const pending=handlers.onWrite({operation:'patch',value:[],observedRevision:1,operationId:'op'}).catch(error=>error)
 await new Promise(resolve=>setImmediate(resolve));assert.equal(typeof resolveGrant,'function')
 await React.act(()=>root.render(render(true)))
 assert.equal(document.querySelector('iframe'),frame);assert.equal(vmDisposals,0);assert.equal(revokes,1)
 await React.act(async()=>{resolveGrant({grantId:'grant'});assert.ok((await pending) instanceof Error)})
 assert.equal(writes,0,'revoked pending authorization must not submit a write')
 await React.act(()=>root.render(render(false)));assert.equal(document.querySelector('iframe'),frame)
 grantPending=false
 await React.act(async()=>{await handlers.onWrite({operation:'patch',value:[],observedRevision:1,operationId:'op'})})
 assert.equal(writes,1)
 await React.act(async()=>{root.render(render(true));await new Promise(resolve=>setImmediate(resolve))})
 assert.equal(document.querySelector('iframe'),frame);assert.equal(vmDisposals,0);assert.equal(reads,4,'revoke must return to one live read binding')
 await React.act(()=>root.render(render(false)))
 await React.act(async()=>{close();await new Promise(resolve=>setImmediate(resolve))})
 assert.equal(document.querySelector('iframe'),null);assert.equal(document.querySelector('[role="status"]'),null)
 assert.doesNotMatch(document.body.textContent,/cardSendAccepted|发送请求已受理/);assert.equal(vmDisposals,1)
 await React.act(()=>root.render(null));mode='unavailable'
 await React.act(()=>root.render(render(false)));await load()
 assert.match(document.querySelector('[role="alert"]').textContent,/appearance.mvuUnavailable/)
 const retry=document.querySelector('button');assert.equal(retry.textContent,'appearance.mvuRetry')
 mode='available';await React.act(()=>retry.click());await load()
 assert.equal(document.querySelector('[role="alert"]'),null);assert.equal(document.querySelector('[role="status"]'),null)
})

test('dependency failures appear as dismissible notices before iframe load, including disabled cards',async t=>{
 const previous={window:globalThis.window,document:globalThis.document,IS_REACT_ACT_ENVIRONMENT:globalThis.IS_REACT_ACT_ENVIRONMENT}
 const {window,document}=parseHTML('<html><body><div id="root"></div></body></html>')
 Object.assign(globalThis,{window,document,IS_REACT_ACT_ENVIRONMENT:true})
 const root=createRoot(document.getElementById('root'));t.after(async()=>{await React.act(()=>root.unmount());for(const [key,value]of Object.entries(previous)){if(value===undefined)delete globalThis[key];else globalThis[key]=value}})
 const {CardDiagnosticNotice}=await import('../packages/client/src/play/card-diagnostics.js')
 let available=false
 const inert={html:'<p>Static opening</p>',scripts:[],unsupported:['appearance.unsupportedModule']}
 const dependencies={...React,h:React.createElement,renderingTrust:{revision:()=>0,subscribe:()=>()=>{}},prepareCardDocument:()=>{if(!available)throw Error('Module dependencies unavailable');return{...inert,unsupported:[],runs:[{code:'fixture'}]}},cardDocument:()=>inert,cleanCardHtml:html=>html,CARD_CSP:'',translate:key=>key,useCardDiagnostics:()=>false,CardDiagnosticNotice,IdentityActionProposal:()=>null}
 const Card=new Function('dependencies',`const {${Object.keys(dependencies).filter(key=>key!=='default').join(',')}}=dependencies;${component};return InteractiveCard`)(dependencies)
 const container=document.getElementById('root')
 await React.act(()=>root.render(React.createElement(Card,{source:'neutral module',enabled:true,scopeKey:'opening',context:{}})))
 assert.match(container.querySelector('[role=alert]').textContent,/Module dependencies unavailable/)
 assert(container.querySelector('.dtv-card-diagnostic'),'yellow notice exists without firing iframe onLoad')
 await React.act(()=>container.querySelector('.dtv-card-diagnostic button').click())
 assert.equal(container.querySelector('[role=alert]'),null)
 await React.act(()=>root.render(React.createElement(Card,{source:'neutral module',enabled:false,scopeKey:'opening',context:{}})))
 assert.equal(container.querySelector('[role=alert]'),null,'same dismissed diagnostic stays dismissed during send')
 available=true
 await React.act(()=>root.render(React.createElement(Card,{source:'available module',enabled:false,scopeKey:'opening',context:{}})))
 assert.match(container.querySelector('[role=alert]').textContent,/appearance.scriptsOff/)
 assert.doesNotMatch(container.querySelector('[role=alert]').textContent,/unavailable|unsupportedModule/)
})
