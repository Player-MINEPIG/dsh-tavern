import {commandHookDeclaration} from '../packages/mvu-adapter/src/command-hook-declaration.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {parseHTML} from 'linkedom'
import {DEPENDENCY_LIMITS} from '../packages/client/src/play/rendering-limits.js'
import {discoverDependencies,externalUrl,loadWrapper} from '../packages/client/src/play/rendering-sources.js'
import {createRenderingTrust} from '../packages/client/src/play/rendering-trust.js'
import {createRenderingDependencies} from '../packages/client/src/play/rendering-dependencies.js'

// Exercise the real preparation function with an inert HTML parser. Sanitizing
// and runtime execution have separate browser coverage; no fixture JS runs here.
const text=await readFile(new URL('../packages/client/src/play/scripted-content.js',import.meta.url),'utf8')
const body=text.slice(text.indexOf('export function prepareCardDocument('),text.indexOf('\nexport function createDomBridge(')).replace('export function','function')
const {document}=parseHTML('<html></html>')
const prepare=new Function('commandHookDeclaration','DEPENDENCY_LIMITS','discoverDependencies','externalUrl','loadWrapper','MAX_RENDER_SOURCE','document','cardDocument',body+';return prepareCardDocument')(commandHookDeclaration,DEPENDENCY_LIMITS,discoverDependencies,externalUrl,loadWrapper,8*1024*1024,document,html=>({html,scripts:[],unsupported:[]}))
const memory=()=>{
 const map=new Map(),read=key=>structuredClone(map.get(key)??{generation:0})
 const advance=(key,pending)=>{const generation=read(key).generation+1;map.set(key,{generation,pending});return generation}
 return {get:async key=>read(key),readCurrent:async(key,snapshot,accept)=>{const saved=read(key);return saved.generation===snapshot.generation&&saved.pending===snapshot.pending?accept(saved)!==false:false},begin:async key=>advance(key,true),remove:async key=>advance(key,false),publish:async(key,generation,graph)=>{const saved=read(key);if(saved.generation!==generation||!saved.pending)return false;map.set(key,{generation,graph:structuredClone(graph)});return true}}
}
const url=name=>'https://example.com/depth/'+name
function convergent(count,order){
 const files=new Map([[url('shared.js'),'export const value=1;']])
 for(let n=0;n<count;n++)files.set(url('a'+n+'.js'),`import '${url(n===count-1?'shared.js':'a'+(n+1)+'.js')}';`)
 const content=order.map(name=>`import '${url(name)}';`).join('\n')
 return {files,content}
}

test('review P2: all convergent entry/declaration permutations agree across acquisition, cache and preparation',async()=>{
 for(const kind of ['helper','split-helper','inline','script','wrapper-inline','wrapper-script','wrapper-scripts'])for(const order of [['shared.js','a0.js'],['a0.js','shared.js']]){
  const owner='character:synthetic-depth',count=kind==='wrapper-script'?7:['script','wrapper-inline','wrapper-scripts'].includes(kind)?8:9
  const {files,content}=convergent(count,order)
  let source='',helpers=[]
  if(kind==='helper')helpers=[{owner,key:'inline',enabled:true,content}]
  if(kind==='split-helper')helpers=order.map((name,i)=>({owner,key:'inline-'+i,enabled:true,content:`import '${url(name)}';`}))
  if(kind==='inline')source=`<body><script type="module">${content}</script></body>`
  if(kind==='script'){files.set(url('entry.js'),content);source=`<body><script type="module" src="${url('entry.js')}"></script></body>`}
  if(kind.startsWith('wrapper')){
   let html=`<body><script type="module">${content}</script></body>`
   if(kind==='wrapper-script'){files.set(url('entry.js'),content);html=`<body><script type="module" src="${url('entry.js')}"></script></body>`}
   if(kind==='wrapper-scripts')html='<body>'+order.map(name=>`<script type="module" src="${url(name)}"></script>`).join('')+'</body>'
   files.set(url('card.html'),html);source=`<body><script>$('body').load('${url('card.html')}')</script></body>`
  }
  const sources=[...helpers,...(source?[{owner,key:'greeting',content:source}]:[])],store=memory(),trust=createRenderingTrust(),calls=[]
  const manager=createRenderingDependencies({store,trust,download:async key=>{assert.ok(files.has(key));calls.push(key);return files.get(key)}})
  await manager.sync(sources);await manager.acquire(owner)
  const graph=manager.inspect(owner),expectedDepth=kind==='wrapper-script'?2:['script','wrapper-inline','wrapper-scripts'].includes(kind)?1:0
  assert.equal(graph.status,'ready',kind+' '+order);assert.equal(graph.items.find(item=>item.url===url('shared.js')).depth,expectedDepth)
  assert.equal(calls.length,files.size);assert.equal(new Set(calls).size,calls.length)
  assert.doesNotThrow(()=>prepare(source,[owner],helpers,trust),kind+' acquired')
  // Legacy/manual cache without stored depths must also use minimum paths.
  const legacy=createRenderingTrust();await legacy.install(owner,graph.items.map(({url,content})=>({url,content})))
  assert.doesNotThrow(()=>prepare(source,[owner],helpers,legacy),kind+' no depth hints')
  const restoredTrust=createRenderingTrust(),restored=createRenderingDependencies({store,trust:restoredTrust,download:()=>{throw Error('No restore network')}})
  await restored.sync(sources);assert.equal(restored.inspect(owner).status,'ready')
  assert.equal(restoredTrust.inspect(owner,url('shared.js')).depth,expectedDepth)
  assert.doesNotThrow(()=>prepare(source,[owner],helpers,restoredTrust),kind+' restored')
 }
})

