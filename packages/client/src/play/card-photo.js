// Only the trusted renderer sees the user-selected File. No filename, path,
// original bytes, decoder, canvas or native object crosses into the card VM.
import { rasterHeader } from './card-images.js'

export const PHOTO_LIMITS = Object.freeze({ imageBytes: 8 * 1024 * 1024, pixels: 8 * 1024 * 1024, edge: 8192, maxEdge: 640, characters: 64 * 1024, waiting: 4 })
const TYPES = new Set(['image/png', 'image/jpeg', 'image/webp'])
let busy = false
const waiting = []
async function acquire(signal) {
  signal.throwIfAborted()
  if (!busy) { busy=true; return }
  if (waiting.length >= PHOTO_LIMITS.waiting) throw Error('PHOTO_BUSY')
  await new Promise((resolve,reject)=>{
    const item={resolve:()=>{signal.removeEventListener('abort',cancel);resolve()}}
    const cancel=()=>{const at=waiting.indexOf(item);if(at>=0)waiting.splice(at,1);reject(signal.reason)}
    waiting.push(item);signal.addEventListener('abort',cancel,{once:true})
  })
}
function release() { if (waiting.length) waiting.shift().resolve(); else busy=false }
export async function selectedPhoto(file, signal) {
  if (!file || !TYPES.has(file.type) || !Number.isSafeInteger(file.size) || file.size < 1 || file.size > PHOTO_LIMITS.imageBytes) throw Error('PHOTO_FORMAT')
  await acquire(signal)
  let bitmap
  try {
    signal.throwIfAborted()
    const bytes=new Uint8Array(await file.arrayBuffer());signal.throwIfAborted()
    if (bytes.length!==file.size) throw Error('PHOTO_BYTES')
    const header=rasterHeader(bytes,PHOTO_LIMITS)
    if (header.mime!==file.type) throw Error('PHOTO_FORMAT')
    bitmap=await createImageBitmap(new Blob([bytes],{type:header.mime}));signal.throwIfAborted()
    const {width,height}=bitmap
    if (!width || !height || width>PHOTO_LIMITS.edge || height>PHOTO_LIMITS.edge || width*height>PHOTO_LIMITS.pixels) throw Error('PHOTO_PIXELS')
    if (!(width===header.width&&height===header.height) && !(header.mime==='image/jpeg'&&width===header.height&&height===header.width)) throw Error('PHOTO_FORMAT')
    let edge=PHOTO_LIMITS.maxEdge
    // Keep one decode and one bounded canvas. Re-encoding strips original
    // metadata, including EXIF location. Difficult photos shrink until the
    // existing bridge/storage budgets can carry the result without expansion.
    for(let attempt=0;attempt<12;attempt++,edge=Math.floor(edge*.8)) {
      signal.throwIfAborted()
      const ratio=Math.min(1,edge/Math.max(width,height)),w=Math.max(1,Math.round(width*ratio)),h=Math.max(1,Math.round(height*ratio))
      const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h
      const context=canvas.getContext('2d');if(!context)throw Error('PHOTO_DECODER')
      context.fillStyle='#fff';context.fillRect(0,0,w,h);context.drawImage(bitmap,0,0,w,h)
      for(const quality of [.82,.7,.55,.4]) {
        const data=canvas.toDataURL('image/jpeg',quality)
        if(data.length<=PHOTO_LIMITS.characters&&/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(data)) {
          signal.throwIfAborted()
          const encoded=data.slice(data.indexOf(',')+1)
          return {data,width:w,height:h,type:'image/jpeg',size:encoded.length*3/4-(encoded.endsWith('==')?2:encoded.endsWith('=')?1:0)}
        }
      }
    }
    throw Error('PHOTO_BYTES')
  } finally { bitmap?.close();release() }
}
