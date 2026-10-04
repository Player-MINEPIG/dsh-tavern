import {commandHookDeclaration} from '../packages/mvu-adapter/src/command-hook-declaration.js'
import {DEPENDENCY_LIMITS} from '../packages/client/src/play/rendering-limits.js'
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
test('unlabelled complete head/body documents route scripts to the card runtime',()=>{
 const source='<head><style>.status{color:green}</style></head>\n<body><output>Loading</output><script>document.querySelector("output").textContent="Ready"</script></body>'
 for(const document of [source,'<!DOCTYPE html>\n'+source,'<!-- card -->\n<!DOCTYPE html>\n<html>'+source+'</html>']){
  assert.deepEqual(splitCards('```\n'+document+'\n```'),[{html:document}])
 }
 assert.deepEqual(splitCards('Before\n```\n'+source+'\n```\nAfter'),[{text:'Before\n'},{html:source},{text:'\nAfter'}])
 for(const document of [source.replace('</body>',''),'<head><script>example()</script></head>','<div><script>example()</script></div>']){
  const text='```\n'+document+'\n```'
  assert.deepEqual(splitCards(text),[{text}])
 }
 for(const marker of ['```js','```text']){
  const text=marker+'\n'+source+'\n```'
  assert.deepEqual(splitCards(text),[{text}])
 }
 for(const marker of ['````','````text','````js','~~~text'])for(const ending of ['','\n'+marker.replace(/(?:text|js)$/,'')]){
  const text=marker+'\n```\n'+source+'\n```'+ending
  assert.deepEqual(splitCards(text),[{text}])
 }
})
test('media tags, CSS and a six-thousand URL catalog are not code dependencies',()=>{
 const images=Array.from({length:6000},(_,i)=>'https://example.com/images/'+i+'.webp')
 const html='<body><img src="https://example.com/a.png" srcset="https://example.com/b.png 2x"><style>@import "https://example.com/style.css"; p{background:url(https://example.com/c.png)}</style><video src="https://example.com/a.mp4"></video><script>const images='+JSON.stringify(images)+';</script></body>'
 assert.deepEqual(discoverDependencies(html),[])
 assert.equal(renderingInventory({data:{first_mes:html}},{kind:'character',resourceId:'media-fixture'})[0].dependencies.length,0)
})
test('dependency discovery retains blocked references without fetching and resolves relative modules',()=>{
 const result=discoverDependencies(`<script src="https://example.com/a.js"></script><script>\nimport x from './b.js';\nimport('http://localhost:5500/a.js');\n$('body').load('https://example.com/card.html')</script>`,'https://example.com/root.js')
 assert.equal(result.length,4);assert.ok(result.some(item=>item.url==='https://example.com/b.js'));assert.ok(result.some(item=>item.raw==='http://localhost:5500/a.js'&&item.blocked))
 for(const url of ['file:///tmp/a','http://example.com/x','https://user:pass@example.com/x','https://127.0.0.1/x','https://[::1]/x','https://x.local/x','https://example.com:8443/x','https://localhost./','https://foo.local./','https://svc.internal./','https://LOCALHOST./'])assert.equal(externalUrl(url),null)
})
test('trust is scoped, digest-bound, revocable, bounded and cancels pending hashing',async()=>{
 const trust=createRenderingTrust();let changes=0;const stop=trust.subscribe(()=>changes++)
 const digest=await trust.stage('character:one','https://example.com/a.js','1')
 assert.throws(()=>trust.read('character:one','https://example.com/a.js'),/not downloaded/)
 assert.throws(()=>trust.approve('character:one','https://example.com/a.js','bad'),/changed/)
 trust.approve('character:one','https://example.com/a.js',digest)
 assert.equal(trust.read('character:one','https://example.com/a.js'),'1')
 assert.throws(()=>trust.read('character:two','https://example.com/a.js'),/not downloaded/)
 await trust.stage('character:one','https://example.com/a.js','2');assert.throws(()=>trust.read('character:one','https://example.com/a.js'),/not downloaded/)
 trust.revoke('character:one','https://example.com/a.js');assert.equal(trust.inspect('character:one','https://example.com/a.js'),null)
 const pending=trust.stage('owner','inline','3');trust.clear();await assert.rejects(pending,/cancelled/)
 await assert.rejects(()=>trust.stage('owner','inline','x'.repeat(8*1024*1024+1)),/limit/)
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
 await assert.rejects(()=>downloadRenderingSource('https://example.com/big.js',{fetch:async()=>new Response('x'.repeat(8*1024*1024+1))}),/8 MiB/)
 const controller=new AbortController();controller.abort();await assert.rejects(()=>downloadRenderingSource('https://example.com/x',{fetch:request,signal:controller.signal}),/abort/i);assert.equal(calls,1)
 await assert.rejects(()=>downloadRenderingSource('https://example.com/x',{fetch:async()=>({ok:true,redirected:true})}),/failed/)
})