test('only selected owner roots lend shortest depth; enabling a shortcut makes the convergent graph ready',async()=>{
 const owner='character:synthetic-depth',{files}=convergent(9,[]),store=memory(),trust=createRenderingTrust()
 const helpers=[{owner,key:'chain',enabled:true,content:`import '${url('a0.js')}';`},{owner,key:'shortcut',enabled:false,content:`import '${url('shared.js')}';throw Error('Disabled entry');`}]
 const manager=createRenderingDependencies({store,trust,download:async key=>files.get(key)})
 await manager.sync(helpers);await manager.acquire(owner)
 assert.equal(manager.inspect(owner).status,'failed')
 assert.equal(manager.inspect(owner).items.find(item=>item.url===url('shared.js')).depth,9)
 helpers[1]={...helpers[1],enabled:true,content:`import '${url('shared.js')}';`}
 await manager.sync(helpers);await manager.acquire(owner)
 assert.equal(manager.inspect(owner).status,'ready')
 const output=prepare('',[owner],helpers,trust)
 assert.equal(output.runs.length,2);assert.doesNotMatch(output.runs.map(item=>item.code).join(''),/Disabled entry/)
 assert.equal(Object.keys(output.modules).length,10)
})

test('a genuine depth-nine dependency remains rejected in acquisition and every runtime root form',async()=>{
 for(const kind of ['helper','script','wrapper-inline','wrapper-script']){
  const owner='character:synthetic-depth',count=kind==='wrapper-script'?7:kind==='helper'?9:8
  const {files}=convergent(count,[]);let source='',helpers=[]
  const content=`import '${url('a0.js')}';`
  if(kind==='helper')helpers=[{owner,key:'inline',enabled:true,content}]
  if(kind==='script'){files.set(url('entry.js'),content);source=`<body><script type="module" src="${url('entry.js')}"></script></body>`}
  if(kind.startsWith('wrapper')){
   let html=`<body><script type="module">${content}</script></body>`
   if(kind==='wrapper-script'){files.set(url('entry.js'),content);html=`<body><script type="module" src="${url('entry.js')}"></script></body>`}
   files.set(url('card.html'),html);source=`<body><script>$('body').load('${url('card.html')}')</script></body>`
  }
  const sources=[...helpers,...(source?[{owner,key:'greeting',content:source}]:[])],trust=createRenderingTrust(),calls=[]
  const manager=createRenderingDependencies({store:memory(),trust,download:async key=>{calls.push(key);return files.get(key)}})
  await manager.sync(sources);await manager.acquire(owner)
  assert.equal(manager.inspect(owner).status,'failed',kind);assert.ok(!calls.includes(url('shared.js')))
  // All bytes exist in this authored legacy fixture, so preparation must still
  // reject depth rather than relying solely on a missing-download error.
  const legacy=createRenderingTrust();await legacy.install(owner,[...files].map(([url,content])=>({url,content})))
  assert.throws(()=>prepare(source,[owner],helpers,legacy),/depth exceeds/,kind)
 }
})

