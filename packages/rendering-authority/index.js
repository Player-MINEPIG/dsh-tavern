import {createHash,randomUUID} from 'node:crypto'
import {API_V1} from '../identity.js'

const PATH=`${API_V1}/rendering-write-grants`
const MAX_SOURCE=24*1024*1024
const canonical=value=>JSON.stringify(value,(_,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item)

/** Trusted UI authority, separate from source execution approval and MVU policy. */
export function createRenderingAuthority({now=Date.now,ttlMs=30*60*1000}={}) {
 const grants=new Map()
 let disposed=false
 const prune=()=>{for(const[id,grant]of grants)if(grant.expiresAt<=now())grants.delete(id)}
 return Object.freeze({
  grant({source,sourceIdentity,reviewed,write}) {
   if(disposed)throw Error('Rendering authority is disposed')
   if(reviewed!==true||write!==true)throw new TypeError('Source review and separate write authorization are required')
   if(typeof source!=='string'||Buffer.byteLength(source)>MAX_SOURCE)throw new TypeError('Rendering source bundle exceeds limit')
   const bundle=JSON.parse(source)
   if(bundle?.version!==1||!bundle.scope||typeof bundle.scope.sessionId!=='string'||!Array.isArray(bundle.runs)||!bundle.modules||typeof bundle.html!=='string')throw new TypeError('Invalid rendering source bundle')
   const identity={version:1,sha256:createHash('sha256').update(source).digest('hex'),scope:bundle.scope}
   if(canonical(identity)!==canonical(sourceIdentity))throw new TypeError('Rendering source identity mismatch')
   prune();if(grants.size>=64)throw Error('Rendering write grant limit exceeded')
   const grantId=randomUUID(),expiresAt=now()+ttlMs
   grants.set(grantId,{identity:canonical(identity),scope:structuredClone(bundle.scope),expiresAt})
   return {grantId,sourceIdentity:identity,expiresAt}
  },
  isCurrent({grantId,sourceIdentity}={}){prune();const grant=grants.get(grantId);return !disposed&&!!grant&&canonical(sourceIdentity)===grant.identity},
  async resolve({grantId,sourceIdentity}={}) {
   prune();const grant=grants.get(grantId)
   if(disposed||!grant||canonical(sourceIdentity)!==grant.identity)return null
   return {valid:true,write:true,scope:structuredClone(grant.scope)}
  },
  revoke(grantId){grants.delete(grantId)},
  dispose(){disposed=true;grants.clear()},
 })
}
export function isRenderingAuthorityPath(url){const path=new URL(url??'/','http://localhost').pathname;return path===PATH||path.startsWith(PATH+'/')}
export function createRenderingAuthorityHandler(authority) {
 const send=(res,status,value)=>{res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify(value))}
 return async(req,res)=>{
  try{
   const path=new URL(req.url,'http://localhost').pathname
   if(req.method==='DELETE'&&path.startsWith(PATH+'/')){authority.revoke(decodeURIComponent(path.slice(PATH.length+1)));return send(res,200,{ok:true})}
   if(req.method!=='POST'||path!==PATH)return send(res,405,{ok:false,error:'Method not allowed'})
   const chunks=[];let size=0
   for await(const chunk of req){size+=chunk.length;if(size>2*MAX_SOURCE){send(res,413,{ok:false,error:'Source review request exceeds limit'});return}chunks.push(chunk)}
   const grant=authority.grant(JSON.parse(Buffer.concat(chunks).toString('utf8')))
   return send(res,200,{ok:true,...grant})
  }catch(error){return send(res,400,{ok:false,error:String(error.message).slice(0,300)})}
 }
}
