import test from 'node:test'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {runInNewContext,createContext,runInContext} from 'node:vm'
import {build} from 'esbuild'
import {VIRTUAL_DOM_BOOTSTRAP} from '../packages/client/src/play/virtual-dom-runtime.js'
import {sourceSha256} from '../packages/client/src/play/source-sha256.js'
import {inspectHtmlLoader,IDENTITY_HTML_LOADER,identityLoaderBootstrap,adaptIdentityHtml} from '../packages/client/src/play/html-loader-adapters.js'
import {loadWrapper,discoverDependencies} from '../packages/client/src/play/rendering-sources.js'
import {createCardScopedStorage} from '../packages/client/src/play/card-scoped-storage.js'

test('synchronous source identities match standard SHA-256 for UTF-8 and block boundaries',()=>{
 for(const input of ['', 'abc','汉字📕', 'a'.repeat(55),'b'.repeat(56),'c'.repeat(64),'d'.repeat(10000)])assert.equal(sourceSha256(input),createHash('sha256').update(input).digest('hex'))
})
test('fixed IIFE loader resolves one immutable reference without running it',()=>{
 for(const fn of ['()=>','function()']){
  const source=`<body><script>(${fn}{const remote='https://example.com/identity.html';jQuery('body').load(remote);})();</script></body>`
  assert.equal(inspectHtmlLoader(source).raw,'https://example.com/identity.html')
  assert.equal(loadWrapper(source).url,'https://example.com/identity.html')
  assert.deepEqual(discoverDependencies(source),[{kind:'html',raw:'https://example.com/identity.html',url:'https://example.com/identity.html',blocked:false}])
 }
})
test('loader incidental effects, mutable URLs, extra arguments and changed compatibility versions fail closed',()=>{
 const wrap=code=>`<body><script>(()=>{${code}})();</script></body>`
 for(const code of ["let url='https://example.com/x';$('body').load(url)","const url='https://example.com/x';$('body').load(url);danger()","const url='https://example.com/x';$('body').load(url,extra)","const url='https://example.com/x';fetch(url)"]){assert.throws(()=>loadWrapper(wrap(code)),/Unsupported HTML loader/);assert.equal(discoverDependencies(wrap(code))[0].blocked,true)}
 assert.throws(()=>loadWrapper(wrap('window.__ST_HYPNOOS_IDENTITY_FRONTEND_URL__="changed";')),/version changed/)
 assert.equal(loadWrapper(wrap("const url='http://localhost/x';$('body').load(url)")).url,null)
})
test('only the unbound global jquery selector can be a fixed body loader',()=>{
 const wrap=code=>`<body><script>${code}</script></body>`
 // Preserve the three independently reproduced negatives verbatim.
 for(const code of ["(function $(){const remote='https://example.com/x';$('body').load(remote);})();","(()=>{const $='https://example.com/x';$('body').load($);})();","(function jQuery(){const remote='https://example.com/x';jQuery('body').load(remote);})();"]){
  assert.throws(()=>inspectHtmlLoader(wrap(code)),/Unsupported HTML loader/)
  assert.equal(discoverDependencies(wrap(code))[0].blocked,true)
 }
 assert.equal(inspectHtmlLoader(wrap("(function named(){const remote='https://example.com/x';$('body').load(remote);})();")).raw,'https://example.com/x')
 assert.equal(inspectHtmlLoader(wrap("(function $(){const remote='https://example.com/x';jQuery('body').load(remote);})();")).raw,'https://example.com/x')
 assert.throws(()=>inspectHtmlLoader(wrap("(()=>{const remote='https://example.com/x';obj.$('body').load(remote);})();")),/Unsupported HTML loader/)
})
test('identity snapshot adapter proposes only and binds latest MVU reads to its own scope',()=>{
 const sandbox={window:{},Mvu:{getMvuData:options=>options,replaceMvuData:(_,options)=>options},TavernUI:{getContext:()=>({userName:'Fixture'}),proposeMessage:value=>sandbox.proposal=value},__call:op=>op==='boundScope'?{mode:'initial',messageId:null}:'fixture-scope'}
 runInNewContext(identityLoaderBootstrap(IDENTITY_HTML_LOADER),sandbox)
 assert.equal(sandbox.window.__ST_HYPNOOS_ASSET_BASE__,IDENTITY_HTML_LOADER.assetBase)
 assert.equal(sandbox.window.Mvu.getMvuData({type:'message',message_id:'latest'}),null)
 assert.throws(()=>sandbox.window.Mvu.getMvuData({type:'message',message_id:'other'}),/bound/)
 assert.equal(sandbox.window.getContext().userName,'Fixture')
 const html='<script>function untouched(){}\n  async function insertOpeningWorldbooks(identity) { unknownWorldbookWrite(identity); }\n  function selectedCard() {}\n  function finishIdentitySelection(prompt) { unknownParentAction(prompt); }\n  $("#identitySelect").addEventListener("click",()=>{});</script>'
 const result=adaptIdentityHtml(html,{kind:'identity-html-loader',htmlSha256:sourceSha256(html)})
 assert.ok(result.includes('__identityPropose(prompt)'));assert.ok(!result.includes('unknownParentAction'))
 assert.ok(result.includes('__identityOpening('));assert.ok(!result.includes('unknownWorldbookWrite'))
 assert.throws(()=>adaptIdentityHtml(html+'changed',{kind:'identity-html-loader',htmlSha256:sourceSha256(html)}),/source changed/)
})
test('identity MVU wrapper retains the original facade through the real virtual window global proxy',async()=>{
 const calls=[],sandbox=createContext({__host:raw=>{const {op,args}=JSON.parse(raw);if(op==='boundScope')return JSON.stringify({value:{mode:'initial',messageId:null}});if(op==='cardStorageScope')return JSON.stringify({value:'fixture'});if(op==='variables'){calls.push({op,args});return JSON.stringify({value:{stat_data:{fixture:true}}})}if(op==='variableWrite'){calls.push({op,args});return JSON.stringify({value:null})}return JSON.stringify({value:null})}})
 const bundled=await build({entryPoints:[new URL('../packages/client/src/play/virtual-dom-entry.js',import.meta.url).pathname],bundle:true,write:false,format:'iife',platform:'browser'})
 runInContext(bundled.outputFiles[0].text,sandbox);runInContext(VIRTUAL_DOM_BOOTSTRAP,sandbox);runInContext(identityLoaderBootstrap(IDENTITY_HTML_LOADER),sandbox)
 assert.equal(runInContext('Mvu===window.Mvu',sandbox),true)
 assert.deepEqual(JSON.parse(runInContext("JSON.stringify(Mvu.getMvuData({type:'message',message_id:'latest'}))",sandbox)),{stat_data:{fixture:true}})
 const write=runInContext("Mvu.replaceMvuData({stat_data:{fixture:false}},{type:'message',message_id:'latest'})",sandbox)
 assert.equal(calls.length,2);assert.equal(calls[0].op,'variables');assert.equal(calls[0].args[0],null);assert.equal(calls[1].op,'variableWrite');assert.equal(calls[1].args[3],null)
 runInContext(`__writeResult(${calls[1].args[0]},{variables:{fixture:'ack'}})`,sandbox);assert.deepEqual(JSON.parse(JSON.stringify(await write)),{fixture:'ack'})
 assert.throws(()=>runInContext("Mvu.getMvuData({type:'message',message_id:'foreign'})",sandbox),/bound/);assert.throws(()=>runInContext("Mvu.replaceMvuData({},{type:'global'})",sandbox),/bound/);assert.equal(calls.length,2)
})
test('drafts persist by exact source and session, while disposed generations cannot write',()=>{
 const values=new Map(),storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)}
 const args={storage,owners:['character:fixture'],scopeKey:'session-A:greeting-1',sourceIdentity:'source'}
 const first=createCardScopedStorage(args);first.request({revision:1,operation:'set',key:'__proto__',value:'safe'});first.dispose()
 assert.throws(()=>first.request({revision:2,operation:'clear'}),/expired/)
 assert.deepEqual(createCardScopedStorage(args).initial.entries,[['__proto__','safe']])
 for(const change of [{scopeKey:'session-B:greeting-1'},{sourceIdentity:'changed'},{owners:['character:other']}])assert.deepEqual(createCardScopedStorage({...args,...change}).initial.entries,[])
 const second=createCardScopedStorage(args)
 assert.throws(()=>second.request({revision:2,operation:'clear'}),/revision/)
 assert.throws(()=>second.request({revision:1,operation:'set',key:'big',value:'x'.repeat(65537)}),/Invalid/)
})
test('storage caps UTF-8 bytes per value and bounds raw persisted JSON before parsing',()=>{
 const values=new Map(),storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)}
 const args={storage,owners:['character:fixture'],scopeKey:'session-A:greeting-1',sourceIdentity:'source'}
 const scoped=createCardScopedStorage(args)
 scoped.request({revision:1,operation:'set',key:'value',value:'汉'.repeat(21845)})
 assert.throws(()=>scoped.request({revision:2,operation:'set',key:'value',value:'汉'.repeat(21846)}),/Invalid/)
 assert.equal(createCardScopedStorage(args).initial.entries[0][1].length,21845)
 const key=[...values.keys()][0]
 values.set(key,'['+' '.repeat(128*1024))
 assert.throws(()=>createCardScopedStorage(args),/exceeds 128 KiB/)
 values.set(key,JSON.stringify([['value','汉'.repeat(44000)]]))
 assert.throws(()=>createCardScopedStorage(args),/exceeds 128 KiB/)
})
