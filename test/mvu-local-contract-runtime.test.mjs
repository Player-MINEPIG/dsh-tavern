import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {parseHTML} from 'linkedom'
import {createRenderingDependencies} from '../packages/client/src/play/rendering-dependencies.js'
import {createRenderingTrust} from '../packages/client/src/play/rendering-trust.js'
import {mvuAdapter} from '../packages/client/src/play/mvu-builtins.js'
import {DEPENDENCY_LIMITS} from '../packages/client/src/play/rendering-limits.js'
import {discoverDependencies,isSideEffectModuleReference,externalUrl,loadWrapper,MAX_RENDER_SOURCE} from '../packages/client/src/play/rendering-sources.js'
import {commandHookDeclaration} from '../packages/mvu-adapter/src/command-hook-declaration.js'
import {spawnCardProbe,inputFor} from '../scripts/fixtures/card-worker-probe.mjs'

const raw=readFileSync(new URL('../packages/client/src/play/scripted-content.js',import.meta.url),'utf8')
const body=raw.slice(raw.indexOf('export function prepareCardDocument('),raw.indexOf('\nexport function createDomBridge(')).replace('export function','function')
const {document}=parseHTML('<html></html>')
const prepare=new Function('commandHookDeclaration','DEPENDENCY_LIMITS','discoverDependencies','isSideEffectModuleReference','externalUrl','loadWrapper','MAX_RENDER_SOURCE','document','cardDocument','mvuAdapter',body+';return prepareCardDocument')(commandHookDeclaration,DEPENDENCY_LIMITS,discoverDependencies,isSideEffectModuleReference,externalUrl,loadWrapper,MAX_RENDER_SOURCE,document,html=>({html,scripts:[],unsupported:[]}),mvuAdapter)
const url='https://cdn.jsdelivr.net/gh/MagicalAstrogy/MagVarUpdate/artifact/bundle.js',owner='character:offline-runtime'
const emptyStore={list:async()=>[],get:async()=>({generation:0}),readCurrent:async(_owner,_saved,accept)=>accept()}

for(const unsupported of [false,true])test(`local MVU reaches the packaged isolated runtime without remote code (unsupported=${unsupported})`,async t=>{
 const trust=createRenderingTrust(),dependencies=createRenderingDependencies({trust,store:emptyStore,channelFactory:()=>null,download:async()=>{throw Error('Upstream is offline')}});t.after(()=>dependencies.dispose())
 const code=`import '${url}'; await waitGlobalInitialized('Mvu'); ${unsupported?'Mvu.unsupportedNewApi();':"document.getElementById('o').textContent=String(Mvu.getMvuData().stat_data.hp);"}`
 const helper={owner,key:'helper',kind:'helper',enabled:true,content:code}
 await dependencies.sync([helper]);assert.equal(dependencies.inspect(owner).status,'ready')
 const data=prepare('<output id="o">Loading</output>',[owner],[helper],trust)
 assert.equal(data.modules[url],'globalThis.__initializeBuiltinMvu(1);')
 assert.equal(data.adapters[0].version,1);assert.equal(data.adapters[0].sha256,undefined)
 const probe=spawnCardProbe();t.after(()=>probe.close())
 probe.init(inputFor('',{html:data.html,runs:data.runs,modules:data.modules,variables:{status:'available',scope:{sessionId:'bound'},revision:1,variables:{stat_data:{hp:42}}}}))
 const result=await probe.waitFor(message=>message.kind==='error'||!unsupported&&message.kind==='ready')
 if(unsupported){assert.equal(result.kind,'error');assert.match(result.value,/CARD_EXECUTION_JS|unsupportedNewApi|not a function/)}
 else{assert.equal(result.kind,'ready');const view=JSON.parse(probe.messages.findLast(message=>message.kind==='view').value);assert.match(view.html,/>42<\/output>/)}
})
