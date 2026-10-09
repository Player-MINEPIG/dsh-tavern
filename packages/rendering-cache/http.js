import {API_V1} from '../identity.js'
import {RENDERING_CACHE_LIMITS} from './contract.js'
const ROOT=`${API_V1}/rendering-cache`
// JSON escaping can expand source bytes sixfold; the store enforces decoded
// bytes, distinct source count and metadata bounds before committing anything.
const BODY_LIMIT=6*RENDERING_CACHE_LIMITS.bytes+16*1024*1024
export function isRenderingCachePath(url){const path=new URL(url??'/','http://localhost').pathname;return path===ROOT||path.startsWith(ROOT+'/')}
export function createRenderingCacheHandler(store,{getConnection=()=>null}={}) {
  const send=(res,status,value)=>{res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(value))}
  return async(req,res)=>{
    try{
      const connection=getConnection()
      if(typeof connection?.admit!=='function')return send(res,503,{ok:false,error:'DSH admission unavailable'})
      const admission=connection.admit(req)
      if(!admission||'rejection' in admission)return send(res,admission?.rejection===403?403:401,{ok:false,error:'DSH admission required'})
      const url=new URL(req.url,'http://localhost'),path=url.pathname.slice(ROOT.length),owner=url.searchParams.get('owner')
      if(req.method==='GET'){
        if(path==='/graphs')return send(res,200,{ok:true,value:owner===null?(url.searchParams.get('metadata')==='1'?{graphs:store.records()}:store.inventory()):store.get(owner)})
        if(path==='/sources')return send(res,200,{ok:true,value:store.source(url.searchParams.get('url'))})
        if(path==='/opening')return send(res,200,{ok:true,value:store.opening()})
      }
      if(req.method==='DELETE'){
        if(path==='/graphs')return send(res,200,{ok:true,value:store.remove(owner)})
        if(path==='/opening'){store.removeOpening();return send(res,200,{ok:true})}
      }
      if(['POST','PUT'].includes(req.method)){
        const chunks=[];let size=0
        for await(const chunk of req){size+=chunk.length;if(size>BODY_LIMIT)return send(res,413,{ok:false,error:'Rendering cache request exceeds limit'});chunks.push(chunk)}
        const body=JSON.parse(Buffer.concat(chunks).toString('utf8'))
        if(req.method==='POST'&&path==='/graphs')return send(res,200,{ok:true,value:store.begin(owner)})
        if(req.method==='PUT'&&path==='/graphs')return send(res,200,{ok:true,value:store.publish(owner,body.generation,body.graph)})
        if(req.method==='POST'&&path==='/graphs/import')return send(res,200,{ok:true,value:store.import(owner,body)})
        if(req.method==='PUT'&&path==='/opening')return send(res,200,{ok:true,value:store.putOpening(body.content,{onlyMissing:body.onlyMissing===true})})
      }
      return send(res,405,{ok:false,error:'Method not allowed'})
    }catch(error){return send(res,error.status??400,{ok:false,error:String(error.message).slice(0,300)})}
  }
}
