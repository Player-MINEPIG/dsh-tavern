import {createHash,randomUUID} from 'node:crypto'
import {API_V1} from '../identity.js'

const PATH=`${API_V1}/rendering-write-grants`
const MAX_SOURCE=24*1024*1024
const canonical=value=>JSON.stringify(value,(_,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item)

/** Internal binding of downloaded, enabled execution to its exact source/scope. */
export function createRenderingAuthority() {
 const grants=new Map()
 let disposed=false
 return Object.freeze({
  grant({source,sourceIdentity,downloaded,enabled,executionId}) {
   if(disposed)throw Error('Rendering authority is disposed')
   if(downloaded!==true||enabled!==true)throw new TypeError('Execution requires downloaded sources and enabled scripts')
   if(typeof source!=='string'||Buffer.byteLength(source)>MAX_SOURCE)throw new TypeError('Rendering source bundle exceeds limit')
   const bundle=JSON.parse(source)
   if(bundle?.version!==1||!bundle.scope||typeof bundle.scope.sessionId!=='string'||!Array.isArray(bundle.runs)||!bundle.modules||typeof bundle.html!=='string')throw new TypeError('Invalid rendering source bundle')
   const identity={version:1,sha256:createHash('sha256').update(source).digest('hex'),scope:bundle.scope}
   if(canonical(identity)!==canonical(sourceIdentity))throw new TypeError('Rendering source identity mismatch')
   if(executionId!==undefined&&!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(executionId))throw new TypeError('Invalid execution identity')
   const grantId=executionId??randomUUID(),existing=grants.get(grantId)
   if(existing){if(existing.identity!==canonical(identity))throw new TypeError('Execution identity changed');return {grantId,sourceIdentity:identity}}
   if(grants.size>=64)throw Error('Rendering execution binding limit exceeded')
   grants.set(grantId,{identity:canonical(identity),scope:structuredClone(bundle.scope)})
   return {grantId,sourceIdentity:identity}
  },
  isCurrent({grantId,sourceIdentity}={}){const grant=grants.get(grantId);return !disposed&&!!grant&&canonical(sourceIdentity)===grant.identity},
  async resolve({grantId,sourceIdentity}={}) {
   const grant=grants.get(grantId)
   if(disposed||!grant||canonical(sourceIdentity)!==grant.identity)return null
   return {valid:true,write:true,scope:structuredClone(grant.scope)}
  },
  revoke(grantId){grants.delete(grantId)},
  dispose(){disposed=true;grants.clear()},
 })
}
export function isRenderingAuthorityPath(url){const path=new URL(url??'/','http://localhost').pathname;return path===PATH||path.startsWith(PATH+'/')}
export function createRenderingAuthorityHandler(authority,{getConnection=()=>null}={}) {
 const send=(res,status,value)=>{res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify(value))}
 return async(req,res)=>{
  try{
   const connection=getConnection()
   if(typeof connection?.admit!=='function')return send(res,503,{ok:false,error:'DSH admission unavailable'})
   const admission=connection.admit(req)
   if(!admission||'rejection' in admission)return send(res,admission?.rejection===403?403:401,{ok:false,error:'DSH admission required'})
   const path=new URL(req.url,'http://localhost').pathname
   if(req.method==='DELETE'&&path.startsWith(PATH+'/')){authority.revoke(decodeURIComponent(path.slice(PATH.length+1)));return send(res,200,{ok:true})}
   if(req.method!=='POST'||path!==PATH)return send(res,405,{ok:false,error:'Method not allowed'})
   const chunks=[];let size=0
   for await(const chunk of req){size+=chunk.length;if(size>2*MAX_SOURCE){send(res,413,{ok:false,error:'Execution binding request exceeds limit'});return}chunks.push(chunk)}
   const grant=authority.grant(JSON.parse(Buffer.concat(chunks).toString('utf8')))
   return send(res,200,{ok:true,...grant})
  }catch(error){return send(res,400,{ok:false,error:String(error.message).slice(0,300)})}
 }
}