test('module graph checks every source owner before sharing identical dependencies',async()=>{
 const {readFile}=await import('node:fs/promises')
 const source=await readFile(new URL('../packages/client/src/play/scripted-content.js',import.meta.url),'utf8')
 const body=source.slice(source.indexOf('export function prepareCardDocument('),source.indexOf('\nexport function createDomBridge(')).replace('export function','function')
 const inertDocument={createElement(){return {innerHTML:'',content:{querySelectorAll(){return []}}}}}
 const prepare=new Function('commandHookDeclaration','DEPENDENCY_LIMITS','discoverDependencies','externalUrl','loadWrapper','MAX_RENDER_SOURCE','document','cardDocument',body+';return prepareCardDocument')(commandHookDeclaration,DEPENDENCY_LIMITS,discoverDependencies,externalUrl,loadWrapper,128*1024,inertDocument,()=>({html:'',scripts:[],unsupported:[]}))
 const trust=createRenderingTrust(),url='https://example.com/shared.js'
 const helpers=['character:A','preset:B'].map(owner=>({owner,key:owner+':helper',content:`import {value} from '${url}';`,enabled:true}))
 const approve=async(owner,key,content)=>trust.approve(owner,key,await trust.stage(owner,key,content))
 for(const helper of helpers)await approve(helper.owner,helper.key,helper.content)
 await approve(helpers[0].owner,url,'export const value="A"')
 assert.throws(()=>prepare('',helpers.map(x=>x.owner),helpers,trust),/not downloaded/)
 await approve(helpers[1].owner,url,'export const value="B"')
 assert.throws(()=>prepare('',helpers.map(x=>x.owner),helpers,trust),/conflict/)
 await approve(helpers[1].owner,url,'export const value="A"')
 assert.equal(prepare('',helpers.map(x=>x.owner),helpers,trust).runs.length,2)
 const child='https://example.com/child.js'
 for(const helper of helpers)await approve(helper.owner,url,`export {value} from '${child}'`)
 await approve(helpers[0].owner,child,'export const value=1')
 assert.throws(()=>prepare('',helpers.map(x=>x.owner),helpers,trust),/not downloaded/)
 await approve(helpers[1].owner,child,'export const value=1')
 assert.equal(prepare('',helpers.map(x=>x.owner),helpers,trust).modules[child],'export const value=1')
 trust.revoke(helpers[1].owner,url)
 assert.throws(()=>prepare('',helpers.map(x=>x.owner),helpers,trust),/not downloaded/)
})

