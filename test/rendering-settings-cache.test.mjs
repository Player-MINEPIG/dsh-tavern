import test from 'node:test'
import assert from 'node:assert/strict'
import {parseHTML} from 'linkedom'
import {createElement as h,act} from 'react'
import {createRoot} from 'react-dom/client'
import {Simulate} from 'react-dom/test-utils'
import {RenderingSettings} from '../packages/client/src/rendering-settings.js'
import {renderingDependencies} from '../packages/client/src/play/rendering-dependencies.js'
import {getClientUiSettings,setClientUiSettings} from '../packages/client/src/i18n.js'

const url='https://cdn.jsdelivr.net/gh/MagicalAstrogy/MagVarUpdate/artifact/bundle.js'

test('cache actions disappear when empty and report successful clearing without removing local MVU',async t=>{
 const saved=Object.fromEntries(['window','document','IS_REACT_ACT_ENVIRONMENT'].map(key=>[key,globalThis[key]])),settings=getClientUiSettings()
 const {window,document}=parseHTML('<html><body><div id="root"></div></body></html>')
 Object.assign(globalThis,{window,document,IS_REACT_ACT_ENVIRONMENT:true});setClientUiSettings({locale:'en',scale:1},{announce:false})
 let graph={status:'ready',complete:true,items:[{url,key:url,status:'ready',builtin:true}],retained:[]},removed=0
 const listeners=new Set(),originals=Object.fromEntries(['inspect','sync','subscribe','uninstall'].map(key=>[key,renderingDependencies[key]]))
 Object.assign(renderingDependencies,{
  inspect:()=>graph,sync:async()=>{},subscribe:listener=>{listeners.add(listener);return()=>listeners.delete(listener)},
  uninstall:async owner=>{assert.equal(owner,'character:fixture');removed++;graph={...graph,retained:[]};for(const listener of listeners)listener()},
 })
 const root=createRoot(document.getElementById('root')),container=document.getElementById('root')
 t.after(async()=>{await act(()=>root.unmount());Object.assign(renderingDependencies,originals);setClientUiSettings(settings,{announce:false});for(const [key,value] of Object.entries(saved)){if(value===undefined)delete globalThis[key];else globalThis[key]=value}})
 const client={getCharacter:async()=>({first_mes:`<script type="module">import '${url}';</script>`}),getFile:async()=>({content:'{"schemaVersion":1,"rules":[]}'})}
 const props={client,activeSnapshot:{selection:{characterCardId:'fixture'}},update(){}}
 const button=text=>[...container.querySelectorAll('button')].find(element=>element.textContent===text)
 const refresh=async()=>act(async()=>{for(const listener of listeners)listener();await new Promise(resolve=>setImmediate(resolve))})
 await act(async()=>{root.render(h(RenderingSettings,props));await new Promise(resolve=>setImmediate(resolve))})
 assert.match(container.textContent,/Built-in MVU/)
 assert.ok(!button('Clear downloaded cache'),'shipped local capabilities have no downloaded cache to clear')
 graph={...graph,retained:[{url,content:'old original source'}]};await refresh()
 assert.ok(button('Clear downloaded cache'))
 await act(async()=>{Simulate.click(button('Clear downloaded cache'));await new Promise(resolve=>setImmediate(resolve))})
 assert.equal(removed,1);assert.ok(!button('Clear downloaded cache'))
 assert.match(container.textContent,/Downloaded cache cleared/)
 assert.match(container.textContent,/Built-in MVU/,'clearing downloads retains shipped local capabilities')
 graph={...graph,status:'downloading',complete:false};await refresh()
 assert.ok(button('Cancel download'),'an unfinished download remains cancellable before any bytes arrive')
})
