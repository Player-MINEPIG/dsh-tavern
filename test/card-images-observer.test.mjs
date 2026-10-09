import test from 'node:test'
import assert from 'node:assert/strict'
import {observeImages,imageCss} from '../packages/client/src/play/card-images.js'

test('6000 DOM pseudo URLs stay inert until generated visible paint; hiding releases leases and visible host reuse remains valid',async()=>{
 const saved=Object.fromEntries(['document','window','IntersectionObserver','MutationObserver','requestAnimationFrame'].map(key=>[key,globalThis[key]]))
 const noop=()=>{},frames=[],targets=new Set(),acquired=[],live=new Set();let intersection
 const base={display:'block',visibility:'visible',opacity:'1',backgroundImage:'none',transform:'none',translate:'none',rotate:'none',scale:'none',position:'static',content:'none',width:'120px',height:'80px',minWidth:'0px',minHeight:'0px',maxWidth:'none',maxHeight:'none',top:'auto',right:'auto',bottom:'auto',left:'auto',getPropertyValue:()=>'',*[Symbol.iterator](){}}
 for(const property of ['marginTop','marginRight','marginBottom','marginLeft','paddingTop','paddingRight','paddingBottom','paddingLeft','borderTopWidth','borderRightWidth','borderBottomWidth','borderLeftWidth'])base[property]='0px'
 const doc={hidden:false,documentElement:{clientWidth:1000,clientHeight:1000},addEventListener:noop,removeEventListener:noop}
 const hosts=Array.from({length:6000},(_,n)=>{
  const source=`https://images.example.com/pseudo-${n}.png`,url=imageCss(`background:url("${source}")`).match(/url\("([^"]+)"\)/)[1],properties=new Map(),attrs=new Map()
  return{localName:'div',ownerDocument:doc,parentElement:null,isConnected:true,pseudo:'none',normal:false,source,url,properties,attrs,rejectStyle:false,rejectCascade:false,style:{removeProperty:key=>properties.delete(key),getPropertyValue:key=>properties.get(key)??'',getPropertyPriority:()=>'',setProperty(key,value){if(!hosts[n].rejectStyle)properties.set(key,value)}},getRootNode:()=>doc,getBoundingClientRect:()=>({left:0,top:0,right:120,bottom:80,width:120,height:80}),setAttribute:(key,value)=>attrs.set(key,value),removeAttribute:key=>attrs.delete(key)}
 })
 const background=host=>host.rejectCascade?`url("${host.url}")`:[...host.properties.values()][0]??`url("${host.url}")`
 const win={addEventListener:noop,removeEventListener:noop,getComputedStyle:(host,pseudo)=>pseudo==='::before'?{...base,display:host.pseudo,content:'""',backgroundImage:background(host)}:{...base,backgroundImage:host.normal?background(host):'none'}};doc.defaultView=win
 const root={ownerDocument:doc,querySelectorAll:selector=>selector==='*'?hosts:[]}
 const pool={subscribe:()=>noop,acquire(source){acquired.push(source);const token={};live.add(token);return{promise:Promise.resolve({data:'data:image/png;base64,AAAA'}),release:()=>live.delete(token)}}}
 globalThis.document=doc;globalThis.window=win
 globalThis.requestAnimationFrame=callback=>{frames.push(callback);return 1}
 globalThis.IntersectionObserver=class{constructor(callback){intersection=callback}observe(host){targets.add(host)}unobserve(host){targets.delete(host)}disconnect(){targets.clear()}}
 globalThis.MutationObserver=class{observe(){}disconnect(){}}
 const flush=async()=>{intersection([...targets].map(target=>({target,isIntersecting:true,intersectionRect:{width:120,height:80}})));for(let n=0;n<8;n++){await Promise.resolve();if(!frames.length)break;frames.shift()()}}
 let controller
 try{
  controller=observeImages(root,{pool});await flush();assert.equal(acquired.length,0);assert.equal(live.size,0)
  hosts[0].pseudo='block';controller.refresh();await flush();assert.deepEqual(acquired,[hosts[0].source]);assert.equal(live.size,1)
  hosts[0].pseudo='none';controller.refresh();await flush();assert.equal(live.size,0)
  hosts[0].pseudo='block';hosts[0].childNodes=[{}];controller.refresh();await flush();assert.equal(live.size,0,'unknown generated-box position from host content must fail closed');hosts[0].childNodes=[];hosts[0].pseudo='none'
  hosts[0].normal=true;controller.refresh();await flush();assert.equal(live.size,1);assert.equal(acquired.at(-1),hosts[0].source)
  hosts[1].normal=true;hosts[1].rejectStyle=true;controller.refresh();await flush();assert.equal(live.size,1);assert.equal(hosts[1].attrs.get('data-dtv-image-state'),'failed');assert.equal(hosts[1].attrs.get('data-dtv-image-error'),'IMAGE_CSS');assert.equal(hosts[1].properties.size,0)
  hosts[2].normal=true;hosts[2].rejectCascade=true;controller.refresh();await flush();assert.equal(live.size,1);assert.equal(hosts[2].attrs.get('data-dtv-image-state'),'failed');assert.equal(hosts[2].attrs.get('data-dtv-image-error'),'IMAGE_CSS');assert.equal(hosts[2].properties.size,0)
 }finally{controller?.dispose();for(const[key,value]of Object.entries(saved))if(value===undefined)delete globalThis[key];else globalThis[key]=value}
 assert.equal(live.size,0)
})
