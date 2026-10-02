import { externalUrl, MAX_RENDER_SOURCE } from './rendering-sources.js'

// Trusted settings UI only. Never expose this function or fetch to card code.
export async function downloadRenderingSource(source, {signal, fetch: request = globalThis.fetch} = {}) {
  const url=externalUrl(source)
  if (!url || url !== source) throw Error('Blocked dependency URL')
  signal?.throwIfAborted()
  const response=await request(url,{signal,mode:'cors',credentials:'omit',redirect:'error',referrerPolicy:'no-referrer',cache:'no-store'})
  if(!response.ok || response.type==='opaque' || response.redirected)throw Error('Source download failed; import a reviewed local file instead')
  const length=Number(response.headers.get('content-length'))
  if(Number.isFinite(length)&&length>MAX_RENDER_SOURCE)throw Error('Source exceeds 8 MiB')
  if(!response.body)throw Error('Source response has no readable body')
  const reader=response.body.getReader(), chunks=[];let size=0
  try{
    while(true){
      signal?.throwIfAborted()
      const {value,done}=await reader.read();if(done)break
      size+=value.byteLength
      if(size>MAX_RENDER_SOURCE)throw Error('Source exceeds 8 MiB')
      chunks.push(value)
    }
  }catch(error){await reader.cancel().catch(()=>{});throw error}finally{reader.releaseLock()}
  signal?.throwIfAborted()
  const bytes=new Uint8Array(size);let offset=0
  for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength}
  return new TextDecoder('utf-8',{fatal:true}).decode(bytes)
}
