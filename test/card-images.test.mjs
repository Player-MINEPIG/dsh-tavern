import test from 'node:test'
import assert from 'node:assert/strict'
import {createImagePool,imageSource,imageCss,rasterHeader,fetchImage,IMAGE_LIMITS} from '../packages/client/src/play/card-images.js'
const url = n => `https://images.example.com/${n}.png`
const settle = () => new Promise(resolve=>setImmediate(resolve))

test('6000 inert image references do not fetch; visible leases share a four-request pool and cancel queued/in-flight work',async()=>{
  const fixture=Array.from({length:6000},(_,i)=>url(i));let calls=[],maximum=0,active=0
  const pool=createImagePool({load:(source,signal)=>new Promise((resolve,reject)=>{
    calls.push(source);maximum=Math.max(maximum,++active)
    signal.addEventListener('abort',()=>{active--;reject(Error('aborted'))},{once:true})
  })})
  assert.equal(fixture.length,6000);assert.equal(calls.length,0)
  const leases=fixture.slice(0,32).map(source=>pool.acquire(source));for(const lease of leases)lease.promise.catch(()=>{})
  await settle();assert.equal(calls.length,4);assert.equal(maximum,4);assert.throws(()=>pool.acquire(fixture[32]),/VISIBLE/)
  for(const lease of leases)lease.release()
  await settle();assert.equal(pool.stats().active,0);assert.equal(pool.stats().entries,0);assert.equal(calls.length,4)
  pool.dispose()
})
test('cache deduplicates, charges decoded pixels, evicts least recently used unpinned entries and rejects oversized results',async()=>{
  let calls=0
  const limits={...IMAGE_LIMITS,entries:3,bytes:12,visible:8}
  const pool=createImagePool({limits,load:async source=>{calls++;return {data:source,bytes:4}}})
  const read=async source=>{const lease=pool.acquire(source);await lease.promise;lease.release()}
  await read(url(0));await read(url(1));await read(url(2));await read(url(0));assert.equal(calls,3)
  await read(url(3));await read(url(0));assert.equal(calls,4)
  await read(url(1));assert.equal(calls,5);assert.ok(pool.stats().bytes<=12);assert.ok(pool.stats().entries<=3)
  pool.dispose()
  const large=createImagePool({limits,load:async()=>({data:'x',bytes:13})});const lease=large.acquire(url(1));await assert.rejects(lease.promise,/BYTES/);lease.release();large.dispose()
})
test('cancellation rejects a stale generation even when its loader ignores abort, and a replacement lease stays valid',async()=>{
  const resolvers=[];const pool=createImagePool({load:()=>new Promise(resolve=>resolvers.push(resolve))})
  const first=pool.acquire(url(0));first.promise.catch(()=>{});await settle();first.release()
  const next=pool.acquire(url(0));await settle();resolvers[0]({data:'old',bytes:4});resolvers[1]({data:'new',bytes:4})
  assert.equal((await next.promise).data,'new');await settle();assert.equal(pool.stats().entries,1);assert.equal(pool.stats().bytes,4);next.release();pool.dispose()
})
test('image URLs never grant local, credentials, insecure, arbitrary protocol or relative network access',()=>{
  for(const source of ['http://images.example.com/a','https://127.0.0.1/a','https://2130706433/a','https://[::1]/a','https://a.local/a','https://a.internal/a','https://localhost/a','https://u:p@images.example.com/a','https://images.example.com:444/a','file:///a','javascript:1','/image.png','data:image/svg+xml;base64,AA=='])assert.equal(imageSource(source),null,source)
  assert.equal(imageSource(url(0)),url(0))
})
test('CSS background URLs become inert placeholders; other resource slots, escapes, imports and SVG are closed',()=>{
  const css=`.cover{width:100px;background:linear-gradient(red,blue),url("${url(1)}") center/cover}`
  const safe=imageCss(css);assert.ok(safe.includes('width:100px'));assert.ok(safe.includes('var(--dtv-img-'));assert.ok(!safe.includes(url(1)));assert.equal(imageCss(safe),safe)
  const alias=imageCss(`--identity-cover-image:url(${url(1)})`);assert.ok(alias.includes('var(--dtv-img-'));assert.equal(imageCss(alias),alias)
  for(const css of [`@import "${url(0)}";p{color:red}`,`@font-face{src:url(${url(0)})}`,`p{cursor:url(${url(0)}),auto}`,`p{background:image-set(url(${url(0)}) 1x)}`,`p{background:u\\72l(${url(0)})}`,`p{background:url(data:image/svg+xml;base64,AA==)}`])assert.equal(imageCss(css),'',css)
})
test('pixel checks happen before decoding and animated PNG/WebP/GIF or disguised SVG cannot reach a decoder',()=>{
  const png=Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=','base64'))
  assert.deepEqual(rasterHeader(png),{width:1,height:1,mime:'image/png'})
  const huge=png.slice();new DataView(huge.buffer).setUint32(16,8193);assert.throws(()=>rasterHeader(huge),/PIXELS/)
  const animated=new Uint8Array(png.length+12);animated.set(png.subarray(0,33));animated.set(Buffer.from('acTL'),37);animated.set(png.subarray(33),45);assert.throws(()=>rasterHeader(animated),/ANIMATION/)
  assert.throws(()=>rasterHeader(new Uint8Array(IMAGE_LIMITS.imageBytes+1)),/BYTES/)
  assert.throws(()=>rasterHeader(new TextEncoder().encode('<svg width="1" height="1"/>')),/FORMAT/)
})

