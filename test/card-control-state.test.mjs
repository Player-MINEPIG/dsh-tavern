import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import {parseHTML} from 'linkedom'
import * as DOM from 'linkedom/worker'
import {VIRTUAL_DOM_BOOTSTRAP} from '../packages/client/src/play/virtual-dom-runtime.js'
import {projectCardControlState} from '../packages/client/src/play/card-control-state.js'
import {createCardScopedStorage,CARD_STORAGE_RUNTIME} from '../packages/client/src/play/card-scoped-storage.js'

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
