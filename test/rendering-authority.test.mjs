import test from 'node:test'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {createRenderingAuthority} from '../packages/rendering-authority/index.js'
import {createRenderingWriteRequests} from '../packages/client/src/play/rendering-write-requests.js'
const scope={sessionId:'session',nodeId:'node',variantId:'variant',endEventId:3}
const bundle={version:1,scope,owners:['character:fixture'],runs:[{code:'Mvu.getMvuData()',name:'fixture.js'}],modules:{},html:'<p>fixture</p>'}
const source=JSON.stringify(bundle),sourceIdentity={version:1,sha256:createHash('sha256').update(source).digest('hex'),scope}

test('Host write grants require full content identity and separate review/write authorization',async()=>{
 let now=10;const authority=createRenderingAuthority({now:()=>now,ttlMs:50})
 for(const flags of [{},{reviewed:true},{write:true}])assert.throws(()=>authority.grant({source,sourceIdentity,...flags}),/authorization/)
 assert.throws(()=>authority.grant({source:source+' ',sourceIdentity,reviewed:true,write:true}),/identity/)
 const grant=authority.grant({source,sourceIdentity,reviewed:true,write:true})
 assert.equal(authority.isCurrent(grant),true);assert.deepEqual(await authority.resolve(grant),{valid:true,write:true,scope})
 assert.equal(await authority.resolve({...grant,sourceIdentity:{...sourceIdentity,scope:{...scope,sessionId:'other'}}}),null)
 const leaseCheck=()=>authority.isCurrent(grant);authority.revoke(grant.grantId);assert.equal(leaseCheck(),false)
 const second=authority.grant({source,sourceIdentity,reviewed:true,write:true});assert.notEqual(second.grantId,grant.grantId)
 now=60;assert.equal(authority.isCurrent(second),false)
 const third=authority.grant({source,sourceIdentity,reviewed:true,write:true});authority.dispose();assert.equal(authority.isCurrent(third),false)
})

test('trusted UI keeps approval separate, revokes on removal and cleans late authorization responses',async()=>{
 const authority=createRenderingAuthority(),deletes=[];let finish,hold=false
 const registry=createRenderingWriteRequests({request:async(url,options)=>{
  if(options.method==='DELETE'){assert.equal(options.headers['Content-Type'],'application/json');const id=url.split('/').at(-1);deletes.push(id);authority.revoke(id);return new Response('{}')}
  const grant=authority.grant(JSON.parse(options.body));if(hold)await new Promise(resolve=>{finish=resolve});return Response.json({ok:true,...grant})
 }})
 const item=registry.register(bundle)
 for(let i=0;i<20&&!registry.list()[0]?.sourceIdentity;i++)await new Promise(r=>setTimeout(r,1))
 const id=registry.list()[0].id
 await assert.rejects(()=>registry.authorize(id),/Review/)
 registry.review(id);assert.equal(item.getGrant(),null);await registry.authorize(id)
 const grant=item.getGrant();assert.equal(authority.isCurrent(grant),true)
 item.dispose();assert.equal(authority.isCurrent(grant),false);assert.equal(deletes.length,1)
 const pending=registry.register(bundle)
 for(let i=0;i<20&&!registry.list()[0]?.sourceIdentity;i++)await new Promise(r=>setTimeout(r,1))
 const next=registry.list()[0].id;registry.review(next);hold=true;const request=registry.authorize(next)
 for(let i=0;i<20&&!finish;i++)await new Promise(r=>setTimeout(r,1))
 pending.dispose();finish();await request;assert.equal(deletes.length,2);assert.equal(registry.list().length,0)
})

test('grant HTTP mutations retain the existing local Origin security boundary',async()=>{
 const {Readable}=await import('node:stream')
 const {secureTavernApi}=await import('../packages/tavern-loader/src/api-security.js')
 const {createRenderingAuthorityHandler}=await import('../packages/rendering-authority/index.js')
 const authority=createRenderingAuthority(),handler=secureTavernApi(createRenderingAuthorityHandler(authority,{getConnection:()=>({admit:()=>({peer:{}})})}))
 const invoke=(method,url,origin,body)=>new Promise((resolve,reject)=>{
  const req=Readable.from(body?[Buffer.from(JSON.stringify(body))]:[])
  Object.assign(req,{method,url,headers:{host:'127.0.0.1:8080',origin,'content-type':'application/json'},socket:{remoteAddress:'127.0.0.1'}})
  const res={statusCode:200,setHeader(){},end(body){resolve({status:res.statusCode,body:JSON.parse(body)})}}
  Promise.resolve(handler(req,res)).catch(reject)
 })
 const url='/pmp-dsh-tavern/api/v1/rendering-write-grants',origin='http://127.0.0.1:8080',body={source,sourceIdentity,reviewed:true,write:true}
 assert.equal((await invoke('POST',url,'https://untrusted.example',body)).status,403)
 const response=await invoke('POST',url,origin,body);assert.equal(response.status,200)
 const grant=response.body;assert.equal(authority.isCurrent(grant),true);assert.equal('source'in grant,false)
 const removed=await invoke('DELETE',url+'/'+grant.grantId,origin);assert.equal(removed.status,200);assert.equal(authority.isCurrent(grant),false)
 authority.dispose()
})

test('grant admission fails closed before consuming a request body or mutating grants',async()=>{
 const {createRenderingAuthorityHandler}=await import('../packages/rendering-authority/index.js')
 for(const [connection,status] of [[null,503],[{admit:()=>({rejection:401})},401],[{admit:()=>({rejection:403})},403]]){
  const authority=createRenderingAuthority();let read=false,mutated=false
  const handler=createRenderingAuthorityHandler({grant(){mutated=true},revoke(){mutated=true}},{getConnection:()=>connection})
  for(const method of ['POST','DELETE']){
   const req={method,url:'/pmp-dsh-tavern/api/v1/rendering-write-grants/x',async *[Symbol.asyncIterator](){read=true;yield Buffer.from('{}')}}
   const res={setHeader(){},end(){}};await handler(req,res);assert.equal(res.statusCode,status)
  }
  assert.equal(read,false);assert.equal(mutated,false);authority.dispose()
 }
})

test('failed server revocation remains visible after card disposal and retries the same grant',async()=>{
 let fail=true;const deletes=[]
 const authority=createRenderingAuthority(),registry=createRenderingWriteRequests({request:async(url,options)=>{
  if(options.method==='DELETE'){deletes.push(url);if(fail)return new Response('{}',{status:503});authority.revoke(url.split('/').at(-1));return Response.json({ok:true})}
  return Response.json(authority.grant(JSON.parse(options.body)))
 }})
 const item=registry.register(bundle)
 while(!registry.list()[0]?.sourceIdentity)await new Promise(r=>setTimeout(r,1))
 const id=registry.list()[0].id;registry.review(id);await registry.authorize(id);const grant=item.getGrant();item.dispose()
 await new Promise(r=>setTimeout(r,0));assert.equal(item.getGrant(),null);assert.equal(registry.list().length,0);assert.equal(authority.isCurrent(grant),true)
 const pending=registry.listRevocations();assert.equal(pending.length,1);assert.match(pending[0].error,/503/);assert.equal('grant' in pending[0],false)
 fail=false;await registry.retryRevocation(pending[0].id);assert.equal(authority.isCurrent(grant),false);assert.equal(registry.listRevocations().length,0);assert.equal(deletes[0],deletes[1]);authority.dispose()
})
