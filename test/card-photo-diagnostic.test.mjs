import test from 'node:test'
import assert from 'node:assert/strict'
import {createPhotoPickerDiagnostic} from '../packages/client/src/play/card-photo-diagnostic.js'

function fixture() {
 let observer,output,inputs=[]
 const parent={createElement(){output={hidden:false,setAttribute(){},remove(){this.removed=true},textContent:''};return output}}
 const container={ownerDocument:parent,append(){}}
 const doc={defaultView:{MutationObserver:class{constructor(callback){this.callback=callback;observer=this}observe(){}disconnect(){this.stopped=true}}},body:{contains:node=>inputs.includes(node),querySelectorAll:()=>inputs}}
 const input=()=>{
  const listeners=new Map(),node={ownerDocument:doc,localName:'input',type:'file',isConnected:true,
   addEventListener(type,callback){listeners.set(type,callback)},removeEventListener(type){listeners.delete(type)},
   event(type,isTrusted){listeners.get(type)?.({isTrusted})},get listenerCount(){return listeners.size}}
  for(const name of ['files','value','name','id','accept','dataset'])Object.defineProperty(node,name,{get(){throw Error('private field read')}})
  return node
 }
 const diagnostic=createPhotoPickerDiagnostic(doc,container)
 return {diagnostic,input,observer,output,setInputs(value){inputs=value},report(){return JSON.parse(output.textContent)}}
}

test('same owned input keeps an opaque token; replaced pending input reports disconnected identity',()=>{
 const f=fixture(),first=f.input();f.setInputs([first]);f.diagnostic.view({reused:false,htmlChars:10,styleChars:20});f.diagnostic.pick(first);f.diagnostic.clickReturned()
 const token=f.report().events.at(-1).picked.token
 f.diagnostic.view({reused:true,htmlChars:10,styleChars:20});assert.equal(f.report().events.at(-1).inputs[0].token,token)
 f.diagnostic.beforeReplace({htmlChanged:true});const second=f.input();first.isConnected=false;f.setInputs([second]);f.diagnostic.view({reused:false,htmlChanged:true});f.observer.callback()
 const report=f.report();assert.equal(report.stats.replacements,2);assert.equal(report.events.at(-1).kind,'picked-connectivity');assert.equal(report.events.at(-1).picked.connected,false);assert.equal(report.events.at(-1).picked.token,token);assert.notEqual(report.events.at(-1).inputs[0].token,token)
 // A detached object's own listener can observe a trusted change even when the
 // application's body listener would never receive that event.
 first.event('change',true);assert.equal(f.report().stats.trustedChanges,1);assert.equal(first.listenerCount,0)
 f.diagnostic.dispose();assert.equal(f.output.removed,true);assert.equal(f.observer.stopped,true)
})
test('diagnostics copy only fixed fields, bound history and never read files or metadata',()=>{
 const f=fixture(),node=f.input();f.setInputs(Array.from({length:20},()=>f.input()));f.setInputs([node,...Array.from({length:20},()=>f.input())]);f.diagnostic.pick(node)
 const privateText='PRIVATE_HTML_CSS_URL_PATH_FILENAME'
 for(let i=0;i<100;i++)f.diagnostic.view({reused:true,htmlChars:100,styleChars:50,html:privateText,styles:privateText,hash:privateText,root:privateText})
 const report=f.report();assert.equal(report.events.length,64);assert.ok(report.dropped>0);assert.equal(report.events.at(-1).inputs.length,16);assert.doesNotMatch(f.output.textContent,/PRIVATE|html"|styles"|hash"|root"|name"|path"|files"|value"/)
 node.event('change',false);assert.equal(f.report().stats.trustedChanges,0);assert.equal(f.report().stats.syntheticChanges,1);assert.equal(node.listenerCount,2)
 node.event('cancel',false);assert.equal(f.report().stats.cancels,0)
 node.event('cancel',true);assert.equal(f.report().stats.cancels,1);assert.equal(node.listenerCount,0)
 f.diagnostic.dispose();const before=f.output.textContent;f.diagnostic.view({});f.observer.callback();assert.equal(f.output.textContent,before)
})
test('diagnostic output is hidden and observation never changes event flow',()=>{
 const f=fixture(),node=f.input();f.setInputs([node]);assert.equal(f.output.hidden,true)
 f.diagnostic.pick(node);const event={isTrusted:true,stopPropagation(){throw Error('event flow changed')},preventDefault(){throw Error('event flow changed')}}
 // The receiver reads isTrusted only. Guest exception details cannot enter it.
 node.event('change',event.isTrusted);assert.equal(f.report().events.at(-1).kind,'trusted-change')
 f.diagnostic.rejected('PRIVATE_ERROR');assert.doesNotMatch(f.output.textContent,/PRIVATE_ERROR/)
 f.diagnostic.dispose()
})
