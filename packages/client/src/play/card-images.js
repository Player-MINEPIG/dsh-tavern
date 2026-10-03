// This module runs in the trusted renderer, never in QuickJS. Source discovery
// is inert; only visible img/CSS backgrounds acquire bounded, cancellable leases.
import { externalUrl } from './rendering-sources.js'

export const IMAGE_SOURCE_ATTRIBUTE = 'data-dtv-image-source'
export const IMAGE_LIMITS = Object.freeze({ concurrent: 4, visible: 32, entries: 64, bytes: 32 * 1024 * 1024, imageBytes: 3 * 1024 * 1024, pixels: 4 * 1024 * 1024, edge: 8192, elements: 8192, timeout: 15000 })
// Public diagnostics never contain a source URL or the browser error message.
const failureCode=error=>/^IMAGE_(?:BYTES|PIXELS|FORMAT|ANIMATION|SOURCE|NETWORK|CACHE|TIMEOUT)$/.test(error?.message)?error.message:'IMAGE_NETWORK'
const MIME = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
export function imageSource(value) {
  if (typeof value !== 'string' || value.length > 3 * 1024 * 1024) return null
  if (value.startsWith('data:')) return /^data:image\/(?:png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+={0,2}$/.test(value) ? value : null
  if (value.length > 4096) return null
  const url=externalUrl(value)
  if(url && /(?:^|\.)(?:home|lan|intranet|corp)$|\.home\.arpa$/.test(new URL(url).hostname))return null
  return url
}
export function stageImages(fragment) {
  for (const image of fragment.querySelectorAll('img')) {
    const source = imageSource(image.getAttribute('src') ?? image.getAttribute(IMAGE_SOURCE_ATTRIBUTE))
    image.removeAttribute('src'); image.removeAttribute('srcset')
    image.removeAttribute(IMAGE_SOURCE_ATTRIBUTE)
    image.setAttribute(IMAGE_SOURCE_ATTRIBUTE, source ?? '')
  }
}
// A bounded, inert raster fallback records a source without putting its URL in
// any browser resource slot. Each loaded background overrides only its private
// CSS variable on the visible element, including ::before/::after backgrounds.
const EMPTY_IMAGE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII='
function sourceCode(source) { return btoa(source).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'') }
function codedSource(code) { try { return imageSource(atob(code.replaceAll('-','+').replaceAll('_','/'))) } catch { return null } }
export function imageCss(css) {
  const value = String(css).replace(/\/\*[\s\S]*?\*\//g,'')
  if (/\\|@import\b|(?:image|image-set|-webkit-image-set|src)\s*\(/i.test(value)) return ''
  let blocked = false
  const clean = value.replace(/url\s*\(\s*(?:"([^"\n]*)"|'([^'\n]*)'|([^\s()"']+))\s*\)/gi,(token,quoted,single,plain,offset)=>{
    // Resource URLs are supported only in background declarations, not in
    // fonts, masks, cursors or content. A custom property may hold an inert
    // image token; it acquires a lease only when a background uses that token.
    const start = Math.max(value.lastIndexOf(';',offset),value.lastIndexOf('{',offset),value.lastIndexOf('}',offset)) + 1
    if (!/^\s*background(?:-image)?\s*:/i.test(value.slice(start,offset)) && !/^\s*--[A-Za-z0-9_-]+\s*:/i.test(value.slice(start,offset))) {blocked=true;return ''}
    const raw = quoted ?? single ?? plain
    const marker = raw.match(/#dtv=([A-Za-z0-9_-]+)$/)
    if (raw.startsWith(EMPTY_IMAGE+'#dtv=') && marker && codedSource(marker[1])) return token
    const source = imageSource(raw)
    if (!source || source.length > 4096) {blocked=true;return ''}
    const code = sourceCode(source)
    return `var(--dtv-img-${code},url("${EMPTY_IMAGE}#dtv=${code}"))`
  })
  return blocked || /url\s*\(/i.test(clean.replace(/url\s*\(\s*"data:image\/png;base64,[A-Za-z0-9+/]+=*#dtv=[A-Za-z0-9_-]+"\s*\)/gi,'')) ? '' : clean
}
function size(width, height, mime, limits = IMAGE_LIMITS) {
  if (!width || !height || width > limits.edge || height > limits.edge || width * height > limits.pixels) throw Error('IMAGE_PIXELS')
  return { width, height, mime }
}
export function rasterHeader(bytes, limits = IMAGE_LIMITS) {
  if (!(bytes instanceof Uint8Array) || bytes.length > limits.imageBytes) throw Error('IMAGE_BYTES')
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const ascii = (at, length) => String.fromCharCode(...bytes.subarray(at, at + length))
  if (bytes.length >= 33 && ascii(0,8) === '\x89PNG\r\n\x1a\n' && ascii(12,4) === 'IHDR' && view.getUint32(8) === 13) {
    const result = size(view.getUint32(16), view.getUint32(20), 'image/png', limits)
    for (let at = 8; at + 12 <= bytes.length;) {
      const length = view.getUint32(at), type = ascii(at + 4,4)
      if (length > bytes.length - at - 12) throw Error('IMAGE_FORMAT')
      if (type === 'acTL') throw Error('IMAGE_ANIMATION')
      at += length + 12
    }
    return result
  }
  if (bytes.length >= 12 && ascii(0,4) === 'RIFF' && ascii(8,4) === 'WEBP') {
    if (view.getUint32(4,true) + 8 !== bytes.length) throw Error('IMAGE_FORMAT')
    let result
    for (let at = 12; at + 8 <= bytes.length;) {
      const length = view.getUint32(at + 4,true), type = ascii(at,4), data = at + 8
      if (length > bytes.length - data) throw Error('IMAGE_FORMAT')
      if (type === 'ANIM' || type === 'ANMF' || (type === 'VP8X' && bytes[data] & 2)) throw Error('IMAGE_ANIMATION')
      if (type === 'VP8X' && length >= 10) result = size(1 + bytes[data+4] + (bytes[data+5]<<8) + (bytes[data+6]<<16), 1 + bytes[data+7] + (bytes[data+8]<<8) + (bytes[data+9]<<16), 'image/webp', limits)
      if (type === 'VP8 ' && length >= 10 && ascii(data+3,3) === '\x9d\x01\x2a') {const next=size(view.getUint16(data+6,true)&0x3fff,view.getUint16(data+8,true)&0x3fff,'image/webp', limits);if(result&&(result.width!==next.width||result.height!==next.height))throw Error('IMAGE_FORMAT');result=next}
      if (type === 'VP8L' && length >= 5 && bytes[data] === 0x2f) {
        const bits = view.getUint32(data+1,true)
        const next=size((bits&0x3fff)+1,((bits>>>14)&0x3fff)+1,'image/webp', limits);if(result&&(result.width!==next.width||result.height!==next.height))throw Error('IMAGE_FORMAT');result=next
      }
      at = data + length + (length & 1)
    }
    if (result) return result
  }
  if (bytes.length >= 13 && ['GIF87a','GIF89a'].includes(ascii(0,6))) {
    const result = size(view.getUint16(6,true),view.getUint16(8,true),'image/gif', limits)
    let at = 13 + ((bytes[10]&128) ? 3 * (1 << ((bytes[10]&7)+1)) : 0), frames = 0
    const blocks = () => { while (at < bytes.length) { const length = bytes[at++]; if (!length) return; at += length; if (at > bytes.length) throw Error('IMAGE_FORMAT') } throw Error('IMAGE_FORMAT') }
    while (at < bytes.length) {
      const type = bytes[at++]
      if (type === 0x3b) { if (frames === 1) return result; break }
      if (type === 0x21) { at++; blocks() }
      else if (type === 0x2c) {
        if (++frames > 1) throw Error('IMAGE_ANIMATION')
        if (at + 9 > bytes.length) throw Error('IMAGE_FORMAT')
        size(view.getUint16(at+4,true),view.getUint16(at+6,true),'image/gif', limits)
        const flags = bytes[at+8]; at += 9 + ((flags&128) ? 3 * (1 << ((flags&7)+1)) : 0)
        at++; blocks()
      } else throw Error('IMAGE_FORMAT')
    }
  }
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let result
    for (let at = 2; at < bytes.length;) {
      if (bytes[at++] !== 0xff) throw Error('IMAGE_FORMAT')
      while (bytes[at] === 0xff) at++
      const marker = bytes[at++]
      if (marker === 0xda || marker === 0xd9) break
      if (marker === 1 || marker >= 0xd0 && marker <= 0xd8) continue
      if (at + 2 > bytes.length) throw Error('IMAGE_FORMAT')
      const length = view.getUint16(at)
      if (length < 2 || at + length > bytes.length) throw Error('IMAGE_FORMAT')
      if ([0xc0,0xc1,0xc2].includes(marker) && length >= 8) {const next=size(view.getUint16(at+5),view.getUint16(at+3),'image/jpeg', limits);if(result&&(result.width!==next.width||result.height!==next.height))throw Error('IMAGE_FORMAT');result=next}
      at += length
    }
    if (result) return result
  }
  throw Error('IMAGE_FORMAT')
}
async function rasterize(bytes, mime, signal) {
  const header = rasterHeader(bytes)
  if (mime !== header.mime) throw Error('IMAGE_FORMAT')
  signal.throwIfAborted()
  const bitmap = await createImageBitmap(new Blob([bytes], {type:mime}))
  try {
    signal.throwIfAborted()
    size(bitmap.width,bitmap.height,mime)
    const matches=bitmap.width===header.width&&bitmap.height===header.height
    const rotated=mime==='image/jpeg'&&bitmap.width===header.height&&bitmap.height===header.width
    if (!matches&&!rotated) throw Error('IMAGE_FORMAT')
    let width=bitmap.width,height=bitmap.height
    for(let attempt=0;attempt<12;attempt++) {
      signal.throwIfAborted()
      const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height
      canvas.getContext('2d').drawImage(bitmap,0,0,width,height)
      const data = canvas.toDataURL('image/png')
      if(data.length<=IMAGE_LIMITS.imageBytes*4/3+64) {
        signal.throwIfAborted()
        // The source can compress much better than the browser's PNG encoder.
        // Bound injected bytes too: shrink while preserving aspect/alpha,
        // rather than raising the cache or retaining an oversized data URI.
        return { data, bytes: data.length * 2 + width * height * 4, width, height }
      }
      width=Math.max(1,Math.floor(width*.8));height=Math.max(1,Math.floor(height*.8))
    }
    throw Error('IMAGE_BYTES')
  } finally { bitmap.close() }
}
export async function fetchImage(source, signal) {
  if (imageSource(source) !== source) throw Error('IMAGE_SOURCE')
  if (source.startsWith('data:')) {
    const comma = source.indexOf(','), encoded = source.slice(comma+1)
    if (encoded.length > IMAGE_LIMITS.imageBytes * 4 / 3 + 4) throw Error('IMAGE_BYTES')
    const binary = atob(encoded), bytes = Uint8Array.from(binary, ch => ch.charCodeAt(0))
    return rasterize(bytes, source.slice(5,source.indexOf(';')), signal)
  }
  const response = await fetch(source, { signal, mode:'cors', credentials:'omit', redirect:'error', referrerPolicy:'no-referrer', cache:'no-store' })
  if (!response.ok || response.type === 'opaque' || response.redirected) throw Error('IMAGE_NETWORK')
  const mime = (response.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase()
  if (!MIME.has(mime)) throw Error('IMAGE_FORMAT')
  const length = response.headers.get('content-length')
  if (length && (!/^\d+$/.test(length) || Number(length) > IMAGE_LIMITS.imageBytes)) throw Error('IMAGE_BYTES')
  if (!response.body) throw Error('IMAGE_NETWORK')
  const reader = response.body.getReader(), chunks = []; let total = 0, complete = false
  try {
    for (;;) {
      signal.throwIfAborted()
      const {done,value} = await reader.read()
      if (done) { complete = true; break }
      total += value.byteLength
      if (total > IMAGE_LIMITS.imageBytes) throw Error('IMAGE_BYTES')
      chunks.push(value)
    }
  } finally { if (!complete) await reader.cancel().catch(()=>{}); reader.releaseLock() }
  const bytes = new Uint8Array(total); let offset = 0
  for (const chunk of chunks) { bytes.set(chunk,offset); offset += chunk.length }
  return rasterize(bytes,mime,signal)
}
export function createImagePool({ load = fetchImage, limits = IMAGE_LIMITS } = {}) {
  const entries = new Map(), subscribers = new Set(); let active = 0, bytes = 0, leases = 0, closed = false
  const changed=()=>{for(const subscriber of subscribers)subscriber()}
  function evict(required = 0, reserve = false) {
    for (const [key,entry] of entries) {
      if (bytes + required <= limits.bytes && (!reserve || entries.size < limits.entries)) break
      if (!entry.refs.size && entry.state === 'loaded') { entries.delete(key); bytes -= entry.value.bytes }
    }
  }
  function pump() {
    if (closed) return
    for (const entry of entries.values()) {
      if (active >= limits.concurrent) break
      if (entry.state !== 'queued') continue
      active++; entry.state = 'loading'; entry.controller = new AbortController()
      const timer = setTimeout(()=>entry.controller.abort(),limits.timeout)
      for (const ref of entry.refs) ref.status?.('loading')
      Promise.resolve().then(()=>load(entry.source,entry.controller.signal)).then(value=>{
        entry.controller.signal.throwIfAborted()
        if (!Number.isSafeInteger(value.bytes) || value.bytes < 1 || value.bytes > limits.bytes) throw Error('IMAGE_BYTES')
        evict(value.bytes)
        if (bytes + value.bytes > limits.bytes) throw Error('IMAGE_CACHE')
        entry.state = 'loaded'; entry.value = value; bytes += value.bytes
        for (const ref of entry.refs) ref.resolve(value)
      }).catch(error=>{
        entry.controller?.abort()
        if (entries.get(entry.source) === entry) entries.delete(entry.source)
        for (const ref of entry.refs) ref.reject(error)
      }).finally(()=>{ clearTimeout(timer); active--; pump(); changed() })
    }
  }
  function acquire(source, status) {
    if (closed || leases >= limits.visible) throw Error('IMAGE_VISIBLE_LIMIT')
    let entry = entries.get(source)
    if (!entry) {
      evict(0,true)
      if (entries.size >= limits.entries) throw Error('IMAGE_CACHE')
      entry = {source,state:'queued',refs:new Set()}; entries.set(source,entry)
    } else { entries.delete(source); entries.set(source,entry) }
    let resolve, reject, released = false
    const promise = new Promise((yes,no)=>{ resolve = yes; reject = no })
    const ref = {resolve,reject,status}; entry.refs.add(ref); leases++
    if (entry.state === 'loaded') resolve(entry.value)
    status?.(entry.state); pump()
    return {promise, release() {
      if (released) return; released = true; entry.refs.delete(ref); leases--
      reject(Error('IMAGE_CANCELLED'))
      if (!entry.refs.size && entry.state !== 'loaded') { entries.delete(source); entry.controller?.abort() }
      changed()
    }}
  }
  return {acquire, subscribe(fn){subscribers.add(fn);return()=>subscribers.delete(fn)}, stats:()=>({active,leases,entries:entries.size,bytes}), dispose() { closed = true; for (const entry of entries.values()) {entry.controller?.abort();for (const ref of entry.refs) ref.reject(Error('IMAGE_CANCELLED'))} entries.clear(); bytes = 0 }}
}
let pagePool
function sharedPool() { return pagePool ??= createImagePool() }
function isDisplayed(element) {
  for (let node = element; node; node = node.parentElement ?? node.getRootNode()?.host) {
    const style = node.ownerDocument.defaultView.getComputedStyle(node)
    if (style.display === 'none' || style.visibility !== 'visible' || Number(style.opacity) === 0) return false
    if (node.parentElement?.localName === 'details' && !node.parentElement.open && node.localName !== 'summary') return false
  }
  return true
}
export function observeImages(root, {frame, pool = sharedPool(), onStatus = ()=>{}, unavailable = 'Image unavailable'} = {}) {
  const doc = root.ownerDocument ?? root, records = new Map(), backgrounds = new WeakMap(), backgroundBindings = new WeakMap(), observers = [], mutations = [], listeners = []
  let disposed = false, scheduled = false, observer, frameVisible = !frame
  const elements=scope=>[...(scope===doc.body?[doc.documentElement]:[]),...(scope.nodeType===1?[scope]:[]),...scope.querySelectorAll('*')]
  function painted(element,pseudo,style=doc.defaultView.getComputedStyle(element,pseudo||null),geometry=false) {
    if(!pseudo)return true
    if(!['block','inline-block','flex','grid','flow-root'].includes(style.display)||style.visibility!=='visible'||Number(style.opacity)===0||!style.content||['none','normal'].includes(style.content))return false
    // CSSOM exposes no pseudo-element bounding box. Fail closed for geometry
    // we cannot establish: require an untransformed, contained generated box
    // on a fully visible host, rather than treating the host's IO as its box.
    if(!['static','relative'].includes(style.position)||style.transform!=='none')return false
    const pixels=value=>/^\d+(?:\.\d+)?px$/.test(value)?parseFloat(value):NaN
    const width=pixels(style.width),height=pixels(style.height),rect=element.getBoundingClientRect()
    if(!(width>0&&height>0&&width<=rect.width&&height<=rect.height))return false
    for(const property of ['top','right','bottom','left'])if(!['auto','0px'].includes(style[property]))return false
    for(const property of ['marginTop','marginRight','marginBottom','marginLeft','paddingTop','paddingRight','paddingBottom','paddingLeft','borderTopWidth','borderRightWidth','borderBottomWidth','borderLeftWidth'])if(style[property]!=='0px')return false
    for(let node=element;node;node=node.parentElement??node.getRootNode()?.host)if(doc.defaultView.getComputedStyle(node).transform!=='none')return false
    if(!geometry)return true
    const inside=(box,w,h)=>box.left>=0&&box.top>=0&&box.right<=w&&box.bottom<=h
    if(!inside(rect,doc.documentElement.clientWidth,doc.documentElement.clientHeight))return false
    if(frame){const outer=frame.getBoundingClientRect();if(!inside({left:outer.left+rect.left,top:outer.top+rect.top,right:outer.left+rect.right,bottom:outer.top+rect.bottom},globalThis.document.documentElement.clientWidth,globalThis.document.documentElement.clientHeight))return false}
    return true
  }
  const hasPaint=record=>!record.property||record.surfaces.some(pseudo=>painted(record.image,pseudo,undefined,true))
  const notify = () => {
    if (disposed) return
    const result = {total:records.size,visible:0,queued:0,loading:0,loaded:0,failed:0}
    for (const record of records.values()) { if (record.visible) result.visible++; if(record.state==='deferred')result.queued++;else if (Object.hasOwn(result,record.state)) result[record.state]++ }
    onStatus(result)
  }
  function restoreBindings(element) {
    for(const [property,binding] of backgroundBindings.get(element)??[]) {
      if(element.style.getPropertyValue(property)===binding.applied) {
        if(binding.original)element.style.setProperty(property,binding.original,binding.priority)
        else element.style.removeProperty(property)
      }
    }
  }
  function displayBackground(element) {
    const loaded=new Map()
    for(const [property,key] of backgrounds.get(element)??[]) {
      const record=records.get(key)
      if(record?.state==='loaded')loaded.set(property.slice('--dtv-img-'.length),record.data)
    }
    // Custom properties resolve var() where they are declared, before their
    // computed value is inherited. Override the image-valued alias locally as
    // well, otherwise a parent's --cover keeps its inert fallback on children.
    for(const [property,binding] of backgroundBindings.get(element)??[]) {
      const value=binding.value.replace(/url\(\s*"[^"]*#dtv=([A-Za-z0-9_-]+)"\s*\)/g,(token,code)=>loaded.has(code)?`url("${loaded.get(code)}")`:token)
      if(value!==binding.value){element.style.setProperty(property,value);binding.applied=value}
      else if(element.style.getPropertyValue(property)===binding.applied){if(binding.original)element.style.setProperty(property,binding.original,binding.priority);else element.style.removeProperty(property);binding.applied=null}
    }
  }
  const release = record => {
    record.ticket++;record.lease?.release();record.lease=null;record.state='idle';record.data=null
    if(record.property){record.image.style.removeProperty(record.property);displayBackground(record.image)}else record.image.removeAttribute('src')
    record.image.setAttribute('data-dtv-image-state','idle')
    record.image.removeAttribute('data-dtv-image-error')
  }
  function tick() {
    scheduled = false; if (disposed) return
    let visible = 0
    for (const record of records.values()) {
      const rectangle = record.image.getBoundingClientRect()
      const display = record.intersects && frameVisible && !doc.hidden && !globalThis.document.hidden && record.image.isConnected && rectangle.width > 0 && rectangle.height > 0 && isDisplayed(record.image) && (!frame || isDisplayed(frame)) && hasPaint(record)
      record.visible = display
      if (!display || ++visible > IMAGE_LIMITS.visible) { if (record.lease) release(record); continue }
      if (record.lease || record.state === 'failed') continue
      const ticket = ++record.ticket
      try {
        record.lease = pool.acquire(record.source,state=>{record.state=state;record.image.setAttribute('data-dtv-image-state',state);schedule()})
        record.lease.promise.then(value=>{
          if (disposed || record.ticket !== ticket || !record.image.isConnected || (!record.property&&record.image.getAttribute(IMAGE_SOURCE_ATTRIBUTE)!==record.source)) return
          record.state = 'loaded'; record.data=value.data; if(record.property){record.image.style.setProperty(record.property,`url("${value.data}")`);displayBackground(record.image)}else record.image.src = value.data; record.image.setAttribute('data-dtv-image-state','loaded');record.image.removeAttribute('data-dtv-image-error'); schedule()
        }).catch(error=>{
          if (disposed || record.ticket !== ticket) return
          record.state = 'failed'; record.image.setAttribute('data-dtv-image-state','failed'); record.image.setAttribute('data-dtv-image-error',failureCode(error));record.image.setAttribute('title',unavailable); schedule()
        })
      } catch(error) {record.state=/IMAGE_(?:VISIBLE_LIMIT|CACHE)/.test(error.message)?'deferred':'failed';record.image.setAttribute('data-dtv-image-state',record.state);if(record.state==='failed'){record.image.setAttribute('data-dtv-image-error',failureCode(error));record.image.setAttribute('title',unavailable)}}
    }
    notify()
  }
  function schedule() { if (!disposed && !scheduled) {scheduled=true;if(globalThis.document.hidden||doc.hidden)queueMicrotask(tick);else requestAnimationFrame(tick)} }
  function roots() {
    const found = [root]
    for (let i=0;i<found.length;i++) for (const el of found[i].querySelectorAll('*')) if (el.shadowRoot) found.push(el.shadowRoot)
    return found
  }
  function refresh() {
    if (disposed) return
    for (const mutation of mutations) mutation.disconnect()
    const current = new Set(), scopes = roots()
    // Clear our own overrides before reading the current cascade, so class,
    // stylesheet and media-query changes reveal their new source immediately.
    for(const record of records.values())if(record.property){restoreBindings(record.image);record.image.style.removeProperty(record.property)}
    for (const scope of scopes) for (const image of scope.querySelectorAll(`img[${IMAGE_SOURCE_ATTRIBUTE}]`)) {
      if (current.size >= IMAGE_LIMITS.elements) break
      current.add(image)
      const source = imageSource(image.getAttribute(IMAGE_SOURCE_ATTRIBUTE)), old = records.get(image)
      if (old?.source === source) continue
      if (old) { release(old);observer?.unobserve(image);records.delete(image) }
      image.removeAttribute('src');image.removeAttribute('srcset')
      if (!image.hasAttribute('width')&&!image.hasAttribute('height')) {image.setAttribute('width','160');image.setAttribute('height','90')}
      if (!image.hasAttribute('alt')) image.setAttribute('alt',unavailable)
      image.style.objectFit='contain'
      const record={image,source,ticket:0,state:source?'idle':'failed',intersects:false,visible:false}; records.set(image,record);observer?.observe(image)
      if(!source){image.setAttribute('data-dtv-image-state','failed');image.setAttribute('data-dtv-image-error','IMAGE_SOURCE');image.setAttribute('title',unavailable)}
    }
    let inspected=0
    for(const scope of scopes)for(const element of elements(scope)) {
      if(++inspected>IMAGE_LIMITS.elements)break
      if(['style','script','template'].includes(element.localName))continue
      const computed=doc.defaultView.getComputedStyle(element),bindings=new Map()
      const views=[['',computed],...['::before','::after'].map(pseudo=>[pseudo,doc.defaultView.getComputedStyle(element,pseudo)])]
      if(!views.some(([pseudo,style])=>style.backgroundImage.includes('#dtv=')&&painted(element,pseudo,style)))continue
      for(const property of computed)if(property.startsWith('--')&&!property.startsWith('--dtv-img-')) {
        const value=computed.getPropertyValue(property)
        if(value.includes('#dtv='))bindings.set(property,{value,original:element.style.getPropertyValue(property),priority:element.style.getPropertyPriority(property),applied:null})
      }
      backgroundBindings.set(element,bindings)
      const surfaces=new Map()
      for(const [pseudo,style] of views) {
        if(!painted(element,pseudo,style))continue
        const background=style.backgroundImage
        for(const match of background.matchAll(/#dtv=([A-Za-z0-9_-]+)/g)) {
          const source=codedSource(match[1]);if(!source||current.size>=IMAGE_LIMITS.elements)continue
          const property='--dtv-img-'+match[1]
          let properties=backgrounds.get(element);if(!properties){properties=new Map();backgrounds.set(element,properties)}
          let key=properties.get(property)
          if(!key){key={element,property};properties.set(property,key)}
          current.add(key)
          let record=records.get(key)
          if(!record){record={image:element,property,source,ticket:0,state:'idle',intersects:false,visible:false,surfaces:[]};records.set(key,record);observer.observe(element)}
          let used=surfaces.get(key);if(!used){used=[];surfaces.set(key,used)}used.push(pseudo)
          record.surfaces=used
          if(record.state==='loaded'){element.style.setProperty(property,`url("${record.data}")`);displayBackground(element)}
        }
      }
    }
    for (const [image,record] of records) if (!current.has(image)) {release(record);observer?.unobserve(record.image);records.delete(image)}
    for(const record of records.values())observer.observe(record.image)
    for (const mutation of mutations) mutation.disconnect()
    mutations.length=0
    for (const scope of [...scopes,...(frame?[doc.head]:[])]) {const mutation=new MutationObserver(()=>{refresh()});mutation.observe(scope,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:[IMAGE_SOURCE_ATTRIBUTE,'class','style','open','hidden']});mutations.push(mutation)}
    if(root===doc.body){const mutation=new MutationObserver(refresh);mutation.observe(doc.documentElement,{attributes:true,attributeFilter:['class','style','hidden']});mutations.push(mutation)}
    schedule()
  }
  // Fail closed when an old browser cannot establish viewport visibility.
  if (typeof IntersectionObserver !== 'function') {onStatus({total:0,visible:0,queued:0,loading:0,loaded:0,failed:1});return {refresh(){},dispose(){}}}
  observer = new IntersectionObserver(entries=>{for(const entry of entries){const visible=entry.isIntersecting&&entry.intersectionRect.width>0&&entry.intersectionRect.height>0;const image=records.get(entry.target);if(image)image.intersects=visible;for(const key of backgrounds.get(entry.target)?.values()??[]){const record=records.get(key);if(record)record.intersects=visible}}schedule()}, {rootMargin:'0px',threshold:0})
  observers.push(observer)
  listeners.push(pool.subscribe(schedule))
  if (frame) {const outer=new IntersectionObserver(entries=>{frameVisible=entries[0]?.isIntersecting===true;schedule()},{threshold:0});outer.observe(frame);observers.push(outer)}
  for (const target of new Set([doc,globalThis.document,doc.defaultView,globalThis.window])) for (const event of ['scroll','resize','visibilitychange','transitionend','animationend','toggle']) {
    const handle=event==='resize'?refresh:schedule;target.addEventListener(event,handle,true);listeners.push(()=>target.removeEventListener(event,handle,true))
  }
  refresh()
  return {refresh,dispose() {if(disposed)return;disposed=true;for(const item of observers)item.disconnect();for(const item of mutations)item.disconnect();for(const stop of listeners)stop();for(const record of records.values())release(record);records.clear()}}
}