test('trusted fetch rejects redirects, MIME mismatch and oversized headers/streamed bytes without a decoder',async()=>{
  const original=globalThis.fetch,controller=new AbortController();let options,reads=0
  try{
    globalThis.fetch=async(source,init)=>{options=init;return new Response('<svg/>',{headers:{'content-type':'image/svg+xml'}})}
    await assert.rejects(fetchImage(url(0),controller.signal),/FORMAT/)
    assert.deepEqual({mode:options.mode,credentials:options.credentials,redirect:options.redirect,referrerPolicy:options.referrerPolicy,cache:options.cache},{mode:'cors',credentials:'omit',redirect:'error',referrerPolicy:'no-referrer',cache:'no-store'})
    globalThis.fetch=async()=>({ok:true,redirected:true,headers:new Headers()})
    await assert.rejects(fetchImage(url(0),controller.signal),/NETWORK/)
    globalThis.fetch=async()=>new Response('',{headers:{'content-type':'image/png','content-length':String(IMAGE_LIMITS.imageBytes+1)}})
    await assert.rejects(fetchImage(url(0),controller.signal),/BYTES/)
    globalThis.fetch=async()=>new Response(new ReadableStream({pull(c){reads++;c.enqueue(new Uint8Array(IMAGE_LIMITS.imageBytes));if(reads>1)c.close()}}),{headers:{'content-type':'image/png'}})
    await assert.rejects(fetchImage(url(0),controller.signal),/BYTES/)
    assert.equal(reads,2)
  }finally{globalThis.fetch=original}
})
test('a bounded source whose browser PNG expands is resized before injection, with output pixels charged and decoder closed',async()=>{
  const previous={bitmap:globalThis.createImageBitmap,document:globalThis.document},draws=[];let closed=0
  const png=Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=','base64'))
  new DataView(png.buffer).setUint32(16,1000);new DataView(png.buffer).setUint32(20,1370)
  globalThis.createImageBitmap=async()=>({width:1000,height:1370,close(){closed++}})
  globalThis.document={createElement(){return{width:0,height:0,getContext(){return{drawImage:(_image,_x,_y,width,height)=>draws.push([width,height])}},toDataURL(){return this.width>700?'data:image/png;base64,'+'A'.repeat(IMAGE_LIMITS.cssChars):'data:image/png;base64,AAAA'}}}}
  try{
    const result=await fetchImage('data:image/png;base64,'+Buffer.from(png).toString('base64'),new AbortController().signal)
    assert.deepEqual(draws,[[1000,1370],[800,1096],[640,876]]);assert.equal(result.width,640);assert.equal(result.height,876)
    assert.equal(result.bytes,result.data.length*2+640*876*4);assert.ok(result.data.length+16<=IMAGE_LIMITS.cssChars);assert.equal(closed,1)
  }finally{if(previous.bitmap===undefined)delete globalThis.createImageBitmap;else globalThis.createImageBitmap=previous.bitmap;if(previous.document===undefined)delete globalThis.document;else globalThis.document=previous.document}
})
