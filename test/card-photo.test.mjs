import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import * as DOM from 'linkedom'
import {readFileSync} from 'node:fs'
import {VIRTUAL_DOM_BOOTSTRAP} from '../packages/client/src/play/virtual-dom-runtime.js'
import {selectedPhoto,PHOTO_LIMITS} from '../packages/client/src/play/card-photo.js'
import {rasterHeader} from '../packages/client/src/play/card-images.js'

test('VM photo compatibility handles only the current selected JPEG and never native canvas/network/file objects',()=>{
 const timers=[],calls=[],context=vm.createContext({__TavernDOM:DOM,__host:raw=>{const value=JSON.parse(raw);calls.push(value);if(value.op==='timer')timers.push(value.args);return JSON.stringify({value:null})}})
 vm.runInContext(VIRTUAL_DOM_BOOTSTRAP,context)
 vm.runInContext(`document.body.innerHTML='<input id="photo" type="file"><output id="status"></output>';__view();globalThis.node=document.getElementById('photo');node.addEventListener('change',event=>{globalThis.file=event.target.files[0];const reader=new FileReader();reader.onload=()=>{const image=new Image();image.onload=()=>{const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);document.getElementById('status').textContent=canvas.toDataURL('image/jpeg',.82)};image.src=reader.result};reader.readAsDataURL(file)});__domEvent({type:'change',target:Number(node.getAttribute('data-dtv-node')),photo:{type:'image/jpeg',data:'data:image/jpeg;base64,AAAA',width:640,height:400,size:3}})`,context)
 while(timers.length){const[id]=timers.shift();vm.runInContext(`__tick(${id},false)`,context)}
 assert.equal(vm.runInContext(`document.getElementById('status').textContent`,context),'data:image/jpeg;base64,AAAA')
 assert.equal(vm.runInContext('file.name',context),'selected-photo.jpg');assert.equal(vm.runInContext('file.path',context),undefined)
 assert.throws(()=>vm.runInContext(`document.createElement('canvas').toDataURL('image/jpeg',.82)`,context),/selected-photo/)
 vm.runInContext(`globalThis.bad=new FileReader();bad.readAsDataURL({type:'image/jpeg',path:'/private/photo'});`,context)
 assert.equal(vm.runInContext('bad.result',context),null);assert.match(vm.runInContext('bad.error.message',context),/current selected photo/)
 vm.runInContext(`globalThis.arbitrary=new Image();arbitrary.src='https://images.example.com/private.png'`,context)
 assert.equal(vm.runInContext('arbitrary.naturalWidth',context),0)
 assert.ok(!calls.some(call=>/fetch|file|canvas|path/.test(call.op)))
})
test('photo requests need a fresh trusted click task; file change and synthetic clicks cannot acquire a picker',()=>{
 const source=readFileSync(new URL('../packages/client/src/play/card-worker-client.js',import.meta.url),'utf8').replace('export function','function')
 let worker,id=0,called=0;const posts=[],errors=[]
 class Worker{constructor(){worker=this}postMessage(value){posts.push(value)}terminate(){}}
 const create=new Function('TAVERN_CARD_WORKER_SOURCE','Worker','URL','Blob','crypto','setTimeout','clearTimeout',source+';return createVirtualCardRuntime')('',Worker,{createObjectURL:()=>'',revokeObjectURL(){}},class{},{randomUUID:()=>String(++id)},()=>0,()=>{})
 const runtime=create({},{onPhotoPick:()=>called++,onError:error=>errors.push(error.message)})
 let requestId=0
 const request=()=>worker.onmessage({data:{nonce:posts[0].nonce,kind:'photoPick',value:{requestId:++requestId,id:1,view:{html:'',styles:''},taskId:posts.at(-1).taskId}}})
 runtime.dispatch({type:'click'},{trusted:false});request();assert.equal(called,0)
 runtime.dispatch({type:'change'},{trusted:true});request();assert.equal(called,0)
 runtime.dispatch({type:'click'},{trusted:true});request();request();assert.equal(called,1)
 runtime.dispose();request();assert.equal(called,1);assert.deepEqual(errors,[])
})
test('selected photo has separate source limits and rejects format/bytes/pixels before native decoding',async()=>{
 const png=Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=','base64'))
 const huge=png.slice();new DataView(huge.buffer).setUint32(16,3000);new DataView(huge.buffer).setUint32(20,3000)
 assert.throws(()=>rasterHeader(huge,PHOTO_LIMITS),/PIXELS/)
 for(const file of [{size:PHOTO_LIMITS.imageBytes+1,type:'image/png'},{size:6,type:'image/svg+xml'},{size:huge.length,type:'image/png',arrayBuffer:async()=>huge.buffer}])await assert.rejects(selectedPhoto(file,new AbortController().signal),/FORMAT|PIXELS/)
 const controller=new AbortController();controller.abort()
 await assert.rejects(selectedPhoto({size:png.length,type:'image/png',arrayBuffer:async()=>png.buffer},controller.signal),/abort/i)
})
