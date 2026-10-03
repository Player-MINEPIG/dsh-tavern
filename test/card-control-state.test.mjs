import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import {parseHTML} from 'linkedom'
import * as DOM from 'linkedom/worker'
import {VIRTUAL_DOM_BOOTSTRAP} from '../packages/client/src/play/virtual-dom-runtime.js'
import {projectCardControlState,cardControlEventChecked} from '../packages/client/src/play/card-control-state.js'
import {createCardScopedStorage,CARD_STORAGE_RUNTIME} from '../packages/client/src/play/card-scoped-storage.js'
import {readFileSync} from 'node:fs'

test('a guest veto of a native toggle emits a correcting view even when its snapshot is unchanged',async()=>{
 const guest=vm.createContext({__TavernDOM:DOM}),messages=[]
 const interpreter={setProp:(_,key,value)=>guest[key]=value,newFunction:(_,fn)=>fn,newAsyncifiedFunction:()=>()=>{},getString:value=>value,newString:value=>value,typeof:value=>typeof value,evalCodeAsync:async code=>{const value=vm.runInContext(code,guest);return{value:{raw:value,dispose(){}}}}}
 interpreter.typeof=handle=>typeof handle.raw;interpreter.getString=handle=>typeof handle==='string'?handle:handle.raw
 interpreter.newFunction=(_,fn)=>Object.assign(fn,{dispose(){}});interpreter.newAsyncifiedFunction=()=>Object.assign(()=>{},{dispose(){}})
 interpreter.dump=()=>({});const runtime={setMemoryLimit(){},setMaxStackSize(){},setInterruptHandler(){},setModuleLoader(){},newContext:()=>interpreter,hasPendingJob:()=>false,computeMemoryUsage:()=>({dispose(){}})}
 const source=readFileSync(new URL('../packages/client/src/play/card-worker.js',import.meta.url),'utf8').replace(/^import[^\n]*\n/gm,'')
 const worker=vm.createContext({createAsyncJobDrain:()=>async()=>{},newQuickJSAsyncWASMModuleFromVariant:async()=>({newRuntime:()=>runtime}),variant:{},VIRTUAL_DOM_BOOTSTRAP,TAVERN_VIRTUAL_DOM_SOURCE:'',TAVERN_QUICKJS_VERSION:'fixture',crypto:globalThis.crypto,TextEncoder,performance,self:{postMessage:value=>messages.push(value),close(){}},setTimeout,clearTimeout})
 vm.runInContext(source,worker)
 worker.self.onmessage({data:{kind:'init',nonce:'fixture',html:'<input type="checkbox" id="veto">',runs:[{code:"document.getElementById('veto').addEventListener('click',event=>{event.target.checked=false})"}]}})
 for(let count=0;count<80&&!messages.some(message=>message.kind==='ready');count++)await new Promise(resolve=>setImmediate(resolve))
 assert.ok(messages.some(message=>message.kind==='ready'),JSON.stringify(messages))
 const before=messages.filter(message=>message.kind==='view');assert.equal(before.length,1)
 const target=JSON.parse(before[0].value).controls[0].id
 worker.self.onmessage({data:{kind:'event',nonce:'fixture',taskId:'native',controlSequence:1,value:{type:'click',target,checked:true}}})
 for(let count=0;count<40&&messages.filter(message=>message.kind==='view').length<2;count++)await new Promise(resolve=>setImmediate(resolve))
 const after=messages.filter(message=>message.kind==='view');assert.equal(after.length,2);assert.equal(after[1].value,before[0].value);assert.equal(after[1].controlSequence,1)
 worker.self.onmessage({data:{kind:'dispose',nonce:'fixture'}})
})

