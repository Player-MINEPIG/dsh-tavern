import test from 'node:test'
import assert from 'node:assert/strict'
import {helperScripts,renderingInventory,discoverDependencies,externalUrl,loadWrapper} from '../packages/client/src/play/rendering-sources.js'
import {createRenderingTrust} from '../packages/client/src/play/rendering-trust.js'
import {splitCards} from '../packages/client/src/play/scripted-content.js'
import {createCardRuntime} from '../packages/client/src/play/card-runtime.js'

test('both Helper extension formats and wrapped script/folder entries preserve source paths',()=>{
 const scripts=[{type:'script',value:{name:'one',content:'1',enabled:true}},{type:'folder',value:{enabled:false,scripts:[{content:'2'}]}}]
 for(const helper of [{scripts,variables:{}},[['scripts',scripts],['variables',{}]]]){
  const resource={source:{raw:{data:{extensions:{tavern_helper:helper}}}}}
  assert.deepEqual(helperScripts(resource).map(item=>[item.path,item.enabled]),[['scripts[0]',true],['scripts[1][0]',false]])
  assert.equal(renderingInventory(resource,{kind:'character',resourceId:'fixture'})[0].owner,'character:fixture')
 }
})
test('body wrappers, unknown languages and interrupted fences are distinguished',()=>{
 const source="<body><script>$('body').load('https://example.com/card.html')</script></body>"
 assert.equal(loadWrapper(source).url,'https://example.com/card.html')
 assert.equal(loadWrapper(source.replace(".load(",".load(extra,")),null)
 assert.equal(splitCards('```\n'+source+'\n```')[0].html,source)
 assert.equal(splitCards(source)[0].html,source)
 assert.equal(splitCards('```js\n'+source+'\n```')[0].html,undefined)
 assert.equal(splitCards('```\n'+source)[0].html,undefined)
})
test('dependency discovery retains blocked references without fetching and resolves relative modules',()=>{
 const result=discoverDependencies(`<script src="https://example.com/a.js"></script>\nimport x from './b.js';\nimport('http://localhost:5500/a.js');\n$('body').load('https://example.com/card.html')`,'https://example.com/root.js')
 assert.equal(result.length,4);assert.equal(result[1].url,'https://example.com/b.js');assert.equal(result[2].blocked,true)
 for(const url of ['file:///tmp/a','http://example.com/x','https://user:pass@example.com/x','https://127.0.0.1/x','https://[::1]/x','https://x.local/x','https://example.com:8443/x'])assert.equal(externalUrl(url),null)
})
test('trust is scoped, digest-bound, revocable, bounded and cancels pending hashing',async()=>{
 const trust=createRenderingTrust();let changes=0;const stop=trust.subscribe(()=>changes++)
 const digest=await trust.stage('character:one','https://example.com/a.js','1')
 assert.throws(()=>trust.read('character:one','https://example.com/a.js'),/review/)
 assert.throws(()=>trust.approve('character:one','https://example.com/a.js','bad'),/changed/)
 trust.approve('character:one','https://example.com/a.js',digest)
 assert.equal(trust.read('character:one','https://example.com/a.js'),'1')
 assert.throws(()=>trust.read('character:two','https://example.com/a.js'),/review/)
 await trust.stage('character:one','https://example.com/a.js','2');assert.throws(()=>trust.read('character:one','https://example.com/a.js'),/review/)
 trust.revoke('character:one','https://example.com/a.js');assert.equal(trust.inspect('character:one','https://example.com/a.js'),null)
 const pending=trust.stage('owner','inline','3');trust.clear();await assert.rejects(pending,/cancelled/)
 await assert.rejects(()=>trust.stage('owner','inline','x'.repeat(128*1024+1)),/limit/)
 stop();const previous=changes;trust.clear();assert.equal(changes,previous)
})
test('reviewed module map is the only module loading authority',async()=>{
 const output=[];const vm=await createCardRuntime(({op,args})=>{if(op==='propose')output.push(args[0])},{modules:{'https://example.com/n.js':'export const value = "reviewed"'}})
 try{
  vm.evaluate('import {value} from "./n.js";TavernUI.proposeMessage(value)',{module:true,name:'https://example.com/main.js'})
  assert.deepEqual(output,['reviewed'])
  assert.throws(()=>vm.evaluate('import "https://example.com/unreviewed.js"',{module:true,name:'https://example.com/reject.js'}))
 }finally{vm.dispose()}
})

test('historical variable scopes are derived from their own variant, not focus or imported position',async()=>{
 const {messageVariableScope}=await import('../packages/client/src/play/chat.js')
 const turn={id:'node',variant:{id:'variant',sessionId:'historical-session',endEventId:12,ext:{pmpDshTavern:{sessionFormatVersion:4}}}}
 assert.deepEqual(messageVariableScope(turn),{sessionId:'historical-session',nodeId:'node',variantId:'variant',endEventId:12,sessionFormatVersion:4})
 for(const patch of [{imported:true},{running:true},{transient:true},{variant:null}])assert.equal(messageVariableScope({...turn,...patch}),undefined)
})

test('explicit downloads omit credentials and refuse redirects, blocked URLs, oversize and cancellation',async()=>{
 const {downloadRenderingSource}=await import('../packages/client/src/play/rendering-download.js')
 let options,calls=0
 const request=async(url,init)=>{calls++;options=init;return new Response('export const value=1',{headers:{'Content-Type':'text/javascript'}})}
 assert.equal(await downloadRenderingSource('https://example.com/code.js',{fetch:request}),'export const value=1')
 assert.equal(options.credentials,'omit');assert.equal(options.redirect,'error');assert.equal(options.mode,'cors');assert.equal(options.referrerPolicy,'no-referrer')
 await assert.rejects(()=>downloadRenderingSource('http://localhost/x',{fetch:request}),/Blocked/);assert.equal(calls,1)
 await assert.rejects(()=>downloadRenderingSource('https://example.com/big.js',{fetch:async()=>new Response('x'.repeat(128*1024+1))}),/128 KiB/)
 const controller=new AbortController();controller.abort();await assert.rejects(()=>downloadRenderingSource('https://example.com/x',{fetch:request,signal:controller.signal}),/abort/i);assert.equal(calls,1)
 await assert.rejects(()=>downloadRenderingSource('https://example.com/x',{fetch:async()=>({ok:true,redirected:true})}),/failed/)
})