test('saved disablement drops old owner-depth hints before an asynchronous inventory refresh',async()=>{
 const owner='character:synthetic-depth',{files}=convergent(9,[]),trust=createRenderingTrust()
 const helpers=[{owner,key:'chain',enabled:true,content:`import '${url('a0.js')}';`},{owner,key:'shortcut',preferenceKey:'helper:id:shortcut',enabled:true,content:`import '${url('shared.js')}';`}]
 const manager=createRenderingDependencies({store:memory(),trust,download:async key=>files.get(key)})
 await manager.sync(helpers);await manager.acquire(owner);assert.doesNotThrow(()=>prepare('',[owner],helpers,trust))
 trust.setEnablement({entries:[{owner,key:'helper:id:shortcut',enabled:false}]})
 assert.equal(trust.inspect(owner,url('shared.js')).depth,undefined)
 assert.throws(()=>prepare('',[owner],helpers,trust),/depth exceeds/)
})

test('shortcuts and equal code from another owner cannot lend depth or bypass content conflicts',async()=>{
 const {files}=convergent(9,[]),trust=createRenderingTrust(),items=[...files].map(([url,content])=>({url,content}))
 await trust.install('character:A',items);await trust.install('preset:B',items)
 for(const reverse of [false,true]){
  const helpers=[{owner:'character:A',key:'short',enabled:true,content:`import '${url('shared.js')}';`},{owner:'preset:B',key:'long',enabled:true,content:`import '${url('a0.js')}';`}]
  if(reverse)helpers.reverse()
  assert.throws(()=>prepare('',['character:A','preset:B'],helpers,trust),/depth exceeds/)
 }
 await trust.install('preset:B',[{url:url('shared.js'),content:'export const value=2;'}])
 for(const owners of [['character:A','preset:B'],['preset:B','character:A']]){
  const helpers=owners.map(owner=>({owner,key:'same',enabled:true,content:`import '${url('shared.js')}';`}))
  assert.throws(()=>prepare('',owners,helpers,trust),/conflict/)
 }
})

test('cache restore and installation refuse invalid ready depths without publishing executable records',async()=>{
 const owner='character:synthetic-depth',source={owner,key:'inline',content:`import '${url('shared.js')}';`},store=memory(),manager=createRenderingDependencies({store,trust:createRenderingTrust(),download:async()=>''})
 await manager.sync([source]);await manager.acquire(owner)
 const saved=await store.get(owner),generation=await store.begin(owner)
 await store.publish(owner,generation,{...saved.graph,items:saved.graph.items.map(item=>({...item,depth:9}))})
 const trust=createRenderingTrust(),restored=createRenderingDependencies({store,trust});await restored.sync([source])
 assert.equal(restored.inspect(owner).status,'failed');assert.match(restored.inspect(owner).error,/cache depth/)
 assert.throws(()=>trust.read(owner,url('shared.js')),/not downloaded/)
 for(const depth of [-1,1.5,9,Infinity])await assert.rejects(()=>trust.install(owner,[{url:url('shared.js'),content:'',depth}]),/Invalid cached/)
})

test('restoration recomputes shortest paths instead of accepting forged in-range depth hints',async()=>{
 const owner='character:synthetic-depth',{files}=convergent(9,[]),source={owner,key:'inline',content:`import '${url('a0.js')}';`},store=memory()
 const manager=createRenderingDependencies({store,trust:createRenderingTrust(),download:async key=>files.get(key)})
 await manager.sync([source]);await manager.acquire(owner);assert.equal(manager.inspect(owner).status,'failed')
 const saved=await store.get(owner),generation=await store.begin(owner)
 // Corrupt a failed cache to claim readiness and all depths zero, including
 // the URL reachable only at depth nine. All numbers individually fit bounds.
 const items=saved.graph.items.map(item=>({...item,status:'ready',content:files.get(item.url),depth:0,error:null}))
 await store.publish(owner,generation,{...saved.graph,items,status:'ready',complete:true,error:null})
 const trust=createRenderingTrust(),restored=createRenderingDependencies({store,trust});await restored.sync([source])
 assert.equal(restored.inspect(owner).status,'failed');assert.match(restored.inspect(owner).error,/cache depth/)
 assert.throws(()=>trust.read(owner,url('a0.js')),/not downloaded/)
})