test('live radio and checkbox state survives virtual HTML snapshots without changing their defaults',()=>{
 const context=vm.createContext({__TavernDOM:DOM,__host:()=>JSON.stringify({value:null})})
 vm.runInContext(VIRTUAL_DOM_BOOTSTRAP,context)
 vm.runInContext(`document.body.innerHTML='<input type="radio" name="choice" id="default" checked><input type="radio" name="choice" id="other"><input type="checkbox" id="perk">'`,context)
 const initial=JSON.parse(vm.runInContext('__view()',context));assert.deepEqual(initial.controls.map(control=>control.checked),[true,false,false])
 vm.runInContext(`document.getElementById('default').checked=false;document.getElementById('other').checked=true;document.getElementById('perk').checked=true`,context)
 const view=JSON.parse(vm.runInContext('__view()',context)),{document}=parseHTML('<html><body>'+view.html+'</body></html>')
 const nodes=new Map([...document.querySelectorAll('[data-dtv-node]')].map(node=>[Number(node.getAttribute('data-dtv-node')),node]))
 assert.ok(document.getElementById('default').hasAttribute('checked'));assert.ok(!document.getElementById('other').hasAttribute('checked'))
 projectCardControlState(view.controls,nodes)
 assert.equal(document.getElementById('default').checked,false);assert.equal(document.getElementById('other').checked,true);assert.equal(document.getElementById('perk').checked,true)
 assert.ok(document.getElementById('default').hasAttribute('checked'));assert.ok(!document.getElementById('other').hasAttribute('checked'))
})
test('control projection rejects foreign nodes, non-checkbox inputs, duplicates and oversized snapshots before mutation',()=>{
 const {document}=parseHTML('<html><body><input id="radio" type="radio"><input id="text"><input id="file" type="file"></body></html>')
 const radio=document.getElementById('radio'),nodes=new Map([[1,radio],[2,document.getElementById('text')],[3,document.getElementById('file')]])
 radio.checked=false
 for(const invalid of [[{id:999,checked:true}],[{id:2,checked:true}],[{id:3,checked:true}],[{id:1,checked:1}],[{id:1,checked:true,grant:true}],[{id:1,checked:true},{id:1,checked:false}],Array.from({length:513},(_,id)=>({id:id+1,checked:false}))]){
  assert.throws(()=>projectCardControlState(invalid,nodes));assert.equal(radio.checked,false)
 }
 assert.throws(()=>projectCardControlState([{id:1,checked:true},{id:999,checked:false}],nodes));assert.equal(radio.checked,false)
})
test('controls-only corrections preserve connected nodes, focus and defaults without dispatching events',()=>{
 const {document}=parseHTML('<html><body><input id="veto" type="checkbox"><input id="default" name="choice" type="radio" checked><input id="other" name="choice" type="radio"></body></html>')
 const nodes=new Map([[1,document.getElementById('veto')],[2,document.getElementById('default')],[3,document.getElementById('other')]]),references=[...nodes.values()]
 let changes=0;for(const node of references)node.addEventListener('change',()=>changes++)
 references[0].checked=true;references[1].checked=false;references[2].checked=true
 projectCardControlState([{id:1,checked:false},{id:2,checked:true},{id:3,checked:false}],nodes,{connected:true})
 assert.deepEqual([...nodes.values()],references);assert.deepEqual(references.map(node=>node.checked),[false,true,false]);assert.equal(changes,0);assert.equal(references[1].hasAttribute('checked'),true)
 const template=document.createElement('template');template.innerHTML='<input type="checkbox">';const stale=template.content.firstChild
 projectCardControlState([{id:1,checked:true}],new Map([[1,stale]]),{preserve:nodes});assert.equal(stale.checked,false)
 assert.throws(()=>projectCardControlState([{id:1,checked:true}],new Map([[1,stale]]),{connected:true}));assert.equal(stale.checked,false)
})
test('a native click/input/change chain synchronizes checked once and independent keyboard input still synchronizes',()=>{
 const phases=new WeakMap(),node={checked:true}
 assert.equal(cardControlEventChecked('pointerdown',node,phases,0),undefined)
 assert.deepEqual(['click','input','change'].map((type,index)=>cardControlEventChecked(type,node,phases,index)),[true,undefined,undefined])
 node.checked=false;assert.deepEqual(['input','change'].map((type,index)=>cardControlEventChecked(type,node,phases,10+index)),[false,undefined])
 assert.equal(cardControlEventChecked('change',node,phases,20),false)
 assert.equal(cardControlEventChecked('click',node,phases,30),false);node.checked=true;assert.equal(cardControlEventChecked('input',node,phases,2000),true)
})
test('control corrections reject stale sequences, foreign generations and duplicates without elevating event authority',()=>{
 const source=readFileSync(new URL('../packages/client/src/play/card-worker-client.js',import.meta.url),'utf8').replace('export function','function')
 let worker;const posts=[],views=[],errors=[]
 class Worker{constructor(){worker=this}postMessage(value){posts.push(value)}terminate(){}}
 const create=new Function('TAVERN_CARD_WORKER_SOURCE','Worker','URL','Blob','crypto','setTimeout','clearTimeout',source+';return createVirtualCardRuntime')('',Worker,{createObjectURL:()=>'',revokeObjectURL(){}},class{},{randomUUID:()=> 'generation'},()=>0,()=>{})
 const runtime=create({},{onView:view=>views.push(view),onError:error=>errors.push(error.message)}),view=JSON.stringify({html:'<input type="checkbox">',styles:'',controls:[{id:1,checked:false}]})
 const emit=(controlSequence,nonce='generation')=>worker.onmessage({data:{kind:'view',nonce,controlSequence,value:view}})
 emit(0);runtime.dispatch({type:'click',target:1,checked:true},{trusted:false,control:true});emit(0);emit(1,'other-generation');emit(1);emit(1)
 assert.equal(views.length,2);assert.equal(posts.at(-1).controlSequence,1);assert.equal(posts.at(-1).kind,'event');assert.ok(!Object.hasOwn(posts.at(-1),'trusted'))
 runtime.dispatch({type:'change',target:1,checked:true},{trusted:true,control:true});emit(1);emit(2);assert.equal(views.length,3)
 runtime.dispose();emit(2);assert.equal(views.length,3);assert.deepEqual(errors,[])
})
test('scoped WebStorage preserves raw strings and JSON strings through its internal JSON envelope',()=>{
 const rows=new Map(),storage={getItem:key=>rows.get(key)??null,setItem:(key,value)=>rows.set(key,value)},options={storage,owners:['character:fixture'],scopeKey:'fixture',sourceIdentity:'source'}
 let host=createCardScopedStorage(options),revision=0
 const context=vm.createContext({window:{},__call:()=>host.initial.entries,__cardStorage:raw=>{host.request({...JSON.parse(raw),revision:++revision});return JSON.stringify({revision})}})
 vm.runInContext(CARD_STORAGE_RUNTIME,context)
 vm.runInContext(`localStorage.setItem('choice','police_done');localStorage.setItem('draft','{"name":"Fixture"}');localStorage.setItem('numeric',17)`,context)
 assert.equal(vm.runInContext(`localStorage.getItem('choice')`,context),'police_done');assert.equal(vm.runInContext(`localStorage.getItem('draft')`,context),'{"name":"Fixture"}');assert.equal(vm.runInContext(`localStorage.getItem('numeric')`,context),'17');assert.equal(vm.runInContext(`localStorage.getItem('missing')`,context),null)
 host.dispose();host=createCardScopedStorage(options)
 assert.deepEqual(host.initial.entries,[['choice','police_done'],['draft','{"name":"Fixture"}'],['numeric','17']])
})
