import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import {cardViewport,cardRootPresentation,usesCardViewport} from '../packages/client/src/play/card-viewport.js'
import {VIRTUAL_DOM_BOOTSTRAP} from '../packages/client/src/play/virtual-dom-runtime.js'

test('viewport reads remain scalar, readonly and current within the guest window',()=>{
 let value={width:320,height:600},events=[]
 const sandbox=vm.createContext({__TavernDOM:{Element:class{},Event:class{constructor(type){this.type=type}},parseHTML:()=>({window:{dispatchEvent:event=>events.push(event.type)},document:{getElementById:()=>null,createElement:()=>null}})},__host:raw=>{assert.equal(JSON.parse(raw).op,'viewport');return JSON.stringify({value})}})
 vm.runInContext(VIRTUAL_DOM_BOOTSTRAP,sandbox)
 assert.deepEqual(JSON.parse(vm.runInContext('JSON.stringify([innerWidth,window.innerWidth,innerHeight,window.innerHeight])',sandbox)),[320,320,600,600])
 vm.runInContext('window.innerWidth=999;innerHeight=999',sandbox)
 assert.equal(vm.runInContext('window.innerWidth',sandbox),320)
 value={width:390,height:720};vm.runInContext('__viewportChanged()',sandbox)
 assert.deepEqual(events,['resize']);assert.equal(vm.runInContext('innerHeight',sandbox),720)
 assert.equal(vm.runInContext('typeof parent',sandbox),'undefined')
})
test('host viewport and root presentation accept only bounded presentation values',()=>{
 assert.deepEqual(cardViewport({width:320,height:600,parent:'discarded'}),{width:320,height:600})
 for(const value of [null,{}, {width:0,height:600},{width:1.5,height:600},{width:320,height:16385}])assert.throws(()=>cardViewport(value),/unavailable/)
 assert.deepEqual(cardRootPresentation(),{html:{className:'',style:''},body:{className:'',style:''}})
 assert.throws(()=>cardRootPresentation({html:{className:'a'.repeat(4097)}}),/presentation/)
 assert.throws(()=>cardRootPresentation({body:{style:{}}}),/presentation/)
 for(const root of [null,[],1])assert.throws(()=>cardRootPresentation(root),/presentation/)
 const root=cardRootPresentation({html:{className:'theme',style:'--accent:red'},body:{style:'margin:0'}})
 assert.equal(usesCardViewport('<div style="position:fixed">', '',root),true)
 assert.equal(usesCardViewport('', '.surface{height:100dvh}',root),true)
 assert.equal(usesCardViewport('<div>Flow</div>', '',root),false)
})