test('runtime and acquisition count the first inline dependency at depth zero',async()=>{
 const {readFile}=await import('node:fs/promises')
 const text=await readFile(new URL('../packages/client/src/play/scripted-content.js',import.meta.url),'utf8')
 const body=text.slice(text.indexOf('export function prepareCardDocument('),text.indexOf('\nexport function createDomBridge(')).replace('export function','function')
 const document={createElement:()=>({innerHTML:'',content:{querySelectorAll:()=>[]}})}
 const prepare=new Function('commandHookDeclaration','DEPENDENCY_LIMITS','discoverDependencies','externalUrl','loadWrapper','MAX_RENDER_SOURCE','document','cardDocument',body+';return prepareCardDocument')(commandHookDeclaration,DEPENDENCY_LIMITS,discoverDependencies,externalUrl,loadWrapper,128*1024,document,()=>({html:'',scripts:[],unsupported:[]}))
 const owner='character:depth-fixture',trust=createRenderingTrust(),url=n=>'https://example.com/depth-'+n+'.js'
 const items=Array.from({length:9},(_,i)=>({url:url(i),content:i===8?'export const done=1;':`import './depth-${i+1}.js';`}))
 await trust.install(owner,items)
 const helpers=[{owner,key:'inline',enabled:true,content:`import '${url(0)}';`}]
 assert.equal(Object.keys(prepare('',[owner],helpers,trust).modules).length,9)
 await trust.install(owner,[...items.slice(0,-1),{url:url(8),content:"import './depth-9.js';"},{url:url(9),content:''}])
 assert.throws(()=>prepare('',[owner],helpers,trust),/depth exceeds/)
})

 test('AST dependency discovery handles multiline declarations and ignores inert strings/comments',()=>{
 const source=`// import 'https://example.com/comment.js';
 const text="import('https://example.com/string.js')";
 import {
 value
 } from './actual.js';
 export {value as other}
 from './reexport.js';
 import('./dynamic.js');`
 assert.deepEqual(discoverDependencies(source,'https://example.com/main.js').map(x=>x.url).sort(),['https://example.com/actual.js','https://example.com/dynamic.js','https://example.com/reexport.js'])
 assert.match(discoverDependencies('import(base + name)')[0].raw,/Computed dynamic/)
 assert.equal(discoverDependencies('import(base + name)')[0].blocked,true)
 assert.equal(discoverDependencies('function broken(')[0].blocked,true)
 })

 test('dependency inventory includes HTML fences after ordinary greeting text',()=>{
 const content='Welcome.\n\n```html\n<body><script src="https://example.com/status.js"></script></body>\n```'
 assert.equal(renderingInventory({data:{first_mes:content}},{kind:'character',resourceId:'fixture'})[0].dependencies[0].url,'https://example.com/status.js')
 })

test('S2: disabled global URL does not shadow reviewed enabled character; explicit origins cannot borrow',async()=>{
 const {readFile}=await import('node:fs/promises')
 const source=await readFile(new URL('../packages/client/src/play/scripted-content.js',import.meta.url),'utf8')
 const body=source.slice(source.indexOf('export function prepareCardDocument('),source.indexOf('\nexport function createDomBridge(')).replace('export function','function')
 const inertDocument={createElement(){return {innerHTML:'',content:{querySelectorAll(){return []}}}}}
 const prepare=new Function('commandHookDeclaration','DEPENDENCY_LIMITS','discoverDependencies','externalUrl','loadWrapper','MAX_RENDER_SOURCE','document','cardDocument',body+';return prepareCardDocument')(commandHookDeclaration,DEPENDENCY_LIMITS,discoverDependencies,externalUrl,loadWrapper,128*1024,inertDocument,()=>({html:'',scripts:[],unsupported:[]}))
 const trust=createRenderingTrust(),url='https://example.com/shared.html',owners=['global:workspace:synthetic','character:synthetic']
 for(const owner of owners)trust.approve(owner,url,await trust.stage(owner,url,'<body>synthetic</body>'))
 trust.setEnablement({schemaVersion:1,entries:[{owner:owners[0],key:url,enabled:false}]})
 const wrapper=`<body><script>$('body').load('${url}')</script></body>`
 assert.doesNotThrow(()=>prepare(wrapper,owners,[],trust))
 const dependency='https://example.com/value.js',helper={owner:owners[0],key:'helper',enabled:true,content:`import '${dependency}';`}
 trust.approve(helper.owner,helper.key,await trust.stage(helper.owner,helper.key,helper.content))
 for(const owner of owners)trust.approve(owner,dependency,await trust.stage(owner,dependency,'export const value=1'))
 trust.setEnablement({schemaVersion:1,entries:[{owner:owners[0],key:dependency,enabled:false}]})
 assert.throws(()=>prepare('',owners,[helper],trust),/disabled/,'explicit global import cannot borrow character review')
})
